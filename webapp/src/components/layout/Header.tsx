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
}

export const Header: React.FC<HeaderProps> = ({ 
    activeTab, 
    setActiveTab, 
    status, 
    remoteIp, 
    setRemoteIp, 
    isMobile 
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
