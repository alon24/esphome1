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

    const screenSelections = context.selections[activeScreenId] || [];
    const isMulti = screenSelections.length > 1;
    const activeSelection = screenSelections.length > 0 ? screenSelections[screenSelections.length - 1] : null;

    if (isMulti) {
        const align = (dir: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => context.alignSelection(dir);
        return (
            <div className={`props-panel open loc-${propsLocation || 'left'}`}>
                <div className="props-inner">
                    <div className="props-header">
                        <div className="props-header-text">
                            <div className="props-title">Bulk Editing</div>
                            <div className="props-entity">
                                {screenSelections.length} Widgets Selected
                            </div>
                        </div>
                    </div>
                    <div className="props-body">
                        <div className="props-subtitle" style={{marginTop:'0', fontSize:'11px', fontWeight:900, color:'#6366f1', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'15px', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>Align Objects</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                             <button onClick={() => align('left')} className="align-btn">
                                 <svg style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2v20M8 6h10a2 2 0 012 2v2a2 2 0 01-2 2H8M8 14h6a2 2 0 012 2v2a2 2 0 01-2 2H8" /></svg>
                                 Align Left
                             </button>
                             <button onClick={() => align('right')} className="align-btn">
                                 <svg style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 2v20M16 6H6a2 2 0 00-2 2v2a2 2 0 002 2h10M16 14h-6a2 2 0 00-2 2v2a2 2 0 002 2h6" /></svg>
                                 Align Right
                             </button>
                             <button onClick={() => align('top')} className="align-btn">
                                 <svg style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4h20M6 8v10a2 2 0 002 2h2a2 2 0 002-2V8M14 8v6a2 2 0 002 2h2a2 2 0 002-2V8" /></svg>
                                 Align Top
                             </button>
                             <button onClick={() => align('bottom')} className="align-btn">
                                 <svg style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h20M6 16V6a2 2 0 012-2h2a2 2 0 012 2v10M14 16v-6a2 2 0 012-2h2a2 2 0 012 2v6" /></svg>
                                 Align Bottom
                             </button>
                             <button onClick={() => align('centerH')} className="align-btn">
                                 <svg style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M8 6h8a2 2 0 012 2v2a2 2 0 01-2 2H8M10 14h4a2 2 0 012 2v2a2 2 0 01-2 2h-4" /></svg>
                                 Center H
                             </button>
                             <button onClick={() => align('centerV')} className="align-btn">
                                 <svg style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M6 8v8a2 2 0 002 2h2a2 2 0 002-2V8M14 10v4a2 2 0 002 2h2a2 2 0 002-2v-4" /></svg>
                                 Center V
                             </button>
                        </div>

                        <div className="props-subtitle" style={{marginTop:'20px', fontSize:'11px', fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>Group Actions</div>
                        <button 
                            className="prop-input" 
                            style={{ color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff", border: '2px solid #fecaca' }}
                            onClick={() => {
                                if (confirm(`Delete ${screenSelections.length} widgets?`)) {
                                    screenSelections.forEach((s: any) => removeItem(s.pageId, s.id));
                                }
                            }}
                        >
                            ✕ DELETE SELECTION
                        </button>
                    </div>
                </div>
                <style>{`
                    .align-btn {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        padding: 10px;
                        border-radius: 10px;
                        font-size: 11px;
                        font-weight: 700;
                        color: #475569;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .align-btn:hover {
                        background: #f8fafc;
                        border-color: #6366f1;
                        color: #6366f1;
                        transform: translateY(-1px);
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    }
                    .align-btn svg { opacity: 0.6; }
                    .align-btn:hover svg { opacity: 1; }
                `}</style>
            </div>
        );
    }

    if (!activeSelection) {
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
                <div className="prop-group" style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                    <div className="prop-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>WIDGET ID</span>
                        <button 
                            onClick={() => { navigator.clipboard.writeText(item.id); alert('ID Copied!'); }}
                            style={{ fontSize: '9px', padding: '2px 6px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            COPY
                        </button>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6366f1', marginTop: '4px', fontWeight: 'bold' }}>{item.id}</div>
                </div>

                <div className="prop-group">
                    <div className="prop-label">Name / ID</div>
                    <input className="prop-input" value={item.name} onChange={e => updateItem(selectedEntity.pageId, item.id, { name: e.target.value })} />
                </div>
                <div className="prop-row">
                    <div className="prop-group"><div className="prop-label">X</div><input className="prop-input" type="number" value={item.x} onChange={e => updateItem(selectedEntity.pageId, item.id, { x: parseInt(e.target.value) || 0 })} /></div>
                    <div className="prop-group"><div className="prop-label">Y</div><input className="prop-input" type="number" value={item.y} onChange={e => updateItem(selectedEntity.pageId, item.id, { y: parseInt(e.target.value) || 0 })} /></div>
                </div>
                {(item.parentId || item.type === 'grid-item') && (
                    <div className="prop-row" style={{marginTop:'8px'}}>
                        <div className="prop-group"><div className="prop-label">Column</div><input className="prop-input" type="number" value={item.col || 0} onChange={e => updateItem(selectedEntity.pageId, item.id, { col: parseInt(e.target.value) || 0 })} /></div>
                        <div className="prop-group"><div className="prop-label">Row</div><input className="prop-input" type="number" value={item.row || 0} onChange={e => updateItem(selectedEntity.pageId, item.id, { row: parseInt(e.target.value) || 0 })} /></div>
                    </div>
                )}
                <div className="prop-row">
                    <div className="prop-group"><div className="prop-label">Width</div><input className="prop-input" type="number" value={item.width} onChange={e => updateItem(selectedEntity.pageId, item.id, { width: parseInt(e.target.value) || 0 })} /></div>
                    <div className="prop-group"><div className="prop-label">Height</div><input className="prop-input" type="number" value={item.height} onChange={e => updateItem(selectedEntity.pageId, item.id, { height: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <hr className="prop-divider" />
                <div className="prop-row">
                    <div className="prop-group">
                        <div className="prop-label">Background Color</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="prop-color" style={{ flex: 1, opacity: item.noBg ? 0.3 : 1, pointerEvents: item.noBg ? 'none' : 'auto' }}>
                                <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-item-bg" value={`#${safeHex(item.color)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { color: parseInt(e.target.value.substring(1), 16) })} />
                                <label htmlFor="cp-item-bg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                    <div className="color-swatch" style={{ background: `#${safeHex(item.color)}` }}></div>
                                    <span className="color-val">#{safeHex(item.color)}</span>
                                </label>
                            </div>
                            <button 
                                onClick={() => updateItem(selectedEntity.pageId, item.id, { noBg: !item.noBg })}
                                style={{ 
                                    padding: '6px 10px', 
                                    fontSize: '10px', 
                                    borderRadius: '6px', 
                                    border: '1px solid #e2e8f0',
                                    background: item.noBg ? '#6366f1' : 'white',
                                    color: item.noBg ? 'white' : '#64748b',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                {item.noBg ? 'TRANSPARENT' : 'SOLID'}
                            </button>
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

                <div className="props-subtitle" style={{marginTop:'20px', fontSize:'11px', fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>Actions</div>
                <div className="prop-group">
                    <div className="prop-label">Navigate to Screen</div>
                    <select 
                        className="prop-input" 
                        value={item.targetScreenId || ''} 
                        onChange={e => updateItem(selectedEntity.pageId, item.id, { targetScreenId: e.target.value, onClick: e.target.value ? `scr:${e.target.value}` : '' })}
                    >
                        <option value="">None</option>
                        {project?.screens?.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="prop-group" style={{marginTop:'8px'}}>
                    <div className="prop-label">Code Function Call</div>
                    <input 
                        className="prop-input" 
                        placeholder="e.g. toggle_light" 
                        value={item.onClick?.startsWith('fn:') ? item.onClick.substring(3) : ''} 
                        onChange={e => updateItem(selectedEntity.pageId, item.id, { onClick: e.target.value ? `fn:${e.target.value}` : '' })} 
                    />
                    <div style={{fontSize:'9px', color:'#94a3b8', marginTop:'2px'}}>Triggers a custom method in C++</div>
                </div>



                {item.type === 'chart' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                        <div className="prop-group">
                            <div className="prop-label">Chart Type</div>
                            <select 
                                className="prop-input" 
                                value={item.chartType || 'line'} 
                                onChange={e => updateItem(selectedEntity.pageId, item.id, { chartType: e.target.value })}
                            >
                                <option value="line">Line Chart</option>
                                <option value="area">Area Chart</option>
                                <option value="bar">Bar Chart</option>
                                <option value="scatter">Scatter Plot</option>
                            </select>
                        </div>
                        <div className="prop-group">
                            <div className="prop-label">Data Points to Keep</div>
                            <input 
                                className="prop-input" 
                                type="number" 
                                value={item.chartPoints || 20} 
                                onChange={e => updateItem(selectedEntity.pageId, item.id, { chartPoints: parseInt(e.target.value) || 1 })} 
                            />
                        </div>
                        <div className="prop-row">
                            <div className="prop-group">
                                <div className="prop-label">Primary Color</div>
                                <div className="prop-color">
                                    <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-chart-p" value={`#${safeHex(item.chartColor || item.color)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { chartColor: parseInt(e.target.value.substring(1), 16) })} />
                                    <label htmlFor="cp-chart-p" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                        <div className="color-swatch" style={{ background: `#${safeHex(item.chartColor || item.color)}` }}></div>
                                        <span className="color-val">#{safeHex(item.chartColor || item.color)}</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="props-subtitle" style={{marginTop:'20px', fontSize:'11px', fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>Visuals & Icons</div>

                <div className="prop-group">
                    <div className="prop-label">Icon / Emoji</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            className="prop-input" 
                            placeholder="Emoji or /path/to/image.png" 
                            value={item.icon || ''} 
                            onChange={e => updateItem(selectedEntity.pageId, item.id, { icon: e.target.value })} 
                        />
                        <button 
                            className="prop-input"
                            style={{ width: '40px', padding: 0 }}
                            onClick={() => updateItem(selectedEntity.pageId, item.id, { icon: '' })}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="props-subtitle" style={{marginTop:'20px', fontSize:'11px', fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>MQTT Bindings</div>

                <div className="prop-group">
                    <div className="prop-label">Command Topic (Publish)</div>
                    <input className="prop-input" placeholder="e.g. cmnd/light/POWER" value={item.mqttTopic || ''} onChange={e => updateItem(selectedEntity.pageId, item.id, { mqttTopic: e.target.value })} />
                </div>
                <div className="prop-group">
                    <div className="prop-label">State Topic (Subscribe)</div>
                    <input className="prop-input" placeholder="e.g. stat/light/POWER" value={item.mqttStateTopic || ''} onChange={e => updateItem(selectedEntity.pageId, item.id, { mqttStateTopic: e.target.value })} />
                </div>

                {(item.type === 'grid' || item.type === 'pane-grid' || item.type === 'grid-item' || item.type === 'label') && (
                    <>
                        <div className="props-subtitle" style={{marginTop:'20px', fontSize:'11px', fontWeight:900, color:'#6366f1', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>
                            {item.type === 'label' ? 'Label Settings' : 'Grid Settings'}
                        </div>
                        {item.type === 'label' && (
                            <>
                                <div className="prop-group">
                                    <div className="prop-label">Label Text</div>
                                    <input className="prop-input" value={item.name || ''} onChange={e => updateItem(selectedEntity.pageId, item.id, { name: e.target.value })} />
                                </div>
                                <div className="prop-row" style={{marginTop:'8px'}}>
                                    <div className="prop-group">
                                        <div className="prop-label">Font Size</div>
                                        <input className="prop-input" type="number" value={item.fontSize || 14} onChange={e => updateItem(selectedEntity.pageId, item.id, { fontSize: parseInt(e.target.value) || 1 })} />
                                    </div>
                                    <div className="prop-group">
                                        <div className="prop-label">Text Color</div>
                                        <div className="prop-color">
                                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-lbl-text" value={`#${safeHex(item.textColor)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { textColor: parseInt(e.target.value.substring(1), 16) })} />
                                            <label htmlFor="cp-lbl-text" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                                <div className="color-swatch" style={{ background: `#${safeHex(item.textColor)}` }}></div>
                                                <span className="color-val">#{safeHex(item.textColor)}</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {(item.type === 'grid' || item.type === 'pane-grid') && (
                            <>
                                <div className="prop-row">
                                    <div className="prop-group">
                                        <div className="prop-label">Columns</div>
                                        <input className="prop-input" type="number" value={item.cols || 2} onChange={e => updateItem(selectedEntity.pageId, item.id, { cols: parseInt(e.target.value) || 1 })} />
                                    </div>
                                    <div className="prop-group">
                                        <div className="prop-label">Rows</div>
                                        <input className="prop-input" type="number" value={item.rows || (item.type === 'pane-grid' ? 1 : 2)} onChange={e => updateItem(selectedEntity.pageId, item.id, { rows: parseInt(e.target.value) || 1 })} />
                                    </div>
                                </div>
                                <div className="prop-row" style={{marginTop:'10px'}}>
                                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#6366f1', fontWeight: 'bold' }}>
                                        <input type="checkbox" checked={!!item.locked} onChange={e => updateItem(selectedEntity.pageId, item.id, { locked: e.target.checked })} />
                                        Lock Items (D&D Reorder)
                                    </label>
                                </div>
                                {item.type === 'pane-grid' && (
                                    <div className="prop-group" style={{marginTop:'10px', opacity: 0.6}}>
                                        <div className="prop-label italic" style={{fontSize:'10px'}}>Advanced: Dashboard Link</div>
                                        <select 
                                            className="prop-input" 
                                            value={item.paneGridId || ''} 
                                            onChange={e => updateItem(selectedEntity.pageId, item.id, { paneGridId: e.target.value })}
                                        >
                                            <option value="">(None)</option>
                                            {(project.paneGrids || []).map((g: any) => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}
                        {item.type === 'grid-item' && (
                            <>
                                <div className="prop-group">
                                    <div className="prop-label">Top Text</div>
                                    <input className="prop-input" value={item.topText || ''} onChange={e => updateItem(selectedEntity.pageId, item.id, { topText: e.target.value })} />
                                </div>
                                <div className="prop-group" style={{marginTop:'8px'}}>
                                    <div className="prop-label">Bottom Text</div>
                                    <input className="prop-input" value={item.bottomText || ''} onChange={e => updateItem(selectedEntity.pageId, item.id, { bottomText: e.target.value })} />
                                </div>
                            </>
                        )}
                    </>
                )}

                <div className="props-subtitle" style={{marginTop:'20px', fontSize:'11px', fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>Layout & Behavior</div>
                
                <div className="prop-row">
                    <div className="prop-group">
                        <div className="prop-label">Opacity (0-255)</div>
                        <input className="prop-input" type="number" min="0" max="255" value={item.opacity !== undefined ? item.opacity : 255} onChange={e => updateItem(selectedEntity.pageId, item.id, { opacity: parseInt(e.target.value) || 0 })} />
                    </div>
                </div>

                <div className="prop-row" style={{marginTop:'10px'}}>
                    <div className="prop-group">
                        <div className="prop-label">Padding</div>
                        <input className="prop-input" type="number" value={item.padding || 0} onChange={e => updateItem(selectedEntity.pageId, item.id, { padding: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Gap</div>
                        <input className="prop-input" type="number" value={item.gap || 0} onChange={e => updateItem(selectedEntity.pageId, item.id, { gap: parseInt(e.target.value) || 0 })} />
                    </div>
                </div>

                <div className="prop-row" style={{marginTop:'5px'}}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#475569' }}>
                        <input type="checkbox" checked={!!item.hidden} onChange={e => updateItem(selectedEntity.pageId, item.id, { hidden: e.target.checked })} />
                        Hidden
                    </label>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#475569' }}>
                        <input type="checkbox" checked={!!item.scrollable} onChange={e => updateItem(selectedEntity.pageId, item.id, { scrollable: e.target.checked })} />
                        Scrollable
                    </label>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#6366f1', fontWeight: 'bold' }}>
                        <input type="checkbox" checked={!!item.pinned} onChange={e => updateItem(selectedEntity.pageId, item.id, { pinned: e.target.checked, x: e.target.checked ? 0 : item.x, y: e.target.checked ? 0 : item.y, width: e.target.checked ? baseWidth : item.width })} />
                        Pinned (Header)
                    </label>
                </div>

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
                <div className="prop-row">
                    <div className="prop-group">
                        <div className="prop-label">Layout</div>
                        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                            {['v', 'h', 'free'].map(l => (
                                <button 
                                    key={l}
                                    onClick={() => updatePanel(pan.id, { layout: l })}
                                    style={{ 
                                        flex: 1, padding: '4px 8px', fontSize: '9px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                        background: (pan.layout || 'v') === l ? '#6366f1' : 'transparent',
                                        color: (pan.layout || 'v') === l ? 'white' : '#64748b',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {l === 'v' ? 'VERT' : l === 'h' ? 'HORIZ' : 'FREE'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Gap</div>
                        <input className="prop-input" type="number" value={pan.gap || 0} onChange={e => updatePanel(pan.id, { gap: parseInt(e.target.value) || 0 })} />
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
