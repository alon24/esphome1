import React, { useContext, useState, useEffect } from "react";
import { GridContext } from "../../context/GridContext";
import { WidgetRenderer } from "./WidgetRenderer";
import { safeHex } from "../../utils";

export const CanvasArea: React.FC<{
    isMobile: boolean;
}> = ({ isMobile }) => {
    const { 
        project, 
        activeScreenId, 
        selections, 
        setSelectedEntity, 
        addItem, 
        updateItem, 
        addPage,
        baseWidth,
        baseHeight,
        scale,
        setScale
    } = useContext(GridContext) as any;

    const [dragInfo, setDragInfo] = useState<{ id: string, pageId: string, startX: number, startY: number, initialX: number, initialY: number, initialWidth: number, initialHeight: number, mode: 'move' | 'resize_br' | 'resize_bl' | 'resize_r' | 'resize_b' | 'resize_l' } | null>(null);
    const [preview, setPreview] = useState<{ x: number, y: number, w: number, h: number, id: string } | null>(null);

    const activeScreen = project.screens.find((s: any) => s.id === activeScreenId) || project.screens[0];
    const selectedEntity = selections[activeScreenId] || selections['main'];
    
    // Zoom/Scale logic
    useEffect(() => {
        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!dragInfo) return;
            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
            const dx = (clientX - dragInfo.startX) / scale;
            const dy = (clientY - dragInfo.startY) / scale;

            if (dragInfo.mode === 'move') {
                setPreview({
                    id: dragInfo.id,
                    x: Math.round(dragInfo.initialX + dx),
                    y: Math.round(dragInfo.initialY + dy),
                    w: dragInfo.initialWidth,
                    h: dragInfo.initialHeight
                });
            } else if (dragInfo.mode === 'resize_r') {
                setPreview({
                    id: dragInfo.id,
                    x: dragInfo.initialX,
                    y: dragInfo.initialY,
                    w: Math.max(10, Math.round(dragInfo.initialWidth + dx)),
                    h: dragInfo.initialHeight
                });
            } else if (dragInfo.mode === 'resize_b') {
                setPreview({
                    id: dragInfo.id,
                    x: dragInfo.initialX,
                    y: dragInfo.initialY,
                    w: dragInfo.initialWidth,
                    h: Math.max(10, Math.round(dragInfo.initialHeight + dy))
                });
            } else if (dragInfo.mode === 'resize_l') {
                setPreview({
                    id: dragInfo.id,
                    x: Math.round(dragInfo.initialX + dx),
                    y: dragInfo.initialY,
                    w: Math.max(10, Math.round(dragInfo.initialWidth - dx)),
                    h: dragInfo.initialHeight
                });
            } else if (dragInfo.mode === 'resize_br') {
                setPreview({
                    id: dragInfo.id,
                    x: dragInfo.initialX,
                    y: dragInfo.initialY,
                    w: Math.max(10, Math.round(dragInfo.initialWidth + dx)),
                    h: Math.max(10, Math.round(dragInfo.initialHeight + dy))
                });
            } else if (dragInfo.mode === 'resize_bl') {
                setPreview({
                    id: dragInfo.id,
                    x: Math.round(dragInfo.initialX + dx),
                    y: dragInfo.initialY,
                    w: Math.max(10, Math.round(dragInfo.initialWidth - dx)),
                    h: Math.max(10, Math.round(dragInfo.initialHeight + dy))
                });
            }
        };

        const onUp = () => {
            if (dragInfo && preview) {
                updateItem(dragInfo.pageId, dragInfo.id, { x: preview.x, y: preview.y, width: preview.w, height: preview.h });
                // We don't nullify preview immediately to prevent the canvas onClick from firing and deselecting
                setTimeout(() => setPreview(null), 50);
            }
            setDragInfo(null);
        };

        if (dragInfo) {
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [dragInfo, preview, scale, updateItem]);

    const headerHeight = 24; // Status bar height on device
    const canvasWidth = Math.max(...activeScreen.pages.map((p: any) => p.x + baseWidth), baseWidth);
    const canvasHeight = Math.max(...activeScreen.pages.map((p: any) => p.y + baseHeight), baseHeight);

    return (
        <div className="canvas-area">
            {/* Active Page Floating Bar (Modern Design) */}
            <div className="active-page-bar">
                <span className="apb-screen">{activeScreenId}</span>
                <span className="apb-sep">/</span>
                <span className="apb-page">
                    {selectedEntity?.type === 'page' ? selectedEntity.id : '...'}
                </span>
                <div className="page-switcher">
                    {activeScreen.pages.map((pg: any) => (
                        <div 
                            key={pg.id} 
                            className={`psw-btn ${selectedEntity?.id === pg.id ? 'active' : ''}`}
                            onClick={() => setSelectedEntity({ type: 'page', id: pg.id })}
                        >
                            {pg.name}
                        </div>
                    ))}
                    <div 
                        className="psw-btn" 
                        style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
                        onClick={() => addPage(activeScreenId, canvasWidth, 0)}
                    >
                        ＋ page
                    </div>
                </div>
            </div>

            {/* Device Frame */}
            <div 
                className="device-frame" 
                style={{ 
                    width: `${baseWidth}px`, 
                    height: `${baseHeight + headerHeight}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center'
                }}
            >
                <div className="device-status">
                    <span className="dtime">14:32</span>
                    <span>{activeScreenId}</span>
                    <div className="spacer"></div>
                    <span>📶</span><span>🔋</span>
                </div>
                
                <div 
                    className="device-canvas" 
                    style={{ background: `#${safeHex(activeScreen.bg)}` }}
                    onClick={(e) => {
                        // Prevent deselect if we just finished dragging/resizing
                        if (preview) return; 
                        (document.activeElement as HTMLElement)?.blur();
                        setSelectedEntity({ type: 'screen', id: activeScreenId });
                    }}
                >
                    {activeScreen.pages.map((pg: any) => (
                        <div 
                            key={pg.id} 
                            style={{ 
                                position: "absolute", 
                                left: pg.x, 
                                top: pg.y, 
                                width: baseWidth, 
                                height: baseHeight, 
                                outline: (selectedEntity?.type === 'page' && selectedEntity.id === pg.id) ? "2px dashed #a78bfa" : "none",
                                zIndex: 1
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                (document.activeElement as HTMLElement)?.blur();
                                setSelectedEntity({ type: 'page', id: pg.id });
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "copy";
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                try {
                                    const raw = e.dataTransfer.getData("application/gridos-item");
                                    if (!raw) return;
                                    const data = JSON.parse(raw);
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const dropX = Math.round((e.clientX - rect.left) / scale);
                                    const dropY = Math.round((e.clientY - rect.top) / scale);
                                    
                                    addItem(
                                        data.type, 
                                        pg.id, 
                                        undefined, 
                                        data.panelId, 
                                        dropX, 
                                        dropY, 
                                        data.meta,
                                        true
                                    );
                                } catch (err) {
                                    console.error("Drop failed", err);
                                }
                            }}
                        >
                            {pg.items.map((it: any) => {
                                const isSelected = selectedEntity?.id === it.id;
                                const isPreviewing = preview?.id === it.id && preview;
                                const x = isPreviewing ? (preview as any).x : it.x;
                                const y = isPreviewing ? (preview as any).y : it.y;
                                const w = isPreviewing ? (preview as any).w : it.width;
                                const h = isPreviewing ? (preview as any).h : it.height;

                                return (
                                    <div 
                                        key={it.id} 
                                        className={`cv-widget ${isSelected ? 'selected' : ''}`}
                                        style={{ 
                                            left: x, 
                                            top: y, 
                                            width: w, 
                                            height: h,
                                            boxShadow: isPreviewing ? "0 0 20px rgba(99,102,241,0.5)" : (isSelected ? "0 0 15px rgba(99,102,241,0.3)" : "none"),
                                            zIndex: isSelected ? 10 : 1
                                        }}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            (document.activeElement as HTMLElement)?.blur();
                                            setSelectedEntity({ type: 'item', id: it.id, pageId: pg.id });
                                            setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "move" });
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                        }}
                                    >
                                        <WidgetRenderer 
                                            it={it} 
                                            panels={project.panels} 
                                            pageId={pg.id} 
                                            onSelect={(id, pId) => {
                                                (document.activeElement as HTMLElement)?.blur();
                                                setSelectedEntity({ type: 'item', id, pageId: pId });
                                            }} 
                                            selectedId={selectedEntity?.id} 
                                        />
                                        {isSelected && (
                                            <>
                                                <div 
                                                    className="resize-handle r" 
                                                    onMouseDown={(e) => { 
                                                        e.stopPropagation(); 
                                                        setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "resize_r" }); 
                                                    }}
                                                />
                                                <div 
                                                    className="resize-handle b" 
                                                    onMouseDown={(e) => { 
                                                        e.stopPropagation(); 
                                                        setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "resize_b" }); 
                                                    }}
                                                />
                                                <div 
                                                    className="resize-handle l" 
                                                    onMouseDown={(e) => { 
                                                        e.stopPropagation(); 
                                                        setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "resize_l" }); 
                                                    }}
                                                />
                                                <div 
                                                    className="resize-handle br" 
                                                    onMouseDown={(e) => { 
                                                        e.stopPropagation(); 
                                                        setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "resize_br" }); 
                                                    }}
                                                />
                                                <div 
                                                    className="resize-handle bl" 
                                                    onMouseDown={(e) => { 
                                                        e.stopPropagation(); 
                                                        setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "resize_bl" }); 
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Zoom Controls */}
            {!isMobile && (
                <div className="zoom-controls">
                    <div className="zoom-label">{Math.round(scale * 100)}%</div>
                    <button className="zoom-btn" onClick={() => setScale(Math.max(0.1, scale - 0.1))}>−</button>
                    <button className="zoom-btn" onClick={() => setScale(Math.min(3, scale + 0.1))}>＋</button>
                    <button className="zoom-btn" style={{ fontSize: '12px' }} onClick={() => setScale(1)}>1:1</button>
                </div>
            )}
        </div>
    );
};
