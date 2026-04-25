import React, { useContext, useState, useEffect, useMemo, useRef } from "react";
import { GridContext } from "../../context/GridContext";
import { WidgetRenderer } from "./WidgetRenderer";
import { safeHex } from "../../utils";

export const CanvasArea: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
    const context = useContext(GridContext) as any;
    if (!context) return <div style={{ color: 'white', padding: 20 }}>No GridContext</div>;

    const { 
        project, activeScreenId, setActiveScreenId, selections, setSelectedEntity, 
        addItem, updateItem, removeItem, addPage, removePage, updateScreen, scale, setScale, baseWidth, baseHeight, theme 
    } = context;

    const [dragInfo, setDragInfo] = useState<any>(null);
    const [screenDragInfo, setScreenDragInfo] = useState<any>(null);
    const [preview, setPreview] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Coordinate Math - Simplified
    const worldScreens = useMemo(() => {
        if (!project?.screens) return [];
        let autoX = 100;
        return project.screens.map((scr: any) => {
            const pages = scr.pages || [];
            const minX = pages.length > 0 ? Math.min(...pages.map((p: any) => p.x || 0)) : 0;
            const maxX = pages.length > 0 ? Math.max(...pages.map((p: any) => p.x || 0)) : 0;
            const minY = pages.length > 0 ? Math.min(...pages.map((p: any) => p.y || 0)) : 0;
            const maxY = pages.length > 0 ? Math.max(...pages.map((p: any) => p.y || 0)) : 0;
            
            const scrWidth = (maxX - minX + 1) * (baseWidth || 800);
            
            const worldX = scr.x ?? autoX;
            const worldY = scr.y ?? 100;

            const entry = {
                scr,
                x: worldX,
                y: worldY,
                offsetX: worldX - (minX * (baseWidth || 800)),
                offsetY: worldY - (minY * (baseHeight || 416)),
                width: scrWidth
            };
            
            autoX = Math.max(autoX, worldX + scrWidth + 500);
            return entry;
        });
    }, [project?.screens, baseWidth, baseHeight]);

    const worldPanels = useMemo(() => {
        if (!project?.panels) return [];
        let autoX = 100;
        // Calculate max Y of screens to place panels below
        const maxY = worldScreens.length > 0 ? Math.max(...worldScreens.map((e: any) => {
            const pages = e.scr.pages || [];
            const pageMaxY = pages.length > 0 ? Math.max(...pages.map((p: any) => p.y || 0)) : 0;
            const pageMinY = pages.length > 0 ? Math.min(...pages.map((p: any) => p.y || 0)) : 0;
            return e.offsetY + (pageMaxY - pageMinY + 1) * baseHeight;
        })) : 500;

        const panelStartY = maxY + 500;

        return project.panels.map((pan: any) => {
            const worldX = pan.x ?? autoX;
            const worldY = pan.y ?? panelStartY;

            const entry = {
                pan,
                x: worldX,
                y: worldY,
                width: pan.width || 160,
                height: pan.height || 416
            };
            
            autoX = Math.max(autoX, worldX + (pan.width || 160) + 200);
            return entry;
        });
    }, [project?.panels, worldScreens, baseHeight]);

    const [screenPreview, setScreenPreview] = useState<any>(null);
    const [panelPreview, setPanelPreview] = useState<any>(null);

    // Global drag logic
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (dragInfo) {
                const dx = (e.clientX - dragInfo.startX) / scale;
                const dy = (e.clientY - dragInfo.startY) / scale;
                
                let newX = dragInfo.initialX;
                let newY = dragInfo.initialY;
                let newW = dragInfo.initialWidth;
                let newH = dragInfo.initialHeight;

                const panel = project.panels.find((p: any) => p.id === dragInfo.pageId);
                const isPanel = !!panel;

                if (dragInfo.mode === 'move') {
                    newX = Math.round(dragInfo.initialX + dx);
                    newY = Math.round(dragInfo.initialY + dy);

                    // Boundary Clamp (Stay within Page)
                    newX = Math.max(0, Math.min(newX, baseWidth - newW));
                    newY = Math.max(0, Math.min(newY, baseHeight - newH));

                    // Reserved Area Clamping (Avoid overlap with Sidebars/Headers)
                    const entry = worldScreens.find((e:any) => e.scr.id === dragInfo.scrId);
                    const pg = entry?.scr.pages.find((p:any) => p.id === dragInfo.pageId);
                    if (pg) {
                        pg.items.forEach((other: any) => {
                            if (other.id !== dragInfo.id && other.type === 'panel-ref') {
                                // If it's a sidebar (left), push content to the right
                                if (other.x === 0 && other.width > 50 && other.height > 200) {
                                    newX = Math.max(other.width, newX);
                                }
                                // If it's a header (top), push content down
                                if (other.y === 0 && other.height > 20 && other.width > 200) {
                                    newY = Math.max(other.height, newY);
                                }
                            }
                        });
                    }

                    if (isPanel) {
                        newX = 0;
                        newW = panel.width;
                        newY = Math.max(0, Math.min(newY, panel.height - newH));
                    }
                    setPreview({ id: dragInfo.id, x: newX, y: newY, w: newW, h: newH });
                } else if (dragInfo.mode === 'resize') {
                    const handle = dragInfo.handle;
                    
                    if (handle.includes('e')) {
                        newW = Math.max(20, Math.round(dragInfo.initialWidth + dx));
                        newW = Math.min(newW, baseWidth - newX);
                    }
                    if (handle.includes('s')) {
                        newH = Math.max(20, Math.round(dragInfo.initialHeight + dy));
                        newH = Math.min(newH, baseHeight - newY);
                    }
                    if (handle.includes('w')) {
                        const deltaX = Math.round(dx);
                        const potentialW = dragInfo.initialWidth - deltaX;
                        const potentialX = dragInfo.initialX + deltaX;
                        if (potentialW > 20 && potentialX >= 0) {
                            newW = potentialW;
                            newX = potentialX;
                        }
                    }
                    if (handle.includes('n')) {
                        const deltaY = Math.round(dy);
                        const potentialH = dragInfo.initialHeight - deltaY;
                        const potentialY = dragInfo.initialY + deltaY;
                        if (potentialH > 20 && potentialY >= 0) {
                            newH = potentialH;
                            newY = potentialY;
                        }
                    }

                    if (isPanel) {
                        newX = 0;
                        newW = panel.width;
                        newH = Math.min(newH, panel.height - newY);
                    }

                    setPreview({ id: dragInfo.id, x: newX, y: newY, w: newW, h: newH });
                }
            } else if (screenDragInfo) {
                const dx = (e.clientX - screenDragInfo.startX) / scale;
                const dy = (e.clientY - screenDragInfo.startY) / scale;
                const newX = Math.round(screenDragInfo.initialX + dx);
                const newY = Math.round(screenDragInfo.initialY + dy);

                if (screenDragInfo.type === 'panel') {
                    setPanelPreview({ id: screenDragInfo.id, x: newX, y: newY });
                } else {
                    setScreenPreview({ id: screenDragInfo.id, x: newX, y: newY });
                }
            }
        };
        const onUp = () => {
            if (dragInfo && preview) {
                const startScreen = worldScreens.find((e:any) => e.scr.id === dragInfo.scrId);
                if (startScreen && dragInfo.mode === 'move') {
                    const startPage = startScreen.scr.pages.find((p:any) => p.id === dragInfo.pageId);
                    if (startPage) {
                        const worldX = startScreen.offsetX + (startPage.x || 0) * baseWidth + preview.x;
                        const worldY = startScreen.offsetY + (startPage.y || 0) * baseHeight + preview.y;

                        // NEW: Search ALL screens for the target page
                        let targetPage: any = null;
                        let targetScr: any = null;
                        
                        for (const sEntry of worldScreens) {
                            const tp = sEntry.scr.pages.find((p:any) => {
                                const pX = sEntry.offsetX + (p.x || 0) * baseWidth;
                                const pY = sEntry.offsetY + (p.y || 0) * baseHeight;
                                return worldX >= pX && worldX < pX + baseWidth &&
                                       worldY >= pY && worldY < pY + baseHeight;
                            });
                            if (tp) {
                                targetPage = tp;
                                targetScr = sEntry;
                                break;
                            }
                        }

                        if (targetPage && targetPage.id !== dragInfo.pageId) {
                            const newRelX = worldX - (targetScr.offsetX + (targetPage.x || 0) * baseWidth);
                            const newRelY = worldY - (targetScr.offsetY + (targetPage.y || 0) * baseHeight);
                            context.moveItemToPage(dragInfo.pageId, targetPage.id, dragInfo.id, { x: newRelX, y: newRelY, width: preview.w, height: preview.h });
                        } else {
                            updateItem(dragInfo.pageId, dragInfo.id, { x: preview.x, y: preview.y, width: preview.w, height: preview.h });
                        }
                    } else {
                        updateItem(dragInfo.pageId, dragInfo.id, { x: preview.x, y: preview.y, width: preview.w, height: preview.h });
                    }
                } else {
                    updateItem(dragInfo.pageId, dragInfo.id, { x: preview.x, y: preview.y, width: preview.w, height: preview.h });
                }
            }
            if (screenDragInfo) {
                if (screenDragInfo.type === 'panel' && panelPreview) {
                    context.updatePanel(screenDragInfo.id, { x: panelPreview.x, y: panelPreview.y });
                } else if (screenDragInfo.type === 'screen' && screenPreview) {
                    updateScreen(screenDragInfo.id, { x: screenPreview.x, y: screenPreview.y });
                }
            }
            setPreview(null); setDragInfo(null); setScreenDragInfo(null);
            setScreenPreview(null); setPanelPreview(null);
        };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [dragInfo, preview, scale, updateItem, screenDragInfo, updateScreen, project.panels, context, screenPreview, panelPreview]);

    // Dynamic bounding box for the entire world
    const { worldWidth, worldHeight } = useMemo(() => {
        const screenMaxX = worldScreens.length > 0 ? Math.max(...worldScreens.map((e: any) => e.x + e.width)) : 0;
        const panelMaxX = worldPanels.length > 0 ? Math.max(...worldPanels.map((e: any) => e.x + e.width)) : 0;
        const maxX = Math.max(screenMaxX, panelMaxX, 2000);

        const screenMaxY = worldScreens.length > 0 ? Math.max(...worldScreens.map((e: any) => {
            const pages = e.scr.pages || [];
            const pageMaxY = pages.length > 0 ? Math.max(...pages.map((p: any) => p.y || 0)) : 0;
            const pageMinY = pages.length > 0 ? Math.min(...pages.map((p: any) => p.y || 0)) : 0;
            return e.offsetY + (pageMaxY - pageMinY + 1) * baseHeight;
        })) : 0;
        const panelMaxY = worldPanels.length > 0 ? Math.max(...worldPanels.map((e: any) => e.y + e.height)) : 0;
        const maxY = Math.max(screenMaxY, panelMaxY, 2000);

        return { worldWidth: maxX + 1000, worldHeight: maxY + 1000 };
    }, [worldScreens, worldPanels, baseHeight]);

    // Auto-scroll to active screen
    useEffect(() => {
        const activeEntry = worldScreens.find((e: any) => e.scr.id === activeScreenId);
        if (activeEntry && containerRef.current) {
            // Instant zoom to 100%
            setScale(1.0);
            
            const viewport = containerRef.current;
            const targetScale = 1.0;
            
            // Calculate center of Page 0,0
            const pageCenterX = activeEntry.offsetX + (baseWidth / 2);
            const pageCenterY = activeEntry.offsetY + (baseHeight / 2);
            
            const scrollLeft = (pageCenterX * targetScale) - (viewport.clientWidth / 2);
            const scrollTop = (pageCenterY * targetScale) - (viewport.clientHeight / 2);

            viewport.scrollTo({
                left: Math.max(0, scrollLeft),
                top: Math.max(0, scrollTop),
                behavior: 'auto'
            });
        }
    }, [activeScreenId, worldScreens, baseWidth, baseHeight, setScale]);

    // Mouse Wheel Zoom
    useEffect(() => {
        const viewport = containerRef.current;
        if (!viewport) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY;
                const factor = delta > 0 ? 0.9 : 1.1;
                setScale((prev: number) => {
                    const next = prev * factor;
                    return Math.min(Math.max(next, 0.05), 3.0);
                });
            }
        };

        viewport.addEventListener('wheel', handleWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', handleWheel);
    }, [setScale]);

    if (!project) return <div>No Project</div>;

    const selectedEntity = selections?.[activeScreenId];

    return (
        <div className="canvas-area" ref={containerRef} onClick={() => setSelectedEntity(null)} style={{ background: theme === 'dark' ? '#020617' : '#f1f5f9', overflow: 'auto', position: 'relative', width: '100%', height: '100%' }}>
            <div className="world-map-container" style={{ width: worldWidth, height: worldHeight, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0 }}>
                {worldScreens.map((entry: any) => {
                    const scr = entry.scr;
                    const isActive = activeScreenId === scr.id;
                    const x = entry.x;
                    const y = entry.y;

                    // Calculate screen bounding box
                    const pages = scr.pages || [];
                    const minX = pages.length > 0 ? Math.min(...pages.map((p: any) => p.x || 0)) : 0;
                    const minY = pages.length > 0 ? Math.min(...pages.map((p: any) => p.y || 0)) : 0;
                    const maxX = pages.length > 0 ? Math.max(...pages.map((p: any) => p.x || 0)) : 0;
                    const maxY = pages.length > 0 ? Math.max(...pages.map((p: any) => p.y || 0)) : 0;

                    const screenX = entry.offsetX + minX * baseWidth;
                    const screenY = entry.offsetY + minY * baseHeight;
                    const screenWidth = (maxX - minX + 1) * baseWidth;
                    const screenHeight = (maxY - minY + 1) * baseHeight;

                    return (
                        <div key={scr.id} style={{ position: 'absolute', left: 0, top: 0 }}>
                            {/* Screen Frame (Background & Solid Border) */}
                            <div style={{
                                position: 'absolute',
                                left: screenX,
                                top: screenY,
                                width: screenWidth,
                                height: screenHeight,
                                background: scr.bg !== undefined ? `#${safeHex(scr.bg)}` : '#0e0e12',
                                border: `2px solid ${isActive ? '#6366f1' : '#334155'}`,
                                borderRadius: '16px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                                zIndex: isActive ? 5 : 1,
                                overflow: 'hidden'
                            }} />

                            {/* Screen Header / Drag Handle */}
                            <div 
                                onMouseDown={(e) => { 
                                    e.stopPropagation(); 
                                    setActiveScreenId(scr.id); 
                                    setScreenDragInfo({ id: scr.id, startX: e.clientX, startY: e.clientY, initialX: x, initialY: y, type: 'screen' }); 
                                }}
                                style={{ 
                                    position: 'absolute', 
                                    left: screenX, 
                                    top: screenY - 50, 
                                    width: screenWidth,
                                    height: 50,
                                    padding: '0 20px', 
                                    background: isActive ? 'rgba(99, 102, 241, 0.05)' : 'rgba(148, 163, 184, 0.02)', 
                                    border: `2px dashed ${isActive ? '#6366f1' : '#cbd5e1'}`,
                                    borderBottom: 'none',
                                    borderRadius: '12px 12px 0 0', 
                                    display: 'flex',
                                    alignItems: 'center',
                                    zIndex: 20,
                                    cursor: 'move'
                                }}
                            >
                                <div style={{ fontSize: '18px', fontWeight: 900, color: isActive ? '#6366f1' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                    {scr.name}
                                </div>
                                <div style={{ marginLeft: '15px', fontSize: '10px', color: '#64748b', fontWeight: 800, letterSpacing: '1px', opacity: 0.5 }}>⠿ DRAG HANDLE</div>
                            </div>
                            {scr.pages.map((pg: any) => (
                                <div 
                                    key={pg.id}
                                    onClick={(e) => { e.stopPropagation(); setActiveScreenId(scr.id); setSelectedEntity({ type: 'page', id: pg.id }); }}
                                    style={{
                                        position: 'absolute', 
                                        left: entry.offsetX + (pg.x||0)*baseWidth, 
                                        top: entry.offsetY + (pg.y||0)*baseHeight, 
                                        width: baseWidth, height: baseHeight,
                                        background: 'transparent',
                                        border: `1px dashed ${isActive ? 'rgba(99, 102, 241, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                                        zIndex: 10
                                    }}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        const raw = e.dataTransfer.getData("application/gridos-item");
                                        if (!raw) return;
                                        const data = JSON.parse(raw);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        addItem(data.type, pg.id, undefined, data.panelId, Math.round((e.clientX - rect.left)/scale), Math.round((e.clientY - rect.top)/scale));
                                    }}
                                >
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                                        {/* Page Indicator */}
                                        {(pg.x === 0 && pg.y === 0) ? (
                                            <div 
                                                style={{ 
                                                    position: 'absolute', top: 5, left: 5, 
                                                    background: 'rgba(99, 102, 241, 0.1)', 
                                                    color: '#6366f1', padding: '2px 8px', 
                                                    borderRadius: '4px', fontSize: '9px', fontWeight: 'bold'
                                                }}
                                            >
                                                PRIMARY PAGE
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removePage(scr.id, pg.id); }}
                                                style={{ 
                                                    position: 'absolute', top: 5, right: 5, 
                                                    background: '#fee2e2', color: '#ef4444', 
                                                    border: 'none', borderRadius: '4px', 
                                                    width: 18, height: 18, cursor: 'pointer', 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                    fontSize: '11px', fontWeight: 'bold', zIndex: 100,
                                                    opacity: 0.6, transition: 'opacity 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                            >✕</button>
                                        )}

                                        {pg.items?.map((it: any) => {
                                            const isSelected = selectedEntity?.id === it.id;
                                            const isPv = preview?.id === it.id;
                                            const w = isPv ? (preview.w ?? it.width ?? 120) : (it.width ?? 120);
                                            const h = isPv ? (preview.h ?? it.height ?? 40) : (it.height ?? 40);
                                            const x = isPv ? preview.x : it.x;
                                            const y = isPv ? preview.y : it.y;
                                            return (
                                                <div key={it.id} 
                                                    onMouseDown={e => { e.stopPropagation(); setActiveScreenId(scr.id); setSelectedEntity({ type: 'item', id: it.id, pageId: pg.id }); setDragInfo({ id: it.id, pageId: pg.id, scrId: scr.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: w, initialHeight: h, mode: 'move' }); }}
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ 
                                                        position: 'absolute', 
                                                        left: x, top: y, 
                                                        width: w, height: h, 
                                                        zIndex: isSelected ? 100 : (it.type === 'panel-ref' ? 0 : 1), 
                                                        outline: isSelected ? '2px dashed #6366f1' : (it.type === 'panel-ref' ? '2px dashed rgba(99, 102, 241, 0.4)' : 'none'), 
                                                        outlineOffset: '-2px', 
                                                        userSelect: 'none' 
                                                    }}>
                                                    <WidgetRenderer 
                                                        it={it} 
                                                        panels={project.panels} 
                                                        pageId={pg.id} 
                                                        selectedId={selectedEntity?.id}
                                                        onSelect={(id, pid) => setSelectedEntity({ type: 'item', id, pageId: pid })}
                                                    />
                                                    {it.type === 'panel-ref' && (
                                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', background: 'rgba(99, 102, 241, 0.03)', border: '1px dashed #6366f1', opacity: 0.5 }}>
                                                            <div style={{ position: 'absolute', top: 4, left: 4, fontSize: '9px', color: '#6366f1', fontWeight: 900, opacity: 0.8 }}>MASTER PANEL AREA</div>
                                                        </div>
                                                    )}
                                                    {isSelected && (
                                                        <>
                                                            {/* 8-point resize handles */}
                                                            {[
                                                                { h: 'nw', c: 'nw-resize', t: -6, l: -6 },
                                                                { h: 'n',  c: 'n-resize',  t: -6, l: '50%', ml: -6 },
                                                                { h: 'ne', c: 'ne-resize', t: -6, r: -6 },
                                                                { h: 'e',  c: 'e-resize',  t: '50%', r: -6, mt: -6 },
                                                                { h: 'se', c: 'se-resize', b: -6, r: -6 },
                                                                { h: 's',  c: 's-resize',  b: -6, l: '50%', ml: -6 },
                                                                { h: 'sw', c: 'sw-resize', b: -6, l: -6 },
                                                                { h: 'w',  c: 'w-resize',  t: '50%', l: -6, mt: -6 },
                                                            ].map(handle => (
                                                                <div 
                                                                    key={handle.h}
                                                                    onMouseDown={e => { e.stopPropagation(); setDragInfo({ id: it.id, pageId: pg.id, scrId: scr.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: w, initialHeight: h, mode: 'resize', handle: handle.h }); }}
                                                                    style={{ 
                                                                        position: 'absolute', 
                                                                        top: handle.t, left: handle.l, right: handle.r, bottom: handle.b,
                                                                        marginTop: handle.mt, marginLeft: handle.ml,
                                                                        width: 12, height: 12, background: '#6366f1', 
                                                                        cursor: handle.c, zIndex: 1000, borderRadius: '2px', border: '1px solid white' 
                                                                    }} 
                                                                />
                                                            ))}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); removeItem(pg.id, it.id); }}
                                                                style={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', zIndex: 101, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                                            >✕</button>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Quick add buttons */}
                                    {!scr.pages.some((p: any) => p.x === (pg.x||0)+1 && p.y === (pg.y||0)) && (
                                        <div 
                                            style={{ position: 'absolute', right: -25, top: '50%', transform: 'translateY(-50%)', width: 20, height: 40, background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#6366f1', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }}
                                            onClick={(e) => { e.stopPropagation(); addPage(scr.id, (pg.x||0)+1, (pg.y||0)); }}
                                            title="Add page to right"
                                        >＋</div>
                                    )}
                                    {!scr.pages.some((p: any) => p.x === (pg.x||0) && p.y === (pg.y||0)+1) && (
                                        <div 
                                            style={{ position: 'absolute', bottom: -25, left: '50%', transform: 'translateX(-50%)', width: 40, height: 20, background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#6366f1', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }}
                                            onClick={(e) => { e.stopPropagation(); addPage(scr.id, (pg.x||0), (pg.y||0)+1); }}
                                            title="Add page below"
                                        >＋</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })}

                {/* MASTER PANELS AREA */}
                {worldPanels.map((entry: any) => {
                    const pan = entry.pan;
                    const isSelected = selectedEntity?.id === pan.id;
                    return (
                        <div key={pan.id} style={{ position: 'absolute', left: 0, top: 0 }}>
                            <div 
                                onMouseDown={(e) => { e.stopPropagation(); setScreenDragInfo({ id: pan.id, startX: e.clientX, startY: e.clientY, initialX: entry.x, initialY: entry.y, type: 'panel' }); }}
                                style={{ position: 'absolute', left: entry.x, top: entry.y - 60, padding: '5px 15px', background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent', borderRadius: '8px', cursor: 'move', userSelect: 'none' }}
                            >
                                <div style={{ fontSize: '24px', fontWeight: 900, color: isSelected ? '#6366f1' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                    🧩 {pan.name}
                                </div>
                            </div>
                            <div 
                                onClick={(e) => { e.stopPropagation(); setSelectedEntity({ type: 'panel', id: pan.id }); }}
                                style={{
                                    position: 'absolute', 
                                    left: entry.x, 
                                    top: entry.y, 
                                    width: pan.width, height: pan.height,
                                    background: pan.bg ? `#${safeHex(pan.bg)}` : '#1e1e2d',
                                    border: `2px solid ${isSelected ? '#6366f1' : '#334155'}`,
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    zIndex: 5
                                }}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    e.preventDefault();
                                    const raw = e.dataTransfer.getData("application/gridos-item");
                                    if (!raw) return;
                                    const data = JSON.parse(raw);
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    addItem(data.type, pan.id, undefined, data.panelId, Math.round((e.clientX - rect.left)/scale), Math.round((e.clientY - rect.top)/scale));
                                }}
                            >
                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    {(() => {
                                        let packedYMap: Record<string, number> | null = null;
                                        
                                        if (preview && dragInfo?.pageId === pan.id) {
                                            const elementsWithPreview = (pan.elements || []).map((it: any) => {
                                                if (preview.id === it.id) return { ...it, ...preview };
                                                return it;
                                            });
                                            elementsWithPreview.sort((a: any, b: any) => {
                                                const centerA = a.y + ((a.height || 50) / 2);
                                                const centerB = b.y + ((b.height || 50) / 2);
                                                return centerA - centerB;
                                            });
                                            let currentY = 0;
                                            packedYMap = {};
                                            elementsWithPreview.forEach((el: any) => {
                                                packedYMap![el.id] = currentY;
                                                currentY += (el.height || 50);
                                            });
                                        }

                                        return pan.elements?.map((it: any) => {
                                            const isItSelected = selectedEntity?.id === it.id;
                                            const isPv = preview?.id === it.id;
                                            
                                            let displayY = it.y;
                                            if (packedYMap) {
                                                if (isPv) {
                                                    displayY = preview.y;
                                                } else {
                                                    displayY = packedYMap[it.id];
                                                }
                                            } else if (isPv) {
                                                displayY = preview.y;
                                            }

                                            const w = isPv ? (preview.w ?? it.width ?? pan.width) : (it.width ?? pan.width);
                                            const h = isPv ? (preview.h ?? it.height ?? 50) : (it.height ?? 50);
                                            const x = isPv ? preview.x : it.x;
                                            const y = displayY;

                                            return (
                                                <div key={it.id} 
                                                    onMouseDown={e => { e.stopPropagation(); setActiveScreenId('panel'); setSelectedEntity({ type: 'item', id: it.id, pageId: pan.id }, 'panel'); setDragInfo({ id: it.id, pageId: pan.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: w, initialHeight: h, mode: 'move' }); }}
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ position: 'absolute', left: x, top: y, width: w, height: h, zIndex: isItSelected ? 100 : 1, outline: isItSelected ? '2px dashed #6366f1' : 'none', outlineOffset: '-2px', userSelect: 'none', transition: isPv ? 'none' : 'top 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                                                    <WidgetRenderer 
                                                        it={it} 
                                                        panels={project.panels} 
                                                        pageId={pan.id} 
                                                        selectedId={selectedEntity?.id}
                                                        onSelect={(id, pid) => setSelectedEntity({ type: 'item', id, pageId: pid }, 'panel')}
                                                    />
                                                    {isItSelected && (
                                                        <>
                                                            {[
                                                                { h: 'n',  c: 'ns-resize', t: -6, l: '50%', ml: -6 },
                                                                { h: 's',  c: 'ns-resize', b: -6, l: '50%', ml: -6 },
                                                            ].map(handle => (
                                                                <div 
                                                                    key={handle.h}
                                                                    onMouseDown={e => { e.stopPropagation(); setDragInfo({ id: it.id, pageId: pan.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: w, initialHeight: h, mode: 'resize', handle: handle.h }); }}
                                                                    style={{ 
                                                                        position: 'absolute', 
                                                                        top: handle.t, left: handle.l, bottom: handle.b,
                                                                        marginLeft: handle.ml,
                                                                        width: 12, height: 12, background: '#6366f1', 
                                                                        cursor: handle.c, zIndex: 1000, borderRadius: '2px', border: '1px solid white' 
                                                                    }} 
                                                                />
                                                            ))}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); removeItem(pan.id, it.id); }}
                                                                style={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', zIndex: 101, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                                            >✕</button>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Controls */}
            <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#1e293b', padding: '10px', borderRadius: '10px', color: 'white', display: 'flex', gap: '15px', alignItems: 'center', zIndex: 1000 }}>
                <button onClick={() => setScale((s:any) => s-0.1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>−</button>
                <span>{Math.round(scale*100)}%</span>
                <button onClick={() => setScale((s:any) => s+0.1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>＋</button>
            </div>
        </div>
    );
};
