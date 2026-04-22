import { Header, type WifiStatus } from "./components/layout/Header";
import { Sidebar } from "./components/editor/Sidebar";
import { PropertiesPanel } from "./components/editor/PropertiesPanel";
import { CanvasArea } from "./components/editor/CanvasArea";
import { WidgetRenderer } from "./components/editor/WidgetRenderer";
import { WifiManager } from "./components/wifi/WifiManager";
import { GridContext } from "./context/GridContext";
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
} from "react";

// --- SMART COMPONENTS REGISTRY ---
// Each entry describes a native C++ component that can be placed anywhere on a screen.

// --- UTILS ---
const safeHex = (num: any, fallback = "000000") => {
	if (num === undefined || num === null) return fallback;
	if (typeof num === "string") {
		const clean = num.replace('#', '');
		return clean.padStart(6, "0").toUpperCase();
	}
	return num.toString(16).padStart(6, "0").toUpperCase();
};

const brightness = (hex: string) => {
	const r = parseInt(hex.substring(1, 3), 16);
	const g = parseInt(hex.substring(3, 5), 16);
	const b = parseInt(hex.substring(5, 7), 16);
	return r * 0.299 + g * 0.587 + b * 0.114;
};

const s: Record<string, React.CSSProperties> = { 
	app: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", userSelect: "none", fontFamily: "'Outfit', sans-serif" }, 
	card: { background: "white", borderRadius: "20px", padding: "28px", boxShadow: "0 8px 30px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }, 
	primaryBtn: { background: "#4f46e5", color: "white", border: "none", borderRadius: "14px", cursor: "pointer", fontWeight: "800", transition: "0.25s", padding: "10px 24px", fontSize: "11px" }, 
	secondaryBtn: { background: "white", border: "1px solid #e2e8f0", color: "#475569", borderRadius: "14px", cursor: "pointer", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }, 
	compactBtn: { background: "white", border: "1px solid #e2e8f0", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 12px 50px rgba(0,0,0,0.15)", transition: "0.25s" },
	cardTitle: { fontSize: "13px", fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "2.5px" }, 
	formGroup: { display: "flex", flexDirection: "column", gap: "10px" },
	formLabel: { fontSize: "12px", fontWeight: 900, color: "#94a3b8", display: "block" }, 
	input: { width: "100%", height: "48px", padding: "0 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", color: "#1e293b", fontSize: "15px", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s" },
    addPageBtn: { background: "rgba(255,255,255,0.05)", border: "2px dashed #e2e8f0", borderRadius: "20px", color: "#64748b", fontWeight: 900, fontSize: "14px", cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" },
    miniDelBtn: { background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", color: "#f43f5e", width: "24px", height: "24px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, cursor: "pointer", transition: "0.2s" }
};

// --- API ---
const isDev = (import.meta as any).env.DEV;

const MOCK_API = {
	async getWifi(): Promise<WifiStatus> {
		const saved = localStorage.getItem("ds_mock_wifi");
		return saved ? JSON.parse(saved) : { connected: true, ip: "192.168.1.100", ssid: "MOCK_WIFI", ap_active: false, ap_always_on: false, ap_ssid: "GRIDOS_MOCK_AP" };
	},
	async updateSettings(opts: any) {
		const cur = await this.getWifi();
		if (!cur) return false;
		const next = { ...cur, ...opts, ap_active: opts.active ?? cur.ap_active };
		localStorage.setItem("ds_mock_wifi", JSON.stringify(next));
		return true;
	},
	async saveGrid(name: string, data: any) {
		console.log(`[MOCK] Saved Screen ${name}`, data);
		localStorage.setItem(`scr_${name}`, JSON.stringify(data));
		return true;
	},
	async savePanels(panels: Panel[]) {
		console.log(`[MOCK] Saved Panels`, panels);
		localStorage.setItem("ds_panels", JSON.stringify(panels));
		return true;
	},
	async scanWifi() {
		return [
			{ ssid: "GridOS_Home", rssi: -45, secure: true },
			{ ssid: "Guest_Net", rssi: -62, secure: true },
			{ ssid: "Starbucks_Free", rssi: -78, secure: false },
			{ ssid: "Hidden_Network", rssi: -85, secure: true }
		];
	},
	async connectWifi(creds: any) {
		console.log("[MOCK] Connecting to ", creds);
		return true;
	}
};

const REAL_API = {
	async getWifi(): Promise<WifiStatus> {
		try { const res = await fetch("/api/wifi/status"); return await res.json(); } catch(e) { return null; }
	},
	async updateSettings(opts: { active?: boolean, always_on?: boolean, ss_enabled?: boolean, ssid?: string, password?: string }) {
		try { 
			await fetch("/api/wifi/ap", {
				method: "POST",
				body: JSON.stringify(opts),
				headers: { "Content-Type": "application/json" }
			});
			return true;
		} catch(e) { return false; }
	},
	async saveGrid(name: string, data: any) {
		try { 
			await fetch(`/api/grid/config?name=${name}`, {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" }
			});
			return true;
		} catch(e) { return false; }
	},
	async savePanels(panels: Panel[]) {
		try {
			await fetch("/api/grid/panels", {
				method: "POST",
				body: JSON.stringify(panels),
				headers: { "Content-Type": "application/json" }
			});
			return true;
		} catch(e) { return false; }
	},
	async scanWifi(): Promise<any[]> {
		try { const res = await fetch("/api/wifi/scan"); return await res.json(); } catch(e) { return []; }
	},
	async connectWifi(creds: any): Promise<boolean> {
		try { await fetch("/api/wifi/connect", { method: "POST", body: JSON.stringify(creds), headers: { "Content-Type": "application/json" } }); return true; } catch(e) { return false; }
	}
};

const API = isDev ? MOCK_API : REAL_API;

const getWidgetPreview = (type: ElementType, color: string) => {
	const base = { width: 12, height: 12, borderRadius: 2, display: "flex" as const, alignItems: "center", justifyContent: "center" };
	switch(type) {
		case "btn": return <div style={{ ...base, border: `2px solid ${color}` }} />;
		case "switch": return <div style={{ width: 14, height: 8, borderRadius: 10, background: "#e2e8f0", position: "relative" }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: color, position: "absolute", right: 2, top: 2 }} /></div>;
		case "slider": return <div style={{ width: 14, height: 2, background: color, position: "relative" }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: color, position: "absolute", left: '50%', top: -1 }} /></div>;
		case "label": return <div style={{ fontSize: 8, fontWeight: 900, color }}>Ab</div>;
		case "clock": return <div style={{ fontSize: 8, fontWeight: 900, color }}>12:0</div>;
		case "arc": return <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${color}`, borderTopColor: "transparent" }} />;
		case "bar": return <div style={{ width: 12, height: 4, background: "#e2e8f0", overflow: "hidden" }}><div style={{ width: '60%', height: '100%', background: color }} /></div>;
		case "roller": return <div style={{ width: 12, height: 12, border: `1px solid ${color}`, borderRadius: 2, background: "linear-gradient(transparent, rgba(0,0,0,0.1), transparent)" }} />;
		case "border": return <div style={{ width: 14, height: 14, border: `1px solid ${color}`, borderRadius: 2 }} />;
		case "nav-menu": return <div style={{ width: 14, height: 14, display: "flex", flexDirection: "column", gap: 2 }}>{[1,2,3].map(i=><div key={i} style={{ width: "100%", height: 2, background: color }} />)}</div>;
		default: return null;
	}
};
// --- HOOKS ---

// --- HOOKS ---
function useWindowSize() {
	const [size, setSize] = useState([window.innerWidth, window.innerHeight]);
	useLayoutEffect(() => {
		const update = () => setSize([window.innerWidth, window.innerHeight]);
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	return size;
}

// --- MAIN WRAPPER ---
export default function SafeApp() {
	const [width] = useWindowSize();
	const isMobile = width < 900;
	return (
		<ErrorBoundary>
			<div style={{ ...s.app, background: "#f8fafc", color: "#1e293b", padding: "0" }}>
				<App isMobile={isMobile} />
			</div>
		</ErrorBoundary>
	);
}

function App({ isMobile }: { isMobile: boolean }) {
    const [remoteIp, setRemoteIp] = useState(() => localStorage.getItem("ds_remote_ip") || "");
	const [activeTab, setActiveTab] = useState<"grid" | "mirror" | "wifi" | "logs" | "settings">("grid");
	const [status, setStatus] = useState<WifiStatus>({ connected: true, ip: "127.0.0.1", ssid: "STATION", ap_active: false, ap_always_on: false });
	const [width] = useWindowSize();

    useEffect(() => { localStorage.setItem("ds_remote_ip", remoteIp); }, [remoteIp]);

	const refreshWifi = useCallback(async () => {
		const sw = await API.getWifi();
		if (sw) setStatus(sw);
	}, []);

	useEffect(() => {
		refreshWifi();
		const t = setInterval(refreshWifi, 5000);
		return () => clearInterval(t);
	}, [refreshWifi]);

	const [propsLocation, setPropsLocation] = useState<'left' | 'right'>(() => {
        return (localStorage.getItem("ds_props_location") as 'left' | 'right') || 'left';
    });

    useEffect(() => {
        localStorage.setItem("ds_props_location", propsLocation);
    }, [propsLocation]);

	const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem("ds_theme") as 'light' | 'dark') || 'light';
    });

    useEffect(() => {
        localStorage.setItem("ds_theme", theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

	const handleAPToggle = async (active?: boolean) => {
		const newState = active ?? !status?.ap_active;
		const success = await API.updateSettings({ active: newState, always_on: status?.ap_always_on || false });
		if (success) refreshWifi();
	};
	
	const headerHeight = isMobile ? 56 : 64;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", overflow: "hidden" }}>
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

			<main style={{ flex: 1, overflow: isMobile ? "hidden" : "auto", position: "relative" }}>
				{activeTab === "grid" ? <GridTab isMobile={isMobile} width={width} wifiStatus={status} onWifiUpdate={refreshWifi} onSettingsUpdate={handleAPToggle} remoteIp={remoteIp} setRemoteIp={setRemoteIp} propsLocation={propsLocation} setPropsLocation={setPropsLocation} theme={theme} setTheme={setTheme} /> :
				 activeTab === "mirror" ? <MirrorTab /> :
				 activeTab === "logs" ? <LogsTab isMobile={isMobile} /> :
				 activeTab === "wifi" ? <WifiTab status={status} onRefresh={refreshWifi} onAPToggle={handleAPToggle} /> :
				 activeTab === "settings" ? <SettingsTab status={status} onRefresh={refreshWifi} onAPToggle={handleAPToggle} /> :
				 null}
			</main>

			{isMobile && (
				<nav style={{ height: "70px", background: "white", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 10000 }}>
					{[{ id: "grid", label: "Builder", icon: "🛠️" }, { id: "mirror", label: "Mirror", icon: "📱" }, { id: "wifi", label: "WiFi", icon: "🌐" }, { id: "logs", label: "Logs", icon: "🖥️" }, { id: "settings", label: "Settings", icon: "⚙️" }].map(tab => (
						<button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, color: activeTab === tab.id ? "#4f46e5" : "#64748b" }}>
							<span style={{ fontSize: "20px" }}>{tab.icon}</span>
							<span style={{ fontSize: "10px", fontWeight: 700 }}>{tab.label}</span>
						</button>
					))}
				</nav>
			)}
		</div>
	);
}

// ... GridContext moved to separate file


// ... Hierarchy components moved to Sidebar.tsx


// --- GRID TAB (BUILDER) ---

function GridTab({ isMobile, width, wifiStatus, onWifiUpdate, onSettingsUpdate, remoteIp, setRemoteIp, propsLocation, setPropsLocation, theme, setTheme }: { isMobile: boolean, width: number, wifiStatus: WifiStatus, onWifiUpdate: () => void, onSettingsUpdate: (active?: boolean) => void, remoteIp: string, setRemoteIp: (ip: string) => void, propsLocation: 'left' | 'right', setPropsLocation: (loc: 'left' | 'right') => void, theme: 'light' | 'dark', setTheme: (t: 'light' | 'dark') => void }) {
	const [project, setProject] = useState<Project>(() => {
		const VERSION = "2026.4"; // 6.1 Version Guard
		const savedVersion = localStorage.getItem("ds_project_version");
		const saved = localStorage.getItem("ds_project_v3");
		
		if (savedVersion !== VERSION) {
			console.warn("New version detected, clearing stale localStorage...");
			localStorage.removeItem("ds_project_v3");
			localStorage.setItem("ds_project_version", VERSION);
			return {
				screens: [{ id: "main", name: "Main Screen", bg: 0x0e0e12, pages: [{ id: "p1", name: "Page 1", x: 0, y: 0, items: [] }] }],
				panels: [{ id: "sidebar", name: "Sidebar", width: 160, height: 480, bg: 0x000000, itemBg: 0x000000, elements: [] }]
			};
		}

		return saved ? JSON.parse(saved) : {
			screens: [{ id: "main", name: "Main Screen", bg: 0x0e0e12, pages: [{ id: "p1", name: "Page 1", x: 0, y: 0, items: [] }] }],
			panels: [{ id: "sidebar", name: "Sidebar", width: 160, height: 480, bg: 0x000000, itemBg: 0x000000, elements: [] }]
		};
	});
	const [activeScreenId, setActiveScreenId] = useState<string>("main");
	const [sidebarTab, setSidebarTab] = useState<'palette' | 'layers'>('layers');
	const [selections, setSelections] = useState<Record<string, { type: 'screen' | 'page' | 'item' | 'panel' | 'component', id: string, pageId?: string } | null>>({});
	const selectedEntity = selections[activeScreenId] || null;

	const setSelectedEntity = useCallback((ent: { type: 'screen' | 'page' | 'item' | 'panel' | 'component', id: string, pageId?: string } | null, screenId?: string, skipTabSwitch: boolean = false) => {
		const targetScreenId = screenId || activeScreenId;
		if (ent?.type === 'screen') {
			const scr = project.screens.find(s => s.id === ent.id);
			if (scr?.pages[0]) {
                const pageEnt = { type: 'page' as const, id: scr.pages[0].id };
				setSelections(prev => ({ ...prev, [ent.id]: pageEnt }));
				return;
			}
		}
		if (!skipTabSwitch && (ent?.type === 'item' || ent?.type === 'page')) {
			setSidebarTab('layers');
		}
		setSelections(prev => ({ ...prev, [targetScreenId]: ent }));
	}, [activeScreenId, project.screens]);

	const addPage = (screenId: string, x: number, y: number) => {
		setProject(prev => ({
			...prev,
			screens: prev.screens.map(s => s.id === screenId ? {
				...s,
				pages: [...s.pages, { id: `p${Math.random().toString(36).substr(2, 5)}`, name: `Page ${s.pages.length+1}`, items: [], x, y }]
			} : s)
		}));
	};
	const removePage = (screenId: string, pageId: string) => {
		setProject(prev => ({
			...prev,
			screens: prev.screens.map(s => s.id === screenId ? {
				...s,
				pages: s.pages.filter(p => p.id !== pageId)
			} : s)
		}));
		if (selectedEntity?.id === pageId) setSelectedEntity(null);
	};
	const [dragInfo, setDragInfo] = useState<{ id: string; pageId: string; startX: number; startY: number; initialX: number; initialY: number; initialWidth: number; initialHeight: number; mode: "move" | "resize" } | null>(null);
	const [showLib, setShowLib] = useState(false);
	const [showEditor, setShowEditor] = useState(false);
	const [baseWidth, setBaseWidth] = useState(800);
	const [baseHeight, setBaseHeight] = useState(416);
	const [showKeyboard, setShowKeyboard] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

	const sidebarWidth = 160;
	const headerHeight = 64;
	const frameWidth = 800;
	const frameHeight = 480;

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

	const activeScreen = project.screens.find(s => s.id === activeScreenId) || project.screens[0];
	const isEditingPanel = selectedEntity?.type === 'panel' || (selectedEntity?.type === 'item' && selectedEntity.pageId === 'panel');
	const editingPanel = (isEditingPanel && selectedEntity) ? project.panels.find(p => p.id === selectedEntity.id || (selectedEntity.pageId === 'panel' && project.panels.some(pan => pan.elements.some(el => el.id === selectedEntity.id)))) : null;
	
	const selectedItem = (selectedEntity?.type === 'item') 
		? (selectedEntity.pageId === 'panel' 
			? project.panels.flatMap(p => p.elements).find(it => it.id === selectedEntity.id)
			: activeScreen.pages.map(p => findItemRecursive(p.items, selectedEntity.id)).find(it => it))
		: null;
	
	const updateProject = (patch: Partial<Project>) => setProject(prev => ({ ...prev, ...patch }));
	const updateScreen = (id: string, patch: Partial<Screen>) => setProject(prev => ({ ...prev, screens: prev.screens.map(s => s.id === id ? { ...s, ...patch } : s) }));
	const addScreen = () => {
		const newScreen: Screen = {
			id: `scr_${Math.random().toString(36).substr(2, 5)}`,
			name: `Screen ${project.screens.length + 1}`,
			pages: [{ id: `p${Math.random().toString(36).substr(2, 5)}`, name: "Page 1", items: [], x: 0, y: 0 }]
		};
		setProject(prev => ({ ...prev, screens: [...prev.screens, newScreen] }));
		setActiveScreenId(newScreen.id);
		setSelectedEntity({ type: 'screen', id: newScreen.id }, newScreen.id);
	};

	const removeScreen = (id: string) => {
		if (id === "main") return;
		setProject(prev => ({ ...prev, screens: prev.screens.filter(s => s.id !== id) }));
		setActiveScreenId("main");
	};

	const addPanel = (override?: Partial<Panel>) => {
		const newPanel: Panel = {
			id: `pan_${Math.random().toString(36).substr(2, 5)}`,
			name: `Navigation ${project.panels.length+1}`,
			width: 160,
			height: 480,
			bg: 0x4f46e5,
			itemBg: 0x6366f1,
			elements: [],
            ...override
		};
		setProject(prev => ({ ...prev, panels: [...prev.panels, newPanel] }));
		setSelectedEntity({ type: 'panel', id: newPanel.id });
	};

	const updatePanel = (id: string, patch: Partial<Panel>) => {
		setProject(prev => ({ ...prev, panels: prev.panels.map(p => p.id === id ? { ...p, ...patch } : p) }));
	};

	const removePanel = (id: string) => {
		setProject(prev => ({
			...prev,
			panels: prev.panels.filter(p => p.id !== id),
			screens: prev.screens.map(s => ({
				...s,
				pages: s.pages.map(p => ({
					...p,
					items: p.items.filter(it => it.panelId !== id)
				}))
			}))
		}));
		setSelectedEntity(null);
	};

	const moveScreen = (draggedId: string, targetId: string) => {
		setProject(prev => {
			const arr = [...prev.screens];
			const fromIdx = arr.findIndex(s => s.id === draggedId);
			const toIdx = arr.findIndex(s => s.id === targetId);
			if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
			const [item] = arr.splice(fromIdx, 1);
			arr.splice(toIdx, 0, item);
			return { ...prev, screens: arr };
		});
	};
	const updatePage = (screenId: string, pageId: string, patch: Partial<Page>) => setProject(prev => ({ 
		...prev, 
		screens: prev.screens.map(s => s.id === screenId ? { 
			...s, 
			pages: s.pages.map(p => p.id === pageId ? { ...p, ...patch } : p) 
		} : s) 
	}));

	useEffect(() => { localStorage.setItem("ds_project_v3", JSON.stringify(project)); }, [project]);
	
	
	const [scale, setScale] = useState(1);
	const panelsTotalWidth = isMobile ? 0 : 560;
    
    useEffect(() => {
        const nextScale = isMobile ? Math.min(1, (width - 40) / frameWidth) : Math.min(1, (width - panelsTotalWidth - 100) / frameWidth);
        setScale(nextScale);
    }, [isMobile, width, frameWidth, panelsTotalWidth]);
	const canvasContainerRef = useRef<HTMLDivElement>(null);

	const applyRecursive = (items: GridItem[], targetId: string, transform: (it: GridItem) => GridItem | null): GridItem[] => {
		return items.map(it => {
			if (it.id === targetId) return transform(it);
			if (it.children) return { ...it, children: applyRecursive(it.children, targetId, transform).filter(x => x) as GridItem[] };
			return it;
		}).filter(x => x) as GridItem[];
	};

	const addItem = useCallback((type: ElementType, pageId: string, parentId?: string, panelId?: string, forceX?: number, forceY?: number, itemOverride?: Partial<GridItem>, skipTabSwitch: boolean = false) => {
		const newId = `${type}_${Math.random().toString(36).substr(2, 5)}`;
		const isMenu = type === 'menu-item' || type === 'nav-item';
		const newItem: GridItem = { 
            id: newId, 
            name: isMenu ? `Menu Item ${Math.floor(Math.random()*100)}` : `New ${type}`, 
            type, 
            x: forceX ?? (type === 'panel-ref' ? 0 : 20), 
            y: forceY ?? (type === 'panel-ref' ? 0 : 20), 
            width: type === 'panel-ref' ? 160 : (isMenu ? 160 : 120), 
            height: type === 'panel-ref' ? 480 : 40, 
            textColor: 0xffffff, 
            color: isMenu ? 0x2d2d3f : 0x4f46e5, 
            value: 50, 
            min: 0, 
            max: 100, 
            options: "Item 1\nItem 2\nItem 3", 
            borderWidth: 0, 
            radius: type === 'panel-ref' ? 0 : 8, 
            panelId, 
            fontSize: isMenu ? 13 : 10,
            ...itemOverride 
        };
		
		if (pageId === 'panel' && editingPanel) {
			setProject(prev => ({
				...prev,
				panels: prev.panels.map(p => p.id === editingPanel.id ? { ...p, elements: [...p.elements, newItem] } : p)
			}));
			setSelectedEntity({ type: 'item', id: newId, pageId: 'panel' });
			return;
		}

		setProject(prev => ({
			...prev,
			screens: prev.screens.map(s => {
				const hasPage = s.pages.some(p => p.id === pageId);
				if (!hasPage) return s;
				return {
					...s,
					pages: s.pages.map(p => p.id === pageId ? { 
						...p, 
						items: parentId 
							? applyRecursive(p.items, parentId, pit => ({ ...pit, children: [...(pit.children || []), newItem] }))
							: [...p.items, newItem] 
					} : p)
				};
			})
		}));
		setSelectedEntity({ type: 'item', id: newId, pageId }, undefined, skipTabSwitch);
		setShowEditor(true);
	}, [editingPanel, setSelectedEntity]);

	const updateItem = useCallback((pageId: string, id: string, patch: Partial<GridItem>) => {
		const targetPanel = project.panels.find(p => p.id === pageId);
		if (targetPanel) {
			setProject(prev => ({
				...prev,
				panels: prev.panels.map(p => p.id === pageId ? { ...p, elements: p.elements.map(e => e.id === id ? { ...e, ...patch } : e) } : p)
			}));
			return;
		}

		setProject(prev => ({
			...prev,
			screens: prev.screens.map(s => ({
				...s,
				pages: s.pages.map(p => {
					if (p.id !== pageId) return p;
					return {
						...p,
						items: applyRecursive(p.items, id, pit => ({ ...pit, ...patch }))
					};
				})
			}))
		}));
	}, [project.panels, applyRecursive]);

	const removeItem = useCallback((pageId: string, id: string) => {
		let siblingToSelect: any = null;
		
		const targetPanel = project.panels.find(p => p.id === pageId);
		if (targetPanel) {
			const idx = targetPanel.elements.findIndex(e => e.id === id);
			if (idx !== -1) {
				const sib = targetPanel.elements[idx + 1] || targetPanel.elements[idx - 1];
				if (sib) siblingToSelect = { type: 'item', id: sib.id, pageId };
				else siblingToSelect = { type: 'panel', id: targetPanel.id };
			}
			setProject(prev => ({
				...prev,
				panels: prev.panels.map(p => p.id === pageId ? { ...p, elements: p.elements.filter(e => e.id !== id) } : p)
			}));
			setSelectedEntity(siblingToSelect);
			return;
		}

		// Find sibling in pages
		for (const scr of project.screens) {
			const pg = scr.pages.find(p => p.id === pageId);
			if (pg) {
				const idx = pg.items.findIndex(it => it.id === id);
				if (idx !== -1) {
					const sib = pg.items[idx + 1] || pg.items[idx - 1];
					if (sib) siblingToSelect = { type: 'item', id: sib.id, pageId };
					else siblingToSelect = { type: 'page', id: pageId };
				}
				break;
			}
		}

		setProject(prev => ({
			...prev,
			screens: prev.screens.map(s => ({
				...s,
				pages: s.pages.map(p => {
					if (p.id !== pageId) return p;
					return {
						...p,
						items: applyRecursive(p.items, id, () => null as any)
					};
				})
			}))
		}));
		setSelectedEntity(siblingToSelect);
	}, [editingPanel, project.screens, setSelectedEntity]);


	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Delete" || e.key === "Backspace") {
				// Don't delete if we're typing in an input
				if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
				
                console.log("Delete key pressed, selectedEntity:", selectedEntity);
				if (selectedEntity?.type === 'item') {
					removeItem(selectedEntity.pageId!, selectedEntity.id);
				} else if (selectedEntity?.type === 'page') {
                    if (activeScreen.pages.length > 1) {
					    removePage(activeScreenId, selectedEntity.id);
                    } else {
                        console.warn("Cannot delete the only page in a screen");
                    }
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedEntity, activeScreenId, activeScreen.pages, removeItem, removePage]);
	
	const moveItemHierarchy = (draggedId: string, targetId: string) => {
		setProject(prev => {
			let draggedItem: GridItem | null = null;
			
			const findAndRemove = (list: GridItem[]): GridItem[] => {
				const idx = list.findIndex(it => it.id === draggedId);
				if (idx !== -1) {
					draggedItem = list[idx];
					return list.filter(item => item.id !== draggedId);
				}
				return list.map(item => item.children ? { ...item, children: findAndRemove(item.children) } : item);
			};

			const findAndInsert = (list: GridItem[]): GridItem[] => {
				const idx = list.findIndex(it => it.id === targetId);
				if (idx !== -1 && draggedItem) {
					const newList = [...list];
					newList.splice(idx, 0, draggedItem);
					return newList;
				}
				return list.map(item => item.children ? { ...item, children: findAndInsert(item.children) } : item);
			};

			const newScreens = prev.screens.map(s => ({
				...s,
				pages: s.pages.map(p => {
					let items = findAndRemove(p.items);
					items = findAndInsert(items);
					return { ...p, items };
				})
			}));

            const newPanels = prev.panels.map(p => {
                let elements = findAndRemove(p.elements || []);
                elements = findAndInsert(elements);
                return { ...p, elements };
            });

			return { ...prev, screens: newScreens, panels: newPanels };
		});
	};

	const syncToDevice = async () => {
		if (isSyncing) return;
		
		const targetIp = remoteIp || (window.location.hostname !== 'localhost' ? window.location.hostname : '');
		const useRemote = !!remoteIp;
		const currentScreenId = activeScreenId;

		setIsSyncing(true);
		setSyncStatus('idle');
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

			// 1. Sync Panels
			if (useRemote) {
				await fetch(`http://${targetIp}/api/grid/panels`, { 
					method: "POST", 
					body: JSON.stringify(project.panels),
					signal: controller.signal
				});
			} else {
				await API.savePanels(project.panels);
			}

			// Sync screens - push current screen LAST so the device navigates to it at the end
			const otherScreens = project.screens.filter(s => s.id !== currentScreenId);
			const activeScreen = project.screens.find(s => s.id === currentScreenId);
			const screensToSync = [...otherScreens];
			if (activeScreen) screensToSync.push(activeScreen);

			for (const scr of screensToSync) {
				const flatItems = scr.pages.flatMap(p => p.items.map(it => ({ ...it, x: it.x + p.x, y: it.y + p.y })));
				const scrData = { 
					name: scr.name,
					items: flatItems, 
					bg: scr.bg || 0x0e0e12, 
					borderColor: scr.borderColor || 0x222222, 
					borderWidth: scr.borderWidth || 0,
					height: Math.max(...scr.pages.map(p => p.y + baseHeight), baseHeight),
					width: Math.max(...scr.pages.map(p => p.x + baseWidth), baseWidth)
				};
				
				if (useRemote) {
					console.log(`Syncing screen ${scr.id}...`);
					await fetch(`http://${targetIp}/api/grid/config?name=${scr.id}`, { 
						method: "POST", 
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(scrData),
						signal: controller.signal
					});
				} else {
					await API.saveGrid(scr.id, scrData);
				}
			}
			clearTimeout(timeoutId);
			if (useRemote) {
				setSyncStatus('success');
				setTimeout(() => setSyncStatus('idle'), 3000);
			}
		} catch (e) {
			console.error("Sync Error:", e);
			setSyncStatus('error');
			alert("❌ Sync failed!\n\n1. Check if device is reachable at http://" + targetIp + "\n2. Ensure device is on the same WiFi\n3. Details: " + (e as Error).message);
		} finally {
			setIsSyncing(false);
		}
	};


	return (
		<GridContext.Provider value={{ project, selectedEntity, setSelectedEntity, selections, setSelections, setShowEditor, addItem, removeItem, moveItemHierarchy, activeScreenId, setActiveScreenId, updateScreen, addScreen, removeScreen, moveScreen, updatePage, removePage, updateItem, addPage, addPanel, updatePanel, removePanel, scale, setScale, baseWidth, baseHeight, sidebarTab, setSidebarTab, propsLocation, setPropsLocation, theme, setTheme }}>
			<div style={{ display: "flex", flex: 1, height: "100%", width: "100%", position: "relative", flexDirection: "column" }}>
            <div style={{ height: "54px", background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", zIndex: 1100 }}>
                <div style={{ display: "flex", gap: "10px" }}><span style={{ fontSize: "11px", fontWeight: 900, color: "#94a3b8", letterSpacing: "1px" }}>BUILDER MODE: {activeScreen.name}</span></div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
					<div style={{ display: "flex", background: "#f1f5f9", borderRadius: "100px", padding: "2px 4px", alignItems: "center", border: "1px solid #e2e8f0" }}>
						<span style={{ fontSize: "10px", fontWeight: 900, color: "#64748b", padding: "0 10px" }}>DEV SYNC</span>
						<input 
							placeholder="Device IP" 
							style={{ border: "none", background: "white", borderRadius: "100px", height: "30px", fontSize: "11px", width: "120px", padding: "0 12px", outline: "none" }}
							value={remoteIp}
							onChange={e => setRemoteIp(e.target.value)}
						/>
					</div>
                    <button 
						disabled={isSyncing}
						onClick={syncToDevice} 
						style={{ 
							...s.primaryBtn, 
							padding: "10px 24px", 
							height: "38px",
							background: isSyncing ? "#94a3b8" : (syncStatus === 'success' ? "#10b981" : "#4f46e5"),
							display: "flex",
							alignItems: "center",
							gap: "8px"
						}}
					>
						{isSyncing ? "⏳ SYNCING..." : (syncStatus === 'success' ? "✓ SYNCED" : (syncStatus === 'error' ? "❌ RETRY" : "🚀 SYNC DEVICE"))}
					</button>
                    <button onClick={() => setShowKeyboard(!showKeyboard)} style={{ ...s.secondaryBtn, height: "38px", padding: "0 15px", background: showKeyboard ? "rgba(79, 70, 229, 0.1)" : "white" }}>⌨️</button>
                </div>
            </div>

            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {!isMobile && <Sidebar />}
                {!isMobile && propsLocation === 'left' && <PropertiesPanel />}
                <CanvasArea isMobile={isMobile} />
                {!isMobile && propsLocation === 'right' && <PropertiesPanel />}
            </div>

			{isMobile && showLib && (
				<div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 20000, display: "flex", alignItems: "flex-end", backdropFilter: "blur(12px)" }}>
					<div style={{ background: "white", width: "100%", borderRadius: "40px 40px 0 0", padding: "40px", maxHeight: "90vh", overflowY: "auto" }}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
							<span style={s.cardTitle}>COMPONENTS</span>
							<button onClick={() => setShowLib(false)} style={{ border: "none", background: "none", fontWeight: 900, fontSize: "32px" }}>✕</button>
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
							{["btn", "switch", "slider", "arc", "label", "clock", "bar", "roller", "border"].map(type => (
								<button key={type} onClick={() => { if(activeScreen.pages[0]) addItem(type as any, activeScreen.pages[0].id); setShowLib(false); }} style={{ ...s.secondaryBtn, height: "100px", flexDirection: "column", gap: "12px" }}>
									<div style={{ transform: "scale(2)" }}>{getWidgetPreview(type as ElementType, "#6366f1")}</div>
									<div style={{ fontSize: "12px", fontWeight: "800", marginTop: "10px" }}>{type.toUpperCase()}</div>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
		</GridContext.Provider>
	);
}

// --- LOGS TAB ---
function LogsTab({ isMobile }: { isMobile: boolean }) {
	const [logs, setLogs] = useState<string[]>([]);
	const scrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const es = new EventSource("/events");
		es.onmessage = (e) => setLogs(prev => [...prev, e.data].slice(-200));
		return () => es.close();
	}, []);
	useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);
	return (
		<div style={{ height: "100%", overflowY: "auto", background: "#0f172a", padding: "12px" }} ref={scrollRef}>
			<div style={{ color: "#6366f1", fontSize: "10px", marginBottom: "10px", fontWeight: "900" }}>-- ESP32 REAL-TIME STREAM --</div>
			{logs.map((l, i) => <div key={i} style={{ fontFamily: "monospace", fontSize: "10px", color: i % 2 === 0 ? "#fff" : "#94a3b8", padding: "1px 0" }}>{l}</div>)}
		</div>
	);
}

// --- WIFI TAB ---
function WifiTab({ status, onRefresh, onAPToggle }: { status: WifiStatus, onRefresh: () => void, onAPToggle: (active?: boolean) => void }) {
	return (
		<div style={{ background: "#f8fafc", minHeight: "100%" }}>
			<div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
				<WifiManager status={status} onRefresh={onRefresh} API={API} />
				
				{/* AP Section */}
				<div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px 40px" }}>
					<div className="wifi-card" style={{ padding: "32px" }}>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
							<h2 style={{ fontSize: "20px", fontWeight: 900, margin: 0 }}>Soft Access Point (AP)</h2>
							<div style={{ background: status?.ap_active ? "#dcfce7" : "#f1f5f9", color: status?.ap_active ? "#16a34a" : "#64748b", padding: "4px 12px", borderRadius: "100px", fontSize: "11px", fontWeight: 900 }}>
								{status?.ap_active ? "BROADCASTING" : "IDLE"}
							</div>
						</div>
						
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
							<div>
								<label style={{ fontSize: "12px", fontWeight: 800, color: "#94a3b8", display: "block", marginBottom: "8px" }}>SSID</label>
								<input style={{ ...s.input, padding: "0 16px" }} defaultValue={status?.ap_ssid} onBlur={async e => { await API.updateSettings({ ssid: e.target.value }); onRefresh(); }} />
							</div>
							<div>
								<label style={{ fontSize: "12px", fontWeight: 800, color: "#94a3b8", display: "block", marginBottom: "8px" }}>AP IP</label>
								<div style={{ height: "48px", display: "flex", alignItems: "center", fontWeight: 700, color: "#1e293b" }}>{status?.ap_ip || "192.168.4.1"}</div>
							</div>
						</div>

						<div style={{ display: "flex", gap: "10px" }}>
							<button onClick={() => onAPToggle(true)} style={{ ...s.primaryBtn, flex: 1, padding: "14px" }}>START AP</button>
							<button onClick={() => onAPToggle(false)} style={{ ...s.secondaryBtn, flex: 1, padding: "14px", color: "#f43f5e", borderColor: "#fecaca" }}>STOP AP</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// --- SETTINGS TAB ---
function SettingsTab({ status, onRefresh, onAPToggle }: { status: WifiStatus, onRefresh: () => void, onAPToggle: (active?: boolean) => void }) {
	const [mqtt, setMqtt] = useState(() => {
		try { return JSON.parse(localStorage.getItem("ds_mqtt_config") || "{}"); } catch { return {}; }
	});
	const [wifiCreds, setWifiCreds] = useState({ ssid: "", password: "" });
	const [apCreds, setApCreds] = useState({ ssid: status?.ap_ssid || "GridOS-AP", password: "", always_on: status?.ap_always_on || false });
	const [saved, setSaved] = useState<string | null>(null);

	const saveMqtt = async () => {
		localStorage.setItem("ds_mqtt_config", JSON.stringify(mqtt));
		try { await fetch("/api/mqtt/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mqtt) }); } catch {}
		setSaved("mqtt"); setTimeout(() => setSaved(null), 2000);
	};
	const saveWifi = async () => {
		try { await fetch("/api/wifi/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wifiCreds) }); } catch {}
		setSaved("wifi"); setTimeout(() => { setSaved(null); onRefresh(); }, 2000);
	};
	const saveAP = async () => {
		await API.updateSettings({ ssid: apCreds.ssid, password: apCreds.password, always_on: apCreds.always_on });
		setSaved("ap"); setTimeout(() => { setSaved(null); onRefresh(); }, 2000);
	};

	const col = { purple: "#6d28d9", green: "#16a34a", blue: "#1d4ed8", orange: "#c2410c" };

	const Card = ({ color, title, icon, children }: { color: string, title: string, icon: string, children: React.ReactNode }) => (
		<div style={{ background: "white", borderRadius: "16px", border: `2px solid #e2e8f0`, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
			<div style={{ background: `${color}12`, borderBottom: `2px solid ${color}30`, padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
				<span style={{ fontSize: "20px" }}>{icon}</span>
				<span style={{ fontSize: "13px", fontWeight: 900, color, letterSpacing: "1.5px", textTransform: "uppercase" }}>{title}</span>
			</div>
			<div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>{children}</div>
		</div>
	);

	const Field = ({ label, children }: { label: string, children: React.ReactNode }) => (
		<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
			<label style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1.5px", textTransform: "uppercase" }}>{label}</label>
			{children}
		</div>
	);

	const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} style={{ background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", fontWeight: 600, color: "#1e293b", outline: "none", width: "100%", ...props.style }} />
	);

	const SaveBtn = ({ color, onClick, label, isSaved }: { color: string, onClick: () => void, label: string, isSaved: boolean }) => (
		<button onClick={onClick} style={{ background: isSaved ? "#16a34a" : color, color: "white", border: "none", borderRadius: "10px", padding: "11px 24px", fontSize: "13px", fontWeight: 800, cursor: "pointer", alignSelf: "flex-end", minWidth: "120px", transition: "background 0.2s" }}>
			{isSaved ? "✓ SAVED" : label}
		</button>
	);

	return (
		<div style={{ background: "#f1f5f9", minHeight: "100%", padding: "24px" }}>
			<div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>

				<div style={{ fontSize: "11px", fontWeight: 900, color: "#94a3b8", letterSpacing: "2px", marginBottom: "4px" }}>DEVICE SETTINGS</div>

				{/* MQTT */}
				<Card color={col.purple} title="MQTT Broker" icon="📡">
					<div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
						<Field label="Broker Host">
							<Input placeholder="192.168.1.100 or mqtt.server.com" value={mqtt.host || ""} onChange={e => setMqtt((p: any) => ({ ...p, host: e.target.value }))} />
						</Field>
						<Field label="Port">
							<Input type="number" placeholder="1883" value={mqtt.port || ""} onChange={e => setMqtt((p: any) => ({ ...p, port: e.target.value }))} style={{ width: "90px" }} />
						</Field>
					</div>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
						<Field label="Username">
							<Input placeholder="(optional)" value={mqtt.username || ""} onChange={e => setMqtt((p: any) => ({ ...p, username: e.target.value }))} />
						</Field>
						<Field label="Password">
							<Input type="password" placeholder="(optional)" value={mqtt.password || ""} onChange={e => setMqtt((p: any) => ({ ...p, password: e.target.value }))} />
						</Field>
					</div>
					<Field label="Topic Prefix">
						<Input placeholder="gridos/device" value={mqtt.topicPrefix || ""} onChange={e => setMqtt((p: any) => ({ ...p, topicPrefix: e.target.value }))} />
					</Field>
					<div style={{ background: "#f5f3ff", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#6d28d9", fontWeight: 600 }}>
						Widgets with MQTT Topic set will publish/subscribe to: <strong>{mqtt.topicPrefix || "gridos/device"}/&lt;topic&gt;</strong>
					</div>
					<SaveBtn color={col.purple} onClick={saveMqtt} label="SAVE MQTT" isSaved={saved === "mqtt"} />
				</Card>

				{/* WiFi Station */}
				<Card color={col.blue} title="WiFi Station" icon="📶">
					<div style={{ display: "flex", gap: "24px", padding: "10px 14px", background: "#f0f9ff", borderRadius: "10px", fontSize: "13px" }}>
						<div>
							<div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1px" }}>STATUS</div>
							<div style={{ fontWeight: 900, color: status?.connected ? "#16a34a" : "#dc2626", marginTop: "2px" }}>{status?.connected ? "● CONNECTED" : "● OFFLINE"}</div>
						</div>
						<div>
							<div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1px" }}>SSID</div>
							<div style={{ fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>{status?.ssid || "—"}</div>
						</div>
						<div>
							<div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1px" }}>IP</div>
							<div style={{ fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>{status?.ip || "—"}</div>
						</div>
					</div>
					<Field label="New Network SSID">
						<Input placeholder="Enter WiFi network name" value={wifiCreds.ssid} onChange={e => setWifiCreds(p => ({ ...p, ssid: e.target.value }))} />
					</Field>
					<Field label="Password">
						<Input type="password" placeholder="WiFi password" value={wifiCreds.password} onChange={e => setWifiCreds(p => ({ ...p, password: e.target.value }))} />
					</Field>
					<SaveBtn color={col.blue} onClick={saveWifi} label="CONNECT" isSaved={saved === "wifi"} />
				</Card>

				{/* AP WiFi */}
				<Card color={col.orange} title="Access Point (AP)" icon="📡">
					<div style={{ display: "flex", gap: "24px", padding: "10px 14px", background: "#fff7ed", borderRadius: "10px", fontSize: "13px" }}>
						<div>
							<div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1px" }}>AP STATUS</div>
							<div style={{ fontWeight: 900, color: status?.ap_active ? "#d97706" : "#94a3b8", marginTop: "2px" }}>{status?.ap_active ? "● BROADCASTING" : "● DISABLED"}</div>
						</div>
						<div>
							<div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1px" }}>AP IP</div>
							<div style={{ fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>{status?.ap_ip || "192.168.4.1"}</div>
						</div>
						<div>
							<div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", letterSpacing: "1px" }}>CLIENTS</div>
							<div style={{ fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>{status?.ap_clients?.length ?? 0}</div>
						</div>
					</div>
					<Field label="AP Network Name (SSID)">
						<Input placeholder="GridOS-AP" value={apCreds.ssid} onChange={e => setApCreds(p => ({ ...p, ssid: e.target.value }))} />
					</Field>
					<Field label="AP Password (leave blank for open)">
						<Input type="password" placeholder="(open network)" value={apCreds.password} onChange={e => setApCreds(p => ({ ...p, password: e.target.value }))} />
					</Field>
					<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "#fff7ed", borderRadius: "10px", cursor: "pointer" }} onClick={() => setApCreds(p => ({ ...p, always_on: !p.always_on }))}>
						<div style={{ width: "44px", height: "24px", borderRadius: "12px", background: apCreds.always_on ? "#f97316" : "#e2e8f0", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
							<div style={{ position: "absolute", top: "2px", left: apCreds.always_on ? "22px" : "2px", width: "20px", height: "20px", borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
						</div>
						<div>
							<div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Always On</div>
							<div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>AP stays active even when connected to station WiFi</div>
						</div>
					</div>
					<div style={{ display: "flex", gap: "10px" }}>
						<button onClick={() => onAPToggle(true)} style={{ flex: 1, background: "#f97316", color: "white", border: "none", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 800, cursor: "pointer" }}>▶ START AP</button>
						<button onClick={() => onAPToggle(false)} style={{ flex: 1, background: "white", color: "#dc2626", border: "2px solid #fecaca", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 800, cursor: "pointer" }}>■ STOP AP</button>
						<SaveBtn color={col.orange} onClick={saveAP} label="SAVE AP" isSaved={saved === "ap"} />
					</div>
				</Card>

				<button onClick={onRefresh} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "12px", fontSize: "13px", fontWeight: 700, color: "#64748b", cursor: "pointer" }}>↻ REFRESH STATUS</button>
			</div>
		</div>
	);
}

// --- MIRROR TAB ---
function MirrorTab() {
	const [project, setProject] = useState<Project | null>(null);
	const [screenId, setScreenId] = useState(() => localStorage.getItem("ds_active_screen") || "main");
	const [width] = useWindowSize();

	useEffect(() => {
		const saved = localStorage.getItem("ds_project_v3");
		if (saved) setProject(JSON.parse(saved));
		
		const lastActive = localStorage.getItem("ds_active_screen");
		if (lastActive) setScreenId(lastActive);
	}, []);

	if (!project) return <div style={{ color: "white", padding: "40px" }}>No project data found. Open the Builder first.</div>;

	const frameWidth = 800;
	const headerHeight = 64;
	const scale = Math.min(1, (width - 40) / frameWidth);

	return (
		<div style={{ display: "flex", flex: 1, height: "100%", flexDirection: "column", background: "#1e293b" }}>
			{/* Mirror Toolbar */}
			<div style={{ padding: "15px 25px", background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "20px" }}>
				<span style={{ fontSize: "11px", fontWeight: 900, color: "#94a3b8", letterSpacing: "1px" }}>MIRROR SCREEN SELECT</span>
				<div style={{ display: "flex", gap: "8px" }}>
					{project.screens.map(s => (
						<button 
							key={s.id} 
							onClick={() => setScreenId(s.id)}
							style={{ 
								padding: "6px 15px", 
								borderRadius: "100px", 
								border: "none", 
								fontSize: "11px", 
								fontWeight: 800, 
								cursor: "pointer",
								background: screenId === s.id ? "#4f46e5" : "rgba(255,255,255,0.1)",
								color: "white"
							}}
						>
							{s.name}
						</button>
					))}
				</div>
			</div>

			<div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", position: "relative" }}>
				<div style={{ transform: `scale(${scale})`, transformOrigin: "center center", width: `${frameWidth}px`, height: "480px", background: "#0e0e12", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", borderRadius: "12px", overflow: "hidden", border: "12px solid #1a1a1a" }}>
					<div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${headerHeight/2}px`, background: "rgba(10, 10, 15, 0.9)", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 15px", color: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: 900 }}>
						<span>GRIDOS V2.4</span>
						<div style={{ display: "flex", gap: "10px" }}><span>12:45</span><span>WiFi</span><span>⚡</span></div>
					</div>
					<div style={{ position: "absolute", left: 0, top: headerHeight/2, right: 0, bottom: 0, overflow: "hidden" }}>
						<GridRenderer project={project} activeScreenId={screenId} />
					</div>
				</div>
			</div>
		</div>
	);
}

function GridRenderer({ project, activeScreenId }: { project: Project | null, activeScreenId: string }) {
	if (!project) return null;
	const activeScreen = project.screens.find(s => s.id === activeScreenId) || project.screens[0];

	return (
		<div style={{ width: "100%", height: "100%", position: "relative", background: `#${safeHex(activeScreen.bg)}`, boxSizing: "border-box" }}>
			{activeScreen.pages.map(pg => (
				<div key={pg.id} style={{ position: "absolute", left: pg.x, top: pg.y, width: "100%", height: "100%" }}>
					{pg.items.map(it => (
						<div key={it.id} style={{ position: "absolute", left: it.x, top: it.y, width: it.width, height: it.height, zIndex: 10 }}>
							<WidgetRenderer it={it} panels={project.panels} pageId={pg.id} />
						</div>
					))}
				</div>
			))}
		</div>
	);
}

// --- SUB COMPONENTS ---
function WifiStatusBadge({ status, onClick, isMobile }: { status: WifiStatus, onClick: () => void, isMobile?: boolean }) { 
	return (
		<div onClick={onClick} style={{ fontSize: "11px", fontWeight: 900, color: status?.connected ? "#10b981" : "#f43f5e", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px", borderRadius: "100px", background: "white", border: "1px solid #e2e8f0", boxShadow: "0 4px 15px rgba(0,0,0,0.06)" }}>
			<span style={{ fontSize: "16px" }}>●</span>
			{!isMobile && <span>{status?.connected ? (status.ip || "CONNECTED") : "OFFLINE"}</span>}
		</div>
	); 
}

function VirtualKeyboard({ onClose }: { onClose: () => void }) {
    const keys = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", "BKSP"],
        ["?123", "SPACE", "ENTER"]
    ];
    return (
        <div style={{ background: "rgba(20, 20, 25, 0.95)", backdropFilter: "blur(20px)", padding: "15px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 -20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", fontWeight: 900, cursor: "pointer", fontSize: "12px" }}>DONE</button></div>
            {keys.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                    {row.map(key => (
                        <div key={key} style={{ flex: key === "SPACE" ? 4 : (key === "SHIFT" || key === "BKSP" || key === "ENTER" || key === "?123" ? 1.5 : 1), height: "45px", background: "rgba(255,255,255,0.15)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", transition: "0.2s" }}>{key}</div>
                    ))}
                </div>
            ))}
        </div>
    );
}

interface ErrorBoundaryProps { children: ReactNode; } interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> { constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; } static getDerivedStateFromError(error: Error) { return { hasError: true, error }; } render() { return this.state.hasError ? <div style={{ padding: "40px", background: "#fef2f2" }}><h1>SYSTEM FAULT</h1><pre>{this.state.error?.toString()}</pre><button onClick={() => window.location.reload()}>REBOOT INTERFACE</button></div> : this.props.children; } }


