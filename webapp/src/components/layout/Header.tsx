import React, { useContext } from "react";
import { GridContext } from "../../context/GridContext";

export type WifiStatus = {
	connected: boolean;
	ip: string;
	ssid: string;
	ap_active?: boolean;
	ap_always_on?: boolean;
	ss_enabled?: boolean;
	mqtt_enabled?: boolean;
	ap_ssid?: string;
	ap_ip?: string;
	ap_clients?: { mac: string, ip: string }[];
} | null;

interface HeaderProps {
    activeTab: string;
    setActiveTab: (tab: "grid" | "dashboard" | "mirror" | "wifi" | "logs" | "settings") => void;
    status: WifiStatus;
    remoteIp: string;
    setRemoteIp: (ip: string) => void;
    isMobile: boolean;
    propsLocation?: 'left' | 'right';
    setPropsLocation?: (loc: 'left' | 'right') => void;
    theme?: 'light' | 'dark';
    setTheme?: (theme: 'light' | 'dark') => void;
}

export const Header: React.FC<HeaderProps> = ({ 
    activeTab, 
    setActiveTab, 
    status, 
    remoteIp, 
    setRemoteIp, 
    isMobile,
    propsLocation,
    setPropsLocation,
    theme,
    setTheme
}) => {
    const context = useContext(GridContext) as any;
    const { exportProject, importProject, syncToDevice } = context || {};

    return (
        <header className="header" style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '60px', background: theme === 'dark' ? '#1e293b' : '#fff', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <div className="logo" style={{ fontSize: '20px', fontWeight: 900, color: '#6366f1', letterSpacing: '1px' }}>GRIDOS</div>
            {!isMobile && (
                <div className="tab-bar" style={{ display: 'flex', marginLeft: '40px', gap: '20px' }}>
                    {(["grid", "dashboard", "mirror", "wifi", "logs", "settings"] as const).map((id) => {
                        const labels: Record<string, string> = {
                            grid: "BUILDER",
                            dashboard: "DASHBOARD",
                            mirror: "MIRROR",
                            wifi: "WIFI",
                            logs: "CONSOLE",
                            settings: "SETTINGS"
                        };
                        const active = activeTab === id;
                        return (
                            <div 
                                key={id} 
                                onClick={() => setActiveTab(id)}
                                style={{ 
                                    cursor: 'pointer', 
                                    fontSize: '12px', 
                                    fontWeight: 800, 
                                    color: active ? '#6366f1' : '#94a3b8',
                                    padding: '20px 0',
                                    borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {labels[id]}
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="spacer" style={{ flex: 1 }} />
            {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                    <button 
                        onClick={context?.exportProject}
                        style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        ⬇ EXPORT
                    </button>
                    
                    <label 
                        style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                    >
                        ⬆ IMPORT
                        <input type="file" accept=".json" onChange={context?.importProject} style={{ display: 'none' }} />
                    </label>

                    <input 
                        className="ip-input" 
                        value={remoteIp} 
                        onChange={(e) => setRemoteIp(e.target.value)}
                        placeholder="device ip..." 
                        style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', width: '140px' }}
                    />
                    <button 
                        className="sync-btn" 
                        onClick={context?.syncToDevice}
                        style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        ⬆ SYNC
                    </button>

                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '8px' }}>
                        <div onClick={() => setPropsLocation?.('left')} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: propsLocation === 'left' ? '#6366f1' : 'transparent', display: 'flex' }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" stroke={propsLocation === 'left' ? "white" : "#94a3b8"} strokeWidth="1.5"/><line x1="5.5" y1="2" x2="5.5" y2="14" stroke={propsLocation === 'left' ? "white" : "#94a3b8"} strokeWidth="1.5"/></svg>
                        </div>
                        <div onClick={() => setPropsLocation?.('right')} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: propsLocation === 'right' ? '#6366f1' : 'transparent', display: 'flex' }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" stroke={propsLocation === 'right' ? "white" : "#94a3b8"} strokeWidth="1.5"/><line x1="10.5" y1="2" x2="10.5" y2="14" stroke={propsLocation === 'right' ? "white" : "#94a3b8"} strokeWidth="1.5"/></svg>
                        </div>
                    </div>

                    <div 
                        onClick={() => setTheme?.(theme === 'light' ? 'dark' : 'light')}
                        style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: '100px', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <span style={{ fontSize: '16px' }}>{theme === 'light' ? '🌙' : '☀️'}</span>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#64748b' }}>{theme?.toUpperCase()}</span>
                    </div>
                </div>
            )}
            <div 
                onClick={() => setActiveTab("wifi")} 
                style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: status?.connected ? 'rgba(22, 163, 74, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    marginLeft: '20px'
                }}
            >
                <span style={{ fontSize: '18px' }}>{status?.connected ? '📶' : '❌'}</span>
                {!isMobile && <span style={{ fontSize: '11px', fontWeight: 800, color: status?.connected ? '#16a34a' : '#ef4444' }}>{status?.connected ? 'ONLINE' : 'OFFLINE'}</span>}
            </div>
        </header>
    );
};
