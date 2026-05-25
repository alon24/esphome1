import React from "react";

const TYPE_ICONS: Record<string, string> = {
    label: 'Aa', btn: '○', clock: '⏰', frame: '□', circle: '◯', rounded_rect: '▢',
    switch: '⇌', slider: '─', arc: '◉', bar: '▮', checkbox: '☑', dropdown: '▾',
    roller: '⊙', chart: '📈', 'nav-menu': '≡', 'nav-item': '▸', 'side-menu': '☰',
    tilesGrid: '⊞', 'pane-grid': '⊞', tile: '□', header: '▬',
    'native-wifi': '📡', 'native-sd': '💾', 'native-system': '⚙️',
    component: '⚙️', battery_icon: '🔋', 'native-wifi-info': '🌐',
};

interface SelectionBarProps {
    item: { type: string; name?: string; id: string; label?: string } | null;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

export const SelectionBar: React.FC<SelectionBarProps> = ({ item, onEdit, onDuplicate, onDelete }) => {
    if (!item) return null;

    const icon = TYPE_ICONS[item.type] || '□';
    const name = item.name || item.label || item.type;

    return (
        <div
            onClick={onEdit}
            style={{
                display: 'flex',
                alignItems: 'center',
                height: 52,
                background: 'var(--mob-accent-dim)',
                borderTop: '1px solid var(--mob-accent)',
                borderBottom: '1px solid var(--mob-border)',
                padding: '0 8px 0 12px',
                gap: 8,
                cursor: 'pointer',
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            {/* Type icon */}
            <span style={{
                fontSize: 15,
                color: 'var(--mob-accent)',
                fontFamily: 'var(--mob-font-mono)',
                flexShrink: 0,
                width: 22,
                textAlign: 'center',
            }}>
                {icon}
            </span>

            {/* Name */}
            <span style={{
                flex: 1,
                fontFamily: 'var(--mob-font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--mob-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {name}
            </span>

            {/* Edit hint */}
            <span style={{
                fontSize: 10,
                color: 'var(--mob-accent)',
                fontFamily: 'var(--mob-font-head)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                flexShrink: 0,
                paddingRight: 4,
            }}>
                EDIT →
            </span>

            {/* Separator */}
            <div style={{ width: 1, height: 24, background: 'var(--mob-border)', flexShrink: 0 }} />

            {/* Dup button */}
            <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                style={{
                    width: 40,
                    height: 40,
                    background: 'none',
                    border: 'none',
                    color: 'var(--mob-text-muted)',
                    fontSize: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    flexShrink: 0,
                }}
                title="Duplicate"
            >
                ⧉
            </button>

            {/* Delete button */}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                style={{
                    width: 40,
                    height: 40,
                    background: 'none',
                    border: 'none',
                    color: 'var(--mob-danger)',
                    fontSize: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    flexShrink: 0,
                }}
                title="Delete"
            >
                🗑
            </button>
        </div>
    );
};
