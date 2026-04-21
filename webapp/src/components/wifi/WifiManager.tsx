import React, { useState, useEffect, useCallback } from 'react';

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

    const handleScan = async () => {
        setScanning(true);
        try {
            const results = await API.scanWifi();
            setNetworks(results);
        } catch (e) {
            console.error("Scan failed", e);
        } finally {
            setScanning(false);
        }
    };

    const handleConnect = async () => {
        if (!selectedNet) return;
        setConnecting(true);
        try {
            const success = await API.connectWifi({ ssid: selectedNet.ssid, password });
            if (success) {
                setSelectedNet(null);
                setPassword("");
                onRefresh();
            } else {
                alert("Connection failed");
            }
        } catch (e) {
            alert("Error connecting");
        } finally {
            setConnecting(false);
        }
    };

    const getSignalBars = (rssi: number) => {
        const quality = Math.min(Math.max(2 * (rssi + 100), 0), 100);
        const bars = Math.ceil(quality / 25);
        return (
            <div className="signal-icon">
                {[1, 2, 3, 4].map(b => (
                    <div 
                        key={b} 
                        className={`signal-bar ${b <= bars ? 'active' : ''}`} 
                        style={{ height: `${b * 25}%` }} 
                    />
                ))}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Network Manager</h1>
                <button 
                    className={`scan-btn ${scanning ? 'scanning' : ''}`} 
                    onClick={handleScan}
                    disabled={scanning}
                >
                    {scanning ? 'Searching...' : 'Scan Networks'}
                </button>
            </div>

            {/* Current Connection Status */}
            <div className="wifi-card" style={{ padding: '24px', borderLeft: `6px solid ${status?.connected ? '#10b981' : '#94a3b8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' }}>CURRENT CONNECTION</div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', marginTop: '4px' }}>
                            {status?.connected ? status.ssid : 'Not Connected'}
                        </div>
                    </div>
                    {status?.connected && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' }}>IP ADDRESS</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>{status.ip}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Network List */}
            <div className="wifi-card">
                <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 900, color: '#64748b', letterSpacing: '0.5px' }}>
                    AVAILABLE NETWORKS ({networks.length})
                </div>
                {networks.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        {scanning ? 'Scanning for signals...' : 'Connect to a network by scanning.'}
                    </div>
                ) : (
                    networks.map(net => (
                        <div key={net.ssid} className="network-item" onClick={() => setSelectedNet(net)}>
                            {getSignalBars(net.rssi)}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: '#1e293b' }}>{net.ssid}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{net.secure ? '🔒 WPA2 Personal' : '🔓 Open Network'}</div>
                            </div>
                            <button className="scan-btn" style={{ height: '32px', padding: '0 16px', background: '#f1f5f9', color: '#6366f1' }}>
                                Connect
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Connection Modal Overlay */}
            {selectedNet && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="wifi-card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0 }}>Join Network</h2>
                            <button onClick={() => setSelectedNet(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px' }}>SSID</div>
                            <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{selectedNet.ssid}</div>
                        </div>
                        {selectedNet.secure && (
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>PASSWORD</label>
                                <input 
                                    type="password" 
                                    className="input" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter network password"
                                    autoFocus
                                    style={{ width: '100%', height: '48px', padding: '0 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', outline: 'none' }}
                                />
                            </div>
                        )}
                        <button 
                            className="scan-btn" 
                            style={{ width: '100%', height: '52px', justifyContent: 'center' }}
                            onClick={handleConnect}
                            disabled={connecting}
                        >
                            {connecting ? 'Connecting...' : 'Connect to Network'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
