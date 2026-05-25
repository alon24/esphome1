import React, { useState, useContext, useEffect } from "react";
import { GridContext } from "../../context/GridContext";
import { SMART_COMPONENTS, type ElementType } from "../../types";

const RECENT_KEY = 'gridos_recent_widgets';
const MAX_RECENT = 4;

const WIDGET_GROUPS: { title: string; items: { type: ElementType; label: string; icon: string; w: number; h: number }[] }[] = [
    {
        title: 'BASIC',
        items: [
            { type: 'label',        label: 'Label',       icon: 'Aa', w: 120, h: 40  },
            { type: 'btn',          label: 'Button',      icon: '○',  w: 120, h: 44  },
            { type: 'clock',        label: 'Clock',       icon: '⏰', w: 120, h: 40  },
            { type: 'border',       label: 'Frame',       icon: '□',  w: 160, h: 100 },
            { type: 'circle',       label: 'Circle',      icon: '◯',  w: 80,  h: 80  },
            { type: 'rounded_rect', label: 'Round Rect',  icon: '▢',  w: 120, h: 60  },
        ],
    },
    {
        title: 'CONTROLS',
        items: [
            { type: 'switch',   label: 'Switch',    icon: '⇌', w: 60,  h: 30  },
            { type: 'slider',   label: 'Slider',    icon: '─',  w: 160, h: 30  },
            { type: 'arc',      label: 'Arc',       icon: '◉',  w: 100, h: 100 },
            { type: 'bar',      label: 'Bar',       icon: '▮',  w: 20,  h: 100 },
            { type: 'checkbox', label: 'Checkbox',  icon: '☑',  w: 100, h: 30  },
            { type: 'dropdown', label: 'Dropdown',  icon: '▾',  w: 140, h: 40  },
            { type: 'roller',   label: 'Roller',    icon: '⊙',  w: 80,  h: 100 },
        ],
    },
    {
        title: 'VISUALS',
        items: [
            { type: 'chart', label: 'Chart', icon: '📈', w: 200, h: 120 },
        ],
    },
    {
        title: 'LAYOUT',
        items: [
            { type: 'tilesGrid', label: 'Tiles Grid', icon: '⊞', w: 400, h: 300 },
        ],
    },
    {
        title: 'NAVIGATION',
        items: [
            { type: 'nav-menu',  label: 'Nav Menu',  icon: '≡', w: 200, h: 40  },
            { type: 'nav-item',  label: 'Nav Item',  icon: '▸', w: 100, h: 40  },
            { type: 'side-menu', label: 'Side Menu', icon: '☰', w: 160, h: 300 },
        ],
    },
];

function getRecent(): { type: string; label: string; icon: string }[] {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(type: string, label: string, icon: string) {
    const prev = getRecent().filter(r => r.type !== type);
    const next = [{ type, label, icon }, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

interface WidgetPickerProps {
    onClose: () => void;
}

export const WidgetPicker: React.FC<WidgetPickerProps> = ({ onClose }) => {
    const ctx = useContext(GridContext) as any;
    const [query, setQuery] = useState('');
    const [recent, setRecent] = useState(getRecent());

    useEffect(() => {
        setRecent(getRecent());
    }, []);

    const addWidget = (type: ElementType, label: string, icon: string, w: number, h: number) => {
        if (!ctx) return;
        const { project, activeScreenId, addItem, setSelectedEntity } = ctx;
        const screen = project?.screens?.find((s: any) => s.id === activeScreenId) || project?.screens?.[0];
        if (!screen) return;
        const page = screen.pages?.[0];
        if (!page) return;

        // Place at center of canvas
        const cx = Math.round((800 - w) / 2);
        const cy = Math.round((480 - h) / 2);

        addItem(page.id, type, { x: cx, y: cy, width: w, height: h, name: label });
        saveRecent(type, label, icon);
        setRecent(getRecent());
        onClose();
    };

    const addSmart = (sc: any) => {
        const type = (sc.type || 'component') as ElementType;
        addWidget(type, sc.label, sc.icon, sc.defaultW, sc.defaultH);
    };

    const allItems = WIDGET_GROUPS.flatMap(g => g.items);
    const filtered = query.trim()
        ? allItems.filter(it => it.label.toLowerCase().includes(query.toLowerCase()))
        : null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    zIndex: 200,
                }}
            />

            {/* Sheet */}
            <div style={{
                position: 'fixed',
                bottom: 64,
                left: 0,
                right: 0,
                maxHeight: '72vh',
                background: 'var(--mob-surface)',
                borderTop: '1px solid var(--mob-border)',
                borderRadius: '20px 20px 0 0',
                zIndex: 201,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--mob-border)' }} />
                </div>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 8px', gap: 12 }}>
                    <span style={{
                        flex: 1,
                        fontFamily: 'var(--mob-font-head)',
                        fontWeight: 700,
                        fontSize: 16,
                        color: 'var(--mob-text)',
                        letterSpacing: '0.02em',
                    }}>
                        ADD WIDGET
                    </span>
                    <button onClick={onClose} style={{
                        background: 'var(--mob-surface-3)', border: 'none',
                        borderRadius: 8, padding: '4px 10px',
                        color: 'var(--mob-text-muted)', cursor: 'pointer',
                        fontFamily: 'var(--mob-font-body)', fontSize: 12,
                    }}>
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '0 16px 8px' }}>
                    <input
                        type="text"
                        placeholder="Search widgets..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus={false}
                        style={{
                            width: '100%',
                            background: 'var(--mob-surface-2)',
                            border: '1px solid var(--mob-border)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            color: 'var(--mob-text)',
                            fontFamily: 'var(--mob-font-body)',
                            fontSize: 14,
                        }}
                    />
                </div>

                {/* Scrollable list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>
                    {/* Recent */}
                    {!filtered && recent.length > 0 && (
                        <>
                            <SectionTitle title="RECENT" />
                            <div style={{ display: 'flex', padding: '4px 12px', gap: 8 }}>
                                {recent.map(r => (
                                    <button
                                        key={r.type}
                                        onClick={() => {
                                            const wg = allItems.find(i => i.type === r.type);
                                            if (wg) addWidget(wg.type, wg.label, wg.icon, wg.w, wg.h);
                                        }}
                                        style={{
                                            flex: 1,
                                            background: 'var(--mob-surface-2)',
                                            border: '1px solid var(--mob-border)',
                                            borderRadius: 10,
                                            padding: '10px 4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <span style={{ fontSize: 18 }}>{r.icon}</span>
                                        <span style={{ fontSize: 9, fontFamily: 'var(--mob-font-body)', color: 'var(--mob-text-muted)' }}>
                                            {r.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Filtered */}
                    {filtered ? (
                        filtered.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--mob-text-muted)', fontSize: 13 }}>
                                No widgets found
                            </div>
                        ) : (
                            filtered.map(it => (
                                <WidgetRow key={it.type} it={it} onAdd={() => addWidget(it.type, it.label, it.icon, it.w, it.h)} />
                            ))
                        )
                    ) : (
                        <>
                            {WIDGET_GROUPS.map(g => (
                                <React.Fragment key={g.title}>
                                    <SectionTitle title={g.title} />
                                    {g.items.map(it => (
                                        <WidgetRow key={it.type} it={it} onAdd={() => addWidget(it.type, it.label, it.icon, it.w, it.h)} />
                                    ))}
                                </React.Fragment>
                            ))}
                            {/* Smart components */}
                            <SectionTitle title="SMART COMPONENTS" />
                            {SMART_COMPONENTS.map(sc => (
                                <WidgetRow
                                    key={sc.id}
                                    it={{ type: sc.id as any, label: sc.label, icon: sc.icon, w: sc.defaultW, h: sc.defaultH }}
                                    onAdd={() => addSmart(sc)}
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <div style={{
        padding: '12px 16px 4px',
        fontSize: 9,
        fontFamily: 'var(--mob-font-head)',
        fontWeight: 800,
        letterSpacing: '0.1em',
        color: 'var(--mob-text-dim)',
    }}>
        {title}
    </div>
);

const WidgetRow: React.FC<{
    it: { type: any; label: string; icon: string; w: number; h: number };
    onAdd: () => void;
}> = ({ it, onAdd }) => (
    <button
        onClick={onAdd}
        style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid var(--mob-border)',
            cursor: 'pointer',
            gap: 12,
            WebkitTapHighlightColor: 'transparent',
        }}
    >
        <span style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--mob-surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
        }}>
            {it.icon}
        </span>
        <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--mob-font-body)', fontSize: 14, fontWeight: 500, color: 'var(--mob-text)' }}>
                {it.label}
            </div>
            <div style={{ fontFamily: 'var(--mob-font-mono)', fontSize: 10, color: 'var(--mob-text-dim)', marginTop: 1 }}>
                {it.w} × {it.h}px
            </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--mob-accent)' }}>＋</span>
    </button>
);
