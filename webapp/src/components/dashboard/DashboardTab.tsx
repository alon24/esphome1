import React, { useContext, useState } from "react";
import { GridContext } from "../../context/GridContext";
import { Header } from "../layout/Header";
import { type Project, type PaneGrid, type Pane } from "../../types";

export const DashboardTab: React.FC<any> = ({ theme, setTheme, activeTab, setActiveTab, wifiStatus, remoteIp, setRemoteIp, isMobile, propsLocation, setPropsLocation }) => {
    const { project, setProject } = useContext(GridContext) as any;
    const [selectedGridId, setSelectedGridId] = useState<string | null>(project.paneGrids?.[0]?.id || null);
    const [selectedPaneId, setSelectedPaneId] = useState<string | null>(null);

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
            name: `New Dashboard ${project.paneGrids.length + 1}`,
            columns: 3,
            gap: 10,
            panes: []
        };
        setProject((prev: Project) => ({ ...prev, paneGrids: [...(prev.paneGrids || []), newGrid] }));
        setSelectedGridId(id);
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

    const selectedGrid = project.paneGrids?.find((g: any) => g.id === selectedGridId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme === 'dark' ? '#0f172a' : '#f8fafc' }}>
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
            
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Dashboard Sidebar */}
                <div style={{ 
                    width: '260px', 
                    borderRight: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    background: theme === 'dark' ? '#0f172a' : '#ffffff' 
                }}>
                    <div style={{ 
                        padding: '20px', 
                        borderBottom: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center' 
                    }}>
                        <span style={{ fontWeight: 800, fontSize: '12px', color: theme === 'dark' ? '#94a3b8' : '#64748b', letterSpacing: '1px' }}>DASHBOARDS</span>
                        <button onClick={addGrid} style={{ background: '#6366f1', border: 'none', borderRadius: '4px', color: 'white', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}>＋ NEW</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                        {project.paneGrids?.map((g: any) => (
                            <div 
                                key={g.id}
                                onClick={() => setSelectedGridId(g.id)}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    marginBottom: '4px',
                                    cursor: 'pointer',
                                    background: selectedGridId === g.id ? (theme === 'dark' ? '#1e293b' : '#f1f5f9') : 'transparent',
                                    color: selectedGridId === g.id ? (theme === 'dark' ? 'white' : '#6366f1') : (theme === 'dark' ? '#64748b' : '#94a3b8'),
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

                {/* Dashboard Canvas */}
                <div style={{ 
                    flex: 1, 
                    background: theme === 'dark' ? '#020617' : '#f8fafc', 
                    overflowY: 'auto', 
                    padding: '40px', 
                    position: 'relative' 
                }}>
                    {!selectedGrid ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme === 'dark' ? '#475569' : '#cbd5e1', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ fontSize: '48px' }}>📊</div>
                            <div style={{ textAlign: 'center' }}>
                                <h2 style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>No Dashboard Selected</h2>
                                <p>Create a new dashboard grid to start building your Home Assistant panel.</p>
                            </div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                            <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h1 style={{ color: theme === 'dark' ? 'white' : '#1e293b', margin: 0, fontSize: '24px' }}>{selectedGrid.name}</h1>
                                    <div style={{ color: '#6366f1', fontSize: '12px', marginTop: '4px', fontWeight: 'bold' }}>GRID ID: {selectedGrid.id}</div>
                                </div>
                                <button 
                                    onClick={() => addPane(selectedGrid.id)}
                                    style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
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
                                            onClick={(e) => { e.stopPropagation(); setSelectedPaneId(pane.id); }}
                                            style={{
                                                background: isSelected ? (theme === 'dark' ? '#334155' : '#f1f5f9') : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                                                borderRadius: '16px',
                                                aspectRatio: '1/1',
                                                padding: '20px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                position: 'relative',
                                                border: isSelected ? '2px solid #6366f1' : `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                                                boxShadow: theme === 'dark' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
                                                cursor: 'pointer',
                                                transition: '0.2s'
                                            }}
                                        >
                                            <div style={{ fontSize: '24px', marginBottom: '10px' }}>{pane.icon}</div>
                                            <div style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>{pane.title}</div>
                                            <div style={{ flex: 1 }}></div>
                                            <div style={{ fontSize: '20px', color: theme === 'dark' ? 'white' : '#1e293b', fontWeight: 800 }}>--</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Dashboard Properties */}
                <div style={{ 
                    width: '300px', 
                    borderLeft: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, 
                    background: theme === 'dark' ? '#0f172a' : '#ffffff', 
                    display: 'flex', 
                    flexDirection: 'column' 
                }}>
                    <div style={{ 
                        padding: '20px', 
                        borderBottom: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}` 
                    }}>
                        <span style={{ fontWeight: 800, fontSize: '12px', color: theme === 'dark' ? '#94a3b8' : '#64748b', letterSpacing: '1px' }}>PROPERTIES</span>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                        {selectedPaneId && selectedGrid ? (() => {
                            const pane = selectedGrid.panes.find((p: any) => p.id === selectedPaneId);
                            if (!pane) return <div style={{ color: '#475569', fontSize: '12px' }}>Pane not found</div>;
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ 
                                        background: theme === 'dark' ? '#1e293b' : '#f8fafc', 
                                        padding: '12px', 
                                        borderRadius: '8px', 
                                        border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}` 
                                    }}>
                                        <div style={{ fontSize: '10px', color: '#6366f1', fontWeight: 800, marginBottom: '4px' }}>PANE ID</div>
                                        <div style={{ fontFamily: 'monospace', color: theme === 'dark' ? 'white' : '#1e293b', fontSize: '12px' }}>{pane.id}</div>
                                    </div>

                                    <div className="prop-group">
                                        <div className="prop-label" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>TITLE</div>
                                        <input 
                                            style={{ 
                                                width: '100%', 
                                                background: theme === 'dark' ? '#111827' : '#ffffff', 
                                                border: `1px solid ${theme === 'dark' ? '#1e293b' : '#cbd5e1'}`, 
                                                borderRadius: '6px', 
                                                color: theme === 'dark' ? 'white' : '#0f172a', 
                                                padding: '8px' 
                                            }}
                                            value={pane.title} 
                                            onChange={e => updatePane(selectedGrid.id, pane.id, { title: e.target.value })} 
                                        />
                                    </div>

                                    <div className="prop-group">
                                        <div className="prop-label" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>ICON / EMOJI</div>
                                        <input 
                                            style={{ 
                                                width: '100%', 
                                                background: theme === 'dark' ? '#111827' : '#ffffff', 
                                                border: `1px solid ${theme === 'dark' ? '#1e293b' : '#cbd5e1'}`, 
                                                borderRadius: '6px', 
                                                color: theme === 'dark' ? 'white' : '#0f172a', 
                                                padding: '8px' 
                                            }}
                                            value={pane.icon || ''} 
                                            onChange={e => updatePane(selectedGrid.id, pane.id, { icon: e.target.value })} 
                                        />
                                    </div>

                                    <div className="prop-group">
                                        <div className="prop-label" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>MQTT STATE TOPIC</div>
                                        <input 
                                            style={{ 
                                                width: '100%', 
                                                background: theme === 'dark' ? '#111827' : '#ffffff', 
                                                border: `1px solid ${theme === 'dark' ? '#1e293b' : '#cbd5e1'}`, 
                                                borderRadius: '6px', 
                                                color: theme === 'dark' ? 'white' : '#0f172a', 
                                                padding: '8px' 
                                            }}
                                            placeholder="tele/sensor/STATE"
                                            value={pane.mqttStateTopic || ''} 
                                            onChange={e => updatePane(selectedGrid.id, pane.id, { mqttStateTopic: e.target.value })} 
                                        />
                                    </div>

                                    <div className="prop-group">
                                        <div className="prop-label" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>MQTT COMMAND TOPIC</div>
                                        <input 
                                            style={{ 
                                                width: '100%', 
                                                background: theme === 'dark' ? '#111827' : '#ffffff', 
                                                border: `1px solid ${theme === 'dark' ? '#1e293b' : '#cbd5e1'}`, 
                                                borderRadius: '6px', 
                                                color: theme === 'dark' ? 'white' : '#0f172a', 
                                                padding: '8px' 
                                            }}
                                            placeholder="cmnd/switch/POWER"
                                            value={pane.mqttTopic || ''} 
                                            onChange={e => updatePane(selectedGrid.id, pane.id, { mqttTopic: e.target.value })} 
                                        />
                                    </div>

                                    <hr style={{ border: 'none', borderTop: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, margin: '10px 0' }} />

                                    
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
                                        style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        DELETE TILE
                                    </button>
                                </div>
                            );
                        })() : selectedGrid ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className="prop-group">
                                    <div className="prop-label" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>DASHBOARD NAME</div>
                                    <input 
                                        style={{ 
                                            width: '100%', 
                                            background: theme === 'dark' ? '#111827' : '#ffffff', 
                                            border: `1px solid ${theme === 'dark' ? '#1e293b' : '#cbd5e1'}`, 
                                            borderRadius: '6px', 
                                            color: theme === 'dark' ? 'white' : '#0f172a', 
                                            padding: '8px' 
                                        }}
                                        value={selectedGrid.name} 
                                        onChange={e => updateGrid(selectedGrid.id, { name: e.target.value })} 
                                    />
                                </div>
                                <div className="prop-group">
                                    <div className="prop-label" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>COLUMNS</div>
                                    <input 
                                        type="number"
                                        style={{ 
                                            width: '100%', 
                                            background: theme === 'dark' ? '#111827' : '#ffffff', 
                                            border: `1px solid ${theme === 'dark' ? '#1e293b' : '#cbd5e1'}`, 
                                            borderRadius: '6px', 
                                            color: theme === 'dark' ? 'white' : '#0f172a', 
                                            padding: '8px' 
                                        }}
                                        value={selectedGrid.columns || 3} 
                                        onChange={e => updateGrid(selectedGrid.id, { columns: parseInt(e.target.value) || 1 })} 
                                    />
                                </div>
                                <div className="prop-group">
                                    <div className="prop-label" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>GAP (PX)</div>
                                    <input 
                                        type="number"
                                        style={{ 
                                            width: '100%', 
                                            background: theme === 'dark' ? '#111827' : '#ffffff', 
                                            border: `1px solid ${theme === 'dark' ? '#1e293b' : '#cbd5e1'}`, 
                                            borderRadius: '6px', 
                                            color: theme === 'dark' ? 'white' : '#0f172a', 
                                            padding: '8px' 
                                        }}
                                        value={selectedGrid.gap || 10} 
                                        onChange={e => updateGrid(selectedGrid.id, { gap: parseInt(e.target.value) || 0 })} 
                                    />
                                </div>

                                <button 
                                    onClick={() => {
                                        if (window.confirm('Delete this dashboard?')) {
                                            setProject((prev: Project) => ({
                                                ...prev,
                                                paneGrids: prev.paneGrids?.filter(g => g.id !== selectedGrid.id)
                                            }));
                                            setSelectedGridId(null);
                                        }
                                    }}
                                    style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 700, cursor: 'pointer', marginTop: '20px' }}
                                >
                                    DELETE DASHBOARD
                                </button>
                            </div>
                        ) : (
                            <div style={{ color: '#475569', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>Select a tile or dashboard to edit properties.</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
