import { Header, type WifiStatus } from "./components/layout/Header";
import { Sidebar } from "./components/editor/Sidebar";
import { PropertiesPanel } from "./components/editor/PropertiesPanel";
import { CanvasArea } from "./components/editor/CanvasArea";
import { WidgetRenderer } from "./components/editor/WidgetRenderer";
import { WifiManager } from "./components/wifi/WifiManager";
import { GridContext } from "./context/GridContext";
import { SettingsManager } from "./components/layout/SettingsManager";
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
} from "react";

// --- HELPERS ---
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

const applyRecursive = (items: GridItem[], targetId: string, transform: (it: GridItem) => GridItem | null): GridItem[] => {
    return items.map(it => {
        if (it.id === targetId) return transform(it);
        if (it.children) return { ...it, children: applyRecursive(it.children, targetId, transform).filter(x => x) as GridItem[] };
        return it;
    }).filter(x => x) as GridItem[];
};


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
	const [activeTab, setActiveTab] = useState<"grid" | "mirror" | "wifi" | "logs" | "settings">("grid");
	const [status, setStatus] = useState<WifiStatus>({ connected: true, ip: "127.0.0.1", ssid: "STATION", ap_active: false, ap_always_on: false, mqtt_enabled: true });
    const [propsLocation, setPropsLocation] = useState<'left' | 'right'>(() => (localStorage.getItem("ds_props_location") as any) || 'left');
	const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem("ds_theme") as any) || 'light');

    useEffect(() => { localStorage.setItem("ds_remote_ip", remoteIp); }, [remoteIp]);
    useEffect(() => { localStorage.setItem("ds_props_location", propsLocation); }, [propsLocation]);
    useEffect(() => { 
        localStorage.setItem("ds_theme", theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

	const refreshWifi = useCallback(async () => {
		const sw = await API.getWifi();
		if (sw) setStatus(sw);
	}, []);

	useEffect(() => {
		refreshWifi();
		const t = setInterval(refreshWifi, 5000);
		return () => clearInterval(t);
	}, [refreshWifi]);

	return (
		<div style={{ ...s.app, background: theme === 'dark' ? '#0f172a' : '#f8fafc', color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}>
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
		</div>
	);
}

function GridTab({ isMobile, width, wifiStatus, remoteIp, setRemoteIp, propsLocation, setPropsLocation, theme, setTheme, activeTab, setActiveTab }: any) {
	const [project, setProject] = useState<Project>(() => {
		const VERSION = "2026.4";
		const saved = localStorage.getItem("ds_project_v3");
		if (localStorage.getItem("ds_project_version") !== VERSION) {
			localStorage.setItem("ds_project_version", VERSION);
			return {
				screens: [{ id: "main", name: "Main Screen", bg: 0x0e0e12, pages: [{ id: "p1", name: "Page (0,0)", x: 0, y: 0, items: [] }] }],
				panels: [{ id: "sidebar", name: "Sidebar", width: 160, height: 416, bg: 0x000000, itemBg: 0x000000, elements: [] }]
			};
		}
		return saved ? JSON.parse(saved) : {
			screens: [{ id: "main", name: "Main Screen", bg: 0x0e0e12, pages: [{ id: "p1", name: "Page (0,0)", x: 0, y: 0, items: [] }] }],
			panels: [{ id: "sidebar", name: "Sidebar", width: 160, height: 416, bg: 0x000000, itemBg: 0x000000, elements: [] }]
		};
	});

	const [activeScreenId, setActiveScreenId] = useState<string>("main");
	const [sidebarTab, setSidebarTab] = useState<'palette' | 'layers'>('layers');
	const [selections, setSelections] = useState<Record<string, any>>({});
    const [lastSelectedEntity, setLastSelectedEntity] = useState<any>(null);
	const [scale, setScale] = useState(1.0);
    const [baseWidth, setBaseWidth] = useState(800);
    const [baseHeight, setBaseHeight] = useState(416);

    // Auto-fix panel heights if they are still at the old 480 resolution
    useEffect(() => {
        const needsFix = project.panels.some(p => p.height === 480);
        if (needsFix) {
            setProject(prev => ({
                ...prev,
                panels: prev.panels.map(p => p.height === 480 ? { ...p, height: 416 } : p)
            }));
        }
    }, [project.panels]);

    const setSelectedEntity = useCallback((ent: any, screenId?: string) => {
		const targetScreenId = screenId || activeScreenId;
		setSelections(prev => ({ ...prev, [targetScreenId]: ent }));
        setLastSelectedEntity(ent);
    }, [activeScreenId]);

    // Ensure all panel-ref items are correctly sized and positioned
    useEffect(() => {
        setProject(prev => ({
            ...prev,
            screens: prev.screens.map(s => ({
                ...s,
                pages: s.pages.map(p => ({
                    ...p,
                    items: p.items.map(it => {
                        if (it.type === 'panel-ref') {
                            return { ...it, y: 32, height: baseHeight - 32 };
                        }
                        return it;
                    })
                }))
            }))
        }));
    }, [baseHeight]);

    const updateScreen = useCallback((id: string, patch: any) => {
        setProject(prev => ({ ...prev, screens: prev.screens.map(s => s.id === id ? { ...s, ...patch } : s) }));
    }, []);

    const addScreen = useCallback(() => {
        const id = `scr_${Math.random().toString(36).substr(2, 5)}`;
        setProject(prev => {
            let maxX = 0;
            // Find the rightmost edge of all existing screens
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
            // Note: baseWidth/Height are from state, but for nudging we can use current state values
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
        
        // Iteratively nudge to handle chain reactions
        while (changed) {
            changed = false;
            const modBounds = getBounds(currentScreens.find(s => s.id === modId)!);
            
            currentScreens = currentScreens.map(s => {
                if (s.id === modId) return s;
                const bounds = getBounds(s);
                // Check overlap
                const isOverlapping = !(bounds.right <= modBounds.left || bounds.left >= modBounds.right || bounds.bottom <= modBounds.top || bounds.top >= modBounds.bottom);
                if (isOverlapping) {
                    const overlap = modBounds.right - bounds.left;
                    changed = true;
                    return { ...s, x: (s.x ?? 0) + overlap + 200 }; // 200px gap
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
            return {
                ...prev,
                screens: nudgeScreens(newScreens, scrId)
            };
        });
    }, [nudgeScreens]);

    const removePage = useCallback((scrId: string, pgId: string) => {
        setProject(prev => {
            const screen = prev.screens.find(s => s.id === scrId);
            const page = screen?.pages.find(p => p.id === pgId);
            if (page && (page.x === 0 && page.y === 0)) {
                alert("You cannot delete the base Page (0,0). You can only delete its children (widgets).");
                return prev;
            }
            return {
                ...prev,
                screens: prev.screens.map(s => s.id === scrId ? { ...s, pages: s.pages.filter(p => p.id !== pgId) } : s)
            };
        });
    }, []);

    const updatePage = useCallback((scrId: string, pgId: string, patch: any) => {
        setProject(prev => ({
            ...prev,
            screens: prev.screens.map(s => s.id === scrId ? { ...s, pages: s.pages.map(p => p.id === pgId ? { ...p, ...patch } : p) } : s)
        }));
    }, []);

    const addItem = useCallback((type: ElementType, pageId: string, parentId?: string, panelId?: string, fx?: number, fy?: number) => {
        const id = `${type}_${Math.random().toString(36).substr(2, 5)}`;
        const newItem: GridItem = { id, name: `New ${type}`, type, x: fx??20, y: fy??0, width: 120, height: 40, color: 0x4f46e5, textColor: 0xffffff, radius: 8, panelId };
        
        setProject(prev => {
            const isPanel = prev.panels.some(p => p.id === pageId);
            if (isPanel) {
                if (type !== 'nav-item') {
                    alert("Master Panels (Sidebars) can only contain Nav Items.");
                    return prev;
                }
                const panel = prev.panels.find(p => p.id === pageId);
                const width = panel?.width || 160;
                const newNavItem: GridItem = { ...newItem, x: 0, y: (panel?.elements.length || 0) * 50, width: width, height: 50 };
                return {
                    ...prev,
                    panels: prev.panels.map(p => p.id === pageId ? { ...p, elements: [...p.elements, newNavItem] } : p)
                };
            } else {
                let pageItem = { ...newItem };
                
                // Special handling for adding Sidebars (panel-ref) to a page
                if (type === 'panel-ref' && panelId) {
                    const panel = prev.panels.find(p => p.id === panelId);
                    pageItem = {
                        ...pageItem,
                        x: 0,
                        y: 0,
                        width: panel?.width || 160,
                        height: baseHeight
                    };
                }

                return {
                    ...prev,
                    screens: prev.screens.map(s => ({
                        ...s,
                        pages: s.pages.map(p => p.id === pageId ? { ...p, items: [...p.items, pageItem] } : p)
                    }))
                };
            }
        });
        setSelectedEntity({ type: 'item', id, pageId });
    }, [setSelectedEntity]);

    const updateItem = useCallback((pageId: string, id: string, patch: any) => {
        setProject(prev => {
            const isPanel = prev.panels.some(p => p.id === pageId);
            const finalPatch = { ...patch };
            let newPanels = prev.panels;

            if (isPanel) {
                const panel = prev.panels.find(p => p.id === pageId);
                if (finalPatch.x !== undefined) finalPatch.x = 0;
                if (finalPatch.width !== undefined) finalPatch.width = panel?.width || 160;

                newPanels = prev.panels.map(p => {
                    if (p.id === pageId) {
                        const newElements = p.elements.map(e => e.id === id ? { ...e, ...finalPatch } : e);
                        newElements.sort((a, b) => {
                            const centerA = a.y + ((a.height || 50) / 2);
                            const centerB = b.y + ((b.height || 50) / 2);
                            return centerA - centerB;
                        });
                        
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
            }



            return {
                ...prev,
                panels: newPanels,
                screens: !isPanel ? prev.screens.map(s => ({
                    ...s,
                    pages: s.pages.map(p => p.id === pageId ? { ...p, items: applyRecursive(p.items, id, it => ({ ...it, ...finalPatch })) } : p)
                })) : prev.screens
            };
        });
    }, []);

    const removeItem = useCallback((pageId: string, id: string) => {
        setProject(prev => {
            const isPanel = prev.panels.some(p => p.id === pageId);
            return {
                ...prev,
                panels: isPanel ? prev.panels.map(p => p.id === pageId ? { ...p, elements: p.elements.filter(e => e.id !== id) } : p) : prev.panels,
                screens: !isPanel ? prev.screens.map(s => ({
                    ...s,
                    pages: s.pages.map(p => p.id === pageId ? { ...p, items: applyRecursive(p.items, id, () => null) } : p)
                })) : prev.screens
            };
        });
        setSelectedEntity(null);
    }, [setSelectedEntity]);

    const addPanel = useCallback((patch?: any) => {
        const id = `pan_${Math.random().toString(36).substr(2, 5)}`;
        setProject(prev => ({ ...prev, panels: [...prev.panels, { id, name: 'New Panel', width: 160, height: 416, bg: 0x000000, elements: [], ...patch }] }));
        setSelectedEntity({ type: 'panel', id });
    }, [setSelectedEntity]);

    const updatePanel = useCallback((id: string, patch: any) => {
        setProject(prev => ({ ...prev, panels: prev.panels.map(p => p.id === id ? { ...p, ...patch } : p) }));
    }, []);

    const removePanel = useCallback((id: string) => {
        setProject(prev => ({ ...prev, panels: prev.panels.filter(p => p.id !== id) }));
        setSelectedEntity(null);
    }, [setSelectedEntity]);

    const moveItemToPage = useCallback((oldPageId: string, newPageId: string, itemId: string, patch: any) => {
        setProject(prev => {
            let itemToMove: any = null;
            
            // 1. Remove from old page and capture item
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

            // 2. Add to new page
            return {
                ...prev,
                screens: newScreens.map(s => ({
                    ...s,
                    pages: s.pages.map(p => {
                        if (p.id === newPageId) {
                            return { ...p, items: [...p.items, itemToMove] };
                        }
                        return p;
                    })
                }))
            };
        });
        setSelectedEntity({ type: 'item', id: itemId, pageId: newPageId });
    }, [setSelectedEntity]);

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
                    console.log("Project imported successfully!");
                } else {
                    console.error("Invalid project file");
                }
            } catch (err) {
                console.error("Error parsing JSON file", err);
            }
        };
        reader.readAsText(file);
    }, []);

    const syncToDevice = useCallback(async () => {
        if (!remoteIp) {
            console.warn("Sync attempted without device IP address.");
            return;
        }

        try {
            console.log("Syncing to device:", remoteIp);
            
            // Sort screens so active one is synced LAST (so device stays on it)
            const sortedScreens = [...project.screens].sort((a, b) => {
                if (a.id === activeScreenId) return 1;
                if (b.id === activeScreenId) return -1;
                return 0;
            });

            // 1. Sync Screens
            for (const screen of sortedScreens) {
                console.log(`Processing screen: ${screen.id} (${screen.name})`);
                
                const flattenedItems: any[] = [];
                (screen.pages || []).forEach(pg => {
                    const pgX = pg.x || 0;
                    const pgY = pg.y || 0;
                    const offsetX = pgX * baseWidth;
                    const offsetY = pgY * baseHeight;
                    
                    (pg.items || []).forEach(it => {
                        flattenedItems.push({
                            ...it,
                            x: (it.x || 0) + offsetX,
                            y: (it.y || 0) + offsetY
                        });
                    });
                });

                const deviceConfig = {
                    ...screen,
                    items: flattenedItems,
                    // Add some metadata for the device
                    width: baseWidth,
                    height: baseHeight
                };
                delete (deviceConfig as any).pages; 

                console.log(`Sending config for ${screen.id} (${flattenedItems.length} items):`, deviceConfig);

                const url = `http://${remoteIp}/api/grid/config?name=${screen.id}`;
                const res = await fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(deviceConfig),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!res.ok) throw new Error(`Failed to sync screen ${screen.id}: ${res.statusText}`);
            }

            // 2. Sync Panels
            console.log("Syncing Master Panels...");
            const panelsUrl = `http://${remoteIp}/api/grid/panels`;
            const panelsRes = await fetch(panelsUrl, {
                method: 'POST',
                body: JSON.stringify(project.panels),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!panelsRes.ok) throw new Error("Failed to sync Master Panels.");

            console.log("Project synced successfully!");
        } catch (err: any) {
            console.error("Sync error:", err);
        }
    }, [project, remoteIp, activeScreenId, baseWidth, baseHeight]);


    useEffect(() => { localStorage.setItem("ds_project_v3", JSON.stringify(project)); }, [project]);

    const contextValue = useMemo(() => ({
        project, activeScreenId, setActiveScreenId, selections, setSelections, setSelectedEntity,
        selectedEntity: lastSelectedEntity,
        addScreen, removeScreen, updateScreen, addPage, removePage, updatePage,
        addItem, updateItem, removeItem, addPanel, updatePanel, removePanel, moveItemToPage, syncToDevice,
        baseWidth, setBaseWidth, baseHeight, setBaseHeight, scale, setScale, propsLocation, setPropsLocation, theme, setTheme, activeTab, setActiveTab
    }), [project, activeScreenId, selections, lastSelectedEntity, addScreen, removeScreen, updateScreen, addPage, removePage, updatePage, addItem, updateItem, removeItem, addPanel, updatePanel, removePanel, moveItemToPage, syncToDevice, baseWidth, setBaseWidth, baseHeight, setBaseHeight, scale, setScale, propsLocation, setPropsLocation, theme, setTheme, activeTab, setActiveTab]);

	return (
		<GridContext.Provider value={contextValue}>
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
                    {propsLocation === 'left' && !isMobile && <PropertiesPanel />}
                    <CanvasArea isMobile={isMobile} />
                    {propsLocation === 'right' && !isMobile && <PropertiesPanel />}
                </div>
            </div>
		</GridContext.Provider>
	);
}
