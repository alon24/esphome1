import React, { useState } from "react";

interface DeviceBarProps {
    status: { connected: boolean; ip?: string; ssid?: string } | null;
    onPull: () => Promise<void>;
    onPush: () => Promise<void>;
    onOpenSheet: () => void;
    dirty?: boolean;
}

export const DeviceBar: React.FC<DeviceBarProps> = ({ status, onPull, onPush, onOpenSheet, dirty }) => {
    const [pulling, setPulling] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const handlePull = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (pulling) return;
        setPulling(true);
        try {
            await onPull();
            showToast("Pulled from device");
        } catch {
            showToast("Pull failed");
        } finally {
            setPulling(false);
        }
    };

    const handlePush = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (pushing) return;
        setPushing(true);
        try {
            await onPush();
            showToast("Synced to device ✓");
        } catch {
            showToast("Push failed");
        } finally {
            setPushing(false);
        }
    };

    const online = status?.connected;

    return (
        <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: 52,
            background: 'var(--mob-surface)',
            borderTop: '1px solid var(--mob-border)',
            padding: '0 12px',
            gap: 8,
            flexShrink: 0,
        }}>
            {/* Status pill */}
            <button
                onClick={onOpenSheet}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--mob-surface-2)',
                    border: '1px solid var(--mob-border)',
                    borderRadius: 20,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0,
                }}
            >
                <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: online ? 'var(--mob-online)' : 'var(--mob-offline)',
                    flexShrink: 0,
                    boxShadow: online ? '0 0 6px var(--mob-online)' : 'none',
                }} />
                <span style={{
                    fontFamily: 'var(--mob-font-mono)',
                    fontSize: 11,
                    color: 'var(--mob-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {online ? (status?.ip || status?.ssid || 'device') : 'OFFLINE'}
                </span>
            </button>

            {/* Pull */}
            <button
                onClick={handlePull}
                disabled={pulling}
                style={{
                    height: 36,
                    padding: '0 14px',
                    background: 'var(--mob-surface-2)',
                    border: '1px solid var(--mob-border)',
                    borderRadius: 10,
                    color: pulling ? 'var(--mob-text-dim)' : 'var(--mob-text)',
                    fontFamily: 'var(--mob-font-head)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: pulling ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    flexShrink: 0,
                    letterSpacing: '0.03em',
                }}
            >
                {pulling ? '···' : '⬇ PULL'}
            </button>

            {/* Push */}
            <button
                onClick={handlePush}
                disabled={pushing}
                style={{
                    height: 36,
                    padding: '0 14px',
                    background: dirty ? 'rgba(245,158,11,0.15)' : 'var(--mob-surface-2)',
                    border: `1px solid ${dirty ? 'var(--mob-dirty)' : 'var(--mob-border)'}`,
                    borderRadius: 10,
                    color: pushing ? 'var(--mob-text-dim)' : dirty ? 'var(--mob-dirty)' : 'var(--mob-text)',
                    fontFamily: 'var(--mob-font-head)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: pushing ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    flexShrink: 0,
                    letterSpacing: '0.03em',
                }}
            >
                {pushing ? '···' : '⬆ PUSH'}
            </button>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'absolute',
                    bottom: 58,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--mob-surface-3)',
                    border: '1px solid var(--mob-border)',
                    borderRadius: 10,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontFamily: 'var(--mob-font-body)',
                    color: 'var(--mob-text)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 100,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                }}>
                    {toast}
                </div>
            )}
        </div>
    );
};
