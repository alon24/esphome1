import React, { useContext, useState, useRef, useCallback, useEffect } from "react";
import { GridContext } from "../../context/GridContext";
import { CanvasArea } from "../editor/CanvasArea";
import { MiniLayerTree } from "./MiniLayerTree";
import { DeviceBar } from "./DeviceBar";
import { WidgetPicker } from "./WidgetPicker";
import { MobileEditor } from "./MobileEditor";
import { QuickProps } from "./QuickProps";
import { findItemRecursive } from "../../utils";

type MobileView = "canvas" | "editor" | "screenList";

interface MobileBuilderProps {
    wifiStatus: any;
    remoteIp: string;
    setRemoteIp: (ip: string) => void;
}

// ─── Screen list view ────────────────────────────────────────────────────────
const ScreenList: React.FC<{ onBack: () => void; onSelect: (id: string) => void }> = ({ onBack, onSelect }) => {
    const ctx = useContext(GridContext) as any;
    if (!ctx) return null;
    const { project, activeScreenId, setActiveScreenId, addScreen, removeScreen, updateScreen, updatePage, baseWidth, baseHeight, setBaseWidth, setBaseHeight } = ctx;
    const screens: any[] = project?.screens || [];

    const handleSelect = (id: string) => {
        setActiveScreenId(id);
        onSelect(id);
    };

    const handleAddScreen = () => {
        addScreen();
        onBack();
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--mob-bg)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', height: 56,
                padding: '0 8px 0 4px',
                background: 'var(--mob-surface)',
                borderBottom: '1px solid var(--mob-border)',
                flexShrink: 0, gap: 4,
            }}>
                <button onClick={onBack} style={{
                    width: 44, height: 44, background: 'none', border: 'none',
                    color: 'var(--mob-accent)', fontSize: 20, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
                }}>←</button>
                <span style={{
                    flex: 1, fontFamily: 'var(--mob-font-head)', fontWeight: 700,
                    fontSize: 16, color: 'var(--mob-text)', letterSpacing: '0.02em',
                }}>SCREENS</span>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '12px 16px 4px', fontSize: 9, fontFamily: 'var(--mob-font-head)', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--mob-text-dim)' }}>
                    SCREENS
                </div>
                {screens.map(scr => (
                    <div key={scr.id} style={{
                        display: 'flex', alignItems: 'center',
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--mob-border)',
                        background: scr.id === activeScreenId ? 'var(--mob-accent-dim)' : 'none',
                        borderLeft: scr.id === activeScreenId ? '2px solid var(--mob-accent)' : '2px solid transparent',
                        cursor: 'pointer',
                        gap: 12,
                    }} onClick={() => handleSelect(scr.id)}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>📺</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--mob-font-body)', fontSize: 14, fontWeight: 500, color: 'var(--mob-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {scr.name}
                            </div>
                            <div style={{ fontSize: 10, fontFamily: 'var(--mob-font-mono)', color: 'var(--mob-text-dim)', marginTop: 2 }}>
                                {scr.pages?.reduce((n: number, p: any) => n + (p.items?.length || 0), 0) || 0} items
                            </div>
                        </div>
                        {scr.id === activeScreenId && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--mob-font-head)', fontWeight: 800, color: 'var(--mob-accent)', letterSpacing: '0.08em', background: 'var(--mob-accent-dim)', padding: '3px 8px', borderRadius: 6 }}>
                                ACTIVE
                            </span>
                        )}
                        {scr.id !== 'main' && (
                            <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${scr.name}"?`)) removeScreen(scr.id); }} style={{
                                width: 36, height: 36, background: 'none', border: 'none',
                                color: 'var(--mob-danger)', cursor: 'pointer', fontSize: 15, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                            }}>🗑</button>
                        )}
                    </div>
                ))}

                {/* Add screen */}
                <button onClick={handleAddScreen} style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    padding: '14px 16px', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--mob-border)', cursor: 'pointer', gap: 12,
                }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mob-surface-2)', border: '1px dashed var(--mob-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--mob-accent)', flexShrink: 0 }}>+</span>
                    <span style={{ fontFamily: 'var(--mob-font-body)', fontSize: 14, color: 'var(--mob-accent)', fontWeight: 500 }}>Add New Screen</span>
                </button>

                {/* Canvas config */}
                <div style={{ padding: '20px 16px 4px', fontSize: 9, fontFamily: 'var(--mob-font-head)', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--mob-text-dim)' }}>
                    CANVAS SIZE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--mob-border)', gap: 12 }}>
                    <span style={{ fontFamily: 'var(--mob-font-body)', fontSize: 14, color: 'var(--mob-text)', flex: 1 }}>Width</span>
                    <input type="number" value={baseWidth} onChange={e => setBaseWidth(Number(e.target.value))} style={{
                        width: 80, background: 'var(--mob-surface-2)', border: '1px solid var(--mob-border)', borderRadius: 8, padding: '8px 10px',
                        color: 'var(--mob-text)', fontFamily: 'var(--mob-font-mono)', fontSize: 13, textAlign: 'center',
                    }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--mob-border)', gap: 12 }}>
                    <span style={{ fontFamily: 'var(--mob-font-body)', fontSize: 14, color: 'var(--mob-text)', flex: 1 }}>Height</span>
                    <input type="number" value={baseHeight} onChange={e => setBaseHeight(Number(e.target.value))} style={{
                        width: 80, background: 'var(--mob-surface-2)', border: '1px solid var(--mob-border)', borderRadius: 8, padding: '8px 10px',
                        color: 'var(--mob-text)', fontFamily: 'var(--mob-font-mono)', fontSize: 13, textAlign: 'center',
                    }} />
                </div>

                <div style={{ height: 40 }} />
            </div>
        </div>
    );
};

// ─── Device sheet overlay ─────────────────────────────────────────────────────
const DeviceSheet: React.FC<{
    wifiStatus: any;
    remoteIp: string;
    setRemoteIp: (ip: string) => void;
    onClose: () => void;
}> = ({ wifiStatus, remoteIp, setRemoteIp, onClose }) => {
    const ctx = useContext(GridContext) as any;
    if (!ctx) return null;
    const { syncToDevice, pullFromDevice, exportProject, importProject, resetProject } = ctx;
    const [pulling, setPulling] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const handlePull = async () => {
        setPulling(true);
        try { await pullFromDevice(); showToast("Pulled from device ✓"); }
        catch { showToast("Pull failed"); }
        finally { setPulling(false); }
    };

    const handlePush = async () => {
        setPushing(true);
        try { await syncToDevice(); showToast("Synced to device ✓"); }
        catch { showToast("Push failed"); }
        finally { setPushing(false); }
    };

    const handleErase = () => {
        if (window.confirm("Erase ALL screens and panels? Cannot be undone.")) {
            resetProject();
            showToast("Project reset");
        }
    };

    const online = wifiStatus?.connected;

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0,
                background: 'var(--mob-surface)',
                borderBottom: '1px solid var(--mob-border)',
                borderRadius: '0 0 20px 20px',
                zIndex: 301,
                display: 'flex', flexDirection: 'column',
                maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
            }}>
                {/* Handle / header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid var(--mob-border)' }}>
                    <span style={{ fontFamily: 'var(--mob-font-head)', fontWeight: 700, fontSize: 15, color: 'var(--mob-text)', letterSpacing: '0.05em', flex: 1 }}>DEVICE</span>
                    <button onClick={onClose} style={{ background: 'var(--mob-surface-3)', border: 'none', borderRadius: 8, padding: '4px 10px', color: 'var(--mob-text-muted)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>

                {/* Connection */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--mob-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--mob-online)' : 'var(--mob-offline)', boxShadow: online ? '0 0 8px var(--mob-online)' : 'none', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--mob-font-mono)', fontSize: 12, color: 'var(--mob-text)', flex: 1 }}>
                        {online ? (wifiStatus?.ip || wifiStatus?.ssid || 'device') : 'OFFLINE'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--mob-text-dim)', fontFamily: 'var(--mob-font-body)' }}>device IP:</span>
                    <input
                        value={remoteIp}
                        onChange={e => setRemoteIp(e.target.value)}
                        placeholder="192.168.1.100"
                        style={{
                            width: 130, background: 'var(--mob-surface-2)', border: '1px solid var(--mob-border)',
                            borderRadius: 8, padding: '6px 10px', color: 'var(--mob-text)',
                            fontFamily: 'var(--mob-font-mono)', fontSize: 12,
                        }}
                    />
                </div>

                {/* PULL / PUSH */}
                <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--mob-border)' }}>
                    <button onClick={handlePull} disabled={pulling} style={{
                        flex: 1, padding: '14px', background: 'var(--mob-surface-2)',
                        border: '1px solid var(--mob-border)', borderRadius: 12,
                        color: pulling ? 'var(--mob-text-dim)' : 'var(--mob-text)',
                        fontFamily: 'var(--mob-font-head)', fontWeight: 700, fontSize: 13,
                        cursor: pulling ? 'default' : 'pointer', letterSpacing: '0.04em',
                    }}>
                        {pulling ? '···' : '⬇  PULL'}<br />
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--mob-text-dim)', fontFamily: 'var(--mob-font-body)' }}>Load from device</span>
                    </button>
                    <button onClick={handlePush} disabled={pushing} style={{
                        flex: 1, padding: '14px', background: 'var(--mob-surface-2)',
                        border: '1px solid var(--mob-accent)', borderRadius: 12,
                        color: pushing ? 'var(--mob-text-dim)' : 'var(--mob-accent)',
                        fontFamily: 'var(--mob-font-head)', fontWeight: 700, fontSize: 13,
                        cursor: pushing ? 'default' : 'pointer', letterSpacing: '0.04em',
                    }}>
                        {pushing ? '···' : '⬆  PUSH'}<br />
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--mob-text-dim)', fontFamily: 'var(--mob-font-body)' }}>Send to device</span>
                    </button>
                </div>

                {/* Export / Import / Erase */}
                <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--mob-border)' }}>
                    <button onClick={exportProject} style={{
                        flex: 1, padding: '10px 6px', background: 'var(--mob-surface-2)', border: '1px solid var(--mob-border)',
                        borderRadius: 10, color: 'var(--mob-text)', fontFamily: 'var(--mob-font-body)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    }}>📤 Export</button>
                    <label style={{
                        flex: 1, padding: '10px 6px', background: 'var(--mob-surface-2)', border: '1px solid var(--mob-border)',
                        borderRadius: 10, color: 'var(--mob-text)', fontFamily: 'var(--mob-font-body)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                        📥 Import
                        <input ref={fileInputRef} type="file" accept=".json" onChange={importProject} style={{ display: 'none' }} />
                    </label>
                    <button onClick={handleErase} style={{
                        flex: 1, padding: '10px 6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 10, color: 'var(--mob-danger)', fontFamily: 'var(--mob-font-body)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    }}>🗑 Erase</button>
                </div>

                {/* WiFi quick info */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--mob-border)' }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--mob-font-head)', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--mob-text-dim)', marginBottom: 6 }}>WIFI</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--mob-font-mono)', color: 'var(--mob-text-muted)' }}>
                        {online ? `${wifiStatus?.ssid} · ${wifiStatus?.ip}` : 'Not connected'}
                    </div>
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{ padding: '10px 16px', background: 'var(--mob-surface-3)', textAlign: 'center', fontSize: 13, fontFamily: 'var(--mob-font-body)', color: 'var(--mob-text)' }}>
                        {toast}
                    </div>
                )}

                <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </div>
        </>
    );
};

// ─── Collapsible section wrapper ─────────────────────────────────────────────
const CollapsibleSection: React.FC<{
    title: string;
    badge?: string | number;
    defaultOpen?: boolean;
    contentHeight: number;
    children: React.ReactNode;
}> = ({ title, badge, defaultOpen = true, contentHeight, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ flexShrink: 0 }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    padding: '0 12px', height: 32, gap: 8,
                    background: 'var(--mob-surface)', border: 'none',
                    borderTop: '1px solid var(--mob-border)',
                    borderBottom: '1px solid var(--mob-border)',
                    cursor: 'pointer', textAlign: 'left',
                }}
            >
                <span style={{
                    fontSize: 9, color: 'var(--mob-text-dim)',
                    transition: 'transform 0.15s',
                    transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
                    display: 'inline-block',
                }}>▼</span>
                <span style={{
                    fontFamily: 'var(--mob-font-head)', fontWeight: 800,
                    fontSize: 9, letterSpacing: '0.1em',
                    color: 'var(--mob-text-dim)', flex: 1,
                }}>{title}</span>
                {badge !== undefined && (
                    <span style={{
                        fontFamily: 'var(--mob-font-mono)', fontSize: 9,
                        color: 'var(--mob-text-dim)', background: 'var(--mob-surface-3)',
                        padding: '2px 6px', borderRadius: 4,
                    }}>{badge}</span>
                )}
            </button>
            {open && (
                <div style={{ height: contentHeight, display: 'flex', flexDirection: 'column' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

// ─── Drag handle between sections ────────────────────────────────────────────
const ResizeHandle: React.FC<{ onDelta: (dy: number) => void }> = ({ onDelta }) => {
    const prevY = useRef<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const onDeltaRef = useRef(onDelta);
    onDeltaRef.current = onDelta;

    const startDrag = useCallback((y: number) => {
        prevY.current = y;
        setDragging(true);
    }, []);

    useEffect(() => {
        if (!dragging) return;
        const onMouseMove = (e: MouseEvent) => {
            if (prevY.current === null) return;
            onDeltaRef.current(e.clientY - prevY.current);
            prevY.current = e.clientY;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (prevY.current === null) return;
            e.preventDefault();
            onDeltaRef.current(e.touches[0].clientY - prevY.current);
            prevY.current = e.touches[0].clientY;
        };
        const stop = () => { prevY.current = null; setDragging(false); };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', stop);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', stop);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', stop);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', stop);
        };
    }, [dragging]);

    return (
        <div
            onMouseDown={e => { e.preventDefault(); startDrag(e.clientY); }}
            onTouchStart={e => startDrag(e.touches[0].clientY)}
            style={{
                height: 12,
                flexShrink: 0,
                background: dragging ? 'var(--mob-accent-dim)' : 'var(--mob-surface-2)',
                borderTop: `1px solid ${dragging ? 'var(--mob-accent)' : 'var(--mob-border)'}`,
                borderBottom: `1px solid ${dragging ? 'var(--mob-accent)' : 'var(--mob-border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'ns-resize',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
                transition: 'background 0.15s, border-color 0.15s',
                zIndex: 10,
            }}
        >
            <div style={{
                width: 36, height: 3, borderRadius: 2,
                background: dragging ? 'var(--mob-accent)' : 'var(--mob-text-dim)',
                transition: 'background 0.15s',
            }} />
        </div>
    );
};

// ─── Main canvas view — Approach A (top canvas, bottom layers + props) ────────
const CanvasView: React.FC<{
    onOpenEditor: () => void;
    onOpenPicker: () => void;
    onOpenScreens: () => void;
    onOpenDevice: () => void;
    wifiStatus: any;
    remoteIp: string;
    setRemoteIp: (ip: string) => void;
}> = ({ onOpenEditor, onOpenPicker, onOpenScreens, onOpenDevice, wifiStatus }) => {
    const ctx = useContext(GridContext) as any;
    if (!ctx) return null;
    const { project, activeScreenId, syncToDevice, pullFromDevice } = ctx;
    const activeScreenName = project?.screens?.find((s: any) => s.id === activeScreenId)?.name || 'Screen';

    const [canvasH, setCanvasH] = useState(250);
    const itemCount = ctx.project?.screens?.find((s: any) => s.id === ctx.activeScreenId)
        ?.pages?.reduce((n: number, p: any) => n + (p.items?.length || 0), 0) ?? 0;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--mob-bg)' }}>

            {/* ── Top bar: screen picker + add widget ── */}
            <div style={{
                display: 'flex', alignItems: 'center', height: 48,
                padding: '0 10px', gap: 8,
                background: 'var(--mob-surface)',
                borderBottom: '1px solid var(--mob-border)',
                flexShrink: 0,
            }}>
                <button onClick={onOpenScreens} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: 'none', cursor: 'pointer',
                    flex: 1, padding: 0, minWidth: 0,
                }}>
                    <span style={{ fontSize: 13 }}>📺</span>
                    <span style={{
                        fontFamily: 'var(--mob-font-head)', fontWeight: 700, fontSize: 13,
                        color: 'var(--mob-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{activeScreenName}</span>
                    <span style={{ fontSize: 10, color: 'var(--mob-text-dim)', flexShrink: 0 }}>▾</span>
                </button>
                <button onClick={onOpenPicker} style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: 'var(--mob-accent)', border: 'none',
                    color: 'white', fontSize: 22, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, lineHeight: 1,
                }}>+</button>
            </div>

            {/* ── Canvas — resizable ── */}
            <div style={{ height: canvasH, flexShrink: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <CanvasArea isMobile={true} />
            </div>

            {/* ── Canvas resize handle ── */}
            <ResizeHandle onDelta={dy => setCanvasH(h => Math.max(80, Math.min(500, h + dy)))} />

            {/* ── Scrollable area: collapsible LAYERS + PROPERTIES ── */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--mob-bg)' }}>
                <CollapsibleSection title="LAYERS" badge={itemCount} contentHeight={160}>
                    <MiniLayerTree />
                </CollapsibleSection>
                <CollapsibleSection title="PROPERTIES" contentHeight={220}>
                    <QuickProps onEditAll={onOpenEditor} />
                </CollapsibleSection>
                <div style={{ height: 8 }} />
            </div>

            {/* ── Device bar — always pinned above bottom nav ── */}
            <DeviceBar
                status={wifiStatus}
                onPull={pullFromDevice}
                onPush={syncToDevice}
                onOpenSheet={onOpenDevice}
            />
        </div>
    );
};

// ─── Root MobileBuilder ───────────────────────────────────────────────────────
export const MobileBuilder: React.FC<MobileBuilderProps> = ({ wifiStatus, remoteIp, setRemoteIp }) => {
    const [mobileView, setMobileView] = useState<MobileView>("canvas");
    const [showPicker, setShowPicker] = useState(false);
    const [showDevice, setShowDevice] = useState(false);

    // Android back button support
    useEffect(() => {
        const onPopState = () => {
            if (mobileView !== 'canvas') {
                setMobileView('canvas');
                history.pushState(null, '');
            }
        };
        history.pushState(null, '');
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [mobileView]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--mob-bg)' }}>
            {mobileView === 'canvas' && (
                <CanvasView
                    onOpenEditor={() => setMobileView('editor')}
                    onOpenPicker={() => setShowPicker(true)}
                    onOpenScreens={() => setMobileView('screenList')}
                    onOpenDevice={() => setShowDevice(true)}
                    wifiStatus={wifiStatus}
                    remoteIp={remoteIp}
                    setRemoteIp={setRemoteIp}
                />
            )}

            {mobileView === 'editor' && (
                <MobileEditor onBack={() => setMobileView('canvas')} />
            )}

            {mobileView === 'screenList' && (
                <ScreenList
                    onBack={() => setMobileView('canvas')}
                    onSelect={() => setMobileView('canvas')}
                />
            )}

            {showPicker && <WidgetPicker onClose={() => setShowPicker(false)} />}

            {showDevice && (
                <DeviceSheet
                    wifiStatus={wifiStatus}
                    remoteIp={remoteIp}
                    setRemoteIp={setRemoteIp}
                    onClose={() => setShowDevice(false)}
                />
            )}
        </div>
    );
};
