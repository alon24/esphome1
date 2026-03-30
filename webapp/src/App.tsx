import { useCallback, useEffect, useState } from "react";

type WifiStatus = {
  connected: boolean;
  ip: string;
  ssid: string;
} | null;

type Network = {
  ssid: string;
  rssi: number;
  auth: number;
};

export default function App() {
  const [status, setStatus] = useState<WifiStatus>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState("");

  const fetchStatus = useCallback(() => {
    fetch("/api/wifi/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ connected: false, ip: "", ssid: "" }));
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Auto-scan when disconnected and no networks listed yet
  useEffect(() => {
    if (status && !status.connected && networks.length === 0 && !scanning) {
      scan();
    }
  }, [status?.connected]);

  const scan = () => {
    setScanning(true);
    fetch("/api/wifi/scan")
      .then((r) => r.json())
      .then((d) => setNetworks(d.networks ?? []))
      .catch(() => setNetworks([]))
      .finally(() => setScanning(false));
  };

  const connect = () => {
    if (!selectedSsid) return;
    setConnecting(true);
    setConnectMsg("");
    fetch("/api/wifi/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid: selectedSsid, password }),
    })
      .then((r) => r.json())
      .then(() => {
        setConnectMsg("Connecting…");
        setTimeout(fetchStatus, 4000);
      })
      .catch(() => setConnectMsg("Request failed"))
      .finally(() => setConnecting(false));
  };

  return (
    <div style={s.app}>
      {/* ── Header ── */}
      <header style={s.header}>
        <span style={s.headerTitle}>Hello World</span>
        <WifiStatusBadge status={status} />
      </header>

      {/* ── Main ── */}
      <main style={s.main}>
        {status === null ? (
          <p style={s.muted}>Connecting to device…</p>
        ) : status.connected ? (
          <ConnectedView status={status} />
        ) : (
          <ScanView
            networks={networks}
            scanning={scanning}
            selectedSsid={selectedSsid}
            password={password}
            connecting={connecting}
            connectMsg={connectMsg}
            onScan={scan}
            onSelectSsid={setSelectedSsid}
            onPasswordChange={setPassword}
            onConnect={connect}
          />
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WifiStatusBadge({ status }: { status: WifiStatus }) {
  if (!status) return <span style={{ ...s.badge, color: "#94a3b8" }}>●  —</span>;
  if (status.connected)
    return (
      <span style={{ ...s.badge, color: "#4ade80" }}>
        ●&nbsp; Connected &nbsp;<strong style={{ color: "#93c5fd" }}>{status.ip}</strong>
      </span>
    );
  return <span style={{ ...s.badge, color: "#f87171" }}>●&nbsp; Disconnected</span>;
}

function ConnectedView({ status }: { status: NonNullable<WifiStatus> }) {
  return (
    <div style={s.centreCol}>
      <div style={s.card}>
        <Row label="Status" value="Connected" valueColor="#4ade80" />
        <Row label="IP Address" value={status.ip} valueColor="#93c5fd" mono />
        {status.ssid && <Row label="Network" value={status.ssid} valueColor="#e2e8f0" />}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
  mono,
}: {
  label: string;
  value: string;
  valueColor: string;
  mono?: boolean;
}) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={{ color: valueColor, fontFamily: mono ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

function ScanView({
  networks,
  scanning,
  selectedSsid,
  password,
  connecting,
  connectMsg,
  onScan,
  onSelectSsid,
  onPasswordChange,
  onConnect,
}: {
  networks: Network[];
  scanning: boolean;
  selectedSsid: string;
  password: string;
  connecting: boolean;
  connectMsg: string;
  onScan: () => void;
  onSelectSsid: (s: string) => void;
  onPasswordChange: (s: string) => void;
  onConnect: () => void;
}) {
  return (
    <div style={s.scanWrap}>
      {/* Network list */}
      <div style={s.card}>
        <div style={s.scanTop}>
          <span style={s.cardTitle}>Available Networks</span>
          <button onClick={onScan} disabled={scanning} style={s.scanBtn}>
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>

        {scanning && networks.length === 0 && (
          <p style={s.muted}>Scanning for networks…</p>
        )}

        {networks.map((n, i) => (
          <NetworkRow
            key={i}
            network={n}
            selected={selectedSsid === n.ssid}
            onSelect={onSelectSsid}
          />
        ))}

        {!scanning && networks.length === 0 && (
          <p style={s.muted}>No networks found. Tap Scan.</p>
        )}
      </div>

      {/* Connect form */}
      <div style={s.card}>
        <span style={s.cardTitle}>Connect</span>
        <input
          type="text"
          placeholder="SSID"
          value={selectedSsid}
          onChange={(e) => onSelectSsid(e.target.value)}
          style={s.input}
        />
        <input
          type="password"
          placeholder="Password (leave blank for open)"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          style={s.input}
        />
        <button
          onClick={onConnect}
          disabled={connecting || !selectedSsid}
          style={{ ...s.connectBtn, opacity: !selectedSsid ? 0.5 : 1 }}
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>
        {connectMsg && <p style={s.connectMsg}>{connectMsg}</p>}
      </div>
    </div>
  );
}

function NetworkRow({
  network,
  selected,
  onSelect,
}: {
  network: Network;
  selected: boolean;
  onSelect: (s: string) => void;
}) {
  return (
    <button
      style={{
        ...s.networkRow,
        background: selected ? "#1e3a5f" : "transparent",
        borderColor: selected ? "#60a5fa" : "#2a2a4a",
      }}
      onClick={() => onSelect(network.ssid)}
    >
      <SignalBars rssi={network.rssi} />
      <span style={s.ssidText}>{network.ssid}</span>
      <span style={s.rssiText}>{network.rssi} dBm</span>
      {network.auth > 0 && <span style={s.lock}>⚿</span>}
    </button>
  );
}

function SignalBars({ rssi }: { rssi: number }) {
  const level = rssi > -55 ? 5 : rssi > -63 ? 4 : rssi > -71 ? 3 : rssi > -79 ? 2 : 1;
  const color = rssi > -55 ? "#00cc44" : rssi > -65 ? "#88cc00" : rssi > -75 ? "#ffaa00" : rssi > -85 ? "#ff6600" : "#ff2222";
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" style={{ flexShrink: 0 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const h = 4 + i * 4;
        return (
          <rect key={i} x={i * 5 + 1} y={20 - h} width={4} height={h} rx={1}
            fill={i < level ? color : "#333"} />
        );
      })}
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    background: "#12122a",
    borderBottom: "1px solid #2a2a4a",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#a78bfa",
    letterSpacing: "0.02em",
  },
  badge: {
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  centreCol: {
    width: "100%",
    maxWidth: 480,
  },
  card: {
    background: "#1e1e3a",
    border: "1px solid #3d3d6b",
    borderRadius: 12,
    padding: "16px 20px",
    width: "100%",
    maxWidth: 480,
    marginBottom: 16,
  },
  cardTitle: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #2a2a4a",
  },
  rowLabel: {
    color: "#94a3b8",
    fontSize: "0.9rem",
  },
  scanWrap: {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
  },
  scanTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  scanBtn: {
    background: "#334499",
    color: "#e0e0f0",
    border: "none",
    borderRadius: 6,
    padding: "4px 14px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  networkRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #2a2a4a",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 6,
    color: "#e0e0f0",
    textAlign: "left",
  },
  ssidText: {
    flex: 1,
    fontSize: "0.95rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rssiText: {
    color: "#64748b",
    fontSize: "0.8rem",
    flexShrink: 0,
  },
  lock: {
    color: "#94a3b8",
    fontSize: "0.85rem",
    flexShrink: 0,
  },
  input: {
    display: "block",
    width: "100%",
    padding: "10px 12px",
    marginBottom: 10,
    background: "#12122a",
    border: "1px solid #3d3d6b",
    borderRadius: 8,
    color: "#e0e0f0",
    fontSize: "0.95rem",
  },
  connectBtn: {
    width: "100%",
    padding: "11px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 600,
  },
  connectMsg: {
    color: "#facc15",
    textAlign: "center",
    marginTop: 10,
    fontSize: "0.9rem",
  },
  muted: {
    color: "#64748b",
    fontSize: "0.9rem",
    padding: "12px 0",
    textAlign: "center",
  },
};
