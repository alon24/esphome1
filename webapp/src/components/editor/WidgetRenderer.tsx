import React from "react";
import { type GridItem, type Panel } from "../../types";
import { safeHex } from "../../utils";

import { GridContext } from "../../context/GridContext";

export const WidgetRenderer: React.FC<{
    it: GridItem;
    panels: Panel[];
    pageId: string;
    onSelect?: (id: string, pgId: string, isMulti?: boolean) => void;
    onDragStart?: (id: string, pgId: string, e: React.MouseEvent) => void;
    selections?: any[];
}> = ({ it, panels, pageId, onSelect, onDragStart, selections = [] }) => {
    const { project, setActiveScreenId, updateItem } = React.useContext(GridContext) as any;
    const isSelected = selections.some(s => s.id === it.id);

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
                zIndex: 2,
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

    const color = (it.color !== undefined ? (typeof (it.color as any) === 'string' ? ((it.color as any).startsWith('#') ? it.color : `#${it.color}`) : `#${safeHex(it.color)}`) : '#4F46E5') as string;
    const txt = (it.textColor !== undefined ? (typeof (it.textColor as any) === 'string' ? ((it.textColor as any).startsWith('#') ? it.textColor : `#${it.textColor}`) : `#${safeHex(it.textColor)}`) : '#000000') as string;
    const bColor = (it.borderColor !== undefined ? (typeof (it.borderColor as any) === 'string' ? ((it.borderColor as any).startsWith('#') ? it.borderColor : `#${it.borderColor}`) : `#${safeHex(it.borderColor)}`) : txt) as string;

    const baseStyle: React.CSSProperties = { 
        borderRadius: it.radius !== undefined ? it.radius : 0, 
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
        background: it.noBg ? "transparent" : ((it.type === "panel-ref" || it.type === "border") ? "none" : color),
        boxSizing: "border-box",
        outline: isSelected ? "3px solid #6366f1" : "1px dashed rgba(148, 163, 184, 0.3)", // DESIGN AID
        outlineOffset: isSelected ? "2px" : "-1px",
        boxShadow: isSelected ? "0 0 15px rgba(99, 102, 241, 0.5)" : "none",
        zIndex: isSelected ? 100 : 1
    };

    let content: React.ReactNode = null;

    if (it.type === "panel-ref") {
        const pt = panels.find(pd => pd.id === it.panelId);
        const elements = pt?.elements || it.children || [];
        const isFree = pt?.layout === "free";
        const isHorizontal = pt?.layout === "h";
        
        content = (
            <div style={{ 
                width: "100%", 
                height: "100%", 
                position: "relative", 
                background: pt ? `#${safeHex(pt.bg)}` : "rgba(255,255,255,0.05)", 
                borderRadius: it.radius !== undefined ? it.radius : 0, 
                overflow: "hidden" 
            }}>
                <div style={{ 
                    display: isFree ? "block" : "flex", 
                    flexDirection: isHorizontal ? "row" : "column", 
                    gap: isFree ? "0" : `${pt?.gap || 0}px`, 
                    height: "100%",
                    width: "100%",
                    overflowY: (isHorizontal || isFree) ? "hidden" : "auto",
                    overflowX: (isHorizontal || isFree) ? "auto" : "hidden",
                    boxSizing: "border-box",
                    alignItems: isHorizontal ? "center" : "stretch",
                    position: "relative"
                }}>
                    {elements.map(el => (
                        <div key={el.id} style={{ 
                            cursor: onSelect ? "pointer" : "default", 
                            width: (isFree || isHorizontal) ? (el.width || "auto") : "100%", 
                            height: (isFree || isHorizontal) ? (el.height || "100%") : (el.height || 50), 
                            position: isFree ? "absolute" : "relative",
                            left: isFree ? (el.x || 0) : "auto",
                            top: isFree ? (el.y || 0) : "auto",
                            flexShrink: 0 
                        }} onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(el.id, pageId, e.shiftKey); } }}>
                            <WidgetRenderer it={el} panels={panels} pageId={pageId} onSelect={onSelect} selections={selections} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
 else if (it.type === "switch") {
        content = (
            <div style={{ ...baseStyle, border: `2px solid ${color}`, background: it.value ? color : "rgba(255,255,255,0.05)", borderRadius: it.radius !== undefined ? it.radius : 100, padding: 4 }}>
                <div style={{ width: "45%", height: "100%", background: it.value ? "white" : color, borderRadius: it.radius !== undefined ? it.radius : 100, marginLeft: it.value ? "auto" : "0", transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)" }} />
            </div>
        );
    } else if (it.type === "slider") {
        content = (
            <div style={{ ...baseStyle, background: "rgba(255,255,255,0.05)", borderRadius: it.radius !== undefined ? it.radius : 100, padding: "0 10px", justifyContent: "flex-start", border: `1px solid rgba(255,255,255,0.1)` }}>
                <div style={{ width: `${it.value || 0}%`, height: "4px", background: color, borderRadius: it.radius !== undefined ? it.radius : 2, position: "relative" }}>
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
                        onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(c.id, pageId, e.shiftKey); } }}
                        style={{ flex: "0 0 auto", cursor: onSelect ? "pointer" : "default" }}>
                        <WidgetRenderer it={c} panels={panels} pageId={pageId} onSelect={onSelect} selections={selections} />
                    </div>
                ))}
            </div>
        );
    } else if (it.type === "menu-item" || it.type === "nav-item") {
        content = (
            <div style={{ 
                padding: "0 20px", 
                background: color, 
                borderRadius: `${it.radius !== undefined ? it.radius : 0}px`, 
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
            <div style={{ 
                ...baseStyle, 
                textAlign: "center", 
                fontWeight: 800, 
                fontSize: `${it.fontSize || 16}px`,
                color: txt || '#FFFFFF'
            }}>
                {it.name || it.id || "LABEL"}
            </div>
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
                <div style={{ width: 22, height: 22, borderRadius: it.radius !== undefined ? it.radius : 6, border: `2px solid ${color}`, background: it.value ? color : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        const columns = it.cols || 3;
        const rows = it.rows || 1;
        const gap = it.gap !== undefined ? it.gap : 10;
        const children = it.children || [];

        content = (
            <div style={{ 
                ...baseStyle, 
                display: "grid", 
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: `${gap}px`,
                padding: `${gap}px`,
                background: "rgba(99, 102, 241, 0.05)",
                border: "1px dashed rgba(99, 102, 241, 0.3)"
            }}>
                {children.map((child) => (
                    <div 
                        key={child.id}
                        style={{ 
                            gridColumn: child.col !== undefined ? child.col + 1 : "auto",
                            gridRow: child.row !== undefined ? child.row + 1 : "auto",
                            cursor: (it.locked) ? "grab" : "default",
                            width: '100%',
                            height: '100%'
                        }}
                        onMouseDown={(e) => {
                            if (e.button === 1) e.preventDefault();
                            if ((it.locked || e.ctrlKey || e.metaKey || e.button === 1) && onDragStart) {
                                e.stopPropagation();
                                if (onSelect) onSelect(child.id, pageId, e.shiftKey);
                                onDragStart(child.id, pageId, e);
                            } else if (onSelect) {
                                e.stopPropagation();
                                onSelect(child.id, pageId, e.shiftKey);
                            }
                        }}
                    >
                        <WidgetRenderer it={{ ...child, parentId: it.id }} panels={panels} pageId={pageId} onSelect={onSelect} onDragStart={onDragStart} selections={selections} />
                    </div>
                ))}
                {children.length === 0 && !isSelected && (
                    <div style={{ gridColumn: `1 / span ${columns}`, gridRow: `1 / span ${rows}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', opacity: 0.3, pointerEvents: 'none' }}>
                        EMPTY PANE GRID (DRAG PANELS HERE)
                    </div>
                )}
            </div>
        );
    } else if (it.type === "grid") {
        const columns = it.cols || 2;
        const rows = it.rows || 2;
        const gap = it.gap !== undefined ? it.gap : 10;
        const children = it.children || [];

        content = (
            <div style={{ 
                ...baseStyle, 
                display: "grid", 
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: `${gap}px`,
                padding: `${gap}px`,
                background: "rgba(0,0,0,0.1)",
                border: "1px dashed rgba(148, 163, 184, 0.2)"
            }}>
                {children.map((child) => (
                    <div 
                        key={child.id}
                        style={{ 
                            gridColumn: child.col !== undefined ? child.col + 1 : "auto",
                            gridRow: child.row !== undefined ? child.row + 1 : "auto",
                            cursor: (it.locked) ? "grab" : "default",
                            width: '100%',
                            height: '100%'
                        }}
                        onMouseDown={(e) => {
                            if (e.button === 1) e.preventDefault();
                            if ((it.locked || e.ctrlKey || e.metaKey || e.button === 1) && onDragStart) {
                                e.stopPropagation();
                                if (onSelect) onSelect(child.id, pageId, e.shiftKey);
                                onDragStart(child.id, pageId, e);
                            } else if (onSelect) {
                                e.stopPropagation();
                                onSelect(child.id, pageId, e.shiftKey);
                            }
                        }}
                    >
                        <WidgetRenderer it={{ ...child, parentId: it.id }} panels={panels} pageId={pageId} onSelect={onSelect} onDragStart={onDragStart} selections={selections} />
                    </div>
                ))}
            </div>
        );
    } else if (it.type === "grid-item") {
        content = (
            <div style={{ 
                ...baseStyle, 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: it.itemBg !== undefined ? `#${safeHex(it.itemBg)}` : (color || '#FFFF00'),
                borderRadius: `${it.radius !== undefined ? it.radius : 12}px`,
                padding: '8px',
                border: isSelected ? '4px solid #6366f1' : `2px solid ${bColor || '#000'}`,
                boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.4)' : '0 2px 4px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                transition: '0.2s',
                color: '#1e293b'
            }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(0,0,0,0.7)', textAlign: 'center', marginBottom: '2px', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.topText || it.name || 'ITEM'}
                </div>
                <div style={{ fontSize: '28px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.icon || '💡'}</div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(0,0,0,0.6)', textAlign: 'center', marginTop: '2px', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.bottomText}
                </div>
                {/* Debug info */}
                <div style={{ position: 'absolute', top: 2, right: 2, fontSize: '8px', background: 'black', color: 'lime', padding: '2px', borderRadius: '2px', zIndex: 10 }}>
                    c:{it.col ?? '-'}, r:{it.row ?? '-'}
                </div>
            </div>
        );
    } else if (it.type === "chart") {
        content = (
            <div style={{ ...baseStyle, background: 'rgba(15, 23, 42, 0.4)', padding: '10px', flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ flex: 1, position: 'relative', borderBottom: `1px solid ${color}44`, borderLeft: `1px solid ${color}44` }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path 
                            d="M 0 80 Q 10 20 20 50 T 40 40 T 60 70 T 80 30 T 100 50" 
                            fill="none" 
                            stroke={color} 
                            strokeWidth="2" 
                            vectorEffect="non-scaling-stroke"
                        />
                        <path 
                            d="M 0 80 Q 10 20 20 50 T 40 40 T 60 70 T 80 30 T 100 50 L 100 100 L 0 100 Z" 
                            fill={`url(#grad-${it.id})`} 
                            opacity={it.chartType === "area" ? "0.4" : "0"}
                        />
                        <defs>
                            <linearGradient id={`grad-${it.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.8 }} />
                                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                    <span>0s</span>
                    <span>-60s</span>
                </div>
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
    } else if (it.type === "component") {
        if (it.component === "wifi-panel") {
            content = (
                <div style={{ ...baseStyle, background: '#0a0a0a', display: 'flex', border: '1px solid #333' }}>
                    {/* Mock Left: Networks List */}
                    <div style={{ width: '40%', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', padding: '8px', gap: '8px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '10px', color: '#00CED1', fontWeight: 800 }}>NETWORKS</div>
                        {['Home_WiFi', 'Guest_Net', 'Coffee_Shop'].map((ssid, i) => (
                            <div key={ssid} style={{ background: '#1a1a1a', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', opacity: 1 - i * 0.2 }}>
                                <span style={{ fontSize: '12px' }}>📶</span>
                                <span style={{ fontSize: '11px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{ssid}</span>
                            </div>
                        ))}
                    </div>
                    {/* Mock Right: Form */}
                    <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#FF8800' }}>SSID</div>
                        <div style={{ background: '#1a1a1a', height: '24px', borderRadius: '4px', border: '1px solid #333' }} />
                        <div style={{ fontSize: '10px', color: '#FF8800' }}>PASSWORD</div>
                        <div style={{ background: '#1a1a1a', height: '24px', borderRadius: '4px', border: '1px solid #333' }} />
                        <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                            <div style={{ flex: 1, background: '#1a3a1a', height: '30px', borderRadius: '4px', border: '1px solid #00FF00', color: '#00FF00', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>SCAN</div>
                            <div style={{ flex: 1, background: '#003050', height: '30px', borderRadius: '4px', border: '1px solid #00FFFF', color: '#00FFFF', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>CONN</div>
                        </div>
                    </div>
                </div>
            );
        } else if (it.component === "sd-browser") {
            content = (
                <div style={{ ...baseStyle, background: '#0f172a', display: 'flex', flexDirection: 'column', border: '1px solid #1e293b' }}>
                    <div style={{ padding: '12px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 800 }}>💾 SD BROWSER</span>
                        <span style={{ fontSize: '10px', opacity: 0.6 }}>ROOT /</span>
                    </div>
                    <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                        {['LOGS', 'PHOTOS', 'config.json', 'update.bin'].map((file, i) => (
                            <div key={file} style={{ background: i < 2 ? 'rgba(56, 189, 248, 0.1)' : 'transparent', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '14px' }}>{i < 2 ? '📁' : '📄'}</span>
                                <span style={{ fontSize: '12px', flex: 1 }}>{file}</span>
                                <span style={{ fontSize: '10px', opacity: 0.4 }}>{i < 2 ? '--' : '42KB'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        } else if (it.component === "system-settings") {
            content = (
                <div style={{ ...baseStyle, background: '#0a0a0a', display: 'flex', flexDirection: 'column', border: '1px solid #333' }}>
                    <div style={{ padding: '12px', fontSize: '14px', fontWeight: 900, borderBottom: '1px solid #222', color: '#6366f1' }}>SYSTEM SETTINGS</div>
                    <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { l: 'Display Brightness', v: '80%' },
                            { l: 'Auto-Sleep Timeout', v: '30s' },
                            { l: 'Screen Rotation', v: '270°' }
                        ].map(opt => (
                            <div key={opt.l} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #111', paddingBottom: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.8 }}>{opt.l}</span>
                                <span style={{ fontSize: '12px', color: '#6366f1' }}>{opt.v}</span>
                            </div>
                        ))}
                        <div style={{ background: '#ef4444', height: '35px', borderRadius: '6px', color: 'white', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, marginTop: 'auto' }}>REBOOT DEVICE</div>
                    </div>
                </div>
            );
        } else {
            content = (
                <div style={{ ...baseStyle, border: '2px dashed #6366f1', background: 'rgba(99, 102, 241, 0.1)' }}>
                    {it.name}
                </div>
            );
        }
    } else if (it.type === "rounded_rect") {
        content = (
            <div style={{ ...baseStyle, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: it.radius !== undefined ? it.radius : 15, border: `4px solid ${color}`, boxSizing: 'border-box' }} />
            </div>
        );
    } else if ((it.type as string) === "pane-grid") {
        const paneGrid = project.paneGrids?.find((p: any) => p.id === (it.paneGridId || it.id));
        const cols = paneGrid?.cols || it.cols || 3;
        const rows = paneGrid?.rows || it.rows || 1;
        const gap = paneGrid?.gap || it.gap || 10;
        content = (
            <div style={{ 
                ...baseStyle, 
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: `${gap}px`,
                padding: `${gap}px`,
                background: it.bg ? `#${safeHex(it.bg)}` : 'rgba(30, 41, 59, 0.5)',
                border: isSelected ? '4px solid #6366f1' : '1px dashed rgba(148, 163, 184, 0.3)',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                {(it.children || paneGrid?.children || [])?.map((child: any) => (
                    <div 
                        key={child.id}
                        style={{ 
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            gridColumn: (child.col ?? 0) + 1,
                            gridRow: (child.row ?? 0) + 1,
                            zIndex: (selections as any[])?.some((s: any) => s.id === child.id) ? 100 : 1
                        }}
                        onClick={(e) => {
                            if (onSelect) {
                                e.stopPropagation();
                                onSelect(child.id, pageId, e.shiftKey);
                            }
                        }}
                    >
                        <WidgetRenderer it={{ ...child, parentId: it.id }} panels={panels} pageId={pageId} onSelect={onSelect} onDragStart={onDragStart} selections={selections} />
                    </div>
                ))}
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
            {it.type !== 'label' && renderIcon()}
        </div>
    );
};
