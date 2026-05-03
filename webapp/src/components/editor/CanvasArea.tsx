import React, { useContext, useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { GridContext } from "../../context/GridContext";
import { WidgetRenderer } from "./WidgetRenderer";
import { safeHex, findItemRecursive, getAbsoluteOffset, getParentRecursive, findGridAtPositionRecursive } from "../../utils";

export const CanvasArea: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
    const context = useContext(GridContext) as any;
    if (!context) return <div style={{ color: 'white', padding: 20 }}>No GridContext</div>;

    const { 
        project, activeScreenId, setActiveScreenId, selections, setSelectedEntity, 
        addItem, updateItem, removeItem, addPage, removePage, updateScreen, scale, setScale, baseWidth, baseHeight, theme 
    } = context;

    const [previews, setPreviews] = useState<Record<string, {x:number, y:number, w?:number, h?:number}>>({});
    const [xrayMode, setXrayMode] = useState(false);
    const [dragInfo, setDragInfo] = useState<{ ids: string[], initialOffsets: Record<string, {x:number, y:number}>, startX: number, startY: number, mode: 'move' | 'resize', pageId: string, scrId: string, handle?: string } | null>(null);
    const [lasso, setLasso] = useState<{ startX: number, startY: number, x: number, y: number, w: number, h: number } | null>(null);
    const [screenDragInfo, setScreenDragInfo] = useState<any>(null);
    const [screenPreview, setScreenPreview] = useState<any>(null);
    const [panelPreview, setPanelPreview] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pendingScrollRef = useRef<{ x: number, y: number } | null>(null);
    const selectionSourceRef = useRef<'canvas' | 'other' | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: string, id: string, pageId: string } | null>(null);
    const longPressTimer = useRef<any>(null);

    useLayoutEffect(() => {
        if (pendingScrollRef.current && containerRef.current) {
            containerRef.current.scrollLeft = pendingScrollRef.current.x;
            containerRef.current.scrollTop = pendingScrollRef.current.y;
            pendingScrollRef.current = null;
        }
    }, [scale]);

    const [alignmentMode, setAlignmentMode] = useState(false);
    const [showMinimap, setShowMinimap] = useState(true);
    const [viewport, setViewport] = useState({ x: 0, y: 0, w: 0, h: 0, worldW: 5000, worldH: 5000 });

    // Global keyboard shortcuts
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl) {
                if (e.key === 'c') context.copySelection && context.copySelection();
                if (e.key === 'x') context.cutSelection && context.cutSelection();
                if (e.key === 'v') {
                    const sel = (selections[activeScreenId] || []);
                    let targetId = project.screens.find((s:any)=>s.id===activeScreenId)?.pages[0]?.id;
                    if (sel.length > 0) {
                        if (sel[0].type === 'panel') targetId = sel[0].id;
                        else if (sel[0].type === 'item') targetId = sel[0].pageId;
                    }
                    if (targetId && context.pasteSelection) context.pasteSelection(targetId);
                }
                if (e.key === 'z') {
                    if (e.shiftKey) context.redo();
                    else context.undo();
                }
                if (e.key === 'y') {
                    context.redo();
                }
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const sel = selections[activeScreenId] || [];
                sel.forEach((s: any) => context.removeItem(s.pageId, s.id));
            }
            if (e.key.toLowerCase() === 'l') {
                const sel = selections[activeScreenId] || [];
                if (sel.length > 1) setAlignmentMode(prev => !prev);
            }
        };
        const hideCtx = () => setContextMenu(null);
        window.addEventListener('mousedown', hideCtx);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('mousedown', hideCtx);
        };
    }, [context, selections, activeScreenId, project]);

    // Coordinate Math
    const { screenMaxX, screenMaxY } = useMemo(() => {
        let maxX = 800;
        let maxY = 480;
        if (project?.screens && project.screens.length > 0) {
            maxY = Math.max(...project.screens.map((s:any) => {
                const pages = s.pages || [];
                const maxPgY = pages.length > 0 ? Math.max(...pages.map((p: any) => p.y || 0)) : 0;
                return (s.y ?? 100) + (maxPgY + 1) * (baseHeight || 480) + 120;
            }));
            maxX = Math.max(...project.screens.map((s:any) => {
                const pages = s.pages || [];
                const maxPgX = pages.length > 0 ? Math.max(...pages.map((p: any) => p.x || 0)) : 0;
                return (s.x ?? 100) + (maxPgX + 1) * (baseWidth || 800) + 120;
            }));
        }
        return { screenMaxX: maxX, screenMaxY: maxY };
    }, [project?.screens, baseWidth, baseHeight]);

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
            const entry = { scr, x: worldX, y: worldY, offsetX: worldX - (minX * baseWidth), offsetY: worldY - (minY * baseHeight), width: scrWidth };
            autoX = Math.max(autoX, worldX + scrWidth + 500);
            return entry;
        });
    }, [project?.screens, baseWidth, baseHeight]);

    const worldPanels = useMemo(() => {
        if (!project?.panels) return [];
        
        const panelStartY = screenMaxY + 200;
        let currentX = 100; // Start aligning from the left edge (0,0 in their place)

        const entries = project.panels.map((pan: any) => {
            const width = pan.width || 160;
            const worldX = pan.x !== undefined ? pan.x : currentX;
            const worldY = Math.max(screenMaxY + 100, pan.y !== undefined ? pan.y : panelStartY);
            if (pan.x === undefined) {
                currentX = worldX + width + 100; // 100px gap for the next panel
            }
            return { pan, x: worldX, y: worldY, width, height: pan.height || 416 };
        });
        
        return entries;
    }, [project?.panels, screenMaxY]);

    const [mmItems, setMmItems] = useState<any[]>([]);
    const mmContentBounds = useMemo(() => {
        if (mmItems.length === 0) return { minX: 0, minY: 0, maxX: 2000, maxY: 2000, w: 2000, h: 2000 };
        const minX = Math.min(...mmItems.map(i => i.x));
        const minY = Math.min(...mmItems.map(i => i.y));
        const maxX = Math.max(...mmItems.map(i => i.x + i.w));
        const maxY = Math.max(...mmItems.map(i => i.y + i.h));
        const margin = 500;
        return { 
            minX: minX - margin, 
            minY: minY - margin, 
            maxX: maxX + margin, 
            maxY: maxY + margin,
            w: (maxX - minX) + margin * 2, 
            h: (maxY - minY) + margin * 2 
        };
    }, [mmItems]);

    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const inner = containerRef.current.querySelector('div[style*="transform"]') as HTMLElement;
                if (inner) {
                    const innerRect = inner.getBoundingClientRect();
                    
                    // Update Viewport
                    setViewport({
                        x: (rect.left - innerRect.left) / scale,
                        y: (rect.top - innerRect.top) / scale,
                        w: rect.width / scale,
                        h: rect.height / scale,
                        worldW: inner.scrollWidth, 
                        worldH: inner.scrollHeight
                    });

                    // Update Items
                    const screens = Array.from(containerRef.current.querySelectorAll('[id^="screen-"]'));
                    const panels = Array.from(containerRef.current.querySelectorAll('[id^="panel-"]'));
                    const pages = Array.from(containerRef.current.querySelectorAll('[id^="page-"]'));
                    
                    const items = [...screens, ...panels, ...pages].map(el => {
                        const r = el.getBoundingClientRect();
                        let type = 'screen';
                        if (el.id.startsWith('panel')) type = 'panel';
                        if (el.id.startsWith('page')) type = 'page';
                        
                        return {
                            id: el.id,
                            x: (r.left - innerRect.left) / scale,
                            y: (r.top - innerRect.top) / scale,
                            w: r.width / scale,
                            h: r.height / scale,
                            type
                        };
                    });
                    setMmItems(items);
                }
            }
        };
        const el = containerRef.current;
        el?.addEventListener('scroll', update);
        window.addEventListener('resize', update);
        const tid = setInterval(update, 2000);
        update();
        return () => {
            el?.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
            clearInterval(tid);
        };
    }, [scale, project, worldScreens, worldPanels]);

    const headerHeight = useMemo(() => {
        const h = project.panels.find((p: any) => p.name.toLowerCase().includes('header'));
        return h ? (h.height || 60) : 0;
    }, [project.panels]);

    // Auto-scroll to selection
    useEffect(() => {
        const selArray = selections[activeScreenId];
        if (!selArray || selArray.length === 0) return;

        if (selArray.length < 2) setAlignmentMode(false);
        
        // Don't auto-scroll if we just clicked it on the canvas
        if (selectionSourceRef.current === 'canvas') {
            selectionSourceRef.current = null; // Reset for next time
            return;
        }

        const sel = selArray[0];
        let targetId = "";
        if (sel.type === 'panel') targetId = `panel-${sel.id}`;
        else if (sel.type === 'screen') targetId = `screen-${sel.id}`;
        else if (sel.type === 'item') targetId = `item-${sel.id}`;

        if (targetId) {
            const el = document.getElementById(targetId);
            if (el) {
                // Check if already mostly in view to avoid jarring jumps
                const rect = el.getBoundingClientRect();
                const containerRect = containerRef.current?.getBoundingClientRect();
                if (containerRect) {
                    const isInView = (
                        rect.top >= containerRect.top &&
                        rect.left >= containerRect.left &&
                        rect.bottom <= containerRect.bottom &&
                        rect.right <= containerRect.right
                    );
                    if (!isInView) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    }
                }
            }
        }
        selectionSourceRef.current = null;
    }, [selections, activeScreenId]);

    const selectionBounds = useMemo(() => {
        const sel = selections[activeScreenId] || [];
        if (sel.length < 2) return null;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let found = false;

        sel.forEach((s: any) => {
            if (s.type !== 'item') return;
            // Get from project state directly for current values
            const scr = project.screens.find((sc: any) => sc.id === activeScreenId);
            const pg = scr?.pages.find((p: any) => p.id === s.pageId);
            const it = findItemRecursive(pg?.items || [], s.id);
            if (it) {
                minX = Math.min(minX, it.x);
                maxX = Math.max(maxX, it.x + it.width);
                minY = Math.min(minY, it.y);
                maxY = Math.max(maxY, it.y + it.height);
                found = true;
            }
        });

        if (!found) return null;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, pageId: sel.find((s: any) => s.pageId)?.pageId };
    }, [selections, activeScreenId, project]);

    const [guides, setGuides] = useState<{x?: number, y?: number, pageId: string}[]>([]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (dragInfo) {
                const dx = (e.clientX - dragInfo.startX) / scale;
                const dy = (e.clientY - dragInfo.startY) / scale;
                if (dragInfo.mode === 'move') {
                    const next: any = {};
                    const newGuides: any[] = [];
                    
                    dragInfo.ids.forEach(id => {
                        const init = dragInfo.initialOffsets[id];
                        let it: any = null;
                        
                        const scr = project.screens.find((s:any)=>s.id===activeScreenId);
                        if (scr) {
                            const pg = scr.pages.find((p:any)=>p.id===dragInfo.pageId);
                            it = findItemRecursive(pg?.items || [], id);
                        } else {
                            const pan = project.panels.find((p:any)=>p.id===dragInfo.pageId);
                            it = findItemRecursive(pan?.elements || [], id);
                        }

                        if (it?.pinned || it?.type === 'header') {
                            next[id] = { x: 0, y: 0, w: baseWidth };
                        } else {
                            let newX = Math.round(init.x + dx);
                            let newY = Math.round(init.y + dy);

                            if (!e.altKey && dragInfo.scrId !== 'panel') {
                                const SNAP_DIST = 8;
                                const scr = project.screens.find((s:any)=>s.id===activeScreenId);
                                const pg = scr?.pages.find((p:any)=>p.id===dragInfo.pageId);
                                if (pg) {
                                    pg.items.forEach((other: any) => {
                                        if (dragInfo.ids.includes(other.id)) return;
                                        const myW = it.width || 0;
                                        const myH = it.height || 0;
                                        const otW = other.width || 0;
                                        const otH = other.height || 0;

                                        // Vertical Guides (Aligning X)
                                        if (Math.abs(newX - other.x) < SNAP_DIST) { newX = other.x; newGuides.push({x: other.x, pageId: pg.id}); }
                                        if (Math.abs((newX + myW) - (other.x + otW)) < SNAP_DIST) { newX = other.x + otW - myW; newGuides.push({x: other.x + otW, pageId: pg.id}); }
                                        if (Math.abs((newX + myW/2) - (other.x + otW/2)) < SNAP_DIST) { newX = other.x + otW/2 - myW/2; newGuides.push({x: other.x + otW/2, pageId: pg.id}); }

                                        // Horizontal Guides (Aligning Y)
                                        if (Math.abs(newY - other.y) < SNAP_DIST) { newY = other.y; newGuides.push({y: other.y, pageId: pg.id}); }
                                        if (Math.abs((newY + myH) - (other.y + otH)) < SNAP_DIST) { newY = other.y + otH - myH; newGuides.push({y: other.y + otH, pageId: pg.id}); }
                                        if (Math.abs((newY + myH/2) - (other.y + otH/2)) < SNAP_DIST) { newY = other.y + otH/2 - myH/2; newGuides.push({y: other.y + otH/2, pageId: pg.id}); }
                                    });
                                }
                            }

                            const panRef = it?.panelId ? project.panels.find((p: any) => p.id === it.panelId) : null;
                            const isHeader = it?.type === 'header' || it?.name?.toLowerCase().includes('header') || panRef?.name?.toLowerCase().includes('header');
                            const isSidePanel = it?.type === 'nav-menu' || it?.name?.toLowerCase().includes('sidebar') || panRef?.name?.toLowerCase().includes('sidebar');
                            const hPanel = project.panels.find((p: any) => p.name.toLowerCase().includes('header'));
                            const headerHeight = hPanel ? (hPanel.height || 60) : 0;

                            if (isHeader) { newX = 0; newY = 0; }
                            else if (isSidePanel) { newX = 0; newY = headerHeight; }

                            if (dragInfo.scrId === 'panel') {
                                const pan = project.panels.find((p:any)=>p.id===dragInfo.pageId);
                                if (pan) {
                                    const panW = pan.width || 160;
                                    const panH = pan.height || 416;
                                    const itW = it?.width || 50;
                                    const itH = it?.height || 50;
                                    newX = Math.max(0, Math.min(newX, panW - itW));
                                    newY = Math.max(0, Math.min(newY, panH - itH));
                                }
                            }
                            next[id] = { x: newX, y: newY, w: (init as any).w, h: (init as any).h };
                        }
                    });
                    setPreviews(next);
                    setGuides(newGuides);
                } else if (dragInfo.mode === 'resize' && dragInfo.ids.length === 1) {
                    const id = dragInfo.ids[0];
                    const init = dragInfo.initialOffsets[id];
                    let { x, y, w, h } = { x: init.x, y: init.y, w: 120, h: 40 };
                    
                    let it: any = null;
                    const scr = project.screens.find((s:any)=>s.id===activeScreenId);
                    if (scr) {
                        const pg = scr.pages.find((p:any)=>p.id===dragInfo.pageId);
                        it = findItemRecursive(pg?.items || [], id);
                    } else {
                        const pan = project.panels.find((p:any)=>p.id===dragInfo.pageId);
                        it = findItemRecursive(pan?.elements || [], id);
                    }

                    if (it) { 
                        w = it.width; h = it.height; 
                        if (it.type === 'header') {
                            x = 0; y = 0; w = baseWidth;
                        }
                    }
                    if (dragInfo.handle?.includes('e')) w = Math.round(w + dx);
                    if (dragInfo.handle?.includes('s')) h = Math.round(h + dy);
                    setPreviews({ [id]: { x, y, w, h } });
                }
            } else if (lasso) {
                const rect = document.getElementById('canvas-root')?.getBoundingClientRect();
                if (!rect) return;
                const curX = (e.clientX - rect.left) / scale;
                const curY = (e.clientY - rect.top) / scale;
                setLasso(prev => prev ? ({ ...prev, x: Math.min(prev.startX, curX), y: Math.min(prev.startY, curY), w: Math.abs(curX - prev.startX), h: Math.abs(curY - prev.startY) }) : null);
            } else if (screenDragInfo) {
                const dx = (e.clientX - screenDragInfo.startX) / scale;
                const dy = (e.clientY - screenDragInfo.startY) / scale;
                const newX = Math.round(screenDragInfo.initialX + dx);
                const newY = Math.round(screenDragInfo.initialY + dy);
                if (screenDragInfo.type === 'panel') setPanelPreview({ id: screenDragInfo.id, x: newX, y: Math.max(screenMaxY + 100, newY) });
                else setScreenPreview({ id: screenDragInfo.id, x: newX, y: newY });
            }
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        };

        const onUp = (e: MouseEvent) => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            if (dragInfo) {
                const dx = (e.clientX - dragInfo.startX) / scale;
                const dy = (e.clientY - dragInfo.startY) / scale;
                dragInfo.ids.forEach(id => {
                    const init = dragInfo.initialOffsets[id];
                    const pv = previews[id];
                    
                    if (dragInfo.ids.length === 1 && dragInfo.mode === 'move' && dragInfo.scrId !== 'panel') {
                        const startScreen = worldScreens.find((s:any) => s.scr.id === dragInfo.scrId);
                        if (startScreen) {
                            const startPage = startScreen.scr.pages.find((p:any) => p.id === dragInfo.pageId);
                            if (startPage) {
                                const pg = project.screens.find((s:any)=>s.id===activeScreenId)?.pages.find((p:any)=>p.id===dragInfo.pageId);
                                const it = findItemRecursive(pg?.items || [], id);
                                const panRef = it?.panelId ? project.panels.find((p: any) => p.id === it.panelId) : null;
                                const isHeader = it?.type === 'header' || it?.name?.toLowerCase().includes('header') || panRef?.name?.toLowerCase().includes('header');
                                const isSidePanel = it?.type === 'nav-menu' || it?.name?.toLowerCase().includes('sidebar') || panRef?.name?.toLowerCase().includes('sidebar');

                                const worldX = startScreen.offsetX + (startPage.x || 0) * baseWidth + (pv?.x ?? init.x);
                                const worldY = startScreen.offsetY + (startPage.y || 0) * baseHeight + (pv?.y ?? init.y);
                                
                                const centerX = worldX + (it?.width || 50) / 2;
                                const centerY = worldY + (it?.height || 50) / 2;

                                let targetPage: any = null; 
                                let targetScr: any = null;
                                
                                for (const sEntry of worldScreens) {
                                    const tp = sEntry.scr.pages.find((p:any) => {
                                        const pX = sEntry.offsetX + (p.x || 0) * baseWidth;
                                        const pY = sEntry.offsetY + (p.y || 0) * baseHeight;
                                        return centerX >= pX && centerX < pX + baseWidth && centerY >= pY && centerY < pY + baseHeight;
                                    });
                                    if (tp) { targetPage = tp; targetScr = sEntry; break; }
                                }
                                
                                if (targetPage) {
                                    let newRelX = worldX - (targetScr.offsetX + (targetPage.x || 0) * baseWidth);
                                    let newRelY = worldY - (targetScr.offsetY + (targetPage.y || 0) * baseHeight);
                                    
                                    newRelX = Math.max(0, Math.min(newRelX, baseWidth - (it?.width || 50)));
                                    newRelY = Math.max(0, Math.min(newRelY, baseHeight - (it?.height || 50)));
                                    
                                    if (it?.pinned || isHeader || isSidePanel) {
                                        let finalX = 0, finalY = 0;
                                        if (isHeader) { finalX = 0; finalY = 0; }
                                        else if (isSidePanel) { finalX = 0; finalY = headerHeight; }
                                        updateItem(dragInfo.pageId, id, { x: finalX, y: finalY });
                                    } else {
                                        const parentGrid = getParentRecursive(pg?.items || [], id);
                                        
                                        // Calculate center relative to target page
                                        const centerRelX = centerX - (targetScr.offsetX + (targetPage.x || 0) * baseWidth);
                                        const centerRelY = centerY - (targetScr.offsetY + (targetPage.y || 0) * baseHeight);

                                        const targetGrid = findGridAtPositionRecursive(targetPage.items, centerRelX, centerRelY);
                                        
                                        if (targetGrid && (it?.type === 'grid-item' || it?.type === 'label' || it?.type === 'panel-ref' || it?.type === 'btn')) {
                                            const gridAbs = getAbsoluteOffset(targetPage.items, targetGrid.id);
                                            const gap = targetGrid.gap !== undefined ? targetGrid.gap : 10;
                                            const colStep = (targetGrid.width - gap) / (targetGrid.cols || (targetGrid.type === 'pane-grid' ? 3 : 2));
                                            const rowStep = (targetGrid.height - gap) / (targetGrid.rows || 1);
                                            
                                            const relX = centerX - (targetScr.offsetX + (targetPage.x || 0) * baseWidth + gridAbs.x);
                                            const relY = centerY - (targetScr.offsetY + (targetPage.y || 0) * baseHeight + gridAbs.y);
                                            
                                            const newCol = Math.floor(Math.max(0, relX - gap) / colStep);
                                            const newRow = Math.floor(Math.max(0, relY - gap) / rowStep);
                                            
                                            console.log('DRAG_GRID', {
                                                targetGridId: targetGrid.id,
                                                gap, colStep, rowStep, relX, relY, newCol, newRow,
                                                cols: targetGrid.cols || (targetGrid.type === 'pane-grid' ? 3 : 2),
                                                rows: targetGrid.rows || 1,
                                                parentGridId: parentGrid?.id
                                            });
                                            
                                            if (newCol >= 0 && newCol < (targetGrid.cols || (targetGrid.type === 'pane-grid' ? 3 : 2)) && newRow >= 0 && newRow < (targetGrid.rows || 1)) {
                                                if (parentGrid && parentGrid.id === targetGrid.id) {
                                                    console.log('DRAG_GRID_REORDER', parentGrid.id, id, newCol, newRow);
                                                    context.reorderGridItem(parentGrid.id, id, newCol, newRow);
                                                } else {
                                                    console.log('DRAG_GRID_MOVE', targetGrid.id, id, newCol, newRow);
                                                    context.moveItemToGrid(dragInfo.pageId, targetGrid.id, id, newCol, newRow);
                                                }
                                                return;
                                            } else {
                                                console.log('DRAG_GRID_FAILED_BOUNDS');
                                            }
                                        }
                                        
                                        else {
                                            // Regular move on page
                                            if (targetPage.id !== dragInfo.pageId) context.moveItemToPage(dragInfo.pageId, targetPage.id, id, { x: newRelX, y: newRelY });
                                            else updateItem(dragInfo.pageId, id, { x: newRelX, y: newRelY });
                                        }
                                    }
                                } else {
                                    // Clamp to the original page bounds to "bounce back" into it
                                    const rawX = pv?.x ?? init.x;
                                    const rawY = pv?.y ?? init.y;
                                    const clampedX = Math.max(0, Math.min(rawX, baseWidth - (it?.width || 50)));
                                    const clampedY = Math.max(0, Math.min(rawY, baseHeight - (it?.height || 50)));
                                    updateItem(dragInfo.pageId, id, { x: clampedX, y: clampedY });
                                }
                            }
                        }
                    } else {
                        // For Panels or multiple selection, just update relative coords
                        let finalX = pv?.x ?? init.x;
                        let finalY = pv?.y ?? init.y;

                        let it: any = null;
                        const scr = project.screens.find((s:any)=>s.id===activeScreenId);
                        if (scr) {
                            const pg = scr.pages.find((p:any)=>p.id===dragInfo.pageId);
                            it = findItemRecursive(pg?.items || [], id);
                        } else {
                            const pan = project.panels.find((p:any)=>p.id===dragInfo.pageId);
                            it = findItemRecursive(pan?.elements || [], id);
                        }

                        const panRef = it?.panelId ? project.panels.find((p: any) => p.id === it.panelId) : null;
                        const isHeader = it?.type === 'header' || it?.name?.toLowerCase().includes('header') || panRef?.name?.toLowerCase().includes('header');
                        const isSidePanel = it?.type === 'nav-menu' || it?.name?.toLowerCase().includes('sidebar') || panRef?.name?.toLowerCase().includes('sidebar');

                        if (isHeader) {
                            finalX = 0;
                            finalY = 0;
                        } else if (isSidePanel) {
                            finalX = 0;
                            finalY = headerHeight;
                        }

                        if (dragInfo.scrId === 'panel') {
                            const pan = project.panels.find((p:any)=>p.id===dragInfo.pageId);
                            if (pan) {
                                const it = findItemRecursive(pan.elements, id);
                                const panW = pan.width || 160;
                                const panH = pan.height || 416;
                                const itW = pv?.w ?? it?.width ?? 50;
                                const itH = pv?.h ?? it?.height ?? 50;
                                finalX = Math.max(0, Math.min(finalX, panW - itW));
                                finalY = Math.max(0, Math.min(finalY, panH - itH));
                            }
                        }
                        const upPatch: any = { x: finalX, y: finalY };
                        if (pv?.w !== undefined) upPatch.width = pv.w;
                        if (pv?.h !== undefined) upPatch.height = pv.h;
                        updateItem(dragInfo.pageId, id, upPatch);
                    }
                });
                setDragInfo(null); setPreviews({}); setGuides([]);
            } else if (lasso) {
                const scr = project.screens.find((s: any) => s.id === activeScreenId);
                const selected: any[] = [];
                scr?.pages.forEach((pg: any) => pg.items.forEach((it: any) => {
                    const overlap = !(it.x > lasso.x + lasso.w || it.x + it.width < lasso.x || it.y > lasso.y + lasso.h || it.y + it.height < lasso.y);
                    if (overlap) selected.push({ type: 'item', id: it.id, pageId: pg.id });
                }));
                if (selected.length > 0) {
                    setSelectedEntity(null, activeScreenId);
                    selected.forEach((s: any) => setSelectedEntity(s, activeScreenId, true));
                } else setSelectedEntity(null, activeScreenId);
                setLasso(null);
            }
            if (screenDragInfo) {
                if (screenDragInfo.type === 'panel' && panelPreview) {
                    context.updatePanel(screenDragInfo.id, { 
                        x: panelPreview.x, 
                        y: Math.max(screenMaxY + 100, panelPreview.y) 
                    });
                } else if (screenDragInfo.type === 'screen' && screenPreview) {
                    updateScreen(screenDragInfo.id, { x: screenPreview.x, y: screenPreview.y });
                }
            }
            setScreenDragInfo(null); setScreenPreview(null); setPanelPreview(null);
        };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [dragInfo, previews, scale, updateItem, screenDragInfo, updateScreen, project.panels, context, screenPreview, panelPreview, baseWidth, baseHeight, worldScreens, lasso, activeScreenId, project.screens, setSelectedEntity]);

    // Zoom with Ctrl+Wheel
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                
                const rect = el.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                setScale((prev: number) => {
                    const zoomChange = e.deltaY > 0 ? -0.1 : 0.1;
                    const newScale = Math.max(0.1, Math.min(3, prev + zoomChange));
                    if (newScale === prev) return prev;
                    
                    // The core logic for zooming to mouse:
                    // 1. Find the mouse position in the canvas coordinate system (before scaling)
                    const canvasX = (mouseX + el.scrollLeft) / prev;
                    const canvasY = (mouseY + el.scrollTop) / prev;
                    
                    // 2. Set the new scroll position so that same canvas coordinate 
                    // ends up under the same mouse viewport position
                    pendingScrollRef.current = {
                        x: canvasX * newScale - mouseX,
                        y: canvasY * newScale - mouseY
                    };
                    
                    return newScale;
                });
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [setScale]);

    return (
        <div 
            id="canvas-root"
            ref={containerRef}
            style={{ flex: 1, position: 'relative', overflow: 'auto', background: '#ffffff', cursor: lasso ? 'crosshair' : 'default' }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / scale;
                    const y = (e.clientY - rect.top) / scale;
                    setLasso({ startX: x, startY: y, x, y, w: 0, h: 0 });
                    setSelectedEntity(null, activeScreenId);
                }
            }}
        >
            <div style={{ position: 'absolute', transform: `scale(${scale})`, transformOrigin: '0 0', width: '5000px', height: '5000px', padding: '1000px' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    e.preventDefault();
                    const dataStr = e.dataTransfer.getData("application/gridos-item");
                    if (dataStr) {
                        try {
                            const data = JSON.parse(dataStr);
                            const scr = project.screens.find((s:any)=>s.id===activeScreenId);
                            if (scr && scr.pages.length > 0) {
                                const pg = scr.pages[0];
                                addItem(data.type, pg.id, undefined, data.panelId, 0, 0, data.meta);
                            }
                        } catch(err) {}
                    }
                }}
            >
                {lasso && (
                    <div style={{ position: 'absolute', left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h, border: '1px solid #6366f1', background: 'rgba(99, 102, 241, 0.1)', zIndex: 10000, pointerEvents: 'none' }} />
                )}
                
                {/* Divider for Master Panels */}
                <div style={{ position: 'absolute', top: screenMaxY + 100, left: 100, width: Math.max(800, screenMaxX - 100), height: 2, background: 'rgba(148, 163, 184, 0.3)' }} />
                <div style={{ position: 'absolute', top: screenMaxY + 80, left: 100, color: 'rgba(148, 163, 184, 0.8)', fontSize: 12, fontWeight: 'bold' }}>MASTER PANELS</div>

                
                {worldScreens.map((entry: any) => {
                    const scr = entry.scr;
                    const isSelected = selections[activeScreenId]?.id === scr.id;
                    const isPv = screenPreview?.id === scr.id;
                    const displayX = isPv ? screenPreview.x : entry.x;
                    const displayY = isPv ? screenPreview.y : entry.y;

                    return (
                        <div key={scr.id} id={`screen-${scr.id}`} style={{ position: 'absolute', left: displayX, top: displayY, zIndex: isSelected ? 20 : 10 }}>
                            <div 
                                onMouseDown={e => { e.stopPropagation(); selectionSourceRef.current = 'canvas'; setScreenDragInfo({ type: 'screen', id: scr.id, startX: e.clientX, startY: e.clientY, initialX: entry.x, initialY: entry.y }); setSelectedEntity({ type: 'screen', id: scr.id }, activeScreenId); }}
                                style={{ background: '#6366f1', color: 'white', padding: '4px 12px', borderRadius: '8px 8px 0 0', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'grab', width: 'fit-content' }}
                            >
                                📺 {scr.name}
                            </div>
                            {scr.pages.map((pg: any) => {
                                const pgX = entry.offsetX + (pg.x || 0) * baseWidth;
                                const pgY = entry.offsetY + (pg.y || 0) * baseHeight;
                                return (
                                    <div key={pg.id} id={`page-${pg.id}`} style={{ 
                                        position: 'absolute', left: pgX - displayX, top: pgY - displayY + 24, 
                                        width: baseWidth, height: baseHeight, 
                                        background: '#fff', 
                                        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
                                        backgroundSize: '20px 20px',
                                        borderRadius: '0 0 12px 12px', 
                                        overflow: 'visible', 
                                        border: `2px solid rgba(148, 163, 184, 0.4)`, 
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                    }}
                                         onDragOver={e => e.preventDefault()}
                                         onDrop={e => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             const dataStr = e.dataTransfer.getData("application/gridos-item");
                                             if (dataStr) {
                                                 const data = JSON.parse(dataStr);
                                                 const rect = e.currentTarget.getBoundingClientRect();
                                                 let dropX = Math.round((e.clientX - rect.left)/scale);
                                                 let dropY = Math.round((e.clientY - rect.top)/scale);
                                                 dropX = Math.max(0, Math.min(dropX, baseWidth - 50));
                                                 dropY = Math.max(0, Math.min(dropY, baseHeight - 50));
                                                 addItem(data.type, pg.id, undefined, data.panelId, dropX, dropY, data.meta);
                                             }
                                         }}>
                                         {!(pg.x === 0 && pg.y === 0) && (
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); removePage(scr.id, pg.id); }}
                                                style={{ 
                                                    position: "absolute", top: -12, right: -12, 
                                                    width: 24, height: 24, borderRadius: "50%", 
                                                    background: "#ef4444", color: "white", 
                                                    display: "flex", alignItems: "center", justifyContent: "center", 
                                                    fontSize: "12px", fontWeight: "bold", cursor: "pointer", 
                                                    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                                                    zIndex: 10,
                                                    border: "2px solid white",
                                                    transition: "transform 0.1s"
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                                                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                                            >
                                                ✕
                                            </div>
                                         )}
                                         {alignmentMode && selectionBounds && selectionBounds.pageId === pg.id && (
                                             <div style={{ 
                                                 position: 'absolute', left: selectionBounds.x, top: selectionBounds.y, 
                                                 width: selectionBounds.w, height: selectionBounds.h, 
                                                 border: '2px dashed #6366f1', pointerEvents: 'none', zIndex: 1000 
                                             }}>
                                                 <div onClick={(e) => { e.stopPropagation(); context.alignSelection('left'); }} style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, background: '#1e293b', border: '2px solid #6366f1', borderRadius: '50%', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Align Left"><div style={{width:4, height:4, background:'#6366f1', borderRadius:'50%'}}/></div>
                                                 <div onClick={(e) => { e.stopPropagation(); context.alignSelection('right'); }} style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, background: '#1e293b', border: '2px solid #6366f1', borderRadius: '50%', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Align Right"><div style={{width:4, height:4, background:'#6366f1', borderRadius:'50%'}}/></div>
                                                 <div onClick={(e) => { e.stopPropagation(); context.alignSelection('top'); }} style={{ position: 'absolute', left: '50%', top: -8, transform: 'translateX(-50%)', width: 16, height: 16, background: '#1e293b', border: '2px solid #6366f1', borderRadius: '50%', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Align Top"><div style={{width:4, height:4, background:'#6366f1', borderRadius:'50%'}}/></div>
                                                 <div onClick={(e) => { e.stopPropagation(); context.alignSelection('bottom'); }} style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)', width: 16, height: 16, background: '#1e293b', border: '2px solid #6366f1', borderRadius: '50%', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Align Bottom"><div style={{width:4, height:4, background:'#6366f1', borderRadius:'50%'}}/></div>
                                                 <div onClick={(e) => { e.stopPropagation(); context.alignSelection('centerH'); }} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, background: '#6366f1', border: '2px solid white', borderRadius: '50%', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Center H" />
                                                 <div onClick={(e) => { e.stopPropagation(); context.alignSelection('centerV'); }} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, background: '#6366f1', border: '2px solid white', borderRadius: '50%', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }} title="Center V" />
                                             </div>
                                         )}
                                         
                                         {guides.filter(g => g.pageId === pg.id).map((g, gi) => (
                                             <div key={gi} style={{
                                                 position: 'absolute',
                                                 left: g.x !== undefined ? g.x : 0,
                                                 top: g.y !== undefined ? g.y : 0,
                                                 width: g.x !== undefined ? '1px' : '100%',
                                                 height: g.y !== undefined ? '1px' : '100%',
                                                 borderLeft: g.x !== undefined ? '1px dashed #6366f1' : 'none',
                                                 borderTop: g.y !== undefined ? '1px dashed #6366f1' : 'none',
                                                 zIndex: 2000,
                                                 pointerEvents: 'none'
                                             }} />
                                         ))}

                                         {pg.items?.map((it: any) => {
                                            const itemSel = selections[activeScreenId] || [];
                                            const isSelected = itemSel.some((s: any) => s.id === it.id);
                                            const isSingle = isSelected && itemSel.length === 1;
                                            const pv = previews[it.id];
                                            let w = pv?.w ?? it.width; let h = pv?.h ?? it.height; let x = pv?.x ?? it.x; let y = pv?.y ?? it.y;
                                            const panRef = it?.panelId ? project.panels.find((p: any) => p.id === it.panelId) : null;
                                            const isHeader = it?.type === 'header' || it?.name?.toLowerCase().includes('header') || panRef?.name?.toLowerCase().includes('header');
                                            const isSidePanel = it?.type === 'nav-menu' || it?.name?.toLowerCase().includes('sidebar') || panRef?.name?.toLowerCase().includes('sidebar');
                                            if (isHeader) { x = 0; y = 0; w = baseWidth; }
                                            else if (isSidePanel) { x = 0; y = headerHeight; }
                                            
                                            return (
                                                <div key={it.id} id={`item-${it.id}`} className="cv-widget-item" style={{ position: 'absolute', left: x, top: y, width: w, height: h, zIndex: isSelected ? 100 : 1 }}
                                                     onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', id: it.id, pageId: pg.id }); }}
                                                     onMouseDown={e => {
                                                         e.stopPropagation();
                                                         selectionSourceRef.current = 'canvas';
                                                         const isMulti = e.shiftKey;
                                                         const isCtrl = e.ctrlKey || e.metaKey;
                                                         const isAlt = e.altKey;

                                                          if (isCtrl && !isMulti) {
                                                              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                                              if (rect) {
                                                                  const clickX = (e.clientX - rect.left) / scale;
                                                                  const clickY = (e.clientY - rect.top) / scale;
                                                                  const hits = pg.items.filter((i: any) => clickX >= i.x && clickX <= i.x + i.width && clickY >= i.y && clickY <= i.y + i.height).reverse();
                                                                  if (hits.length > 1) {
                                                                      const curIdx = hits.findIndex((h: any) => itemSel.some((s: any) => s.id === h.id));
                                                                      const nextIdx = (curIdx + 1) % hits.length;
                                                                      const nextItem = hits[nextIdx];
                                                                      setSelectedEntity({ type: "item", id: nextItem.id, pageId: pg.id }, activeScreenId);
                                                                      return;
                                                                  }
                                                              }
                                                          }

                                                         longPressTimer.current = setTimeout(() => {
                                                             setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', id: it.id, pageId: pg.id });
                                                         }, 600);

                                                         if (!isSelected && !isMulti) setSelectedEntity({ type: 'item', id: it.id, pageId: pg.id }, activeScreenId);
                                                         else if (isMulti) setSelectedEntity({ type: 'item', id: it.id, pageId: pg.id }, activeScreenId, true);
                                                         
                                                         const currentSel = context.selections[activeScreenId] || [];
                                                         const toDrag = (!isSelected && !isMulti) ? [{id: it.id, x: it.x, y: it.y}] : currentSel.filter((s:any) => s.type === 'item').map((s:any) => {
                                                             const item = findItemRecursive(pg.items, s.id);
                                                             return { id: s.id, x: item?.x ?? 0, y: item?.y ?? 0 };
                                                         });
                                                         if (!toDrag.find((d: any) => d.id === it.id)) toDrag.push({id: it.id, x: it.x, y: it.y});
                                                         const offsets: any = {}; toDrag.forEach((d: any) => offsets[d.id] = {x: d.x, y: d.y});
                                                         setDragInfo({ ids: toDrag.map((d: any)=>d.id), initialOffsets: offsets, startX: e.clientX, startY: e.clientY, mode: 'move', pageId: pg.id, scrId: scr.id });
                                                     }}>
                                                    <WidgetRenderer it={it} panels={project.panels} pageId={pg.id} onSelect={(id, pid, multi) => setSelectedEntity({ type: 'item', id, pageId: pid }, activeScreenId, multi)} onDragStart={(id, pid, e) => {
                                                        const offset = getAbsoluteOffset(pg.items, id);
                                                        const rect = (e.currentTarget as any).getBoundingClientRect();
                                                         setDragInfo({ ids: [id], initialOffsets: { [id]: { ...offset, w: rect.width / scale, h: rect.height / scale } } as any, startX: e.clientX, startY: e.clientY, mode: 'move', pageId: pid, scrId: scr.id });
                                                    }} selections={itemSel} />
                                                    {isSingle && !isHeader && !isSidePanel && (
                                                        <div onMouseDown={e => { e.stopPropagation(); setDragInfo({ ids: [it.id], initialOffsets: {[it.id]: {x:it.x, y:it.y}}, startX: e.clientX, startY: e.clientY, mode: 'resize', handle: 'se', pageId: pg.id, scrId: scr.id }); }}
                                                              style={{ position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, background: '#6366f1', cursor: 'nwse-resize', borderRadius: '2px', border: '1px solid white' }} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {xrayMode && pg.items?.map((it: any) => {
                                            const pv = previews[it.id];
                                            const w = pv?.w ?? it.width; const h = pv?.h ?? it.height; const x = pv?.x ?? it.x; const y = pv?.y ?? it.y;
                                            return (
                                                <div key={`xray-${it.id}`} 
                                                     style={{ 
                                                         position: 'absolute', left: x, top: y, width: w, height: h, 
                                                         border: '2px dashed #f59e0b', background: 'rgba(245, 158, 11, 0.2)', 
                                                         zIndex: 9999, pointerEvents: 'none', display: 'flex', alignItems: 'flex-start'
                                                     }}>
                                                     <div 
                                                         style={{ background: '#f59e0b', color: 'black', fontSize: '10px', padding: '2px 6px', pointerEvents: 'auto', cursor: 'pointer', fontWeight: 'bold', borderRadius: '0 0 4px 0' }}
                                                         onMouseDown={e => {
                                                             e.stopPropagation();
                                                             setSelectedEntity({ type: 'item', id: it.id, pageId: pg.id }, activeScreenId);
                                                         }}
                                                     >
                                                         {it.name || it.type}
                                                     </div>
                                                </div>
                                            );
                                        })}
                                        {/* Drag Preview for Nested Items */}
                                        {dragInfo && dragInfo.mode === 'move' && dragInfo.ids.map(id => {
                                            const pv = previews[id];
                                            if (!pv) return null;
                                            const item = findItemRecursive(pg.items, id);
                                            if (!item || !item.parentId) return null; // Top-level items are handled above
                                            return (
                                                <div key={`drag-nested-${id}`} style={{ position: 'absolute', left: pv.x, top: pv.y, width: pv.w ?? item.width, height: pv.h ?? item.height, zIndex: 9999, opacity: 0.6, pointerEvents: 'none', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
                                                    <WidgetRenderer it={{ ...item, parentId: undefined, x: 0, y: 0 }} panels={project.panels} pageId={pg.id} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            <div 
                                onClick={() => context.addPage(scr.id, Math.max(...scr.pages.map((p:any)=>p.x||0)) + 1, 0)}
                                style={{ 
                                    position: 'absolute', 
                                    left: (Math.max(...scr.pages.map((p:any)=>p.x||0)) + 1) * baseWidth + entry.offsetX - displayX + 20,
                                    top: entry.offsetY - displayY + 24,
                                    width: 60, height: baseHeight,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(99, 102, 241, 0.05)',
                                    border: '2px dashed rgba(99, 102, 241, 0.3)',
                                    borderRadius: '12px',
                                    color: '#6366f1',
                                    fontSize: '32px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    zIndex: 5
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'; e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)'; }}
                            >
                                +
                            </div>
                            <div 
                                onClick={() => context.addPage(scr.id, 0, Math.max(...scr.pages.map((p:any)=>p.y||0)) + 1)}
                                style={{ 
                                    position: 'absolute', 
                                    left: entry.offsetX - displayX,
                                    top: (Math.max(...scr.pages.map((p:any)=>p.y||0)) + 1) * baseHeight + entry.offsetY - displayY + 24 + 20,
                                    width: baseWidth, height: 60,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(99, 102, 241, 0.05)',
                                    border: '2px dashed rgba(99, 102, 241, 0.3)',
                                    borderRadius: '12px',
                                    color: '#6366f1',
                                    fontSize: '32px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    zIndex: 5
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'; e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)'; }}
                            >
                                +
                            </div>
                        </div>
                    );
                })}

                {worldPanels.map((entry: any) => {
                    const pan = entry.pan;
                    const itemSel = selections['panel'] || [];
                    const isSelected = selections['panel']?.some((s:any) => s.id === pan.id);
                    const isPv = panelPreview?.id === pan.id;
                    const displayX = isPv ? panelPreview.x : entry.x;
                    const displayY = isPv ? panelPreview.y : entry.y;
                    return (
                        <div key={pan.id} id={`panel-${pan.id}`} style={{ position: 'absolute', left: displayX, top: displayY, zIndex: 20 }}>
                            <div onMouseDown={e => { e.stopPropagation(); selectionSourceRef.current = 'canvas'; setScreenDragInfo({ type: 'panel', id: pan.id, startX: e.clientX, startY: e.clientY, initialX: entry.x, initialY: entry.y }); setSelectedEntity({ type: 'panel', id: pan.id }, 'panel'); }}
                                 style={{ background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: '8px 8px 0 0', fontSize: '10px', fontWeight: 'bold', cursor: 'grab', width: 'fit-content' }}>
                                🧩 {pan.name}
                            </div>
                            <div style={{ width: pan.width, height: pan.height, background: pan.bg ? `#${safeHex(pan.bg)}` : '#1e1e2d', border: `2px solid ${isSelected ? '#10b981' : '#334155'}`, borderRadius: '0 0 8px 8px', position: 'relative' }}
                                 onDrop={e => {
                                     e.preventDefault();
                                     const data = JSON.parse(e.dataTransfer.getData("application/gridos-item"));
                                     const rect = e.currentTarget.getBoundingClientRect();
                                     addItem(data.type, pan.id, undefined, data.panelId, Math.round((e.clientX - rect.left)/scale), Math.round((e.clientY - rect.top)/scale), data.meta);
                                  }} onDragOver={e => e.preventDefault()}>
                                 {pan.elements?.map((it: any) => {
                                     const itSel = itemSel.some((s: any) => s.id === it.id);
                                     const pv = previews[it.id];
                                     const w = pv?.w ?? it.width; const h = pv?.h ?? it.height; const x = pv?.x ?? it.x; const y = pv?.y ?? it.y;
                                     return (
                                        <div key={it.id} className="cv-widget-item" style={{ 
                                            position: pan.layout === 'free' ? 'absolute' : 'relative',
                                            left: pan.layout === 'free' ? x : 'auto',
                                            top: pan.layout === 'free' ? y : 'auto',
                                            width: pan.layout === 'free' ? w : '100%',
                                            height: h || 50,
                                            zIndex: itSel ? 100 : 1
                                        }}
                                        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', id: it.id, pageId: pan.id }); }}
                                        onMouseDown={e => {
                                            e.stopPropagation();
                                            selectionSourceRef.current = 'canvas';
                                            const isCtrl = e.ctrlKey || e.metaKey;
                                            const isAlt = e.altKey;

                                            if (isCtrl && !e.shiftKey) {
                                                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                                if (rect) {
                                                    const clickX = (e.clientX - rect.left) / scale;
                                                    const clickY = (e.clientY - rect.top) / scale;
                                                    const hits = pan.elements.filter((i: any) => 
                                                        clickX >= i.x && clickX <= i.x + i.width &&
                                                        clickY >= i.y && clickY <= i.y + i.height
                                                    ).reverse();
                                                    if (hits.length > 1) {
                                                        const curIdx = hits.findIndex((h: any) => itemSel.some((s: any) => s.id === h.id));
                                                        const nextIdx = (curIdx + 1) % hits.length;
                                                        const nextItem = hits[nextIdx];
                                                        setSelectedEntity({ type: 'item', id: nextItem.id, pageId: pan.id }, 'panel');
                                                        return;
                                                    }
                                                }
                                            }

                                            longPressTimer.current = setTimeout(() => {
                                                setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', id: it.id, pageId: pan.id });
                                            }, 600);

                                            setSelectedEntity({ type: 'item', id: it.id, pageId: pan.id }, 'panel');
                                            setDragInfo({ ids: [it.id], initialOffsets: {[it.id]: {x:it.x, y:it.y}}, startX: e.clientX, startY: e.clientY, mode: 'move', pageId: pan.id, scrId: 'panel' });
                                        }}>
                                            <WidgetRenderer it={it} panels={project.panels} pageId={pan.id} onSelect={(id, pid, multi) => setSelectedEntity({ type: 'item', id, pageId: pid }, 'panel', multi)} selections={itemSel} />
                                            {itSel && (
                                                <div onMouseDown={e => { e.stopPropagation(); setDragInfo({ ids: [it.id], initialOffsets: {[it.id]: {x:it.x, y:it.y}}, startX: e.clientX, startY: e.clientY, mode: 'resize', handle: 'se', pageId: pan.id, scrId: 'panel' }); }}
                                                      style={{ position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, background: '#10b981', cursor: 'nwse-resize', borderRadius: '2px', border: '1px solid white' }} />
                                            )}
                                        </div>
                                     );
                                 })}
                                 {xrayMode && pan.layout === 'free' && pan.elements?.map((it: any) => {
                                     const pv = previews[it.id];
                                     const w = pv?.w ?? it.width; const h = pv?.h ?? it.height; const x = pv?.x ?? it.x; const y = pv?.y ?? it.y;
                                     return (
                                        <div key={`xray-${it.id}`} 
                                             style={{ 
                                                 position: 'absolute', left: x, top: y, width: w, height: h, 
                                                 border: '2px dashed #f59e0b', background: 'rgba(245, 158, 11, 0.2)', 
                                                 zIndex: 9999, pointerEvents: 'none', display: 'flex', alignItems: 'flex-start'
                                             }}>
                                             <div 
                                                 style={{ background: '#f59e0b', color: 'black', fontSize: '10px', padding: '2px 6px', pointerEvents: 'auto', cursor: 'pointer', fontWeight: 'bold', borderRadius: '0 0 4px 0' }}
                                                 onMouseDown={e => {
                                                     e.stopPropagation();
                                                     setSelectedEntity({ type: 'item', id: it.id, pageId: pan.id }, activeScreenId);
                                                 }}
                                             >
                                                 {it.name || it.type}
                                             </div>
                                        </div>
                                     );
                                 })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showMinimap && (
            <div style={{ position: 'fixed', bottom: 80, right: 20, width: 220, height: 160, background: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', zIndex: 10000, border: '1px solid rgba(148, 163, 184, 0.2)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#6366f1', letterSpacing: '0.5px' }}>NAVIGATOR</span>
                    <div style={{ fontSize: '9px', opacity: 0.5, fontWeight: 700 }}>{Math.round(mmContentBounds.w)}x{Math.round(mmContentBounds.h)}</div>
                </div>
                <div 
                    onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mmScale = Math.min(200 / mmContentBounds.w, 110 / mmContentBounds.h);
                        
                        const jump = (moveEv: any) => {
                            const mRect = rect;
                            const offsetX = (moveEv.clientX - mRect.left);
                            const offsetY = (moveEv.clientY - mRect.top);
                            
                            // Center the viewport on the click
                            const worldX = (offsetX / mmScale) + mmContentBounds.minX;
                            const worldY = (offsetY / mmScale) + mmContentBounds.minY;
                            
                            if (containerRef.current) {
                                containerRef.current.scrollLeft = (worldX - viewport.w / 2) * scale;
                                containerRef.current.scrollTop = (worldY - viewport.h / 2) * scale;
                            }
                        };
                        jump(e);
                        const onMove = (me: MouseEvent) => jump(me);
                        const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                        };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                    }}
                    style={{ flex: 1, position: 'relative', margin: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', cursor: 'crosshair' }}
                >
                    {(() => {
                        const mmScale = Math.min(200 / mmContentBounds.w, 110 / mmContentBounds.h);
                        
                        return (
                            <>
                                {/* Items */}
                                {mmItems.map((it: any) => (
                                    <div key={it.id} style={{
                                        position: 'absolute',
                                        left: (it.x - mmContentBounds.minX) * mmScale,
                                        top: (it.y - mmContentBounds.minY) * mmScale,
                                        width: it.w * mmScale,
                                        height: it.h * mmScale,
                                        background: it.type === 'screen' ? '#6366f1' : it.type === 'panel' ? '#10b981' : it.type === 'page' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.3)',
                                        border: it.type === 'page' ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                                        opacity: 1,
                                        borderRadius: '2px',
                                        zIndex: it.type === 'page' ? 1 : 2
                                    }} />
                                ))}
                                {/* Viewport */}
                                <div style={{
                                    position: 'absolute',
                                    left: (viewport.x - mmContentBounds.minX) * mmScale,
                                    top: (viewport.y - mmContentBounds.minY) * mmScale,
                                    width: (viewport.w) * mmScale,
                                    height: (viewport.h) * mmScale,
                                    border: '1.5px solid #6366f1',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    zIndex: 2,
                                    borderRadius: '2px'
                                }} />
                            </>
                        );
                    })()}
                </div>
            </div>
            )}

            <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', padding: '8px 16px', borderRadius: '20px', color: 'white', display: 'flex', gap: '15px', alignItems: 'center', zIndex: 10000, border: '1px solid rgba(255,255,255,0.1)' }}>
                <button 
                    onClick={() => setShowMinimap(!showMinimap)} 
                    style={{ background: showMinimap ? '#6366f1' : '#334155', border: 'none', color: 'white', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    <span style={{ fontSize: '14px' }}>🗺️</span> MAP
                </button>
                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
                <button 
                    onClick={() => setXrayMode(!xrayMode)} 
                    style={{ background: xrayMode ? '#f59e0b' : '#334155', border: 'none', color: 'white', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    <span style={{ fontSize: '14px' }}>👁️</span> X-RAY
                </button>
                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
                <button 
                    onClick={() => {
                        const h = project.panels.find((p: any) => p.name.toLowerCase().includes('header'));
                        if (h) {
                            setSelectedEntity({ type: 'panel', id: h.id }, activeScreenId);
                        } else {
                            alert("No header panel found.");
                        }
                    }} 
                    style={{ background: '#10b981', border: 'none', color: 'white', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px' }}
                >
                    GO TO HEADER
                </button>
                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
                <button onClick={() => setScale(Math.max(0.2, scale - 0.1))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: '12px', fontWeight: 800 }}>{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(Math.min(2, scale + 0.1))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>+</button>
                {contextMenu && (
                    <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 100000, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '4px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', minWidth: '160px' }}>
                        <div onClick={() => context.reorderItem(contextMenu.pageId, contextMenu.id, 'front')} style={{ padding: '8px 12px', color: 'white', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#334155'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Bring to Front</div>
                        <div onClick={() => context.reorderItem(contextMenu.pageId, contextMenu.id, 'forward')} style={{ padding: '8px 12px', color: 'white', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#334155'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Bring Forward</div>
                        <div onClick={() => context.reorderItem(contextMenu.pageId, contextMenu.id, 'backward')} style={{ padding: '8px 12px', color: 'white', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#334155'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Send Backward</div>
                        <div onClick={() => context.reorderItem(contextMenu.pageId, contextMenu.id, 'back')} style={{ padding: '8px 12px', color: 'white', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#334155'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Send to Back</div>
                        <div style={{ height: '1px', background: '#334155', margin: '4px 0' }} />
                        <div onClick={() => context.removeItem(contextMenu.pageId, contextMenu.id)} style={{ padding: '8px 12px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#334155'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Delete</div>
                    </div>
                )}
            </div>
        </div>
    );
};
