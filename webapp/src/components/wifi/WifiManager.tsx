import React, { useState, useEffect } from 'react';

interface Network {
    ssid: string;
    rssi: number;
    secure: boolean;
}

interface WifiManagerProps {
    status: any;
    onRefresh: () => void;
    API: any;
    remoteIp?: string;
    setRemoteIp?: (ip: string) => void;
}

export const WifiManager: React.FC<WifiManagerProps> = ({ status, onRefresh, API, remoteIp, setRemoteIp }) => {
    const [networks, setNetworks] = useState<Network[]>([]);
    const [scanning, setScanning] = useState(false);
    const [selectedNet, setSelectedNet] = useState<Network | null>(null);
    const [password, setPassword] = useState("");
    const [connecting, setConnecting] = useState(false);
    const [forgetting, setForgetting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'info' | 'error' | 'ok' } | null>(null);
    const [ipInput, setIpInput] = useState(remoteIp || "");
    const [apEnabled, setApEnabled] = useState<boolean>(true);
    const [apSsid, setApSsid] = useState("GridOS-AP");
    const [apPass, setApPass] = useState("");
    const [apSaving, setApSaving] = useState(false);

    useEffect(() => {
        if (status) {
            setApEnabled(!!status.ap_active);
            if (status.ap_ssid) setApSsid(status.ap_ssid);
        }
    }, [status?.ap_active, status?.ap_ssid]);

    const deviceUrl = API.getDeviceUrl?.() || "";
    const hasDevice = !!deviceUrl;

    const handleSaveIp = () => {
        const ip = ipInput.trim();
        if (setRemoteIp) setRemoteIp(ip);
        localStorage.setItem("ds_remote_ip", ip);
        setStatusMsg({ text: ip ? `Device IP set to ${ip}` : "Device IP cleared.", type: 'info' });
    };

    const handleScan = async () => {
        setScanning(true);
        setStatusMsg(null);
        try {
            const results = await API.scanWifi();
            setNetworks(results);
            if (results.length === 0) {
                setStatusMsg({ text: "No networks found. The device may be starting up — try again.", type: 'info' });
            } else {
                setStatusMsg({ text: `Found ${results.length} network${results.length !== 1 ? 's' : ''}.`, type: 'ok' });
            }
        } catch (e: any) {
            if (e?.message === "SCAN_BUSY") {
                setStatusMsg({ text: "Device WiFi is busy (another scan in progress). Try again in a few seconds.", type: 'error' });
            } else if (e?.message === "SCAN_EMPTY") {
                setStatusMsg({ text: "No networks found. The radio may be busy — wait a moment and try again.", type: 'info' });
            } else {
                setStatusMsg({ text: "Scan failed — check that the device is reachable and firmware is up to date.", type: 'error' });
            }
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
                setStatusMsg({ text: `Connecting to ${selectedNet.ssid}… status will update in a few seconds.`, type: 'ok' });
                setSelectedNet(null);
                setPassword("");
                setTimeout(onRefresh, 5000);
            } else {
                setStatusMsg({ text: "Connection request failed.", type: 'error' });
            }
        } catch {
            setStatusMsg({ text: "Error sending connect request.", type: 'error' });
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        setStatusMsg(null);
        try {
            const ok = await API.disconnectWifi();
            if (ok) {
                setStatusMsg({ text: "Disconnected. Device is now in AP mode.", type: 'ok' });
                setTimeout(onRefresh, 2000);
            } else {
                setStatusMsg({ text: "Disconnect request failed.", type: 'error' });
            }
        } catch {
            setStatusMsg({ text: "Error sending disconnect request.", type: 'error' });
        } finally {
            setDisconnecting(false);
        }
    };

    const handleForget = async () => {
        setForgetting(true);
        setStatusMsg(null);
        try {
            const ok = await API.forgetWifi();
            if (ok) {
                setStatusMsg({ text: "Credentials cleared. Device switched to AP mode.", type: 'ok' });
                setTimeout(onRefresh, 2000);
            } else {
                setStatusMsg({ text: "Forget request failed.", type: 'error' });
            }
        } catch {
            setStatusMsg({ text: "Error sending forget request.", type: 'error' });
        } finally {
            setForgetting(false);
        }
    };

    const handleApSave = async (newEnabled?: boolean) => {
        const active = newEnabled !== undefined ? newEnabled : apEnabled;
        setApSaving(true);
        setStatusMsg(null);
        try {
            const ok = await API.updateSettings({ active, always_on: active, ssid: apSsid.trim(), password: apPass });
            if (ok) {
                setApEnabled(active);
                setStatusMsg({ text: active ? `AP "${apSsid.trim()}" activated.` : 'AP turned off.', type: 'ok' });
                setTimeout(onRefresh, 1500);
            } else {
                setStatusMsg({ text: 'AP update failed.', type: 'error' });
            }
        } catch {
            setStatusMsg({ text: 'Error sending AP update.', type: 'error' });
        } finally {
            setApSaving(false);
        }
    };

    const getSignalBars = (rssi: number) => {
        const quality = Math.min(Math.max(2 * (rssi + 100), 0), 100);
        const bars = Math.ceil(quality / 25);
        return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '18px', marginRight: '10px', flexShrink: 0 }}>
                {[1, 2, 3, 4].map(b => (
                    <div key={b} style={{
                        width: '5px', height: `${b * 22}%`, borderRadius: '1px', alignSelf: 'flex-end',
                        background: b <= bars ? '#10b981' : '#334155'
                    }} />
                ))}
            </div>
        );
    };

    const hasSavedCredentials = status?.ssid && status.ssid.length > 0;
    const msgColor = statusMsg?.type === 'error' ? '#fca5a5' : statusMsg?.type === 'ok' ? '#86efac' : '#94a3b8';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px', margin: '0 auto', padding: '20px' }}>

            {/* Device IP config */}
            <div className="wifi-card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '1px', marginBottom: '8px' }}>
                    DEVICE IP {hasDevice ? <span style={{ color: '#10b981' }}>● CONNECTED</span> : <span style={{ color: '#ef4444' }}>● NOT SET</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="e.g. 192.168.1.100"
                        value={ipInput}
                        onChange={e => setIpInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveIp()}
                        style={{ flex: 1, height: '36px', padding: '0 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none' }}
                    />
                    <button onClick={handleSaveIp}
                        style={{ padding: '0 16px', height: '36px', background: '#1e40af', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                        Set
                    </button>
                </div>
                {hasDevice && (
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                        Using <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>{deviceUrl}</span>
                    </div>
                )}
            </div>

            {/* Scan + results — results appear immediately below the scan button */}
            <div className="wifi-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: networks.length > 0 || scanning ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {scanning ? 'Scanning…' : networks.length > 0 ? `${networks.length} network${networks.length !== 1 ? 's' : ''} found` : 'Scan for nearby networks'}
                    </div>
                    <button className="scan-btn" onClick={handleScan} disabled={scanning}>
                        {scanning ? 'Scanning…' : 'Scan'}
                    </button>
                </div>

                {statusMsg && (
                    <div style={{ padding: '10px 16px', borderBottom: networks.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', color: msgColor, fontSize: '12px', background: 'rgba(0,0,0,0.15)' }}>
                        {statusMsg.text}
                    </div>
                )}

                {networks.length === 0 && !scanning && !statusMsg && (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                        Press Scan to search.
                    </div>
                )}

                {networks.map((net, i) => (
                    <div key={`${net.ssid}-${i}`} onClick={() => { setSelectedNet(net); setPassword(""); }}
                        style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: i < networks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.1s' }}>
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
                ))}
            </div>

            {/* Current connection */}
            <div className="wifi-card" style={{ padding: '18px 20px', borderLeft: `5px solid ${status?.connected ? '#10b981' : '#475569'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '1px', marginBottom: '4px' }}>CURRENT CONNECTION</div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {status?.connected ? (status.ssid || 'Connected') : hasSavedCredentials ? `Saved: ${status?.ssid}` : 'Not Connected'}
                        </div>
                        {status?.connected && (
                            <div style={{ fontSize: '13px', color: '#6366f1', marginTop: '2px' }}>{status?.ip}</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {status?.connected && (
                            <button onClick={handleDisconnect} disabled={disconnecting}
                                style={{ padding: '8px 14px', background: '#172554', border: '1px solid #1d4ed8', borderRadius: '8px', color: '#93c5fd', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                            </button>
                        )}
                        {hasSavedCredentials && (
                            <button onClick={handleForget} disabled={forgetting}
                                style={{ padding: '8px 14px', background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '8px', color: '#fca5a5', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {forgetting ? 'Clearing…' : 'Forget Network'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* AP config card — always visible */}
            <div className="wifi-card" style={{ padding: '16px 20px', borderLeft: `5px solid ${status?.ap_active ? '#6366f1' : '#334155'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '1px' }}>
                        HOTSPOT (AP MODE)&nbsp;
                        {status?.ap_active
                            ? <span style={{ color: '#6366f1' }}>● ACTIVE · {status.ap_ip || '192.168.4.1'}</span>
                            : <span style={{ color: '#475569' }}>● OFF</span>}
                    </div>
                    <button
                        onClick={() => handleApSave(!apEnabled)}
                        disabled={apSaving}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                            background: apEnabled ? '#4c1d95' : '#1e293b',
                            color: apEnabled ? '#c4b5fd' : '#64748b' }}>
                        {apSaving ? '…' : apEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>SSID</div>
                        <input
                            type="text"
                            value={apSsid}
                            onChange={e => setApSsid(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>PASSWORD <span style={{ fontWeight: 400, color: '#475569' }}>(leave empty for open)</span></div>
                        <input
                            type="text"
                            value={apPass}
                            onChange={e => setApPass(e.target.value)}
                            placeholder="No password"
                            style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}
                        />
                    </div>
                </div>
                <button
                    className="scan-btn"
                    onClick={() => handleApSave()}
                    disabled={apSaving}
                    style={{ height: '34px', padding: '0 18px', fontSize: '12px' }}>
                    {apSaving ? 'Saving…' : 'Save & Apply'}
                </button>
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
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleConnect()}
                                    placeholder="Enter password" autoFocus
                                    style={{ width: '100%', boxSizing: 'border-box', height: '44px', padding: '0 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: 'white', fontSize: '15px', outline: 'none' }}
                                />
                            </div>
                        )}
                        <button className="scan-btn" style={{ width: '100%', height: '48px', justifyContent: 'center', fontSize: '14px' }}
                            onClick={handleConnect} disabled={connecting}>
                            {connecting ? 'Sending…' : 'Connect'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
