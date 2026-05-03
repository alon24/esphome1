import { Header, type WifiStatus } from "./components/layout/Header";
import { Sidebar } from "./components/editor/Sidebar";
import { PropertiesPanel } from "./components/editor/PropertiesPanel";
import { CanvasArea } from "./components/editor/CanvasArea";
import { WidgetRenderer } from "./components/editor/WidgetRenderer";
import { WifiManager } from "./components/wifi/WifiManager";
import { GridContext } from "./context/GridContext";
import { SettingsManager } from "./components/layout/SettingsManager";
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { 
    type ElementType, 
    type GridItem, 
    type Page, 
    type Screen, 
    type Panel, 
    type Project,
    SMART_COMPONENTS
} from "./types";
import React, {
	Component,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
	useLayoutEffect,
	useMemo,
    useContext
} from "react";
import { findItemRecursive, applyRecursive } from "./utils";

// --- STYLES ---


// --- STYLES ---
const s: Record<string, React.CSSProperties> = { 
	app: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", userSelect: "none", fontFamily: "'Outfit', sans-serif" }, 
	primaryBtn: { background: "#4f46e5", color: "white", border: "none", borderRadius: "14px", cursor: "pointer", fontWeight: "800", transition: "0.25s", padding: "10px 24px", fontSize: "11px" }, 
	secondaryBtn: { background: "white", border: "1px solid #e2e8f0", color: "#475569", borderRadius: "14px", cursor: "pointer", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }, 
};

// --- MOCK API ---
const API = {
	async getWifi(): Promise<WifiStatus> {
		const saved = localStorage.getItem("ds_mock_wifi");
		return saved ? JSON.parse(saved) : { connected: true, ip: "192.168.1.100", ssid: "MOCK_WIFI", ap_active: false, ap_always_on: false };
	},
	async updateSettings(opts: any) {
        const ip = localStorage.getItem("ds_remote_ip");
        if (!ip) return true;
        try {
            await fetch(`http://${ip}/api/wifi/ap`, {
                method: 'POST',
                body: JSON.stringify(opts),
                headers: { 'Content-Type': 'application/json' }
            });
            return true;
        } catch (e) {
            console.error("Update failed", e);
            return false;
        }
    },
	async saveGrid(name: string, data: any) { return true; },
	async savePanels(panels: Panel[]) { return true; }
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: any) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) return <div style={{ padding: 40, color: 'white', background: '#450a0a', height: '100vh' }}><h1>Application Crash Detected</h1><p>Please refresh the page.</p></div>;
        return this.props.children;
    }
}

// --- MAIN APP ---
export default function SafeApp() {
	const [width, setWidth] = useState(window.innerWidth);
	useLayoutEffect(() => {
		const update = () => setWidth(window.innerWidth);
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	const isMobile = width < 900;
	return (
		<ErrorBoundary>
			<App isMobile={isMobile} width={width} />
		</ErrorBoundary>
	);
}

function App({ isMobile, width }: { isMobile: boolean, width: number }) {
    const [remoteIp, setRemoteIp] = useState(() => localStorage.getItem("ds_remote_ip") || "");
	const [activeTab, setActiveTab] = useState<"grid" | "dashboard" | "mirror" | "wifi" | "logs" | "settings">("grid");
	const [status, setStatus] = useState<WifiStatus>({ connected: true, ip: "127.0.0.1", ssid: "STATION", ap_active: false, ap_always_on: false, mqtt_enabled: true });
    const [propsLocation, setPropsLocation] = useState<'left' | 'right'>(() => (localStorage.getItem("ds_props_location") as any) || 'left');
	const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem("ds_theme") as any) || 'light');

    const [history, setHistory] = useState<{ past: Project[], present: Project, future: Project[] }>(() => {
		const VERSION = "2026.4";
		const saved = localStorage.getItem("ds_project_v3");
        let data: Project;
		if (localStorage.getItem("ds_project_version") !== VERSION) {
			localStorage.setItem("ds_project_version", VERSION);
			data = {
				screens: [{ id: "main", name: "Main Screen", bg: 0x0e0e12, pages: [{ id: "p1", name: "Page (0,0)", x: 0, y: 0, items: [] }] }],
				panels: [{ id: "sidebar", name: "Sidebar", width: 160, height: 416, bg: 0x000000, itemBg: 0x000000, elements: [] }],
                paneGrids: []
			};
		} else {
		    data = saved ? JSON.parse(saved) : {
			    screens: [{ id: "main", name: "Main Screen", bg: 0x0e0e12, pages: [{ id: "p1", name: "Page (0,0)", x: 0, y: 0, items: [] }] }],
			    panels: [{ id: "sidebar", name: "Sidebar", width: 160, height: 416, bg: 0x000000, itemBg: 0x000000, elements: [] }],
                paneGrids: []
		    };
        }
        if (!data.paneGrids) data.paneGrids = [];
        return { past: [], present: data, future: [] };
	});

    const project = history.present;

    const setProject = useCallback((action: Project | ((prev: Project) => Project)) => {
        setHistory(h => {
            const next = typeof action === 'function' ? action(h.present) : action;
            if (next === h.present) return h;
            return { past: [...h.past, h.present].slice(-50), present: next, future: [] };
        });
    }, []);

    const undo = useCallback(() => {
        setHistory(h => {
            if (h.past.length === 0) return h;
            const previous = h.past[h.past.length - 1];
            return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
        });
    }, []);

    const redo = useCallback(() => {
        setHistory(h => {
            if (h.future.length === 0) return h;
            const next = h.future[0];
            return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
        });
    }, []);

	const [activeScreenId, setActiveScreenId] = useState<string>("main");
	const [selections, setSelections] = useState<Record<string, any[]>>({});
    const [clipboard, setClipboard] = useState<any[]>([]);
    const [lastSelectedEntity, setLastSelectedEntity] = useState<any>(null);
	const [scale, setScale] = useState(1.0);
    const [baseWidth, setBaseWidth] = useState(800);
    const [baseHeight, setBaseHeight] = useState(480); // Updated to 480

    useEffect(() => { localStorage.setItem("ds_remote_ip", remoteIp); }, [remoteIp]);
    useEffect(() => { localStorage.setItem("ds_props_location", propsLocation); }, [propsLocation]);
    useEffect(() => { 
        localStorage.setItem("ds_theme", theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    useEffect(() => { localStorage.setItem("ds_project_v3", JSON.stringify(project)); }, [project]);

	const refreshWifi = useCallback(async () => {
		const sw = await API.getWifi();
		if (sw) setStatus(sw);
	}, []);

	useEffect(() => {
		refreshWifi();
		const t = setInterval(refreshWifi, 5000);
		return () => clearInterval(t);
	}, [refreshWifi]);

    const setSelectedEntity = useCallback((ent: any, screenId?: string, isMulti?: boolean) => {
		const targetScreenId = screenId || activeScreenId;
        setSelections(prev => {
            const current = prev[targetScreenId] || [];
            if (!ent) return { ...prev, [targetScreenId]: [] };
            
            if (isMulti) {
                const exists = current.find(e => e.id === ent.id);
                if (exists) return { ...prev, [targetScreenId]: current.filter(e => e.id !== ent.id) };
                return { ...prev, [targetScreenId]: [...current, ent] };
            }
            return { ...prev, [targetScreenId]: [ent] };
        });
        setLastSelectedEntity(ent);
    }, [activeScreenId]);

    const updateScreen = useCallback((id: string, patch: any) => {
        setProject(prev => ({ ...prev, screens: prev.screens.map(s => s.id === id ? { ...s, ...patch } : s) }));
    }, []);

    const addScreen = useCallback(() => {
        const id = `scr_${Math.random().toString(36).substr(2, 5)}`;
        setProject(prev => {
            let maxX = 0;
            prev.screens.forEach(s => {
                const sx = s.x ?? 100;
                const pages = s.pages || [];
                const minX = pages.length > 0 ? Math.min(...pages.map((p: any) => p.x || 0)) : 0;
                const maxXp = pages.length > 0 ? Math.max(...pages.map((p: any) => p.x || 0)) : 0;
                const sw = (maxXp - minX + 1) * 800;
                maxX = Math.max(maxX, sx + sw + 200);
            });
            if (maxX < 100) maxX = 100;
            return {
                ...prev,
                screens: [...prev.screens, { 
                    id, 
                    name: `Screen ${prev.screens.length + 1}`, 
                    bg: 0x0e0e12, 
                    x: maxX, 
                    y: 100, 
                    pages: [{ id: `p_${id}`, name: 'Page (0,0)', x: 0, y: 0, items: [] }] 
                }]
            };
        });
        setActiveScreenId(id);
    }, []);

    const removeScreen = useCallback((id: string) => {
        if (id === 'main') return;
        setProject(prev => ({ ...prev, screens: prev.screens.filter(s => s.id !== id) }));
        setActiveScreenId('main');
    }, []);

    const nudgeScreens = useCallback((screens: Screen[], modId: string): Screen[] => {
        const getBounds = (s: Screen) => {
            const pages = s.pages || [];
            const minX = Math.min(...pages.map(p => p.x || 0));
            const maxX = Math.max(...pages.map(p => p.x || 0));
            const minY = Math.min(...pages.map(p => p.y || 0));
            const maxY = Math.max(...pages.map(p => p.y || 0));
            return {
                left: (s.x ?? 0) + minX * baseWidth,
                right: (s.x ?? 0) + (maxX + 1) * baseWidth,
                top: (s.y ?? 100) + minY * baseHeight,
                bottom: (s.y ?? 100) + (maxY + 1) * baseHeight
            };
        };
        const modScr = screens.find(s => s.id === modId);
        if (!modScr) return screens;
        let currentScreens = [...screens];
        let changed = true;
        while (changed) {
            changed = false;
            const modBounds = getBounds(currentScreens.find(s => s.id === modId)!);
            currentScreens = currentScreens.map(s => {
                if (s.id === modId) return s;
                const bounds = getBounds(s);
                const isOverlapping = !(bounds.right <= modBounds.left || bounds.left >= modBounds.right || bounds.bottom <= modBounds.top || bounds.top >= modBounds.bottom);
                if (isOverlapping) {
                    const overlap = modBounds.right - bounds.left;
                    changed = true;
                    return { ...s, x: (s.x ?? 0) + overlap + 200 };
                }
                return s;
            });
        }
        return currentScreens;
    }, [baseWidth, baseHeight]);

    const addPage = useCallback((scrId: string, x: number, y: number) => {
        setProject(prev => {
            const newScreens = prev.screens.map(s => s.id === scrId ? {
                ...s,
                pages: [...s.pages, { id: `p${Math.random().toString(36).substr(2, 5)}`, name: `Page (${x},${y})`, items: [], x, y }]
            } : s);
            return { ...prev, screens: nudgeScreens(newScreens, scrId) };
        });
    }, [nudgeScreens]);

    const removePage = useCallback((scrId: string, pgId: string) => {
        setProject(prev => {
            const screen = prev.screens.find(s => s.id === scrId);
            const page = screen?.pages.find(p => p.id === pgId);
            if (page && (page.x === 0 && page.y === 0)) {
                alert("You cannot delete the base Page (0,0).");
                return prev;
            }
            return { ...prev, screens: prev.screens.map(s => s.id === scrId ? { ...s, pages: s.pages.filter(p => p.id !== pgId) } : s) };
        });
    }, []);

    const updatePage = useCallback((scrId: string, pgId: string, patch: any) => {
        setProject(prev => ({
            ...prev,
            screens: prev.screens.map(s => s.id === scrId ? { ...s, pages: s.pages.map(p => p.id === pgId ? { ...p, ...patch } : p) } : s)
        }));
    }, []);

    const addItem = useCallback((type: ElementType, pageId: string, parentId?: string, panelId?: string, fx?: number, fy?: number, meta?: any) => {
        const id = meta?.id || `${type}_${Math.random().toString(36).substr(2, 5)}`;
        const sc = meta?.component ? SMART_COMPONENTS.find(s => s.id === meta.component) : null;
        const dw = meta?.w || sc?.defaultW || 120;
        const dh = meta?.h || sc?.defaultH || 40;
        const newItem: GridItem = { 
            id, name: `New ${sc?.label || type}`, type, x: fx ?? 20, y: fy ?? 0, width: dw, height: dh, 
            color: 0x4f46e5, textColor: 0x000000, radius: 0, panelId, component: meta?.component,
            mqttTopic: meta?.mqttTopic, mqttStateTopic: meta?.mqttStateTopic,
            noBg: true
        };
        setProject(prev => {
            const isPanel = prev.panels.some(p => p.id === pageId);
            if (isPanel) {
                const panel = prev.panels.find(p => p.id === pageId);
                const width = panel?.width || 160;
                const layout = panel?.layout || 'v';
                let newNavItem = { ...newItem };
                if (layout === 'v') {
                    newNavItem = { ...newItem, x: 0, y: (panel?.elements.length || 0) * 50, width: width, height: 50 };
                }
                return { ...prev, panels: prev.panels.map(p => p.id === pageId ? { ...p, elements: [...p.elements, newNavItem] } : p) };
            } else {
                let pageItem = { ...newItem };
                const panRef = panelId ? prev.panels.find(p => p.id === panelId) : null;
                const isHeader = panRef?.name?.toLowerCase().includes('header');
                const isSidebar = type === 'nav-menu' || panRef?.name?.toLowerCase().includes('sidebar');

                if (isHeader) {
                    pageItem = { ...pageItem, x: 0, y: 0, width: baseWidth, pinned: true, noBg: false, color: 0x334155 };
                } else if (isSidebar) {
                    const h = prev.panels.find(p => p.name.toLowerCase().includes('header'));
                    const hh = h ? (h.height || 60) : 0;
                    pageItem = { ...pageItem, x: 0, y: hh, pinned: true };
                }

                if (type === 'panel-ref' && panelId) {
                    const panel = prev.panels.find(p => p.id === panelId);
                    pageItem = { ...pageItem, x: isSidebar?0:pageItem.x, y: isSidebar?pageItem.y:pageItem.y, width: panel?.width || 160, height: panel?.height || 60 };
                }
                if (type === 'border') {
                    pageItem = { ...pageItem, borderWidth: 2, borderColor: 0x6366f1, noBg: true };
                }

                // Grid Drop Logic (supports 'grid' and 'pane-grid')
                const screen = prev.screens.find(s => s.pages.some(p => p.id === pageId));
                const page = screen?.pages.find(p => p.id === pageId);
                
                // If parentId is explicitly provided, use it. Otherwise, look for a grid at (fx, fy)
                let targetGrid = parentId ? findItemRecursive(page?.items || [], parentId) : null;
                if (!targetGrid && fx !== undefined && fy !== undefined) {
                    targetGrid = page?.items.find(it => (it.type === 'grid' || it.type === 'pane-grid') && fx! >= it.x && fx! <= it.x + it.width && fy! >= it.y && fy! <= it.y + it.height);
                }
                
                const isNestableInGrid = (tGrid: GridItem, droppedType: ElementType) => {
                    if (tGrid.type === 'grid' && droppedType === 'grid-item') return true;
                    if (tGrid.type === 'pane-grid' && (droppedType === 'panel-ref' || droppedType === 'grid-item' || droppedType === 'label')) return true;
                    return false;
                };

                if (targetGrid && isNestableInGrid(targetGrid, type)) {
                    const colWidth = targetGrid.width / (targetGrid.cols || (targetGrid.type === 'pane-grid' ? 3 : 2));
                    const rowHeight = targetGrid.height / (targetGrid.rows || 1);
                    
                    let col = 0;
                    let row = 0;
                    
                    if (fx !== undefined && fy !== undefined && !parentId) {
                        col = Math.floor((fx! - targetGrid.x) / colWidth);
                        row = Math.floor((fy! - targetGrid.y) / rowHeight);
                    } else {
                        // Find first empty cell if parentId was forced
                        const occupied = (targetGrid.children || []).map((c: any) => `${c.col},${c.row}`);
                        let found = false;
                        for (let r = 0; r < (targetGrid.rows || 1); r++) {
                            for (let c = 0; c < (targetGrid.cols || (targetGrid.type === 'pane-grid' ? 3 : 2)); c++) {
                                if (!occupied.includes(`${c},${r}`)) {
                                    col = c; row = r; found = true; break;
                                }
                            }
                            if (found) break;
                        }
                    }
                    
                    const nestedItem = { 
                        ...pageItem, 
                        col, 
                        row, 
                        color: type === 'grid-item' ? 0xFFFF00 : pageItem.color, 
                        radius: type === 'grid-item' ? 10 : pageItem.radius, 
                        noBg: type === 'grid-item' ? false : pageItem.noBg, 
                        parentId: targetGrid.id,
                        width: colWidth - (targetGrid.gap || 10),
                        height: rowHeight - (targetGrid.gap || 10)
                    };
                    
                    return {
                        ...prev,
                        screens: prev.screens.map(s => ({
                            ...s,
                            pages: s.pages.map(p => p.id === pageId ? {
                                ...p,
                                items: applyRecursive(p.items, targetGrid!.id, (it) => ({ ...it, children: [...(it.children || []), nestedItem] }))
                            } : p)
                        }))
                    };
                }

                if (type === 'pane-grid') {
                    const newPaneGrid = { id, name: `Grid ${id}`, cols: 3, rows: 3, gap: 10, panes: [] };
                    return {
                        ...prev,
                        paneGrids: [...(prev.paneGrids || []), newPaneGrid],
                        screens: prev.screens.map(s => ({ ...s, pages: s.pages.map(p => p.id === pageId ? { ...p, items: [...p.items, { ...pageItem, paneGridId: id }] } : p) }))
                    };
                }

                if (type === 'grid-item' && !targetGrid) return prev; // Disallow grid-item on regular page

                return { ...prev, screens: prev.screens.map(s => ({ ...s, pages: s.pages.map(p => p.id === pageId ? { ...p, items: [...p.items, pageItem] } : p) })) };
            }
        });
        setSelectedEntity({ type: 'item', id, pageId });
    }, [setSelectedEntity, baseHeight, baseWidth]);

    const updateItem = useCallback((pageId: string, id: string, patch: any) => {
        setProject(prev => {
            const isPanel = prev.panels.some(p => p.id === pageId);
            const finalPatch = { ...patch };
            let newPanels = prev.panels;
            if (isPanel) {
                const panel = prev.panels.find(p => p.id === pageId);
                const layout = panel?.layout || 'v';
                if (layout === 'v') {
                    if (finalPatch.x !== undefined) finalPatch.x = 0;
                    if (finalPatch.width !== undefined) finalPatch.width = panel?.width || 160;
                    newPanels = prev.panels.map(p => {
                        if (p.id === pageId) {
                            const newElements = p.elements.map(e => e.id === id ? { ...e, ...finalPatch } : e);
                            newElements.sort((a, b) => (a.y + (a.height || 50)/2) - (b.y + (b.height || 50)/2));
                            let currentY = 0;
                            const packedElements = newElements.map(el => {
                                const h = el.height || 50;
                                const packed = { ...el, y: currentY, height: h };
                                currentY += h;
                                return packed;
                            });
                            return { ...p, elements: packedElements };
                        }
                        return p;
                    });
                } else {
                    newPanels = prev.panels.map(p => p.id === pageId ? { ...p, elements: p.elements.map(e => e.id === id ? { ...e, ...finalPatch } : e) } : p);
                }
            }
            return {
                ...prev, panels: newPanels,
                screens: !isPanel ? prev.screens.map(s => ({ ...s, pages: s.pages.map(p => p.id === pageId ? { ...p, items: applyRecursive(p.items, id, it => {
                    const res = { ...it, ...finalPatch };
                    const itPan = it.panelId ? prev.panels.find(p => p.id === it.panelId) : null;
                    const isHeader = it.name.toLowerCase().includes('header') || itPan?.name?.toLowerCase().includes('header');
                    const isSidebar = it.type === 'nav-menu' || it.name.toLowerCase().includes('sidebar') || itPan?.name?.toLowerCase().includes('sidebar');

                    if (isHeader) {
                        res.x = 0; res.y = 0; res.width = baseWidth;
                    } else if (isSidebar) {
                        const h = prev.panels.find(p => p.name.toLowerCase().includes('header'));
                        const hh = h ? (h.height || 60) : 0;
                        res.x = 0; res.y = hh;
                    }
                    return res;
                }) } : p) })) : prev.screens
            };
        });
    }, [baseWidth]);

    const removeItem = useCallback((pageId: string, id: string) => {
        setProject(prev => {
            const isPanel = prev.panels.some(p => p.id === pageId);
            return {
                ...prev,
                panels: isPanel ? prev.panels.map(p => p.id === pageId ? { ...p, elements: p.elements.filter(e => e.id !== id) } : p) : prev.panels,
                screens: !isPanel ? prev.screens.map(s => ({ ...s, pages: s.pages.map(p => p.id === pageId ? { ...p, items: applyRecursive(p.items, id, () => null) } : p) })) : prev.screens
            };
        });
        setSelectedEntity(null);
    }, [setSelectedEntity]);

    const addPanel = useCallback((patch?: any) => {
        const id = `pan_${Math.random().toString(36).substr(2, 5)}`;
        setProject(prev => ({ ...prev, panels: [...prev.panels, { id, name: 'New Panel', width: 160, height: 480, bg: 0x000000, elements: [], ...patch }] }));
        setSelectedEntity({ type: 'panel', id });
    }, [setSelectedEntity]);

    const updatePanel = useCallback((id: string, patch: any) => {
        setProject(prev => ({ ...prev, panels: prev.panels.map(p => p.id === id ? { ...p, ...patch } : p) }));
    }, []);

    const removePanel = useCallback((id: string) => {
        setProject(prev => ({ ...prev, panels: prev.panels.filter(p => p.id !== id) }));
        setSelectedEntity(null);
    }, [setSelectedEntity]);

    const reorderItem = useCallback((pageId: string, id: string, dir: 'front' | 'back' | 'forward' | 'backward') => {
        setProject(prev => {
            const isPanel = prev.panels.some(p => p.id === pageId);
            if (isPanel) {
                return {
                    ...prev,
                    panels: prev.panels.map(p => {
                        if (p.id !== pageId) return p;
                        const items = [...p.elements];
                        const idx = items.findIndex(it => it.id === id);
                        if (idx === -1) return p;
                        const item = items.splice(idx, 1)[0];
                        if (dir === 'front') items.push(item);
                        else if (dir === 'back') items.unshift(item);
                        else if (dir === 'forward') items.splice(Math.min(items.length, idx + 1), 0, item);
                        else if (dir === 'backward') items.splice(Math.max(0, idx - 1), 0, item);
                        return { ...p, elements: items };
                    })
                };
            } else {
                return {
                    ...prev,
                    screens: prev.screens.map(s => ({
                        ...s,
                        pages: s.pages.map(p => {
                            if (p.id !== pageId) return p;
                            const items = [...p.items];
                            const idx = items.findIndex(it => it.id === id);
                            if (idx === -1) return p;
                            const item = items.splice(idx, 1)[0];
                            if (dir === 'front') items.push(item);
                            else if (dir === 'back') items.unshift(item);
                            else if (dir === 'forward') items.splice(Math.min(items.length, idx + 1), 0, item);
                            else if (dir === 'backward') items.splice(Math.max(0, idx - 1), 0, item);
                            return { ...p, items };
                        })
                    }))
                };
            }
        });
    }, []);

    const moveItemToPage = useCallback((oldPageId: string, newPageId: string, itemId: string, patch: any) => {
        setProject(prev => {
            let itemToMove: any = null;
            const newScreens = prev.screens.map(s => ({
                ...s,
                pages: s.pages.map(p => {
                    if (p.id === oldPageId) {
                        const found = findItemRecursive(p.items, itemId);
                        if (found) {
                            itemToMove = { ...found, ...patch };
                            return { ...p, items: applyRecursive(p.items, itemId, () => null) };
                        }
                    }
                    return p;
                })
            }));
            if (!itemToMove) return prev;
            return { ...prev, screens: newScreens.map(s => ({ ...s, pages: s.pages.map(p => p.id === newPageId ? { ...p, items: [...p.items, itemToMove] } : p) })) };
        });
        setSelectedEntity({ type: 'item', id: itemId, pageId: newPageId });
    }, [setSelectedEntity]);

    const resetProject = useCallback(() => {
        if (window.confirm("Are you sure you want to erase ALL screens and panels? This cannot be undone.")) {
            const data: Project = {
                screens: [{ id: "main", name: "Main Screen", bg: 0x0e0e12, pages: [{ id: "p1", name: "Page (0,0)", x: 0, y: 0, items: [] }] }],
                panels: [{ id: "sidebar", name: "Sidebar", width: 160, height: 416, bg: 0x000000, itemBg: 0x000000, elements: [] }],
                paneGrids: []
            };
            setProject(data);
            setActiveScreenId("main");
            setSelections({});
        }
    }, [setProject]);

    const exportProject = useCallback(() => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `gridos_project_${new Date().toISOString().slice(0,10)}.json`);
        dlAnchorElem.click();
    }, [project]);

    const importProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (json && json.screens) {
                    setProject(json);
                    setActiveScreenId(json.screens[0]?.id || "main");
                }
            } catch (err) { console.error(err); }
        };
        reader.readAsText(file);
    }, []);

    const syncToDevice = useCallback(async () => {
        if (!remoteIp) return;
        try {
            const sortedScreens = [...project.screens].sort((a, b) => a.id === activeScreenId ? 1 : b.id === activeScreenId ? -1 : 0);
            for (const screen of sortedScreens) {
                const deviceConfig = { 
                    ...screen, 
                    width: baseWidth, 
                    height: baseHeight,
                    pages: screen.pages.map(pg => ({
                        ...pg,
                        items: pg.items // Keep items inside pages
                    }))
                };
                await fetch(`http://${remoteIp}/api/grid/config?name=${screen.id}`, { method: 'POST', body: JSON.stringify(deviceConfig), headers: { 'Content-Type': 'application/json' } });
            }
            await fetch(`http://${remoteIp}/api/grid/panels`, { method: 'POST', body: JSON.stringify(project.panels), headers: { 'Content-Type': 'application/json' } });
            await fetch(`http://${remoteIp}/api/grid/pane-grids`, { method: 'POST', body: JSON.stringify(project.paneGrids || []), headers: { 'Content-Type': 'application/json' } });
            console.log("Synced!");
        } catch (err) { console.error(err); }
    }, [project, remoteIp, activeScreenId, baseWidth, baseHeight]);

    const reorderGridItem = useCallback((gridId: string, itemId: string, newCol: number, newRow: number) => {
        setProject(prev => ({
            ...prev,
            screens: prev.screens.map(s => ({
                ...s,
                pages: s.pages.map(p => ({
                    ...p,
                    items: applyRecursive(p.items, gridId, (grid) => {
                        if (grid.type !== 'grid' && grid.type !== 'pane-grid') return grid;
                        const children = [...(grid.children || [])];
                        const sourceIdx = children.findIndex(c => c.id === itemId);
                        if (sourceIdx === -1) {
                            console.log('REORDER_GRID: Source item not found!', itemId);
                            return grid;
                        }
                        
                        const targetIdx = children.findIndex(c => c.col === newCol && c.row === newRow);
                        console.log('REORDER_GRID: Found', { sourceIdx, targetIdx, newCol, newRow });
                        
                        if (targetIdx !== -1 && targetIdx !== sourceIdx) {
                            // Swap positions
                            console.log('REORDER_GRID: Swapping', sourceIdx, targetIdx);
                            const sourceCol = children[sourceIdx].col;
                            const sourceRow = children[sourceIdx].row;
                            children[targetIdx] = { ...children[targetIdx], col: sourceCol, row: sourceRow };
                            children[sourceIdx] = { ...children[sourceIdx], col: newCol, row: newRow };
                        } else {
                            // Move to empty cell
                            console.log('REORDER_GRID: Moving to empty cell', sourceIdx);
                            children[sourceIdx] = { ...children[sourceIdx], col: newCol, row: newRow };
                        }
                        return { ...grid, children };
                    })
                }))
            }))
        }));
    }, []);

    const moveItemToGrid = useCallback((sourcePageId: string, targetGridId: string, itemId: string, col: number, row: number) => {
        setProject(prev => {
            let itemToMove: GridItem | null = null;
            
            // 1. Find and remove from source
            const newScreens = prev.screens.map(s => ({
                ...s,
                pages: s.pages.map(p => {
                    if (p.id !== sourcePageId) return p;
                    const found = findItemRecursive(p.items, itemId);
                    if (found) itemToMove = { ...found, parentId: targetGridId, col, row, x: 0, y: 0 };
                    
                    return {
                        ...p,
                        items: applyRecursive(p.items, itemId, () => null) // Remove
                    };
                })
            }));

            if (!itemToMove) return prev;

            // 2. Add to target
            return {
                ...prev,
                screens: newScreens.map(s => ({
                    ...s,
                    pages: s.pages.map(p => ({
                        ...p,
                        items: applyRecursive(p.items, targetGridId, (grid) => ({
                            ...grid,
                            children: [...(grid.children || []), itemToMove!]
                        }))
                    }))
                }))
            };
        });
    }, []);

    const alignSelection = useCallback((direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
        setProject(prev => {
            const currentSel = selections[activeScreenId] || [];
            if (currentSel.length < 2) return prev;

            const itemsToAlign: { pageId: string, id: string, x: number, y: number, width: number, height: number }[] = [];
            currentSel.forEach(sel => {
                if (sel.type !== 'item') return;
                const scr = prev.screens.find(s => s.id === activeScreenId);
                const pg = scr?.pages.find(p => p.id === sel.pageId);
                const it = pg?.items.find(i => i.id === sel.id);
                if (it) itemsToAlign.push({ pageId: sel.pageId, id: it.id, x: it.x, y: it.y, width: it.width, height: it.height });
            });

            if (itemsToAlign.length < 2) return prev;

            const minX = Math.min(...itemsToAlign.map(i => i.x));
            const maxX = Math.max(...itemsToAlign.map(i => i.x + i.width));
            const minY = Math.min(...itemsToAlign.map(i => i.y));
            const maxY = Math.max(...itemsToAlign.map(i => i.y + i.height));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            return {
                ...prev,
                screens: prev.screens.map(s => s.id === activeScreenId ? {
                    ...s,
                    pages: s.pages.map(p => {
                        const pageItems = itemsToAlign.filter(i => i.pageId === p.id);
                        if (pageItems.length === 0) return p;
                        return {
                            ...p,
                            items: p.items.map(it => {
                                const alignIt = pageItems.find(ai => ai.id === it.id);
                                if (!alignIt) return it;
                                let newX = it.x;
                                let newY = it.y;
                                if (direction === 'left') newX = minX;
                                else if (direction === 'right') newX = maxX - it.width;
                                else if (direction === 'top') newY = minY;
                                else if (direction === 'bottom') newY = maxY - it.height;
                                else if (direction === 'centerH') newX = centerX - it.width / 2;
                                else if (direction === 'centerV') newY = centerY - it.height / 2;
                                return { ...it, x: Math.round(newX), y: Math.round(newY) };
                            })
                        };
                    })
                } : s)
            };
        });
    }, [selections, activeScreenId]);

    const contextValue = useMemo(() => ({
        project, setProject, undo, redo, activeScreenId, setActiveScreenId, selections, setSelections, setSelectedEntity,
        selectedEntity: lastSelectedEntity, addScreen, removeScreen, updateScreen, addPage, removePage, updatePage,
        addItem, updateItem, removeItem, reorderItem, addPanel, updatePanel, removePanel, moveItemToPage, syncToDevice, exportProject, importProject, resetProject,
        baseWidth, setBaseWidth, baseHeight, setBaseHeight, scale, setScale, propsLocation, setPropsLocation, theme, setTheme, activeTab, setActiveTab,
        reorderGridItem, moveItemToGrid, alignSelection
    }), [project, activeScreenId, selections, lastSelectedEntity, addScreen, removeScreen, updateScreen, addPage, removePage, updatePage, addItem, updateItem, removeItem, reorderItem, addPanel, updatePanel, removePanel, moveItemToPage, syncToDevice, exportProject, importProject, resetProject, baseWidth, baseHeight, scale, propsLocation, theme, activeTab, setProject, undo, redo, reorderGridItem, moveItemToGrid, alignSelection]);

	return (
		<div style={{ ...s.app, background: theme === 'dark' ? '#0f172a' : '#f8fafc', color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}>
            <GridContext.Provider value={contextValue}>
                <main style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                    {activeTab === "grid" ? (
                        <GridTab 
                            isMobile={isMobile} 
                            width={width} 
                            wifiStatus={status} 
                            onWifiUpdate={refreshWifi} 
                            remoteIp={remoteIp} 
                            setRemoteIp={setRemoteIp} 
                            propsLocation={propsLocation} 
                            setPropsLocation={setPropsLocation} 
                            theme={theme} 
                            setTheme={setTheme}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    ) : activeTab === "dashboard" ? (
                        <DashboardTab 
                            isMobile={isMobile}
                            theme={theme}
                            setTheme={setTheme}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            wifiStatus={status}
                            remoteIp={remoteIp}
                            setRemoteIp={setRemoteIp}
                            propsLocation={propsLocation}
                            setPropsLocation={setPropsLocation}
                        />
                    ) : (
                        <>
                            <Header 
                                activeTab={activeTab} 
                                setActiveTab={setActiveTab} 
                                status={status} 
                                remoteIp={remoteIp} 
                                setRemoteIp={setRemoteIp} 
                                isMobile={isMobile} 
                                propsLocation={propsLocation}
                                setPropsLocation={setPropsLocation}
                                theme={theme}
                                setTheme={setTheme}
                            />
                            {activeTab === "wifi" && <WifiManager status={status} onRefresh={refreshWifi} API={API} />}
                            {activeTab === "settings" && <SettingsManager status={status} onRefresh={refreshWifi} API={API} />}
                            {activeTab === "logs" && <div style={{ padding: 40 }}>Console logs coming soon...</div>}
                            {activeTab === "mirror" && <div style={{ padding: 40 }}>Mirror mode coming soon...</div>}
                        </>
                    )}
                </main>
            </GridContext.Provider>
		</div>
	);
}

function GridTab({ isMobile, width, wifiStatus, remoteIp, setRemoteIp, propsLocation, setPropsLocation, theme, setTheme, activeTab, setActiveTab }: any) {
    const { propsLocation: contextPropsLocation } = useContext(GridContext) as any;
	return (
        <div style={{ display: "flex", flex: 1, height: "100%", flexDirection: "column", overflow: "hidden" }}>
            <Header 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                status={wifiStatus} 
                remoteIp={remoteIp} 
                setRemoteIp={setRemoteIp} 
                isMobile={isMobile} 
                propsLocation={propsLocation}
                setPropsLocation={setPropsLocation}
                theme={theme}
                setTheme={setTheme}
            />
            <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
                {!isMobile && <Sidebar />}
                {contextPropsLocation === 'left' && !isMobile && <PropertiesPanel />}
                <CanvasArea isMobile={isMobile} />
                {contextPropsLocation === 'right' && !isMobile && <PropertiesPanel />}
            </div>
        </div>
	);
}
