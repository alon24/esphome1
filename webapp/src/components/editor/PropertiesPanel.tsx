import React, { useContext } from "react";
import { GridContext } from "../../context/GridContext";
import { safeHex } from "../../utils";
import { SMART_COMPONENTS, GridItem, Page, Panel } from "../../types";

const findItemRecursive = (items: GridItem[], id: string): GridItem | undefined => {
    for (const it of items) {
        if (it.id === id) return it;
        if (it.children) {
            const found = findItemRecursive(it.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

export const PropertiesPanel: React.FC = () => {
    const { 
        project, 
        activeScreenId, 
        selections, 
        setSelectedEntity, 
        updateItem, 
        removeItem, 
        addItem, 
        updateScreen, 
        removeScreen, 
        updatePanel, 
        removePanel,
        baseWidth, setBaseWidth,
        baseHeight, setBaseHeight,
        propsLocation,
        theme, setTheme
    } = useContext(GridContext) as any;

    const selectedEntity = selections[activeScreenId];
    const activeScreen = project.screens.find((s: any) => s.id === activeScreenId) || project.screens[0];

    if (!selectedEntity) {
        return (
            <div className={`props-panel open loc-${propsLocation}`}>
                <div className="props-inner">
                    <div className="props-header">
                        <div className="props-header-text">
                            <div className="props-title">Screen Settings</div>
                            <div className="props-entity">
                                {activeScreen.name} <span className="entity-type-badge">ACTIVE SCREEN</span>
                            </div>
                        </div>
                    </div>
                    <div className="props-body">
                        <div className="prop-group">
                            <div className="prop-label">Screen Name</div>
                            <input className="prop-input" value={activeScreen.name} onChange={e => updateScreen(activeScreenId, { name: e.target.value })} />
                        </div>
                        <div className="prop-group">
                            <div className="prop-label">Background Color</div>
                            <div className="prop-color">
                                <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-scr-bg-def" value={`#${safeHex(activeScreen.bg)}`} onChange={e => updateScreen(activeScreenId, { bg: parseInt(e.target.value.substring(1), 16) })} />
                                <label htmlFor="cp-scr-bg-def" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                    <div className="color-swatch" style={{ background: `#${safeHex(activeScreen.bg)}` }}></div>
                                    <span className="color-val">#{safeHex(activeScreen.bg)}</span>
                                </label>
                            </div>
                        </div>
                        <hr className="prop-divider" />
                        <div className="prop-group">
                            <div className="prop-label">Canvas Width (px)</div>
                            <input className="prop-input" type="number" value={baseWidth} onChange={e => setBaseWidth(parseInt(e.target.value) || 1)} />
                        </div>
                        <div className="prop-group">
                            <div className="prop-label">Canvas Height (px)</div>
                            <input className="prop-input" type="number" value={baseHeight} onChange={e => setBaseHeight(parseInt(e.target.value) || 1)} />
                        </div>
                        <hr className="prop-divider" />
                        <div className="prop-group">
                            <div className="prop-label">Editor Theme</div>
                            <select className="prop-input" value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark')}>
                                <option value="light">☀️ Light mode</option>
                                <option value="dark">🌙 Dark mode</option>
                            </select>
                        </div>
                        <hr className="prop-divider" />
                        <button 
                            className="prop-input" 
                            style={{ color: "#ef4444", borderColor: "#ef4444", cursor: "pointer", background: "#fff", border: '2px solid #ef4444' }}
                            onClick={() => { if(window.confirm("Reseting project will clear all screens and panels. Continue?")) window.location.reload(); }}
                        >
                            ⚠️ RESET PROJECT
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    let title = "";
    let type = "";
    let content = null;

    let item: any = null;
    let page: any = null;

    if (selectedEntity?.type === 'item' && selectedEntity.pageId) {
        const pan = project.panels.find((p: any) => p.id === selectedEntity.pageId);
        if (pan) {
            page = pan;
            item = pan.elements.find((e: any) => e.id === selectedEntity.id) || null;
        } else {
            const screen = project.screens.find((s: any) => s.id === activeScreenId);
            const pg = screen?.pages.find((p: any) => p.id === selectedEntity.pageId);
            if (pg) {
                page = pg;
                item = findItemRecursive(pg.items, selectedEntity.id);
            }
        }
    } else if (selectedEntity?.type === 'page') {
        const screen = project.screens.find((s: any) => s.id === activeScreenId);
        page = screen?.pages.find((p: any) => p.id === selectedEntity.id) || null;
    } else if (selectedEntity?.type === 'panel') {
        page = project.panels.find((p: any) => p.id === selectedEntity.id) || null;
    }

    if (selectedEntity.type === 'item') {
        if (!item) return null;

        title = item.name;
        type = item.type.toUpperCase();

        content = (
            <>
                <div className="prop-group">
                    <div className="prop-label">Name / ID</div>
                    <input className="prop-input" value={item.name} onChange={e => updateItem(selectedEntity.pageId, item.id, { name: e.target.value })} />
                </div>

                {item.type !== "menu-item" && item.type !== "nav-item" && (
                    <>
                        <div className="prop-row">
                            <div className="prop-group"><div className="prop-label">X</div><input className="prop-input" type="number" value={item.x} onChange={e => updateItem(selectedEntity.pageId, item.id, { x: parseInt(e.target.value) || 0 })} /></div>
                            <div className="prop-group"><div className="prop-label">Y</div><input className="prop-input" type="number" value={item.y} onChange={e => updateItem(selectedEntity.pageId, item.id, { y: parseInt(e.target.value) || 0 })} /></div>
                        </div>
                        <div className="prop-row">
                            <div className="prop-group"><div className="prop-label">Width</div><input className="prop-input" type="number" value={item.width} onChange={e => updateItem(selectedEntity.pageId, item.id, { width: parseInt(e.target.value) || 0 })} /></div>
                            <div className="prop-group"><div className="prop-label">Height</div><input className="prop-input" type="number" value={item.height} onChange={e => updateItem(selectedEntity.pageId, item.id, { height: parseInt(e.target.value) || 0 })} /></div>
                        </div>
                    </>
                )}

                <hr className="prop-divider" />

                <div className="prop-row">
                    <div className="prop-group">
                        <div className="prop-label">Font Size</div>
                        <input className="prop-input" type="number" value={item.fontSize || 16} onChange={e => updateItem(selectedEntity.pageId, item.id, { fontSize: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Alignment</div>
                        <select className="prop-input" value={item.textAlign || "center"} onChange={e => updateItem(selectedEntity.pageId, item.id, { textAlign: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </div>

                {["roller", "dropdown"].includes(item.type) && (
                    <div className="prop-group">
                        <div className="prop-label">Options (New line separated)</div>
                        <textarea 
                            className="prop-input" 
                            style={{ height: '80px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }} 
                            value={item.options || "Option 1\nOption 2\nOption 3"} 
                            onChange={e => updateItem(selectedEntity.pageId, item.id, { options: e.target.value })} 
                        />
                    </div>
                )}

                {item.type === "nav-menu" && (
                     <div className="prop-group">
                        <div className="prop-label">Menu Items (Children)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                            {(item.children || []).map((child: any) => (
                                <div key={child.id} style={{ display: 'flex', gap: '5px' }}>
                                    <input 
                                        className="prop-input" 
                                        value={child.name} 
                                        style={{ height: '28px', fontSize: '11px', flex: 1 }}
                                        onChange={e => {
                                            const newChildren = (item.children || []).map((c: any) => c.id === child.id ? { ...c, name: e.target.value } : c);
                                            updateItem(selectedEntity.pageId, item.id, { children: newChildren });
                                        }}
                                    />
                                    <button 
                                        className="prop-input" 
                                        style={{ width: '40px', padding: 0, flexShrink: 0, color: '#ef4444', height: '36px', background: '#fff', border: '2px solid #fecaca' }}
                                        onClick={() => {
                                            const newChildren = (item.children || []).filter((c: any) => c.id !== child.id);
                                            updateItem(selectedEntity.pageId, item.id, { children: newChildren });
                                        }}
                                    >✕</button>
                                </div>
                            ))}
                            <button 
                                    className="sync-btn" 
                                    style={{ width: '100%', marginTop: '5px', background: '#6d28d9', color: '#fff', border: '2px solid #6d28d9' }}
                                    onClick={() => {
                                        const newItem = { id: `m_${Math.random().toString(36).substr(2, 5)}`, name: 'New Item', type: 'menu-item' as const, radius: 8, fontSize: 13 };
                                        updateItem(selectedEntity.pageId!, item!.id, { children: [...(item!.children || []), newItem] });
                                    }}
                                >
                                    ＋ Add Menu Item
                                </button>
                        </div>
                    </div>
                )}

                <div className="prop-row">
                     <div className="prop-group">
                        <div className="prop-label">Background</div>
                        <div className="prop-color">
                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-bg" value={`#${safeHex(item.color)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { color: parseInt(e.target.value.substring(1), 16) })} />
                            <label htmlFor="cp-bg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                <div className="color-swatch" style={{ background: `#${safeHex(item.color)}`, border: '1px solid #ddd' }}></div>
                                <span className="color-val">#{safeHex(item.color)}</span>
                            </label>
                        </div>
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Text Color</div>
                        <div className="prop-color">
                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-fg" value={`#${safeHex(item.textColor)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { textColor: parseInt(e.target.value.substring(1), 16) })} />
                            <label htmlFor="cp-fg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                <div className="color-swatch" style={{ background: `#${safeHex(item.textColor)}`, border: '1px solid #ddd' }}></div>
                                <span className="color-val">#{safeHex(item.textColor)}</span>
                            </label>
                        </div>
                    </div>
                </div>

                {["arc", "slider", "bar"].includes(item.type) && (
                    <div className="prop-row">
                        <div className="prop-group"><div className="prop-label">Min</div><input className="prop-input" type="number" value={item.min || 0} onChange={e => updateItem(selectedEntity.pageId, item.id, { min: parseInt(e.target.value) || 0 })} /></div>
                        <div className="prop-group"><div className="prop-label">Max</div><input className="prop-input" type="number" value={item.max || 100} onChange={e => updateItem(selectedEntity.pageId, item.id, { max: parseInt(e.target.value) || 0 })} /></div>
                    </div>
                )}

                <div className="prop-group">
                    <div className="prop-label">MQTT Topic</div>
                    <input className="prop-input" value={item.mqttTopic || ""} placeholder="sensor/value" onChange={e => updateItem(selectedEntity.pageId, item.id, { mqttTopic: e.target.value })} />
                </div>

                <hr className="prop-divider" />
                <div className="prop-group">
                    <div className="prop-label">Interaction Action</div>
                    <select 
                        className="prop-input" 
                        value={item.action?.split(':')[0] || "none"} 
                        onChange={e => {
                            const newType = e.target.value;
                            if (newType === "none") updateItem(selectedEntity.pageId, item.id, { action: "" });
                            else if (newType === "screen") {
                                const firstScreen = project.screens[0];
                                updateItem(selectedEntity.pageId, item.id, { action: `screen:${firstScreen.id}` });
                            } else {
                                updateItem(selectedEntity.pageId, item.id, { action: `${newType}:` });
                            }
                        }}
                    >
                        <option value="none">None (No action)</option>
                        <option value="screen">Navigate to Screen</option>
                        <option value="url">Open Web URL</option>
                        <option value="mqtt">MQTT Publish</option>
                    </select>
                </div>

                {item.action?.startsWith("screen:") && (
                    <div className="prop-group">
                        <div className="prop-label">Target Screen</div>
                        <select 
                            className="prop-input" 
                            value={item.action.split(":")[1]} 
                            onChange={e => updateItem(selectedEntity.pageId, item.id, { action: `screen:${e.target.value}` })}
                        >
                            {project.screens.map((scr: any) => (
                                <option key={scr.id} value={scr.id}>{scr.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {item.action?.startsWith("url:") && (
                    <div className="prop-group">
                        <div className="prop-label">URL Address</div>
                        <input 
                            className="prop-input" 
                            value={item.action.split(":")[1]} 
                            placeholder="https://google.com"
                            onChange={e => updateItem(selectedEntity.pageId, item.id, { action: `url:${e.target.value}` })} 
                        />
                    </div>
                )}

                <div style={{ marginTop: '15px', borderTop: '2px dashed #f1f5f9', paddingTop: '15px' }}>
                    <button 
                        className="prop-input" 
                        style={{ color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff", fontWeight: 'bold', border: '2px solid #fecaca' }}
                        onClick={() => removeItem(selectedEntity.pageId, item.id)}
                    >
                        ✕ DELETE WIDGET
                    </button>
                </div>
            </>
        );
    } else if (selectedEntity.type === 'page') {
        const page = activeScreen.pages.find((p: any) => p.id === selectedEntity.id);
        if (!page) return null;
        title = page.name;
        type = "PAGE";
        content = (
             <div className="prop-group">
                <div className="prop-label">Page Name</div>
                <input className="prop-input" value={page.name} readOnly />
                <div style={{fontSize:'12px', color:'#94a3b8', marginTop:'10px'}}>Use the Layers tree to rename pages (Double-click).</div>
            </div>
        );
    } else if (selectedEntity.type === 'screen') {
        title = activeScreen.name;
        type = "SCREEN";
        content = (
            <>
                <div className="prop-group">
                    <div className="prop-label">Screen Name</div>
                    <input className="prop-input" value={activeScreen.name} onChange={e => updateScreen(activeScreenId, { name: e.target.value })} />
                </div>
                <div className="prop-group">
                    <div className="prop-label">Background Color</div>
                    <div className="prop-color">
                        <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-scr-bg" value={`#${safeHex(activeScreen.bg)}`} onChange={e => updateScreen(activeScreenId, { bg: parseInt(e.target.value.substring(1), 16) })} />
                        <label htmlFor="cp-scr-bg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                            <div className="color-swatch" style={{ background: `#${safeHex(activeScreen.bg)}` }}></div>
                            <span className="color-val">#{safeHex(activeScreen.bg)}</span>
                        </label>
                    </div>
                </div>
                {activeScreenId !== 'main' && (
                    <button 
                        className="prop-input" 
                        style={{ marginTop: '20px', color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff", border: '2px solid #fecaca' }}
                        onClick={() => removeScreen(activeScreenId)}
                    >
                        ✕ DELETE SCREEN
                    </button>
                )}
            </>
        );
    } else if (selectedEntity.type === 'panel') {
        const pan = project.panels.find((p: any) => p.id === selectedEntity.id);
        if (!pan) return null;
        title = pan.name;
        type = "MASTER PANEL";
        content = (
            <>
                <div className="prop-group">
                    <div className="prop-label">Panel Name</div>
                    <input className="prop-input" value={pan.name} onChange={e => updatePanel(pan.id, { name: e.target.value })} />
                </div>
                <div className="prop-row">
                    <div className="prop-group"><div className="prop-label">Width</div><input className="prop-input" type="number" value={pan.width} onChange={e => updatePanel(pan.id, { width: parseInt(e.target.value) || 0 })} /></div>
                    <div className="prop-group"><div className="prop-label">Height</div><input className="prop-input" type="number" value={pan.height} onChange={e => updatePanel(pan.id, { height: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <div className="prop-group">
                    <div className="prop-label">Background Color</div>
                    <div className="prop-color">
                        <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-pan-bg" value={`#${safeHex(pan.bg)}`} onChange={e => updatePanel(pan.id, { bg: parseInt(e.target.value.substring(1), 16) })} />
                        <label htmlFor="cp-pan-bg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                            <div className="color-swatch" style={{ background: `#${safeHex(pan.bg)}` }}></div>
                            <span className="color-val">#{safeHex(pan.bg)}</span>
                        </label>
                    </div>
                </div>
                 <button 
                    className="prop-input" 
                    style={{ marginTop: '20px', color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff", border: '2px solid #fecaca' }}
                    onClick={() => removePanel(pan.id)}
                >
                    ✕ DELETE PANEL
                </button>
            </>
        );
    } else if (selectedEntity.type === 'component') {
        const comp = SMART_COMPONENTS.find(c => c.id === selectedEntity.id);
        if (!comp) return null;
        title = comp.label;
        type = "NATIVE COMP";
        content = (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div style={{ background: "#f5f3ff", padding: "12px", borderRadius: "10px", color: "#6d28d9", fontSize: "12px", fontWeight: 600 }}>
                    {comp.desc}
                </div>
                <div className="prop-group">
                    <div className="prop-label">Native ID</div>
                    <code style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: "4px", fontSize: "11px" }}>{comp.id}</code>
                </div>
                <p style={{fontSize:'12px', color:'#64748b'}}>Double-click this component in the Palette to add it to your screen.</p>
            </div>
        );
    }

    return (
        <div className={`props-panel open loc-${propsLocation}`}>
            <div className="props-inner">
                <div className="props-header">
                    <div className="props-header-text">
                        <div className="props-title">Properties</div>
                        <div className="props-entity">
                            {title} <span className="entity-type-badge">{type}</span>
                        </div>
                    </div>
                    <button className="props-close" onClick={() => setSelectedEntity(null)}>✕</button>
                </div>
                <div className="props-body">
                    {content}
                </div>
            </div>
        </div>
    );
};
