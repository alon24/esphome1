import React, { useContext, useState, useCallback } from "react";
import { GridContext } from "../../context/GridContext";
import { findItemRecursive } from "../../utils";
import { type GridItem } from "../../types";

// ─── tiny helpers ────────────────────────────────────────────────────────────

function safeHex(n?: number): string {
    if (n == null || isNaN(n)) return '#1e1e2a';
    return '#' + Math.max(0, n).toString(16).padStart(6, '0');
}

function hexToNum(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

const SCREEN_ACTION_OPTIONS = [
    { value: '', label: 'None' },
    { value: 'goto:', label: 'Go to Screen →' },
    { value: 'next-screen', label: 'Next Screen' },
    { value: 'prev-screen', label: 'Prev Screen' },
    { value: 'open-panel:', label: 'Open Panel →' },
    { value: 'close-panel', label: 'Close Panel' },
    { value: 'mqtt-publish:', label: 'MQTT Publish →' },
    { value: 'mqtt-toggle:', label: 'MQTT Toggle →' },
];

function parseAction(action?: string) {
    if (!action) return { kind: '', param: '' };
    for (const opt of SCREEN_ACTION_OPTIONS) {
        if (opt.value && opt.value.endsWith(':') && action.startsWith(opt.value)) {
            return { kind: opt.value, param: action.slice(opt.value.length) };
        }
        if (opt.value && !opt.value.endsWith(':') && action === opt.value) {
            return { kind: opt.value, param: '' };
        }
    }
    return { kind: '', param: action };
}

function buildAction(kind: string, param: string): string | undefined {
    if (!kind) return undefined;
    if (kind.endsWith(':')) return `${kind}${param}`;
    return kind;
}

// ─── sub-components ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string }> = ({ title }) => (
    <div style={{
        padding: '20px 16px 6px',
        fontSize: 9,
        fontFamily: 'var(--mob-font-head)',
        fontWeight: 800,
        letterSpacing: '0.12em',
        color: 'var(--mob-text-dim)',
        borderBottom: '1px solid var(--mob-border)',
        marginBottom: 0,
    }}>
        {title}
    </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode; note?: string }> = ({ label, children, note }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 52,
        padding: '8px 16px',
        borderBottom: '1px solid var(--mob-border)',
        gap: 12,
    }}>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontFamily: 'var(--mob-font-body)', color: 'var(--mob-text)', fontWeight: 500 }}>
                {label}
            </div>
            {note && <div style={{ fontSize: 10, color: 'var(--mob-text-dim)', marginTop: 2, fontFamily: 'var(--mob-font-mono)' }}>{note}</div>}
        </div>
        <div style={{ flexShrink: 0 }}>
            {children}
        </div>
    </div>
);

const TextInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }> = ({ value, onChange, placeholder, mono }) => (
    <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
            background: 'var(--mob-surface-2)',
            border: '1px solid var(--mob-border)',
            borderRadius: 8,
            padding: '8px 12px',
            color: 'var(--mob-text)',
            fontFamily: mono ? 'var(--mob-font-mono)' : 'var(--mob-font-body)',
            fontSize: 14,
            width: 180,
            maxWidth: '100%',
        }}
    />
);

const NumberStepper: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }> = ({
    value, onChange, min, max, step = 1, unit
}) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
            onClick={() => onChange(Math.max(min ?? -9999, Math.round((value - step) / step) * step))}
            style={stepBtn}
        >−</button>
        <input
            type="number"
            value={value}
            onChange={e => {
                const v = Number(e.target.value);
                if (!isNaN(v)) onChange(Math.max(min ?? -9999, Math.min(max ?? 9999, v)));
            }}
            style={{
                width: 60,
                textAlign: 'center',
                background: 'var(--mob-surface-2)',
                border: '1px solid var(--mob-border)',
                borderRadius: 8,
                padding: '8px 4px',
                color: 'var(--mob-text)',
                fontFamily: 'var(--mob-font-mono)',
                fontSize: 13,
            }}
        />
        <button
            onClick={() => onChange(Math.min(max ?? 9999, Math.round((value + step) / step) * step))}
            style={stepBtn}
        >+</button>
        {unit && <span style={{ fontSize: 11, color: 'var(--mob-text-dim)', fontFamily: 'var(--mob-font-mono)' }}>{unit}</span>}
    </div>
);

const stepBtn: React.CSSProperties = {
    width: 36, height: 36,
    background: 'var(--mob-surface-3)',
    border: '1px solid var(--mob-border)',
    borderRadius: 8,
    color: 'var(--mob-text)',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
    fontFamily: 'var(--mob-font-body)',
};

const ColorSwatch: React.FC<{ value: number | undefined; onChange: (v: number) => void; label?: string }> = ({ value, onChange, label }) => {
    const hex = safeHex(value);
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{
                width: 32, height: 32,
                borderRadius: 8,
                background: hex,
                border: '2px solid var(--mob-border)',
                flexShrink: 0,
            }} />
            <span style={{ fontFamily: 'var(--mob-font-mono)', fontSize: 11, color: 'var(--mob-text-muted)' }}>
                {hex.toUpperCase()}
            </span>
            <input
                type="color"
                value={hex}
                onChange={e => onChange(hexToNum(e.target.value))}
                style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
            />
        </label>
    );
};

const Select: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
            background: 'var(--mob-surface-2)',
            border: '1px solid var(--mob-border)',
            borderRadius: 8,
            padding: '8px 12px',
            color: 'var(--mob-text)',
            fontFamily: 'var(--mob-font-body)',
            fontSize: 13,
            maxWidth: 180,
        }}
    >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
);

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
    <button
        onClick={() => onChange(!value)}
        style={{
            width: 48, height: 28,
            borderRadius: 14,
            background: value ? 'var(--mob-accent)' : 'var(--mob-surface-3)',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0,
        }}
    >
        <div style={{
            position: 'absolute',
            top: 3, left: value ? 23 : 3,
            width: 22, height: 22,
            borderRadius: 11,
            background: 'white',
            transition: 'left 0.2s',
        }} />
    </button>
);

const ActionEditor: React.FC<{
    label: string;
    value: string | undefined;
    onChange: (v: string | undefined) => void;
    screens: { id: string; name: string }[];
    panels: { id: string; name: string }[];
}> = ({ label, value, onChange, screens, panels }) => {
    const { kind, param } = parseAction(value);

    const handleKindChange = (newKind: string) => {
        onChange(buildAction(newKind, param));
    };

    const handleParamChange = (newParam: string) => {
        onChange(buildAction(kind, newParam));
    };

    const paramOptions =
        kind === 'goto:' ? screens.map(s => ({ value: s.id, label: s.name })) :
        kind === 'open-panel:' ? panels.map(p => ({ value: p.id, label: p.name })) :
        null;

    return (
        <div style={{ borderBottom: '1px solid var(--mob-border)', padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mob-font-head)', fontWeight: 700, color: 'var(--mob-text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                {label}
            </div>
            <Select
                value={kind}
                onChange={handleKindChange}
                options={SCREEN_ACTION_OPTIONS}
            />
            {paramOptions && (
                <div style={{ marginTop: 8 }}>
                    <Select
                        value={param}
                        onChange={handleParamChange}
                        options={[{ value: '', label: '— select —' }, ...paramOptions]}
                    />
                </div>
            )}
            {kind.endsWith(':') && !paramOptions && (
                <div style={{ marginTop: 8 }}>
                    <TextInput value={param} onChange={handleParamChange} placeholder="topic/path" mono />
                </div>
            )}
        </div>
    );
};

// ─── content sections by type ─────────────────────────────────────────────────

function ContentSection({ item, update }: { item: GridItem; update: (patch: Partial<GridItem>) => void }) {
    const t = item.type;

    if (t === 'label' || t === 'btn') {
        return (
            <>
                <Row label="Text">
                    <TextInput value={item.name || ''} onChange={v => update({ name: v })} placeholder="Label text" />
                </Row>
                <Row label="Icon / Char">
                    <TextInput value={item.icon || ''} onChange={v => update({ icon: v })} placeholder="💡 or any char" />
                </Row>
                <Row label="Font Size">
                    <NumberStepper value={item.fontSize ?? 16} onChange={v => update({ fontSize: v })} min={6} max={120} />
                </Row>
                <Row label="Align">
                    <div style={{ display: 'flex', gap: 4 }}>
                        {(['left', 'center', 'right'] as const).map(a => (
                            <button key={a} onClick={() => update({ textAlign: a })} style={{
                                width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                                background: item.textAlign === a ? 'var(--mob-accent)' : 'var(--mob-surface-3)',
                                border: '1px solid var(--mob-border)',
                                color: item.textAlign === a ? 'white' : 'var(--mob-text-muted)',
                                fontSize: 14,
                            }}>
                                {a === 'left' ? '◀' : a === 'center' ? '≡' : '▶'}
                            </button>
                        ))}
                    </div>
                </Row>
                <Row label="Top Text">
                    <TextInput value={item.topText || ''} onChange={v => update({ topText: v })} placeholder="optional" />
                </Row>
                <Row label="Bottom Text">
                    <TextInput value={item.bottomText || ''} onChange={v => update({ bottomText: v })} placeholder="optional" />
                </Row>
            </>
        );
    }

    if (t === 'clock') {
        return (
            <Row label="Format" note="e.g. %H:%M:%S">
                <TextInput value={item.name || '%H:%M'} onChange={v => update({ name: v })} placeholder="%H:%M" mono />
            </Row>
        );
    }

    if (t === 'switch') {
        return (
            <Row label="(Configure in Events)" note="Set MQTT topics below" >
                <></>
            </Row>
        );
    }

    if (t === 'slider' || t === 'arc' || t === 'bar') {
        return (
            <>
                <Row label="Min">
                    <NumberStepper value={item.min ?? 0} onChange={v => update({ min: v })} />
                </Row>
                <Row label="Max">
                    <NumberStepper value={item.max ?? 100} onChange={v => update({ max: v })} />
                </Row>
                {(t === 'arc' || t === 'bar') && (
                    <Row label="Thickness">
                        <NumberStepper value={item.borderWidth ?? 8} onChange={v => update({ borderWidth: v })} min={1} max={40} />
                    </Row>
                )}
                {t === 'bar' && (
                    <Row label="Orientation">
                        <Select
                            value={item.orientation || 'v'}
                            onChange={v => update({ orientation: v as 'v' | 'h' })}
                            options={[{ value: 'v', label: 'Vertical' }, { value: 'h', label: 'Horizontal' }]}
                        />
                    </Row>
                )}
            </>
        );
    }

    if (t === 'dropdown' || t === 'roller') {
        return (
            <Row label="Options" note="One per line">
                <textarea
                    value={item.options || ''}
                    onChange={e => update({ options: e.target.value })}
                    rows={4}
                    placeholder={"Option 1\nOption 2\nOption 3"}
                    style={{
                        background: 'var(--mob-surface-2)', border: '1px solid var(--mob-border)',
                        borderRadius: 8, padding: '8px 12px', color: 'var(--mob-text)',
                        fontFamily: 'var(--mob-font-body)', fontSize: 13, width: 180, resize: 'vertical',
                    }}
                />
            </Row>
        );
    }

    if (t === 'chart') {
        return (
            <>
                <Row label="Chart Type">
                    <Select
                        value={item.chartType || 'line'}
                        onChange={v => update({ chartType: v as any })}
                        options={[
                            { value: 'line', label: 'Line' },
                            { value: 'bar', label: 'Bar' },
                            { value: 'area', label: 'Area' },
                            { value: 'scatter', label: 'Scatter' },
                        ]}
                    />
                </Row>
                <Row label="Data Points">
                    <NumberStepper value={item.chartPoints ?? 20} onChange={v => update({ chartPoints: v })} min={2} max={200} />
                </Row>
            </>
        );
    }

    if (t === 'tilesGrid') {
        return (
            <>
                <Row label="Columns">
                    <NumberStepper value={item.cols ?? 4} onChange={v => update({ cols: v })} min={1} max={12} />
                </Row>
                <Row label="Rows">
                    <NumberStepper value={item.rows ?? 4} onChange={v => update({ rows: v })} min={1} max={12} />
                </Row>
                <Row label="Gap (px)">
                    <NumberStepper value={item.gap ?? 10} onChange={v => update({ gap: v })} min={0} max={40} />
                </Row>
            </>
        );
    }

    if (t === 'tile') {
        return (
            <>
                <Row label="Title">
                    <TextInput value={item.name || ''} onChange={v => update({ name: v })} placeholder="Tile title" />
                </Row>
                <Row label="Icon">
                    <TextInput value={item.icon || ''} onChange={v => update({ icon: v })} placeholder="💡" />
                </Row>
                <Row label="Top Text">
                    <TextInput value={item.topText || ''} onChange={v => update({ topText: v })} placeholder="value" />
                </Row>
                <Row label="Bottom Text">
                    <TextInput value={item.bottomText || ''} onChange={v => update({ bottomText: v })} placeholder="unit / desc" />
                </Row>
            </>
        );
    }

    return (
        <Row label="Name">
            <TextInput value={item.name || ''} onChange={v => update({ name: v })} placeholder="Widget name" />
        </Row>
    );
}

// ─── main editor ─────────────────────────────────────────────────────────────

interface MobileEditorProps {
    onBack: () => void;
}

const TYPE_ICONS: Record<string, string> = {
    label: 'Aa', btn: '○', clock: '⏰', frame: '□', circle: '◯', rounded_rect: '▢',
    switch: '⇌', slider: '─', arc: '◉', bar: '▮', checkbox: '☑', dropdown: '▾',
    roller: '⊙', chart: '📈', tilesGrid: '⊞', tile: '▪', 'nav-menu': '≡',
    'nav-item': '▸', component: '⚙️', header: '▬',
};

export const MobileEditor: React.FC<MobileEditorProps> = ({ onBack }) => {
    const ctx = useContext(GridContext) as any;
    if (!ctx) return null;

    const { project, activeScreenId, selections, updateItem, removeItem, selectedEntity } = ctx;
    const activeSel = (selections?.[activeScreenId] || [])[0];

    // Find the item
    let item: GridItem | undefined;
    let pageId: string | undefined;

    if (activeSel?.type === 'item') {
        const screen = project?.screens?.find((s: any) => s.id === activeScreenId);
        for (const pg of screen?.pages || []) {
            const found = findItemRecursive(pg.items, activeSel.id);
            if (found) { item = found; pageId = pg.id; break; }
        }
        // Check panels too
        if (!item) {
            for (const pan of project?.panels || []) {
                const found = findItemRecursive(pan.elements, activeSel.id);
                if (found) { item = found; pageId = pan.id; break; }
            }
        }
    }

    const update = useCallback((patch: Partial<GridItem>) => {
        if (!item || !pageId || !activeSel?.id) return;
        updateItem(pageId, activeSel.id, patch);
    }, [item, pageId, activeSel, updateItem]);

    if (!item) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--mob-bg)', overflow: 'hidden' }}>
                <EditorHeader title="No selection" onBack={onBack} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mob-text-dim)', fontFamily: 'var(--mob-font-body)' }}>
                    Tap a widget on the canvas
                </div>
            </div>
        );
    }

    const screens = project?.screens || [];
    const panels = project?.panels || [];
    const icon = TYPE_ICONS[item.type] || '□';
    const typeName = item.type.toUpperCase().replace(/-/g, ' ');

    const handleDelete = () => {
        if (pageId && item) {
            removeItem(pageId, item.id);
            onBack();
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--mob-bg)', overflow: 'hidden' }}>
            <EditorHeader
                title={`${icon}  ${item.name || typeName}`}
                subtitle={typeName}
                onBack={onBack}
                onDelete={handleDelete}
            />

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

                {/* ── CONTENT ─────────────────────────── */}
                <Section title="CONTENT" />
                <ContentSection item={item} update={update} />

                {/* ── STYLE ───────────────────────────── */}
                <Section title="STYLE" />
                <Row label="Background">
                    <ColorSwatch value={item.bg ?? item.color} onChange={v => update({ bg: v, color: v })} />
                </Row>
                <Row label="Text Color">
                    <ColorSwatch value={item.textColor} onChange={v => update({ textColor: v })} />
                </Row>
                <Row label="Border Color">
                    <ColorSwatch value={item.borderColor} onChange={v => update({ borderColor: v })} />
                </Row>
                <Row label="Border Width">
                    <NumberStepper value={item.borderWidth ?? 0} onChange={v => update({ borderWidth: v })} min={0} max={20} unit="px" />
                </Row>
                <Row label="Radius">
                    <NumberStepper value={item.radius ?? 0} onChange={v => update({ radius: v })} min={0} max={120} unit="px" />
                </Row>
                <Row label="Opacity">
                    <NumberStepper value={item.opacity ?? 100} onChange={v => update({ opacity: v })} min={0} max={100} unit="%" step={5} />
                </Row>
                <Row label="Padding">
                    <NumberStepper value={item.padding ?? 0} onChange={v => update({ padding: v })} min={0} max={60} unit="px" />
                </Row>
                <Row label="Hidden">
                    <Toggle value={item.hidden ?? false} onChange={v => update({ hidden: v })} />
                </Row>
                <Row label="No Background">
                    <Toggle value={item.noBg ?? false} onChange={v => update({ noBg: v })} />
                </Row>

                {/* ── POSITION ────────────────────────── */}
                <Section title="POSITION" />
                <Row label="X">
                    <NumberStepper value={item.x} onChange={v => update({ x: v })} step={4} unit="px" />
                </Row>
                <Row label="Y">
                    <NumberStepper value={item.y} onChange={v => update({ y: v })} step={4} unit="px" />
                </Row>
                <Row label="Width">
                    <NumberStepper value={item.width} onChange={v => update({ width: Math.max(4, v) })} min={4} step={4} unit="px" />
                </Row>
                <Row label="Height">
                    <NumberStepper value={item.height} onChange={v => update({ height: Math.max(4, v) })} min={4} step={4} unit="px" />
                </Row>

                {/* ── EVENTS ──────────────────────────── */}
                <Section title="EVENTS" />
                <ActionEditor
                    label="ON TAP"
                    value={item.onClick}
                    onChange={v => update({ onClick: v })}
                    screens={screens}
                    panels={panels}
                />
                <ActionEditor
                    label="ON DOUBLE TAP"
                    value={item.onDoubleClick}
                    onChange={v => update({ onDoubleClick: v })}
                    screens={screens}
                    panels={panels}
                />
                <ActionEditor
                    label="ON LONG PRESS"
                    value={item.onLongPress}
                    onChange={v => update({ onLongPress: v })}
                    screens={screens}
                    panels={panels}
                />
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--mob-border)' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mob-font-head)', fontWeight: 700, color: 'var(--mob-text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                        MQTT PUBLISH TOPIC
                    </div>
                    <TextInput value={item.mqttTopic || ''} onChange={v => update({ mqttTopic: v })} placeholder="home/device/set" mono />
                </div>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--mob-border)' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mob-font-head)', fontWeight: 700, color: 'var(--mob-text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                        MQTT STATE TOPIC
                    </div>
                    <TextInput value={item.mqttStateTopic || ''} onChange={v => update({ mqttStateTopic: v })} placeholder="home/device/state" mono />
                </div>

                {/* Bottom spacer */}
                <div style={{ height: 40 }} />
            </div>
        </div>
    );
};

const EditorHeader: React.FC<{
    title: string;
    subtitle?: string;
    onBack: () => void;
    onDelete?: () => void;
}> = ({ title, subtitle, onBack, onDelete }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 56,
        padding: '0 8px 0 4px',
        background: 'var(--mob-surface)',
        borderBottom: '1px solid var(--mob-border)',
        flexShrink: 0,
        gap: 4,
    }}>
        <button
            onClick={onBack}
            style={{
                width: 44, height: 44,
                background: 'none', border: 'none',
                color: 'var(--mob-accent)',
                fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10, flexShrink: 0,
            }}
        >
            ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                fontFamily: 'var(--mob-font-head)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--mob-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
            }}>
                {title}
            </div>
            {subtitle && (
                <div style={{ fontSize: 10, color: 'var(--mob-text-dim)', fontFamily: 'var(--mob-font-mono)', marginTop: 1 }}>
                    {subtitle}
                </div>
            )}
        </div>
        {onDelete && (
            <button
                onClick={onDelete}
                style={{
                    width: 44, height: 44,
                    background: 'none', border: 'none',
                    color: 'var(--mob-danger)',
                    fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 10, flexShrink: 0,
                }}
            >
                🗑
            </button>
        )}
    </div>
);
