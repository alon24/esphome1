import React from "react";
import { type GridItem, type Panel } from "../../types";
import { safeHex } from "../../utils";

import { GridContext } from "../../context/GridContext";

export const WidgetRenderer: React.FC<{
    it: GridItem;
    panels: Panel[];
    pageId: string;
    onSelect?: (id: string, pgId: string) => void;
    selectedId?: string;
}> = ({ it, panels, pageId, onSelect, selectedId }) => {
    const { project, setActiveScreenId, updateItem } = React.useContext(GridContext) as any;

    const renderIcon = () => {
        if (!it.icon) return null;
        const isFilePath = it.icon.startsWith("/");
        return (
            <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 10,
                fontSize: `${(it.fontSize || 24) * 1.5}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "80%",
                height: "80%"
            }}>
                {isFilePath ? (
                    <img 
                        src={it.icon} 
                        alt="icon" 
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <span>{it.icon}</span>
                )}
            </div>
        );
    };

    const color = `#${safeHex(it.color)}`;
    const txt = `#${safeHex(it.textColor)}`;
    const bColor = it.borderColor !== undefined ? `#${safeHex(it.borderColor)}` : txt;

    const baseStyle: React.CSSProperties = { 
        borderRadius: it.radius || 8, 
        display: it.hidden ? "none" : "flex", 
        alignItems: "center", 
        justifyContent: it.textAlign === "left" ? "flex-start" : (it.textAlign === "right" ? "flex-end" : "center"), 
        textAlign: it.textAlign || "center",
        color: txt, 
        fontWeight: 900, 
        fontSize: `${it.fontSize || 16}px`, 
        width: "100%", 
        height: "100%", 
        position: "relative", 
        overflow: it.scrollable ? "auto" : "hidden",
        opacity: (it.opacity !== undefined ? it.opacity : 255) / 255,
        border: it.borderWidth ? `${it.borderWidth}px solid ${bColor}` : "none",
        background: (it.type === "panel-ref" || it.type === "border") ? "none" : color,
        padding: it.padding !== undefined ? `${it.padding}px` : "0 10px",
        boxSizing: "border-box"
    };

    let content: React.ReactNode = null;

    if (it.type === "panel-ref") {
        const pt = panels.find(pd => pd.id === it.panelId);
        const elements = pt?.elements || it.children || [];
        content = (
            <div style={{ 
                width: "100%", 
                height: "100%", 
                position: "relative", 
                background: pt ? `#${safeHex(pt.bg)}` : "rgba(255,255,255,0.05)", 
                borderRadius: it.radius || 0, 
                overflow: "hidden" 
            }}>
                <div style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "0px", 
                    height: "100%",
                    overflowY: "auto",
                    boxSizing: "border-box"
                }}>
                    {elements.map(el => (
                        <div key={el.id} style={{ cursor: onSelect ? "pointer" : "default", width: "100%", height: el.height || 50, flexShrink: 0 }} onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(el.id, pageId); } }}>
                            <WidgetRenderer it={el} panels={panels} pageId={pageId} onSelect={onSelect} selectedId={selectedId} />
                        </div>
                    ))}
                </div>
            </div>
        );
    } else if (it.type === "switch") {
        content = (
            <div style={{ ...baseStyle, border: `2px solid ${color}`, background: it.value ? color : "rgba(255,255,255,0.05)", borderRadius: 100, padding: 4 }}>
                <div style={{ width: "45%", height: "100%", background: it.value ? "white" : color, borderRadius: "50%", marginLeft: it.value ? "auto" : "0", transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)" }} />
            </div>
        );
    } else if (it.type === "slider") {
        content = (
            <div style={{ ...baseStyle, background: "rgba(255,255,255,0.05)", borderRadius: 100, padding: "0 10px", justifyContent: "flex-start", border: `1px solid rgba(255,255,255,0.1)` }}>
                <div style={{ width: `${it.value || 0}%`, height: "4px", background: color, borderRadius: "2px", position: "relative" }}>
                    <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, background: "white", borderRadius: "50%", border: `2px solid ${color}`, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
                </div>
            </div>
        );
    } else if (it.type === "arc") {
        content = (
            <div style={{ ...baseStyle, background: "none" }}>
                <div style={{ width: "90%", height: "90%", borderRadius: "50%", border: `10px solid rgba(255,255,255,0.05)`, position: "absolute" }} />
                <div style={{ width: "90%", height: "90%", borderRadius: "50%", border: `10px solid ${color}`, borderTopColor: "transparent", borderRightColor: "transparent", transform: `rotate(${(it.value || 50) * 2.4 - 120}deg)`, transition: "0.3s" }} />
                <div style={{ position: "absolute", fontSize: "14px", fontWeight: "900", color: "white" }}>{it.value}%</div>
            </div>
        );
    } else if (it.type === "bar") {
        content = (
            <div style={{ ...baseStyle, background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)` }}>
                <div style={{ width: `${it.value || 0}%`, height: "100%", background: color, transition: "0.3s" }} />
                <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{it.value}%</div>
            </div>
        );
    } else if (it.type === "roller") {
        const opts = (it.options || "Option 1\nOption 2\nOption 3").split("\n");
        const curIdx = it.value || 0;
        content = (
            <div style={{ 
                ...baseStyle, 
                border: `1px solid ${color}`, 
                background: "rgba(0,0,0,0.4)", 
                padding: 0,
                display: "flex",
                flexDirection: "column",
                position: "relative"
            }}>
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, background: "linear-gradient(rgba(0,0,0,0.7) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.7) 100%)" }} />
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "32px", transform: "translateY(-50%)", background: color, opacity: 0.3, zIndex: 1 }} />
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px", justifyContent: "center", height: "100%", zIndex: 1 }}>
                    <div style={{ textAlign: "center", opacity: 0.3, fontSize: '0.7em', transform: 'scale(0.9)' }}>{opts[curIdx - 1] || ""}</div>
                    <div style={{ textAlign: "center", color: "white", fontWeight: 900, fontSize: '0.9em', padding: "2px 0", width: '100%', textShadow: "0 0 10px rgba(255,255,255,0.3)" }}>{opts[curIdx] || "No Option"}</div>
                    <div style={{ textAlign: "center", opacity: 0.3, fontSize: '0.7em', transform: 'scale(0.9)' }}>{opts[curIdx + 1] || ""}</div>
                </div>
            </div>
        );
    } else if (it.type === "clock") {
        content = (
            <div style={{ ...baseStyle, letterSpacing: "2px", textShadow: `0 0 15px ${color}` }}>12:45</div>
        );
    } else if (it.type === "nav-menu") {
        const childItems = it.children || [];
        content = (
            <div style={{ 
                ...baseStyle, 
                display: "flex",
                flexDirection: (it.orientation === "h") ? "row" : "column", 
                padding: it.padding !== undefined ? `${it.padding}px` : "10px", 
                gap: it.gap !== undefined ? `${it.gap}px` : "10px", 
                justifyContent: "flex-start", 
                alignItems: "stretch",
                overflowX: (it.orientation === "h" || it.scrollable) ? "auto" : "hidden",
                overflowY: (it.orientation === "v" || !it.orientation || it.scrollable) ? "auto" : "hidden",
                background: "transparent"
            }}>
                {childItems.map((c, i) => (
                    <div key={c.id} 
                        onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(c.id, pageId); } }}
                        style={{ flex: "0 0 auto", cursor: onSelect ? "pointer" : "default" }}>
                        <WidgetRenderer it={c} panels={panels} pageId={pageId} onSelect={onSelect} selectedId={selectedId} />
                    </div>
                ))}
            </div>
        );
    } else if (it.type === "menu-item" || it.type === "nav-item") {
        const isSelected = selectedId === it.id;
        content = (
            <div style={{ 
                padding: "0 20px", 
                background: color, 
                borderRadius: `${it.radius || 0}px`, 
                fontSize: `${it.fontSize || 13}px`, 
                color: txt, 
                width: "100%", 
                height: "100%",
                textAlign: it.textAlign || "left", 
                borderLeft: isSelected ? "4px solid #6366f1" : "4px solid transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: it.textAlign === "center" ? "center" : "flex-start",
                boxSizing: "border-box",
                flexShrink: 0,
                transition: "all 0.2s",
                fontWeight: isSelected ? 800 : 500,
                cursor: "pointer",
                borderBottom: '1px solid rgba(0,0,0,0.1)'
            }}
            onClick={(e) => {
                if (it.targetScreenId) {
                    e.stopPropagation();
                    setActiveScreenId(it.targetScreenId);
                }
            }}
            >
                {it.name}
            </div>
        );
    } else if (it.type === "label") {
        content = (
            <div style={{ ...baseStyle, textAlign: "center" }}>{it.name}</div>
        );
    } else if (it.type === "btn") {
        content = (
            <div style={baseStyle}>{it.name}</div>
        );
    } else if (it.type === "checkbox") {
        content = (
            <div 
                style={{ ...baseStyle, background: "none", justifyContent: "flex-start", gap: 10, cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); updateItem(pageId, it.id, { value: it.value ? 0 : 1 }); }}
            >
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${color}`, background: it.value ? color : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {it.value && <span style={{ color: "white", fontSize: "14px" }}>✓</span>}
                </div>
                {it.name}
            </div>
        );
    } else if (it.type === "dropdown") {
        const opts = (it.options || "Option 1").split("\n");
        const curIdx = it.value || 0;
        const selected = opts[curIdx] || opts[0];
        content = (
            <div 
                style={{ ...baseStyle, background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, padding: "0 15px", justifyContent: "space-between", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); updateItem(pageId, it.id, { value: (curIdx + 1) % opts.length }); }}
            >
                <span>{selected}</span>
                <span style={{ fontSize: "10px" }}>▼</span>
            </div>
        );
    } else if (it.type === "pane-grid") {
        const grid = (project.paneGrids || []).find((g: any) => g.id === (it as any).paneGridId);
        content = (
            <div style={{ ...baseStyle, background: 'rgba(0,0,0,0.2)', padding: '10px', display: 'flex', flexDirection: 'column' }}>
                {!grid ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', opacity: 0.5 }}>NO GRID SELECTED</div>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: `repeat(${grid.columns || 3}, 1fr)`, 
                        gap: `${(grid.gap || 10) / 4}px`, // Scaled gap
                        width: '100%'
                    }}>
                        {grid.panes.slice(0, 12).map((pane: any) => (
                            <div key={pane.id} style={{ background: '#1e293b', aspectRatio: '1/1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                {pane.icon}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    } else if (it.type === "border") {
        content = (
            <div style={{ ...baseStyle }} />
        );
    } else if (it.type === "native-wifi" || it.type === "native-system" || it.type === "native-sd" || it.type === "native-tests") {
        const iconMap: any = { "native-wifi": "📶", "native-system": "⚙️", "native-sd": "💾", "native-tests": "🛠️" };
        content = (
            <div style={{ ...baseStyle, flexDirection: 'column', gap: '4px', background: 'rgba(99, 102, 241, 0.1)', border: '2px dashed #6366f1' }}>
                <span style={{ fontSize: '24px' }}>{iconMap[it.type]}</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>NATIVE {it.type.split('-')[1].toUpperCase()}</span>
            </div>
        );
    } else if (it.type === "shape_circle") {
        content = (
            <div style={{ ...baseStyle, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ aspectRatio: "1/1", height: "90%", maxHeight: "90%", maxWidth: "90%", borderRadius: '50%', border: `4px solid ${color}`, boxSizing: 'border-box' }} />
            </div>
        );
    } else if (it.type === "battery_icon") {
        content = (
            <div style={{ ...baseStyle, background: 'none', border: 'none', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '32px', color: color }}>🔋</div>
                <div style={{ fontSize: '12px', fontWeight: 900 }}>90%</div>
            </div>
        );
    } else if (it.type === "rounded_rect") {
        content = (
            <div style={{ ...baseStyle, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '15px', border: `4px solid ${color}`, boxSizing: 'border-box' }} />
            </div>
        );
    } else {
        content = (
            <div style={baseStyle}>
                {it.name} ({it.type})
            </div>
        );
    }

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {content}
            {renderIcon()}
        </div>
    );
};
