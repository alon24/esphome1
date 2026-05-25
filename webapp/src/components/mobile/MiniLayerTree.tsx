import React, { useContext } from "react";
import { GridContext } from "../../context/GridContext";

const TYPE_ICONS: Record<string, string> = {
    label: 'Aa', btn: '○', clock: '⏰', frame: '□', circle: '◯', rounded_rect: '▢',
    switch: '⇌', slider: '─', arc: '◉', bar: '▮', checkbox: '☑', dropdown: '▾',
    roller: '⊙', chart: '📈', tilesGrid: '⊞', 'pane-grid': '⊞', tile: '▪',
    'nav-menu': '≡', 'nav-item': '▸', component: '⚙️', header: '▬',
};

const Row: React.FC<{
    label: string;
    icon: string;
    badge?: string;
    indent: number;
    active?: boolean;
    onClick: () => void;
}> = ({ label, icon, badge, indent, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: `7px 12px 7px ${12 + indent * 16}px`,
            background: active ? 'var(--mob-accent-dim)' : 'none',
            border: 'none',
            borderLeft: active ? '2px solid var(--mob-accent)' : '2px solid transparent',
            cursor: 'pointer',
            gap: 8,
            textAlign: 'left',
            WebkitTapHighlightColor: 'transparent',
        }}
    >
        <span style={{ fontSize: 11, color: active ? 'var(--mob-accent)' : 'var(--mob-text-dim)', width: 16, textAlign: 'center', flexShrink: 0 }}>
            {icon}
        </span>
        <span style={{
            flex: 1,
            fontSize: 12,
            fontFamily: 'var(--mob-font-body)',
            color: active ? 'var(--mob-text)' : 'var(--mob-text-muted)',
            fontWeight: active ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
        {badge && (
            <span style={{
                fontSize: 9,
                fontFamily: 'var(--mob-font-mono)',
                color: 'var(--mob-text-dim)',
                background: 'var(--mob-surface-3)',
                padding: '2px 5px',
                borderRadius: 4,
                flexShrink: 0,
            }}>
                {badge}
            </span>
        )}
    </button>
);

export const MiniLayerTree: React.FC = () => {
    const ctx = useContext(GridContext) as any;
    if (!ctx) return null;
    const { project, activeScreenId, setActiveScreenId, setSelectedEntity, selections } = ctx;
    const activeSel = (selections?.[activeScreenId] || [])[0];

    const screens: any[] = project?.screens || [];
    const panels: any[] = project?.panels || [];

    return (
        <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--mob-bg)',
            borderTop: '1px solid var(--mob-border)',
        }}>
            {/* Screens */}
            {screens.map((scr: any) => {
                const isActiveScr = scr.id === activeScreenId;
                return (
                    <React.Fragment key={scr.id}>
                        <Row
                            icon="📺"
                            label={scr.name}
                            badge={isActiveScr ? 'ACTIVE' : undefined}
                            indent={0}
                            active={isActiveScr && !activeSel}
                            onClick={() => { setActiveScreenId(scr.id); setSelectedEntity(null); }}
                        />
                        {isActiveScr && scr.pages?.flatMap((pg: any) =>
                            pg.items?.slice(0, 8).map((it: any) => {
                                const isSelected = activeSel?.id === it.id;
                                return (
                                    <Row
                                        key={it.id}
                                        icon={TYPE_ICONS[it.type] || '□'}
                                        label={it.name || it.label || it.type}
                                        badge={it.type}
                                        indent={1}
                                        active={isSelected}
                                        onClick={() => setSelectedEntity({ type: 'item', id: it.id, pageId: pg.id }, scr.id)}
                                    />
                                );
                            })
                        )}
                    </React.Fragment>
                );
            })}

            {/* Master Panels */}
            {panels.length > 0 && (
                <>
                    <div style={{
                        padding: '10px 12px 4px',
                        fontSize: 9,
                        fontFamily: 'var(--mob-font-head)',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: 'var(--mob-text-dim)',
                    }}>
                        MASTER PANELS
                    </div>
                    {panels.map((pan: any) => (
                        <Row
                            key={pan.id}
                            icon="□"
                            label={pan.name}
                            indent={0}
                            active={activeSel?.type === 'panel' && activeSel?.id === pan.id}
                            onClick={() => setSelectedEntity({ type: 'panel', id: pan.id })}
                        />
                    ))}
                </>
            )}
        </div>
    );
};
