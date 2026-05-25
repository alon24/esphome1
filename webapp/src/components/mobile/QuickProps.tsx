import React, { useContext, useCallback } from "react";
import { GridContext } from "../../context/GridContext";
import { findItemRecursive } from "../../utils";
import { type GridItem } from "../../types";

function safeHex(n?: number): string {
    if (n == null || isNaN(n)) return '#1e1e2a';
    return '#' + Math.max(0, n).toString(16).padStart(6, '0');
}
function hexToNum(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

const inputStyle: React.CSSProperties = {
    background: 'var(--mob-surface-3)',
    border: '1px solid var(--mob-border)',
    borderRadius: 8,
    padding: '7px 10px',
    color: 'var(--mob-text)',
    fontFamily: 'var(--mob-font-body)',
    fontSize: 14,
    width: '100%',
};

const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'var(--mob-font-head)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--mob-text-dim)',
    marginBottom: 4,
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={{ minWidth: 120, flex: 1 }}>
        <div style={labelStyle}>{label}</div>
        {children}
    </div>
);

const ColorField: React.FC<{ label: string; value: number | undefined; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <Field label={label}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 34 }}>
            <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: safeHex(value),
                border: '2px solid var(--mob-border)',
                flexShrink: 0,
            }} />
            <span style={{ fontFamily: 'var(--mob-font-mono)', fontSize: 11, color: 'var(--mob-text-muted)' }}>
                {safeHex(value).toUpperCase()}
            </span>
            <input type="color" value={safeHex(value)} onChange={e => onChange(hexToNum(e.target.value))}
                style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
        </label>
    </Field>
);

const NumField: React.FC<{ label: string; value: number; onChange: (v: number) => void; step?: number }> = ({ label, value, onChange, step = 1 }) => (
    <Field label={label}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={() => onChange(Math.max(0, value - step))}
                style={{ width: 30, height: 34, background: 'var(--mob-surface-3)', border: '1px solid var(--mob-border)', borderRadius: '8px 0 0 8px', color: 'var(--mob-text)', cursor: 'pointer', fontSize: 16, fontFamily: 'var(--mob-font-body)' }}>−</button>
            <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
                style={{ ...inputStyle, width: 56, borderRadius: 0, textAlign: 'center', padding: '7px 4px', borderLeft: 'none', borderRight: 'none' }} />
            <button onClick={() => onChange(value + step)}
                style={{ width: 30, height: 34, background: 'var(--mob-surface-3)', border: '1px solid var(--mob-border)', borderRadius: '0 8px 8px 0', color: 'var(--mob-text)', cursor: 'pointer', fontSize: 16, fontFamily: 'var(--mob-font-body)' }}>+</button>
        </div>
    </Field>
);

// Per-type quick fields: the 2-4 most important props for this widget
function QuickFields({ item, update }: { item: GridItem; update: (p: Partial<GridItem>) => void }) {
    const t = item.type;

    if (t === 'label' || t === 'btn') return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <Field label="TEXT">
                <input style={inputStyle} value={item.name || ''} onChange={e => update({ name: e.target.value })} placeholder="Label text" />
            </Field>
            <ColorField label="TEXT COLOR" value={item.textColor} onChange={v => update({ textColor: v })} />
            <NumField label="FONT SIZE" value={item.fontSize ?? 16} onChange={v => update({ fontSize: v })} />
        </div>
    );

    if (t === 'tile') return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <Field label="TITLE">
                <input style={inputStyle} value={item.name || ''} onChange={e => update({ name: e.target.value })} placeholder="Tile title" />
            </Field>
            <Field label="ICON">
                <input style={{ ...inputStyle, width: 60, textAlign: 'center' }} value={item.icon || ''} onChange={e => update({ icon: e.target.value })} placeholder="💡" />
            </Field>
            <Field label="VALUE">
                <input style={inputStyle} value={item.topText || ''} onChange={e => update({ topText: e.target.value })} placeholder="23°" />
            </Field>
        </div>
    );

    if (t === 'switch') return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <Field label="MQTT TOPIC">
                <input style={inputStyle} value={item.mqttTopic || ''} onChange={e => update({ mqttTopic: e.target.value })} placeholder="home/light/set" />
            </Field>
            <Field label="STATE TOPIC">
                <input style={inputStyle} value={item.mqttStateTopic || ''} onChange={e => update({ mqttStateTopic: e.target.value })} placeholder="home/light/state" />
            </Field>
        </div>
    );

    if (t === 'slider') return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <NumField label="MIN" value={item.min ?? 0} onChange={v => update({ min: v })} />
            <NumField label="MAX" value={item.max ?? 100} onChange={v => update({ max: v })} />
            <Field label="MQTT TOPIC">
                <input style={inputStyle} value={item.mqttTopic || ''} onChange={e => update({ mqttTopic: e.target.value })} placeholder="topic" />
            </Field>
        </div>
    );

    if (t === 'arc' || t === 'bar') return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <NumField label="MIN" value={item.min ?? 0} onChange={v => update({ min: v })} />
            <NumField label="MAX" value={item.max ?? 100} onChange={v => update({ max: v })} />
            <ColorField label="COLOR" value={item.color} onChange={v => update({ color: v })} />
        </div>
    );

    if (t === 'tilesGrid') return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <NumField label="COLS" value={item.cols ?? 4} onChange={v => update({ cols: v })} />
            <NumField label="ROWS" value={item.rows ?? 4} onChange={v => update({ rows: v })} />
            <NumField label="GAP" value={item.gap ?? 10} onChange={v => update({ gap: v })} step={2} />
        </div>
    );

    if (t === 'clock') return (
        <div style={{ padding: '10px 12px' }}>
            <Field label="FORMAT">
                <input style={inputStyle} value={item.name || '%H:%M'} onChange={e => update({ name: e.target.value })} placeholder="%H:%M:%S" />
            </Field>
        </div>
    );

    if (t === 'chart') return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <ColorField label="COLOR" value={item.chartColor ?? item.color} onChange={v => update({ chartColor: v, color: v })} />
            <NumField label="POINTS" value={item.chartPoints ?? 20} onChange={v => update({ chartPoints: v })} />
        </div>
    );

    // Generic fallback: show bg color + text color
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px' }}>
            <Field label="NAME">
                <input style={inputStyle} value={item.name || ''} onChange={e => update({ name: e.target.value })} placeholder="Widget name" />
            </Field>
            <ColorField label="BG" value={item.bg ?? item.color} onChange={v => update({ bg: v })} />
        </div>
    );
}

// ── Screen properties (when no item selected) ────────────────────────────────
function ScreenProps() {
    const ctx = useContext(GridContext) as any;
    if (!ctx) return null;
    const { project, activeScreenId, updateScreen, baseWidth, baseHeight } = ctx;
    const screen = project?.screens?.find((s: any) => s.id === activeScreenId);
    if (!screen) return null;

    const bgHex = safeHex(screen.bg);

    return (
        <div style={{ padding: '10px 12px' }}>
            <div style={labelStyle}>SCREEN</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                <Field label="NAME">
                    <input style={inputStyle} value={screen.name} onChange={e => updateScreen(screen.id, { name: e.target.value })} />
                </Field>
                <Field label="BACKGROUND">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 34 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: bgHex, border: '2px solid var(--mob-border)' }} />
                        <span style={{ fontFamily: 'var(--mob-font-mono)', fontSize: 11, color: 'var(--mob-text-muted)' }}>{bgHex.toUpperCase()}</span>
                        <input type="color" value={bgHex} onChange={e => updateScreen(screen.id, { bg: hexToNum(e.target.value) })}
                            style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
                    </label>
                </Field>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'var(--mob-font-mono)', color: 'var(--mob-text-dim)' }}>
                Canvas {baseWidth} × {baseHeight}px
            </div>
        </div>
    );
}

// ── Main QuickProps panel ─────────────────────────────────────────────────────
interface QuickPropsProps {
    onEditAll: () => void;
}

const TYPE_ICONS: Record<string, string> = {
    label: 'Aa', btn: '○', clock: '⏰', frame: '□', circle: '◯', rounded_rect: '▢',
    switch: '⇌', slider: '─', arc: '◉', bar: '▮', checkbox: '☑', dropdown: '▾',
    roller: '⊙', chart: '📈', tilesGrid: '⊞', tile: '▪', 'nav-menu': '≡',
    'nav-item': '▸', component: '⚙️', header: '▬',
};

export const QuickProps: React.FC<QuickPropsProps> = ({ onEditAll }) => {
    const ctx = useContext(GridContext) as any;
    if (!ctx) return null;

    const { project, activeScreenId, selections, updateItem } = ctx;
    const activeSel = (selections?.[activeScreenId] || [])[0];

    let item: GridItem | undefined;
    let pageId: string | undefined;

    if (activeSel?.type === 'item') {
        const screen = project?.screens?.find((s: any) => s.id === activeScreenId);
        for (const pg of screen?.pages || []) {
            const found = findItemRecursive(pg.items, activeSel.id);
            if (found) { item = found; pageId = pg.id; break; }
        }
    }

    const update = useCallback((patch: Partial<GridItem>) => {
        if (!item || !pageId) return;
        updateItem(pageId, item.id, patch);
    }, [item, pageId, updateItem]);

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--mob-bg)',
            borderTop: '1px solid var(--mob-border)',
            overflow: 'hidden',
            minHeight: 0,
        }}>
            {/* Header row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: 36,
                padding: '0 12px',
                borderBottom: '1px solid var(--mob-border)',
                flexShrink: 0,
                background: 'var(--mob-surface)',
            }}>
                {item ? (
                    <>
                        <span style={{ fontSize: 12, color: 'var(--mob-accent)', marginRight: 6, fontFamily: 'var(--mob-font-mono)' }}>
                            {TYPE_ICONS[item.type] || '□'}
                        </span>
                        <span style={{
                            flex: 1, fontSize: 11, fontFamily: 'var(--mob-font-head)', fontWeight: 700,
                            color: 'var(--mob-text)', letterSpacing: '0.05em',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {item.name || item.type.toUpperCase()}
                        </span>
                        <button onClick={onEditAll} style={{
                            background: 'var(--mob-accent-dim)',
                            border: '1px solid var(--mob-accent)',
                            borderRadius: 8,
                            padding: '4px 10px',
                            color: 'var(--mob-accent)',
                            fontFamily: 'var(--mob-font-head)',
                            fontWeight: 700,
                            fontSize: 10,
                            cursor: 'pointer',
                            letterSpacing: '0.06em',
                            flexShrink: 0,
                        }}>
                            EDIT ALL →
                        </button>
                    </>
                ) : (
                    <span style={{ fontSize: 10, fontFamily: 'var(--mob-font-head)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--mob-text-dim)' }}>
                        SCREEN PROPERTIES
                    </span>
                )}
            </div>

            {/* Scrollable fields */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {item ? (
                    <QuickFields item={item} update={update} />
                ) : (
                    <ScreenProps />
                )}
            </div>
        </div>
    );
};
