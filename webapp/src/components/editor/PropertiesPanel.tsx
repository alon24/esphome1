import React, { useContext } from "react";
import { GridContext } from "../../context/GridContext";
import { safeHex } from "../../utils";
import { SMART_COMPONENTS } from "../../types";

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
        baseHeight, setBaseHeight
    } = useContext(GridContext) as any;

    const selectedEntity = selections[activeScreenId];
    const activeScreen = project.screens.find((s: any) => s.id === activeScreenId) || project.screens[0];

    if (!selectedEntity) {
        return (
            <div className="props-panel open">
                <div className="props-inner">
                    <div className="props-header">
                        <div className="props-header-text">
                            <div className="props-title">Canvas Settings</div>
                            <div className="props-entity">Global Context</div>
                        </div>
                    </div>
                    <div className="props-body">
                        <div className="prop-group">
                            <div className="prop-label">Global Page Width</div>
                            <input className="prop-input" type="number" value={baseWidth} onChange={e => setBaseWidth(parseInt(e.target.value) || 1)} />
                        </div>
                        <div className="prop-group">
                            <div className="prop-label">Global Page Height</div>
                            <input className="prop-input" type="number" value={baseHeight} onChange={e => setBaseHeight(parseInt(e.target.value) || 1)} />
                        </div>
                        <hr className="prop-divider" />
                        <button 
                            className="prop-input" 
                            style={{ color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff" }}
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

    if (selectedEntity.type === 'item') {
        const page = (selectedEntity.pageId === 'panel') 
            ? project.panels.find((p: any) => p.id === selections['panel']?.id) // This is tricky if it's a panel item
            : project.screens.flatMap((s: any) => s.pages).find((p: any) => p.id === selectedEntity.pageId);
        
        // Find the actual element
        let item: any = null;
        if (selectedEntity.pageId === 'panel') {
            const pan = project.panels.find((p: any) => p.id === selections['panel']?.id);
            item = pan?.elements.find((e: any) => e.id === selectedEntity.id);
        } else {
            item = page?.items.find((i: any) => i.id === selectedEntity.id);
        }

        if (!item) return null;

        title = item.name;
        type = item.type.toUpperCase();

        content = (
            <>
                <div className="prop-group">
                    <div className="prop-label">Name / ID</div>
                    <input className="prop-input" value={item.name} onChange={e => updateItem(selectedEntity.pageId, item.id, { name: e.target.value })} />
                </div>
                {item.type !== "menu-item" && (
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
                {item.type === "menu-item" && (
                    <div className="prop-group">
                        <div className="prop-label">Action (Destination)</div>
                        <select className="prop-input" value={item.action || ""} onChange={e => updateItem(selectedEntity.pageId, item.id, { action: e.target.value })}>
                            <option value="">-- None --</option>
                            {project.screens.map((scr: any) => <option key={scr.id} value={`scr:${scr.id}`}>Screen: {scr.name}</option>)}
                            <option value="scr:main">Screen: Main</option>
                        </select>
                    </div>
                )}
                <hr className="prop-divider" />
                <div className="prop-row">
                     <div className="prop-group">
                        <div className="prop-label">Background</div>
                        <div className="prop-color">
                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-bg" value={`#${safeHex(item.color)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { color: parseInt(e.target.value.substring(1), 16) })} />
                            <label htmlFor="cp-bg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                <div className="color-swatch" style={{ background: `#${safeHex(item.color)}` }}></div>
                                <span className="color-val">#{safeHex(item.color)}</span>
                            </label>
                        </div>
                    </div>
                    <div className="prop-group">
                        <div className="prop-label">Text Color</div>
                        <div className="prop-color">
                            <input type="color" style={{visibility:'hidden', width:0, height:0, position:'absolute'}} id="cp-fg" value={`#${safeHex(item.textColor)}`} onChange={e => updateItem(selectedEntity.pageId, item.id, { textColor: parseInt(e.target.value.substring(1), 16) })} />
                            <label htmlFor="cp-fg" style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', width:'100%'}}>
                                <div className="color-swatch" style={{ background: `#${safeHex(item.textColor)}` }}></div>
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
                <button 
                    className="prop-input" 
                    style={{ marginTop: '10px', color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff" }}
                    onClick={() => removeItem(selectedEntity.pageId, item.id)}
                >
                    ✕ DELETE WIDGET
                </button>
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
                        style={{ marginTop: '20px', color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff" }}
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
                    style={{ marginTop: '20px', color: "#ef4444", borderColor: "#fecaca", cursor: "pointer", background: "#fff" }}
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
        <div className="props-panel open">
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
