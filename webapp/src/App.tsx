import { useEffect, useState } from "react";

type Health = { status: string } | null;

export default function App() {
  const [health, setHealth] = useState<Health>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setError(true));
  }, []);

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>ESP32 Display</h1>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Device Status</h2>
        {health ? (
          <p style={{ color: "#4ade80" }}>● Connected — {health.status}</p>
        ) : error ? (
          <p style={{ color: "#f87171" }}>● Offline or unreachable</p>
        ) : (
          <p style={{ color: "#facc15" }}>● Connecting…</p>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Getting Started</h2>
        <ol style={styles.list}>
          <li>Edit <code>webapp/src/App.tsx</code> to build your UI</li>
          <li>Run <code>bun run dev</code> in <code>webapp/</code> for live reload on port 3008</li>
          <li>Run <code>scripts/upload.sh</code> to deploy to the device</li>
        </ol>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    padding: 24,
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: 700,
    color: "#a78bfa",
  },
  card: {
    background: "#1e1e3a",
    border: "1px solid #3d3d6b",
    borderRadius: 12,
    padding: "20px 28px",
    width: "100%",
    maxWidth: 480,
  },
  cardTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  list: {
    paddingLeft: 20,
    lineHeight: 2,
    color: "#cbd5e1",
    fontSize: "0.9rem",
  },
};
