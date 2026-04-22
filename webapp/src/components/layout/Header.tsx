import React from "react";

export type WifiStatus = {
	connected: boolean;
	ip: string;
	ssid: string;
	ap_active?: boolean;
	ap_always_on?: boolean;
	ss_enabled?: boolean;
	ap_ssid?: string;
	ap_ip?: string;
	ap_clients?: { mac: string, ip: string }[];
} | null;

interface HeaderProps {
    activeTab: string;
    setActiveTab: (tab: "grid" | "mirror" | "wifi" | "logs" | "settings") => void;
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
    return (
        <header className="header">
            <div className="logo">GRIDOS</div>
            {!isMobile && (
                <div className="tab-bar">
                    {(["grid", "mirror", "wifi", "logs", "settings"] as const).map((id) => {
                        const labels: Record<string, string> = {
                            grid: "BUILDER",
                            mirror: "MIRROR",
                            wifi: "WIFI",
                            logs: "CONSOLE",
                            settings: "SETTINGS"
                        };
                        return (
                            <div 
                                key={id} 
                                className={`htab ${activeTab === id ? 'active' : ''}`}
                                onClick={() => setActiveTab(id)}
                            >
                                {labels[id]}
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="spacer" />
            {!isMobile && (
                <>
                    <input 
                        className="ip-input" 
                        value={remoteIp} 
                        onChange={(e) => setRemoteIp(e.target.value)}
                        placeholder="device ip..." 
                    />
                    <button className="sync-btn" onClick={() => console.log("SYNC CLICKED")}>⬆ SYNC</button>

                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '8px', marginLeft: '12px' }}>
                        <div 
                            onClick={() => setPropsLocation?.('left')}
                            style={{ 
                                cursor: 'pointer', 
                                padding: '4px 8px', 
                                borderRadius: '6px', 
                                background: propsLocation === 'left' ? '#6d28d9' : 'transparent',
                                border: '1px solid transparent',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="1" y="2" width="14" height="12" rx="1.5" stroke={propsLocation === 'left' ? "white" : "#94a3b8"} strokeWidth="1.5"/>
                                <line x1="5.5" y1="2" x2="5.5" y2="14" stroke={propsLocation === 'left' ? "white" : "#94a3b8"} strokeWidth="1.5"/>
                            </svg>
                        </div>
                        <div 
                            onClick={() => setPropsLocation?.('right')}
                            style={{ 
                                cursor: 'pointer', 
                                padding: '4px 8px', 
                                borderRadius: '6px', 
                                background: propsLocation === 'right' ? '#6d28d9' : 'transparent',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="1" y="2" width="14" height="12" rx="1.5" stroke={propsLocation === 'right' ? "white" : "#94a3b8"} strokeWidth="1.5"/>
                                <line x1="10.5" y1="2" x2="10.5" y2="14" stroke={propsLocation === 'right' ? "white" : "#94a3b8"} strokeWidth="1.5"/>
                            </svg>
                        </div>
                    </div>

                    <div 
                        onClick={() => setTheme?.(theme === 'light' ? 'dark' : 'light')}
                        style={{ 
                            cursor: 'pointer', 
                            padding: '6px 12px', 
                            borderRadius: '100px', 
                            background: 'rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            marginLeft: '12px',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>{theme === 'light' ? '🌙' : '☀️'}</span>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#64748b' }}>{theme?.toUpperCase()}</span>
                    </div>
                </>
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
                    transition: 'all 0.2s'
                }}
            >
                <span style={{ fontSize: '18px' }}>{status?.connected ? '📶' : '❌'}</span>
                {!isMobile && (
                    <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 800, 
                        color: status?.connected ? '#16a34a' : '#ef4444',
                        letterSpacing: '0.5px'
                    }}>
                        {status?.connected ? 'ONLINE' : 'OFFLINE'}
                    </span>
                )}
            </div>
        </header>
    );
};
