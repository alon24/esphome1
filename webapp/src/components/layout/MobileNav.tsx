import React from "react";

type Tab = "grid" | "dashboard" | "mirror" | "wifi" | "logs" | "settings";

interface MobileNavProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    theme?: 'light' | 'dark';
}

const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "grid",     icon: "✏️", label: "BUILD"    },
    { id: "wifi",     icon: "📦",  label: "DEVICE"  },
    { id: "settings", icon: "⚙️",  label: "SETTINGS" },
];

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
    return (
        <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            background: 'var(--mob-surface)',
            borderTop: '1px solid var(--mob-border)',
            display: 'flex',
            alignItems: 'stretch',
            zIndex: 1000,
        }}>
            {TABS.map(({ id, icon, label }) => {
                const active = activeTab === id;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            minHeight: 44,
                            padding: '6px 0',
                            borderTop: active ? '2px solid var(--mob-accent)' : '2px solid transparent',
                            WebkitTapHighlightColor: 'transparent',
                        }}
                    >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
                        <span style={{
                            fontSize: 9,
                            fontFamily: 'var(--mob-font-head)',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: active ? 'var(--mob-accent)' : 'var(--mob-text-dim)',
                        }}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};
