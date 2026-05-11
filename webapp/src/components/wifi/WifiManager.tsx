import React, { useState } from 'react';

interface Network {
    ssid: string;
    rssi: number;
    secure: boolean;
}

interface WifiManagerProps {
    status: any;
    onRefresh: () => void;
    API: any;
}

export const WifiManager: React.FC<WifiManagerProps> = ({ status, onRefresh, API }) => {
    const [networks, setNetworks] = useState<Network[]>([]);
    const [scanning, setScanning] = useState(false);
    const [selectedNet, setSelectedNet] = useState<Network | null>(null);
    const [password, setPassword] = useState("");
    const [connecting, setConnecting] = useState(false);
    const [forgetting, setForgetting] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    const handleScan = async () => {
        setScanning(true);
        setStatusMsg(null);
        try {
            const results = await API.scanWifi();
            setNetworks(results);
            if (results.length === 0) setStatusMsg("No networks found — try again.");
        } catch {
            setStatusMsg("Scan failed. Check device connection.");
        } finally {
            setScanning(false);
        }
    };

    const handleConnect = async () => {
        if (!selectedNet) return;
        setConnecting(true);
        setStatusMsg(null);
        try {
            const ok = await API.connectWifi({ ssid: selectedNet.ssid, password });
            if (ok) {
                setStatusMsg(`Connecting to ${selectedNet.ssid}… check status in a moment.`);
                setSelectedNet(null);
                setPassword("");
                setTimeout(onRefresh, 4000);
            } else {
                setStatusMsg("Connection request failed.");
            }
        } catch {
            setStatusMsg("Error sending connect request.");
        } finally {
            setConnecting(false);
        }
    };

    const handleForget = async () => {
        setForgetting(true);
        setStatusMsg(null);
        try {
            const ok = await API.forgetWifi();
            if (ok) {
                setStatusMsg("Saved credentials cleared. Device will disconnect.");
                setTimeout(onRefresh, 2000);
            } else {
                setStatusMsg("Forget request failed.");
            }
        } catch {
            setStatusMsg("Error sending forget request.");
        } finally {
            setForgetting(false);
        }
    };

    const getSignalBars = (rssi: number) => {
        const quality = Math.min(Math.max(2 * (rssi + 100), 0), 100);
        const bars = Math.ceil(quality / 25);
        return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '18px', marginRight: '10px' }}>
                {[1, 2, 3, 4].map(b => (
                    <div key={b} style={{
                        width: '5px',
                        height: `${b * 22}%`,
                        borderRadius: '1px',
                        background: b <= bars ? '#10b981' : '#334155',
                        alignSelf: 'flex-end'
                    }} />
                ))}
            </div>
        );
    };

    const hasSavedCredentials = status?.ssid && status.ssid.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px', margin: '0 auto', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Network Manager</h1>
                <button className="scan-btn" onClick={handleScan} disabled={scanning}>
                    {scanning ? 'Scanning…' : 'Scan Networks'}
                </button>
            </div>

            {statusMsg && (
                <div style={{ padding: '10px 14px', background: '#1e293b', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>
                    {statusMsg}
                </div>
            )}

            {/* Current connection */}
            <div className="wifi-card" style={{ padding: '20px', borderLeft: `5px solid ${status?.connected ? '#10b981' : '#475569'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '1px', marginBottom: '4px' }}>CURRENT CONNECTION</div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {status?.connected ? (status.ssid || 'Connected') : (hasSavedCredentials ? `Saved: ${status.ssid}` : 'Not Connected')}
                        </div>
                        {status?.connected && (
                            <div style={{ fontSize: '13px', color: '#6366f1', marginTop: '2px' }}>{status.ip}</div>
                        )}
                    </div>
                    {hasSavedCredentials && (
                        <button
                            onClick={handleForget}
                            disabled={forgetting}
                            style={{ padding: '8px 14px', background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '8px', color: '#fca5a5', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {forgetting ? 'Clearing…' : 'Forget Network'}
                        </button>
                    )}
                </div>
            </div>

            {/* AP status */}
            {status?.ap_active && (
                <div className="wifi-card" style={{ padding: '16px 20px', borderLeft: '5px solid #6366f1' }}>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '1px', marginBottom: '4px' }}>HOTSPOT (AP MODE)</div>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>SSID</div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{status.ap_ssid || 'GridOS-AP'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>IP</div>
                            <div style={{ fontWeight: 800, color: '#6366f1' }}>{status.ap_ip || '192.168.4.1'}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Network list */}
            <div className="wifi-card">
                <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '0.5px' }}>
                    AVAILABLE NETWORKS ({networks.length})
                </div>
                {networks.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                        {scanning ? 'Scanning…' : 'Press Scan to search for networks.'}
                    </div>
                ) : (
                    networks.map(net => (
                        <div key={net.ssid} className="network-item" onClick={() => { setSelectedNet(net); setPassword(""); }}
                            style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {getSignalBars(net.rssi)}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px' }}>{net.ssid}</div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                    {net.secure ? '🔒 Secured' : '🔓 Open'} · {net.rssi} dBm
                                    {net.ssid === status?.ssid && <span style={{ color: '#10b981', marginLeft: '8px' }}>● Saved</span>}
                                </div>
                            </div>
                            <button className="scan-btn" style={{ height: '30px', padding: '0 12px', fontSize: '12px', background: '#1e293b', color: '#6366f1', border: '1px solid #334155' }}>
                                Connect
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Connect modal */}
            {selectedNet && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="wifi-card" style={{ width: '100%', maxWidth: '380px', padding: '28px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Join Network</h2>
                            <button onClick={() => setSelectedNet(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>SSID</div>
                            <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>{selectedNet.ssid}</div>
                        </div>
                        {selectedNet.secure && (
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>PASSWORD</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleConnect()}
                                    placeholder="Enter password"
                                    autoFocus
                                    style={{ width: '100%', boxSizing: 'border-box', height: '44px', padding: '0 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: 'white', fontSize: '15px', outline: 'none' }}
                                />
                            </div>
                        )}
                        <button
                            className="scan-btn"
                            style={{ width: '100%', height: '48px', justifyContent: 'center', fontSize: '14px' }}
                            onClick={handleConnect}
                            disabled={connecting}>
                            {connecting ? 'Sending…' : 'Connect'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
