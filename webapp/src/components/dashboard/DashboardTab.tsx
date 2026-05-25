import React, { useContext, useState } from "react";
import { GridContext } from "../../context/GridContext";
import { Header } from "../layout/Header";
import { type Project, type PaneGrid, type Pane } from "../../types";

type MobileTab = 'grids' | 'canvas' | 'props';

export const DashboardTab: React.FC<any> = ({ theme, setTheme, activeTab, setActiveTab, wifiStatus, remoteIp, setRemoteIp, isMobile, propsLocation, setPropsLocation }) => {
    const { project, setProject } = useContext(GridContext) as any;

    const paneGrids = project?.paneGrids || [];

    const [selectedGridId, setSelectedGridId] = useState<string | null>(paneGrids[0]?.id || null);
    const [selectedPaneId, setSelectedPaneId] = useState<string | null>(null);
    const [mobileTab, setMobileTab] = useState<MobileTab>('grids');

    const bg = theme === 'dark' ? '#0f172a' : '#f8fafc';
    const border = theme === 'dark' ? '#1e293b' : '#e2e8f0';
    const cardBg = theme === 'dark' ? '#0f172a' : '#ffffff';
    const mutedText = theme === 'dark' ? '#94a3b8' : '#64748b';

    const updateGrid = (id: string, patch: any) => {
        setProject((prev: Project) => ({
            ...prev,
            paneGrids: prev.paneGrids?.map(g => g.id === id ? { ...g, ...patch } : g)
        }));
    };

    const updatePane = (gridId: string, paneId: string, patch: any) => {
        setProject((prev: Project) => ({
            ...prev,
            paneGrids: prev.paneGrids?.map(g => g.id === gridId ? {
                ...g,
                panes: g.panes.map(p => p.id === paneId ? { ...p, ...patch } : p)
            } : g)
        }));
    };

    const addGrid = () => {
        const id = `grid_${Math.random().toString(36).substr(2, 5)}`;
        const newGrid: PaneGrid = {
            id,
            name: `New Dashboard ${paneGrids.length + 1}`,
            cols: 3,
            rows: 3,
            gap: 10,
            panes: []
        };
        setProject((prev: Project) => ({ ...prev, paneGrids: [...(prev.paneGrids || []), newGrid] }));
        setSelectedGridId(id);
        if (isMobile) setMobileTab('canvas');
    };

    const addPane = (gridId: string) => {
        const id = `pane_${Math.random().toString(36).substr(2, 5)}`;
        const newPane: Pane = {
            id,
            title: "New Tile",
            icon: "💡",
            bg: 0x1e293b,
            textColor: 0xffffff
        };
        setProject((prev: Project) => ({
            ...prev,
            paneGrids: prev.paneGrids?.map(g => g.id === gridId ? { ...g, panes: [...g.panes, newPane] } : g)
        }));
    };

    const selectedGrid = paneGrids.find((g: any) => g.id === selectedGridId);

    // ── Sidebar (grid list) ──────────────────────────────────────────────
    const sidebarContent = (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: cardBg }}>
            <div style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ fontWeight: 800, fontSize: '12px', color: mutedText, letterSpacing: '1px' }}>DASHBOARDS</span>
                <button onClick={addGrid} style={{ background: '#6366f1', border: 'none', borderRadius: '4px', color: 'white', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', fontWeight: 700 }}>＋ NEW</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {paneGrids.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: mutedText, fontSize: '12px' }}>No dashboards yet</div>
                )}
                {paneGrids.map((g: any) => (
                    <div
                        key={g.id}
                        onClick={() => { setSelectedGridId(g.id); setSelectedPaneId(null); if (isMobile) setMobileTab('canvas'); }}
                        style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            marginBottom: '4px',
                            cursor: 'pointer',
                            background: selectedGridId === g.id ? (theme === 'dark' ? '#1e293b' : '#f1f5f9') : 'transparent',
                            color: selectedGridId === g.id ? (theme === 'dark' ? 'white' : '#6366f1') : mutedText,
                            fontSize: '13px',
                            fontWeight: selectedGridId === g.id ? 700 : 500,
                            transition: '0.2s'
                        }}
                    >
                        📊 {g.name}
                    </div>
                ))}
            </div>
        </div>
    );

    // ── Canvas ───────────────────────────────────────────────────────────
    const canvasContent = (
        <div style={{ flex: 1, background: theme === 'dark' ? '#020617' : '#f8fafc', overflowY: 'auto', padding: isMobile ? '20px 16px' : '40px', position: 'relative' }}>
            {!selectedGrid ? (
                <div style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme === 'dark' ? '#475569' : '#cbd5e1', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ fontSize: '48px' }}>📊</div>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ color: mutedText, margin: 0, fontSize: '18px' }}>No Dashboard Selected</h2>
                        <p style={{ fontSize: '13px', marginTop: 8 }}>Create a new dashboard to get started.</p>
                    </div>
                </div>
            ) : (
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ color: theme === 'dark' ? 'white' : '#1e293b', margin: 0, fontSize: isMobile ? '18px' : '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedGrid.name}</h1>
                            <div style={{ color: '#6366f1', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>ID: {selectedGrid.id}</div>
                        </div>
                        <button
                            onClick={() => { addPane(selectedGrid.id); if (isMobile) setMobileTab('props'); }}
                            style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: isMobile ? '8px 12px' : '10px 20px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: isMobile ? '11px' : '13px', flexShrink: 0 }}
                        >
                            <span>＋</span> ADD TILE
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${selectedGrid.columns || 3}, 1fr)`,
                        gap: `${selectedGrid.gap || 10}px`
                    }}>
                        {selectedGrid.panes.map((pane: any) => {
                            const isSelected = selectedPaneId === pane.id;
                            return (
                                <div
                                    key={pane.id}
                                    onClick={(e) => { e.stopPropagation(); setSelectedPaneId(pane.id); if (isMobile) setMobileTab('props'); }}
                                    style={{
                                        background: isSelected ? (theme === 'dark' ? '#334155' : '#f1f5f9') : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                                        borderRadius: '16px',
                                        aspectRatio: '1/1',
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'relative',
                                        border: isSelected ? '2px solid #6366f1' : `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                                        boxShadow: theme === 'dark' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
                                        cursor: 'pointer',
                                        transition: '0.2s'
                                    }}
                                >
                                    <div style={{ fontSize: '22px', marginBottom: '8px' }}>{pane.icon}</div>
                                    <div style={{ color: mutedText, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{pane.title}</div>
                                    <div style={{ flex: 1 }}></div>
                                    <div style={{ fontSize: '18px', color: theme === 'dark' ? 'white' : '#1e293b', fontWeight: 800 }}>--</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    // ── Properties panel ─────────────────────────────────────────────────
    const propertiesContent = (
        <div style={{ background: cardBg, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
                <span style={{ fontWeight: 800, fontSize: '12px', color: mutedText, letterSpacing: '1px' }}>PROPERTIES</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {selectedPaneId && selectedGrid ? (() => {
                    const pane = selectedGrid.panes.find((p: any) => p.id === selectedPaneId);
                    if (!pane) return <div style={{ color: '#475569', fontSize: '12px' }}>Pane not found</div>;
                    const inputStyle = { width: '100%', background: theme === 'dark' ? '#111827' : '#ffffff', border: `1px solid ${border}`, borderRadius: '6px', color: theme === 'dark' ? 'white' : '#0f172a', padding: '8px', boxSizing: 'border-box' as const };
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ background: theme === 'dark' ? '#1e293b' : '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${border}` }}>
                                <div style={{ fontSize: '10px', color: '#6366f1', fontWeight: 800, marginBottom: '2px' }}>PANE ID</div>
                                <div style={{ fontFamily: 'monospace', color: theme === 'dark' ? 'white' : '#1e293b', fontSize: '11px' }}>{pane.id}</div>
                            </div>
                            <div>
                                <div style={{ color: mutedText, fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>TITLE</div>
                                <input style={inputStyle} value={pane.title} onChange={e => updatePane(selectedGrid.id, pane.id, { title: e.target.value })} />
                            </div>
                            <div>
                                <div style={{ color: mutedText, fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>ICON / EMOJI</div>
                                <input style={inputStyle} value={pane.icon || ''} onChange={e => updatePane(selectedGrid.id, pane.id, { icon: e.target.value })} />
                            </div>
                            <div>
                                <div style={{ color: mutedText, fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>MQTT STATE TOPIC</div>
                                <input style={inputStyle} placeholder="tele/sensor/STATE" value={pane.mqttStateTopic || ''} onChange={e => updatePane(selectedGrid.id, pane.id, { mqttStateTopic: e.target.value })} />
                            </div>
                            <div>
                                <div style={{ color: mutedText, fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>MQTT COMMAND TOPIC</div>
                                <input style={inputStyle} placeholder="cmnd/switch/POWER" value={pane.mqttTopic || ''} onChange={e => updatePane(selectedGrid.id, pane.id, { mqttTopic: e.target.value })} />
                            </div>
                            <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '4px 0' }} />
                            <button
                                onClick={() => {
                                    if (window.confirm('Delete this tile?')) {
                                        setProject((prev: Project) => ({
                                            ...prev,
                                            paneGrids: prev.paneGrids?.map(g => g.id === selectedGrid.id ? { ...g, panes: g.panes.filter(p => p.id !== pane.id) } : g)
                                        }));
                                        setSelectedPaneId(null);
                                    }
                                }}
                                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 700, cursor: 'pointer', width: '100%' }}
                            >
                                DELETE TILE
                            </button>
                        </div>
                    );
                })() : selectedGrid ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <div style={{ color: mutedText, fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>DASHBOARD NAME</div>
                            <input style={{ width: '100%', background: theme === 'dark' ? '#111827' : '#ffffff', border: `1px solid ${border}`, borderRadius: '6px', color: theme === 'dark' ? 'white' : '#0f172a', padding: '8px', boxSizing: 'border-box' as const }} value={selectedGrid.name} onChange={e => updateGrid(selectedGrid.id, { name: e.target.value })} />
                        </div>
                        <div>
                            <div style={{ color: mutedText, fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>COLUMNS</div>
                            <input type="number" style={{ width: '100%', background: theme === 'dark' ? '#111827' : '#ffffff', border: `1px solid ${border}`, borderRadius: '6px', color: theme === 'dark' ? 'white' : '#0f172a', padding: '8px', boxSizing: 'border-box' as const }} value={selectedGrid.columns || 3} onChange={e => updateGrid(selectedGrid.id, { columns: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div>
                            <div style={{ color: mutedText, fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>GAP (PX)</div>
                            <input type="number" style={{ width: '100%', background: theme === 'dark' ? '#111827' : '#ffffff', border: `1px solid ${border}`, borderRadius: '6px', color: theme === 'dark' ? 'white' : '#0f172a', padding: '8px', boxSizing: 'border-box' as const }} value={selectedGrid.gap || 10} onChange={e => updateGrid(selectedGrid.id, { gap: parseInt(e.target.value) || 0 })} />
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm('Delete this dashboard?')) {
                                    setProject((prev: Project) => ({
                                        ...prev,
                                        paneGrids: prev.paneGrids?.filter(g => g.id !== selectedGrid.id)
                                    }));
                                    setSelectedGridId(null);
                                    if (isMobile) setMobileTab('grids');
                                }
                            }}
                            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '8px' }}
                        >
                            DELETE DASHBOARD
                        </button>
                    </div>
                ) : (
                    <div style={{ color: '#475569', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>Select a tile or dashboard to edit properties.</div>
                )}
            </div>
        </div>
    );

    const MOBILE_TABS: { id: MobileTab; label: string }[] = [
        { id: 'grids', label: 'GRIDS' },
        { id: 'canvas', label: 'CANVAS' },
        { id: 'props', label: 'PROPS' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg }}>
            <Header
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                status={wifiStatus}
                remoteIp={remoteIp}
                setRemoteIp={setRemoteIp}
                isMobile={isMobile}
                theme={theme}
                setTheme={setTheme}
                propsLocation={propsLocation}
                setPropsLocation={setPropsLocation}
            />

            {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    {/* Mobile sub-nav */}
                    <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, background: bg, flexShrink: 0 }}>
                        {MOBILE_TABS.map(({ id, label }) => {
                            const active = mobileTab === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setMobileTab(id)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 0',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        color: active ? '#6366f1' : mutedText,
                                        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                                        transition: 'all 0.15s',
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {/* Mobile sub-tab content */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {mobileTab === 'grids' && <div style={{ flex: 1, overflowY: 'auto' }}>{sidebarContent}</div>}
                        {mobileTab === 'canvas' && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{canvasContent}</div>}
                        {mobileTab === 'props' && <div style={{ flex: 1, overflowY: 'auto' }}>{propertiesContent}</div>}
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: '260px', borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', background: cardBg }}>
                        {sidebarContent}
                    </div>
                    {canvasContent}
                    <div style={{ width: '300px', borderLeft: `1px solid ${border}`, background: cardBg, display: 'flex', flexDirection: 'column' }}>
                        {propertiesContent}
                    </div>
                </div>
            )}
        </div>
    );
};
