import React from "react";
import { type GridItem, type Panel } from "../../types";
import { safeHex } from "../../utils";

export const WidgetRenderer: React.FC<{
    it: GridItem;
    panels: Panel[];
    pageId: string;
    onSelect?: (id: string, pgId: string) => void;
    selectedId?: string;
}> = ({ it, panels, pageId, onSelect, selectedId }) => {
    const color = `#${safeHex(it.color)}`;
    const txt = `#${safeHex(it.textColor)}`;
    const baseStyle: React.CSSProperties = { 
        borderRadius: it.radius || 8, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        color: txt, 
        fontWeight: 900, 
        fontSize: `${it.fontSize || 10}px`, 
        width: "100%", 
        height: "100%", 
        position: "relative", 
        overflow: "hidden",
        border: it.borderWidth ? `${it.borderWidth}px solid ${txt}` : "none",
        background: (it.type === "panel-ref" || it.type === "border") ? "none" : (it.type === "label" || it.type === "clock" ? "none" : color)
    };

    if (it.type === "panel-ref") {
        const pt = panels.find(pd => pd.id === it.panelId);
        const localItems = it.children || [];
        return (
            <div style={{ width: "100%", height: "100%", position: "relative", background: pt ? `#${safeHex(pt.bg)}` : "rgba(255,255,255,0.05)", borderRadius: it.radius || 0, overflow: "hidden" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "10px", height: "100%" }}>
                    {pt?.elements.map(el => (
                        <div key={el.id} style={{ cursor: onSelect ? "pointer" : "default", width: "100%" }} onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(el.id, pageId); } }}>
                            <WidgetRenderer it={{ ...el, radius: 8 }} panels={panels} pageId={pageId} onSelect={onSelect} selectedId={selectedId} />
                        </div>
                    ))}
                    {localItems.map(el => (
                        <div key={el.id} style={{ cursor: onSelect ? "pointer" : "default", width: "100%" }} onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(el.id, pageId); } }}>
                            <WidgetRenderer it={{ ...el, radius: 8 }} panels={panels} pageId={pageId} onSelect={onSelect} selectedId={selectedId} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (it.type === "switch") return (
        <div style={{ ...baseStyle, border: `2px solid ${color}`, background: it.value ? color : "rgba(255,255,255,0.05)", borderRadius: 100, padding: 4 }}>
            <div style={{ width: "45%", height: "100%", background: it.value ? "white" : color, borderRadius: "50%", marginLeft: it.value ? "auto" : "0", transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)" }} />
        </div>
    );

    if (it.type === "slider") return (
        <div style={{ ...baseStyle, background: "rgba(255,255,255,0.05)", borderRadius: 100, padding: "0 10px", justifyContent: "flex-start", border: `1px solid rgba(255,255,255,0.1)` }}>
            <div style={{ width: `${it.value || 0}%`, height: "4px", background: color, borderRadius: "2px", position: "relative" }}>
                <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, background: "white", borderRadius: "50%", border: `2px solid ${color}`, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
            </div>
        </div>
    );

    if (it.type === "arc") return (
        <div style={{ ...baseStyle, background: "none" }}>
            <div style={{ width: "90%", height: "90%", borderRadius: "50%", border: `10px solid rgba(255,255,255,0.05)`, position: "absolute" }} />
            <div style={{ width: "90%", height: "90%", borderRadius: "50%", border: `10px solid ${color}`, borderTopColor: "transparent", borderRightColor: "transparent", transform: `rotate(${(it.value || 50) * 2.4 - 120}deg)`, transition: "0.3s" }} />
            <div style={{ position: "absolute", fontSize: "14px", fontWeight: "900", color: "white" }}>{it.value}%</div>
        </div>
    );

    if (it.type === "bar") return (
        <div style={{ ...baseStyle, background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)` }}>
            <div style={{ width: `${it.value || 0}%`, height: "100%", background: color, transition: "0.3s" }} />
            <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{it.value}%</div>
        </div>
    );

    if (it.type === "roller") return (
        <div style={{ ...baseStyle, border: `1px solid ${color}`, background: "rgba(0,0,0,0.2)" }}>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", opacity: 0.3, transform: "translateY(-10px)" }}>
                <div style={{ textAlign: "center" }}>ITEM A</div>
                <div style={{ textAlign: "center", opacity: 1, color: "white", fontWeight: 900, background: color, padding: "4px 0" }}>ITEM B</div>
                <div style={{ textAlign: "center" }}>ITEM C</div>
            </div>
        </div>
    );

    if (it.type === "clock") return (
        <div style={{ ...baseStyle, fontSize: "28px", letterSpacing: "2px", textShadow: `0 0 15px ${color}` }}>12:45</div>
    );

    if (it.type == "nav-menu") {
        const childItems = it.children || [];
        return (
            <div style={{ 
                ...baseStyle, 
                display: "flex",
                flexDirection: (it.orientation === "h") ? "row" : "column", 
                padding: "10px", 
                gap: "10px", 
                justifyContent: "flex-start", 
                alignItems: "stretch",
                overflowX: it.orientation === "h" ? "auto" : "hidden",
                overflowY: (it.orientation === "v" || !it.orientation) ? "auto" : "hidden",
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
    }

    if (it.type === "menu-item") {
        return (
            <div style={{ 
                padding: "12px", 
                background: color, 
                borderRadius: `${it.radius || 8}px`, 
                fontSize: `${it.fontSize || 12}px`, 
                color: txt, 
                width: "100%", 
                textAlign: "center", 
                border: `${it.borderWidth || 0}px solid rgba(255,255,255,0.3)`,
                outline: selectedId === it.id ? "2px dashed #6366f1" : "none",
                outlineOffset: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                minHeight: "40px",
                flexShrink: 0
            }}>
                {it.name}
            </div>
        );
    }

    if (it.type === "label") return (
        <div style={{ ...baseStyle, textAlign: "center" }}>{it.name}</div>
    );

    if (it.type === "btn") return (
        <div style={baseStyle}>{it.name}</div>
    );

    if (it.type === "checkbox") return (
        <div style={{ ...baseStyle, background: "none", justifyContent: "flex-start", gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${color}`, background: it.value ? color : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {it.value && <span style={{ color: "white", fontSize: "14px" }}>✓</span>}
            </div>
            {it.name}
        </div>
    );

    if (it.type === "dropdown") return (
        <div style={{ ...baseStyle, background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, padding: "0 15px", justifyContent: "space-between" }}>
            <span>{it.name}</span>
            <span style={{ fontSize: "10px" }}>▼</span>
        </div>
    );

    if (it.type === "border") return (
        <div style={{ ...baseStyle }} />
    );

    return (
        <div style={baseStyle}>
            {it.name} ({it.type})
        </div>
    );
};
