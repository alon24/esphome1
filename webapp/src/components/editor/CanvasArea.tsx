import React, { useContext, useState, useEffect, useRef } from "react";
import { GridContext } from "../../context/GridContext";
import { WidgetRenderer } from "./WidgetRenderer";
import { safeHex } from "../../utils";
import { type GridItem, type Page, type Screen } from "../../types";

export const CanvasArea: React.FC<{
    isMobile: boolean;
}> = ({ isMobile }) => {
    const { 
        project, 
        selections, 
        selectedEntity, 
        setSelectedEntity, 
        addItem, 
        updateItem, 
        activeScreenId, 
        setActiveScreenId, 
        scale, 
        setScale, 
        baseWidth, 
        baseHeight, 
        addPage,
        theme 
    } = useContext(GridContext) as any;
    
    const containerRef = useRef<HTMLDivElement>(null);
    const activeScreen = project.screens.find((s: Screen) => s.id === activeScreenId) || project.screens[0];
    const activeSelection = selections[activeScreenId] || null;
    const activePageId = activeSelection?.pageId || activeSelection?.id || (activeScreen?.pages[0]?.id);
    
    const [isDragging, setIsDragging] = useState(false);
    const [dragInfo, setDragInfo] = useState<{ id: string, pageId: string, startX: number, startY: number, initialX: number, initialY: number, initialWidth: number, initialHeight: number, mode: 'move' | 'resize' } | null>(null);

    // Zoom handlers
    const handleZoomIn = () => setScale(Math.min(scale + 0.1, 2));
    const handleZoomOut = () => setScale(Math.max(scale - 0.1, 0.2));
    const handleZoomReset = () => setScale(1);

    const onWidgetMouseDown = (e: React.MouseEvent, it: GridItem, pageId: string, mode: 'move' | 'resize' = 'move') => {
        e.stopPropagation();
        setSelectedEntity({ type: 'item', id: it.id, pageId }, activeScreenId);
        
        setDragInfo({
            id: it.id,
            pageId,
            startX: e.clientX,
            startY: e.clientY,
            initialX: it.x,
            initialY: it.y,
            initialWidth: it.width,
            initialHeight: it.height,
            mode
        });
        setIsDragging(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragInfo) return;

            const dx = (e.clientX - dragInfo.startX) / scale;
            const dy = (e.clientY - dragInfo.startY) / scale;

            if (dragInfo.mode === 'move') {
                updateItem(dragInfo.pageId, dragInfo.id, {
                    x: Math.round(dragInfo.initialX + dx),
                    y: Math.round(dragInfo.initialY + dy)
                });
            } else if (dragInfo.mode === 'resize') {
                updateItem(dragInfo.pageId, dragInfo.id, {
                    width: Math.max(10, Math.round(dragInfo.initialWidth + dx)),
                    height: Math.max(10, Math.round(dragInfo.initialHeight + dy))
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setDragInfo(null);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragInfo, scale, updateItem]);

    const handleDrop = (e: React.DragEvent, pageId: string) => {
        e.preventDefault();
        const data = e.dataTransfer.getData("application/gridos-item");
        if (!data) return;

        try {
            const { type, meta, panelId } = JSON.parse(data);
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = Math.round((e.clientX - rect.left) / scale);
            const y = Math.round((e.clientY - rect.top) / scale);

            addItem(type, pageId, undefined, panelId, x, y, meta);
        } catch (err) {
            console.error("Drop failed", err);
        }
    };

    if (!activeScreen) return <div className="canvas-area">No Active Screen</div>;

    return (
        <div 
            className="canvas-area" 
            ref={containerRef}
            onClick={() => setSelectedEntity({ type: 'screen', id: activeScreenId }, activeScreenId)}
            onDragOver={(e) => e.preventDefault()}
        >
            {/* ZOOM CONTROLS */}
            <div className="zoom-controls">
                <div className="zoom-label">{Math.round(scale * 100)}%</div>
                <button className="zoom-btn" onClick={handleZoomOut}>−</button>
                <button className="zoom-btn" onClick={handleZoomReset}>⊙</button>
                <button className="zoom-btn" onClick={handleZoomIn}>＋</button>
            </div>

            {/* ACTIVE PAGE INDICATOR */}
            <div className="active-page-bar">
                <span className="apb-screen">{activeScreen.name}</span>
                <span className="apb-sep">/</span>
                <span className="apb-page">
                    {activeScreen.pages.find((p: Page) => p.id === activePageId)?.name || "Select Page"}
                </span>
                <div className="page-switcher">
                    {activeScreen.pages.map((p: Page) => (
                        <button 
                            key={p.id} 
                            className={`psw-btn ${activePageId === p.id ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedEntity({ type: 'page', id: p.id }, activeScreenId); }}
                        >
                            {activeScreen.pages.indexOf(p) + 1}
                        </button>
                    ))}
                    <button className="psw-btn" onClick={(e) => { e.stopPropagation(); addPage(activeScreenId, 0, 0); }}>＋</button>
                </div>
            </div>

            {/* DEVICE FRAME */}
            <div 
                className="device-frame" 
                style={{ 
                    width: baseWidth, 
                    height: baseHeight + 24, // + Status bar
                    transform: `scale(${scale})`,
                    background: `#${safeHex(activeScreen.bg || 0x000000)}`
                }}
            >
                <div className="device-status">
                    <span className="dtime">12:45</span>
                    <span className="spacer"></span>
                    <span>🔋 85%</span>
                    <span>📶</span>
                </div>

                <div 
                    className="device-canvas"
                    onDrop={(e) => handleDrop(e, activePageId)}
                    onDragOver={(e) => e.preventDefault()}
                >
                    {activeScreen.pages.map((pg: Page) => (
                        <div 
                            key={pg.id}
                            style={{ 
                                display: activePageId === pg.id ? 'block' : 'none',
                                width: '100%',
                                height: '100%',
                                position: 'relative'
                            }}
                        >
                            {pg.items.map((it: GridItem) => (
                                <div
                                    key={it.id}
                                    className={`cv-widget ${activeSelection?.id === it.id ? 'selected' : ''}`}
                                    style={{
                                        left: it.x,
                                        top: it.y,
                                        width: it.width,
                                        height: it.height,
                                        zIndex: activeSelection?.id === it.id ? 100 : 10,
                                        background: it.type === 'panel-ref' ? 'transparent' : 'none'
                                    }}
                                    onMouseDown={(e) => onWidgetMouseDown(e, it, pg.id)}
                                >
                                    <WidgetRenderer 
                                        it={it} 
                                        panels={project.panels} 
                                        pageId={pg.id} 
                                        onSelect={(id, pgId) => setSelectedEntity({ type: 'item', id, pageId: pgId }, activeScreenId)}
                                        selectedId={activeSelection?.id}
                                    />
                                    
                                    {/* RESIZE HANDLES */}
                                    {activeSelection?.id === it.id && (
                                        <>
                                            <div className="resize-handle br" onMouseDown={(e) => onWidgetMouseDown(e, it, pg.id, 'resize')} />
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
