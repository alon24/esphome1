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
    const context = useContext(GridContext) as any;
    if (!context) return null;

    const { 
        project, 
        activeScreenId, 
        selectedEntity,
        setSelectedEntity, 
        updateItem, 
        removeItem, 
        updateScreen, 
        removeScreen, 
        updatePanel, 
        removePanel,
        baseWidth, setBaseWidth,
        baseHeight, setBaseHeight,
        propsLocation,
        theme, setTheme
    } = context;

    const activeScreen = project?.screens?.find((s: any) => s.id === activeScreenId) || project?.screens?.[0];

    // Debugging (Remove in production)
    // console.log("PropertiesPanel Render:", { selectedEntity, activeScreenId });

    if (!selectedEntity) {
        if (!activeScreen) return <div className="props-panel open">No Active Screen</div>;
        return (
            <div className={`props-panel open loc-${propsLocation || 'left'}`}>
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

    if (selectedEntity.type === 'item' && selectedEntity.pageId) {
        const pan = project?.panels?.find((p: any) => p.id === selectedEntity.pageId);
        if (pan) {
            page = pan;
            item = pan.elements.find((e: any) => e.id === selectedEntity.id) || null;
        } else {
            const screen = project?.screens?.find((s: any) => s.id === activeScreenId);
            const pg = screen?.pages.find((p: any) => p.id === selectedEntity.pageId);
            if (pg) {
                page = pg;
                item = findItemRecursive(pg.items, selectedEntity.id);
            }
        }
    } else if (selectedEntity.type === 'page') {
        const screen = project?.screens?.find((s: any) => s.id === activeScreenId);
        page = screen?.pages.find((p: any) => p.id === selectedEntity.id) || null;
    } else if (selectedEntity.type === 'panel') {
        page = project?.panels?.find((p: any) => p.id === selectedEntity.id) || null;
    }

    if (selectedEntity.type === 'item') {
        if (!item) return <div className="props-panel open">Item Not Found</div>;
        title = item.name;
        type = item.type.toUpperCase();
        content = (
            <>
                <div className="prop-group">
                    <div className="prop-label">Name / ID</div>
                    <input className="prop-input" value={item.name} onChange={e => updateItem(selectedEntity.pageId, item.id, { name: e.target.value })} />
                </div>
                <div className="prop-row">
                    <div className="prop-group"><div className="prop-label">X</div><input className="prop-input" type="number" value={item.x} onChange={e => updateItem(selectedEntity.pageId, item.id, { x: parseInt(e.target.value) || 0 })} /></div>
                    <div className="prop-group"><div className="prop-label">Y</div><input className="prop-input" type="number" value={item.y} onChange={e => updateItem(selectedEntity.pageId, item.id, { y: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <div className="prop-row">
                    <div className="prop-group"><div className="prop-label">Width</div><input className="prop-input" type="number" value={item.width} onChange={e => updateItem(selectedEntity.pageId, item.id, { width: parseInt(e.target.value) || 0 })} /></div>
                    <div className="prop-group"><div className="prop-label">Height</div><input className="prop-input" type="number" value={item.height} onChange={e => updateItem(selectedEntity.pageId, item.id, { height: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <hr className="prop-divider" />
                <div className="prop-row">
                    <div className="prop-group">
                        <div className="prop-label">Background Color</div>
                        <div className="prop-color">
                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-item-bg" value={`#${safeHex(item.color)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { color: parseInt(e.target.value.substring(1), 16) })} />
                            <label htmlFor="cp-item-bg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                <div className="color-swatch" style={{ background: `#${safeHex(item.color)}` }}></div>
                                <span className="color-val">#{safeHex(item.color)}</span>
                            </label>
                        </div>
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Text Color</div>
                        <div className="prop-color">
                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-item-txt" value={`#${safeHex(item.textColor)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { textColor: parseInt(e.target.value.substring(1), 16) })} />
                            <label htmlFor="cp-item-txt" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                <div className="color-swatch" style={{ background: `#${safeHex(item.textColor)}` }}></div>
                                <span className="color-val">#{safeHex(item.textColor)}</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div className="prop-row">
                    <div className="prop-group">
                        <div className="prop-label">Font Size</div>
                        <input className="prop-input" type="number" value={item.fontSize || 16} onChange={e => updateItem(selectedEntity.pageId, item.id, { fontSize: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Alignment</div>
                        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                            {['left', 'center', 'right'].map(align => (
                                <button 
                                    key={align}
                                    onClick={() => updateItem(selectedEntity.pageId, item.id, { textAlign: align })}
                                    style={{ 
                                        flex: 1, 
                                        padding: '6px', 
                                        border: 'none', 
                                        borderRadius: '6px', 
                                        background: (item.textAlign || 'center') === align ? 'white' : 'transparent',
                                        boxShadow: (item.textAlign || 'center') === align ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: (item.textAlign || 'center') === align ? 'bold' : 'normal',
                                        color: (item.textAlign || 'center') === align ? '#6366f1' : '#64748b',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {align.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="prop-row">
                    <div className="prop-group">
                        <div className="prop-label">Border Width</div>
                        <input className="prop-input" type="number" value={item.borderWidth || 0} onChange={e => updateItem(selectedEntity.pageId, item.id, { borderWidth: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Border Color</div>
                        <div className="prop-color">
                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-item-border" value={`#${safeHex(item.borderColor)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { borderColor: parseInt(e.target.value.substring(1), 16) })} />
                            <label htmlFor="cp-item-border" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                <div className="color-swatch" style={{ background: `#${safeHex(item.borderColor)}` }}></div>
                                <span className="color-val">#{safeHex(item.borderColor)}</span>
                            </label>
                        </div>
                    </div>
                </div>
                {(item.type === 'nav-item' || item.type === 'menu-item' || item.type === 'btn') && (
                    <div className="prop-group" style={{marginTop:'10px'}}>
                        <div className="prop-label">Target Screen</div>
                        <select 
                            className="prop-input" 
                            value={item.targetScreenId || ''} 
                            onChange={e => updateItem(selectedEntity.pageId, item.id, { targetScreenId: e.target.value })}
                        >
                            <option value="">(None)</option>
                            {project.screens.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <button 
                    className="prop-input" 
                    style={{ marginTop: '20px', color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff", border: '2px solid #fecaca' }}
                    onClick={() => removeItem(selectedEntity.pageId, item.id)}
                >
                    ✕ DELETE WIDGET
                </button>
            </>
        );
    } else if (selectedEntity.type === 'page') {
        if (!page) return <div className="props-panel open">Page Not Found</div>;
        title = page.name;
        type = "PAGE";
        content = (
             <div className="prop-group">
                <div className="prop-label">Page Name</div>
                <input className="prop-input" value={page.name} readOnly />
            </div>
        );
    } else if (selectedEntity.type === 'screen') {
        if (!activeScreen) return null;
        title = activeScreen.name;
        type = "SCREEN";
        content = (
            <>
                <div className="prop-group">
                    <div className="prop-label">Screen Name</div>
                    <input className="prop-input" value={activeScreen.name} onChange={e => updateScreen(activeScreenId, { name: e.target.value })} />
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
        const pan = project?.panels?.find((p: any) => p.id === selectedEntity.id);
        if (!pan) return <div className="props-panel open">Panel Not Found</div>;
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
    }

    return (
        <div className={`props-panel open loc-${propsLocation || 'left'}`}>
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
