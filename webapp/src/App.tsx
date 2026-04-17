import React from "react";
import {
	Component,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
	useLayoutEffect,
} from "react";

// --- TYPES ---
type WifiStatus = {
	connected: boolean;
	ip: string;
	ssid: string;
	ap_active?: boolean;
	ap_always_on?: boolean;
	ss_enabled?: boolean;
	ap_ssid?: string;
	ap_ip?: string;
	ap_clients?: { mac: string, ip: string }[];
} | null;

type ElementType = "btn" | "switch" | "slider" | "label" | "clock" | "panel-ref" | "arc" | "checkbox" | "dropdown" | "roller" | "bar" | "border" | "nav-menu";

type GridItem = {
	id: string;
	name: string;
	type: ElementType;
	x: number;
	y: number;
	w: number;
	h: number;
	panelId?: string;     
	textColor?: number;   
	action?: string;      
	color?: number;       
	value?: number;
	min?: number;
	max?: number;
	options?: string;
	borderWidth?: number;
	radius?: number;
	orientation?: "v" | "h";
};

type Panel = {
	id: string;
	name: string;
	w: number;
	h: number;
	elements: GridItem[];
};

// --- UTILS ---
const safeHex = (num: any, fallback = "000000") => {
	if (num === null || num === undefined || isNaN(num)) return fallback;
	return num.toString(16).padStart(6, "0");
};

// --- API ---
const isDev = (import.meta as any).env.DEV;

const MOCK_API = {
	async getWifi(): Promise<WifiStatus> {
		const s = localStorage.getItem("ds_mock_wifi");
		return s ? JSON.parse(s) : { connected: true, ip: "192.168.1.100", ssid: "MOCK_WIFI", ap_active: false, ap_always_on: false, ap_ssid: "GRIDOS_MOCK_AP" };
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
	}
};

const API = isDev ? MOCK_API : REAL_API;

const getWidgetPreview = (type: ElementType, color: string) => {
	const s = { width: 12, height: 12, borderRadius: 2, display: "flex" as const, alignItems: "center", justifyContent: "center" };
	switch(type) {
		case "btn": return <div style={{ ...s, border: `2px solid ${color}` }} />;
		case "switch": return <div style={{ width: 14, height: 8, borderRadius: 10, background: "#e2e8f0", position: "relative" }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: color, position: "absolute", right: 2, top: 2 }} /></div>;
		case "slider": return <div style={{ width: 14, height: 2, background: color, position: "relative" }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: color, position: "absolute", left: '50%', top: -1 }} /></div>;
		case "label": return <div style={{ fontSize: 8, fontWeight: 900, color }}>Ab</div>;
		case "clock": return <div style={{ fontSize: 8, fontWeight: 900, color }}>12:0</div>;
		case "arc": return <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${color}`, borderTopColor: "transparent" }} />;
		case "bar": return <div style={{ width: 12, height: 4, background: "#e2e8f0", overflow: "hidden" }}><div style={{ width: '60%', height: '100%', background: color }} /></div>;
		case "roller": return <div style={{ width: 12, height: 12, border: `1px solid ${color}`, borderRadius: 2, background: "linear-gradient(transparent, rgba(0,0,0,0.1), transparent)" }} />;
		case "border": return <div style={{ width: 14, height: 14, border: `1px solid ${color}`, borderRadius: 2 }} />;
		case "nav-menu": return <div style={{ width: 14, height: 14, display: "flex", flexDirection: "column", gap: 2 }}>{[1,2,3].map(i=><div key={i} style={{ width: "100%", height: 2, background: color }} />)}</div>;
		default: return <div style={s}>?</div>;
	}
};

const renderWidget = (it: GridItem, panels: Panel[]) => {
	const color = `#${safeHex(it.color)}`;
	const txt = `#${safeHex(it.textColor)}`;
	const baseStyle: React.CSSProperties = { 
		borderRadius: it.radius || 8, display: "flex", alignItems: "center", justifyContent: "center", 
		color: txt, fontWeight: 900, fontSize: "10px", width: "100%", height: "100%", 
		position: "relative", overflow: "hidden",
		border: it.borderWidth ? `${it.borderWidth}px solid ${txt}` : "none",
		background: (it.type === "panel-ref" || it.type === "border") ? "none" : (it.type === "label" || it.type === "clock" ? "none" : color)
	};

	if (it.type === "panel-ref") {
		const pt = panels.find(pd => pd.id === it.panelId);
		return <div style={{ width: "100%", height: "100%", position: "relative", border: "1px dashed rgba(99, 102, 241, 0.4)", borderRadius: 8, overflow: "hidden" }}>{pt?.elements.map(el => <div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h }}>{renderWidget(el, panels)}</div>)}</div>;
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
		const items = it.options?.split("\n").filter(x=>x).map(x=>{
			const [name, action] = x.split("|");
			return { name: name || "ITEM", action };
		}) || [];
		
		// If no items, show placeholder slots
		const displayItems = items.length > 0 ? items : [{name:"SLOT 1", action:""}, {name:"SLOT 2", action:""}];

		return (
			<div style={{ ...baseStyle, flexDirection: it.orientation === "h" ? "row" : "column", padding: "8px", gap: "8px", justifyContent: "flex-start", alignItems: "stretch" }}>
				{displayItems.map((m, i) => (
					<div key={i} style={{ 
						padding: "8px 12px", 
						background: i === 0 && items.length > 0 ? color : "rgba(255,255,255,0.02)", 
						borderRadius: "6px", 
						fontSize: "10px", 
						color: i === 0 && items.length > 0 ? "white" : "#94a3b8", 
						width: it.orientation === "h" ? "auto" : "100%", 
						textAlign: "center", 
						border: "1px dashed rgba(255,255,255,0.15)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flex: it.orientation === "h" ? 1 : "none"
					}}>
						{m.name.toUpperCase()}
					</div>
				))}
			</div>
		);
	}

	if (it.type === "label") return (
		<div style={{ ...baseStyle, justifyContent: "flex-start", fontSize: "16px", padding: "0 10px" }}>{it.name}</div>
	);

	return <div style={baseStyle}>{it.name.toUpperCase()}</div>;
};

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

// --- CORE APP ---
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
	const [activeTab, setActiveTab] = useState<"grid" | "mirror" | "wifi" | "logs">("grid");
	const [status, setStatus] = useState<WifiStatus>({ connected: true, ip: "127.0.0.1", ssid: "STATION", ap_active: false, ap_always_on: false });
	const [width] = useWindowSize();

	const refreshWifi = useCallback(async () => {
		const sw = await API.getWifi();
		if (sw) setStatus(sw);
	}, []);

	useEffect(() => {
		refreshWifi();
		const t = setInterval(refreshWifi, 5000);
		return () => clearInterval(t);
	}, [refreshWifi]);

	const handleAPToggle = async (active?: boolean) => {
		const newState = active ?? !status?.ap_active;
		const success = await API.updateSettings({ active: newState, always_on: status?.ap_always_on || false });
		if (success) refreshWifi();
	};
	
	const headerHeight = isMobile ? 56 : 64;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", overflow: "hidden" }}>
			<header style={{ height: headerHeight, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "white", borderBottom: "1px solid #e2e8f0", zIndex: 1000 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<span style={{ fontSize: isMobile ? "14px" : "18px", fontWeight: 900, color: "#4f46e5", letterSpacing: "-0.5px" }}>GRIDOS DESIGNER</span>
				</div>
				{!isMobile && (
					<nav style={{ display: "flex", gap: "25px" }}>
						{[{ id: "grid", label: "BUILDER" }, { id: "mirror", label: "MIRROR" }, { id: "wifi", label: "WIFI" }, { id: "logs", label: "CONSOLE" }].map(tab => (
							<button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ background: "none", border: "none", fontWeight: 900, fontSize: "11px", cursor: "pointer", color: activeTab === tab.id ? "#4f46e5" : "#64748b", borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent", height: headerHeight }}>{tab.label}</button>
						))}
					</nav>
				)}
				<WifiStatusBadge status={status} onClick={() => setActiveTab("wifi")} isMobile={isMobile} />
			</header>

			<main style={{ flex: 1, overflow: isMobile ? "hidden" : "auto", position: "relative" }}>
				{activeTab === "grid" ? <GridTab isMobile={isMobile} width={width} wifiStatus={status} onWifiUpdate={refreshWifi} onSettingsUpdate={handleAPToggle} /> : 
				 activeTab === "mirror" ? <MirrorTab /> :
				 activeTab === "logs" ? <LogsTab isMobile={isMobile} /> :
				 activeTab === "wifi" ? <WifiTab status={status} onRefresh={refreshWifi} onAPToggle={handleAPToggle} /> :
				 null}
			</main>

			{isMobile && (
				<nav style={{ height: "70px", background: "white", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 10000 }}>
					{[{ id: "grid", label: "Builder", icon: "🛠️" }, { id: "mirror", label: "Mirror", icon: "📱" }, { id: "wifi", label: "WiFi", icon: "🌐" }, { id: "logs", label: "Logs", icon: "🖥️" }].map(tab => (
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

function GridTab({ isMobile, width, wifiStatus, onWifiUpdate, onSettingsUpdate }: { isMobile: boolean, width: number, wifiStatus: WifiStatus, onWifiUpdate: () => void, onSettingsUpdate: (active?: boolean) => void }) {
	const [items, setItems] = useState<GridItem[]>([]);
	const [panels, setPanels] = useState<Panel[]>([]);
	const [activeScreen, setActiveScreen] = useState("main");
	const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [gridBg, setGridBg] = useState(0x0e0e12);
	const [gridBorderColor, setGridBorderColor] = useState(0x222222);
	const [gridBorderWidth, setGridBorderWidth] = useState(0);
	const [screens, setScreens] = useState<string[]>(["main"]);
	const [showLib, setShowLib] = useState(false);
	const [showEditor, setShowEditor] = useState(false);
	const [canvasHeight, setCanvasHeight] = useState(1248); // 3 pages of 416
	const [canvasWidth, setCanvasWidth] = useState(640);
	const [baseWidth, setBaseWidth] = useState(640);
	const [baseHeight, setBaseHeight] = useState(416);
	const [showKeyboard, setShowKeyboard] = useState(false);
	const [hasDeviceSidebar, setHasDeviceSidebar] = useState(true);

	const sidebarWidth = 160;
	const headerHeight = 64;
	const frameWidth = 800;
	const frameHeight = 480;
	
	const panelsTotalWidth = isMobile ? 0 : 560; // 260 lib + 300 editor
	const scale = isMobile ? Math.min(1, (width - 40) / frameWidth) : Math.min(1, (width - panelsTotalWidth - 100) / frameWidth);
	const canvasContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const sL = localStorage.getItem("ds_scr_list"); if (sL) setScreens(JSON.parse(sL));
		const pL = localStorage.getItem("ds_panels"); if (pL) setPanels(JSON.parse(pL));
		loadScreen("main");
	}, []);

	useEffect(() => { localStorage.setItem("ds_scr_list", JSON.stringify(screens)); }, [screens]);
	useEffect(() => { localStorage.setItem("ds_panels", JSON.stringify(panels)); }, [panels]);

	useEffect(() => {
		if (activeScreen && !editingPanelId) {
			localStorage.setItem(`scr_${activeScreen}`, JSON.stringify({ items, bg: gridBg, borderColor: gridBorderColor, borderWidth: gridBorderWidth, height: canvasHeight, width: canvasWidth }));
			localStorage.setItem("ds_active_scr", activeScreen);
		}
	}, [items, gridBg, gridBorderColor, gridBorderWidth, activeScreen, editingPanelId, canvasHeight, canvasWidth]);

	const loadScreen = (name: string) => {
		setSelectedIds([]); setEditingPanelId(null);
		const saved = localStorage.getItem(`scr_${name}`);
		const d = saved ? JSON.parse(saved) : { items: [], bg: 0x0e0e12, borderColor: 0x222222, borderWidth: 0, height: 1248, width: 640 };
		setItems(d.items || []); setGridBg(d.bg ?? 0x0e0e12); setGridBorderColor(d.borderColor ?? 0x222222); setGridBorderWidth(d.borderWidth ?? 0); setCanvasHeight(d.height ?? 1248); setCanvasWidth(d.width ?? 640);
		setActiveScreen(name);
	};

	const addItem = (type: ElementType, x: number, y: number, panelId?: string) => {
		const newId = `${type}_${Math.random().toString(36).substr(2, 5)}`;
		const w = type === "panel-ref" ? 200 : (type === "slider" ? 180 : (type === "switch" ? 60 : (type === "arc" ? 80 : 120)));
		const h = type === "panel-ref" ? 150 : (type === "slider" ? 24 : (type === "switch" ? 32 : (type === "arc" ? 80 : 40)));
		let spawnY = y;
		let spawnX = 20;
		if (canvasContainerRef.current) spawnY = Math.round((canvasContainerRef.current.scrollTop / scale) + y);
		const newItem: GridItem = { id: newId, name: `New ${type}`, type, x: spawnX, y: Math.max(0, spawnY), w, h, textColor: 0xffffff, color: 0x4f46e5, panelId, value: 50, min: 0, max: 100, options: "Item 1\nItem 2\nItem 3", borderWidth: 0, radius: 0, orientation: "v" };
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: [...p.elements, newItem] } : p));
		else setItems(prev => [...prev, newItem]);
		setSelectedIds([newId]); setShowLib(false); setShowEditor(true);
	};

	const updateItem = (id: string, patch: Partial<GridItem>) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.map(el => el.id === id ? { ...el, ...patch } : el) } : p));
		else setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
	};

	const removeItem = (id: string) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.filter(it => it.id !== id) } : p));
		else setItems(prev => prev.filter(it => it.id !== id));
		setSelectedIds(prev => prev.filter(i => i !== id));
	};

	const moveItem = (id: string, direction: 1 | -1) => {
		const list = editingPanelId ? panels.find(p => p.id === editingPanelId)?.elements : items;
		if (!list) return;
		const idx = list.findIndex(it => it.id === id);
		if (idx === -1) return;
		const newIdx = idx + direction;
		if (newIdx < 0 || newIdx >= list.length) return;

		const newList = [...list];
		[newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]];

		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: newList } : p));
		else setItems(newList);
	};

	const syncToDevice = async () => {
		await API.savePanels(panels);
		await API.saveGrid(activeScreen, { items, bg: gridBg, borderColor: gridBorderColor, borderWidth: gridBorderWidth, height: canvasHeight, width: canvasWidth });
	};

	const removePage = (pageIdx: number) => {
		if (canvasHeight <= baseHeight) return;
		const startY = pageIdx * baseHeight;
		const endY = (pageIdx + 1) * baseHeight;
		setItems(prev => prev.filter(it => it.y < startY || it.y >= endY).map(it => it.y >= endY ? { ...it, y: it.y - baseHeight } : it));
		setCanvasHeight(h => Math.max(baseHeight, h - baseHeight));
	};

	const removeHorizontalPage = (colIdx: number) => {
		if (canvasWidth <= baseWidth) return;
		setCanvasWidth(w => Math.max(baseWidth, w - baseWidth));
	};

	const getActiveList = () => editingPanelId ? (panels.find(p => p.id === editingPanelId)?.elements || []) : items;
	const selectedItem = selectedIds.length === 1 ? getActiveList().find(it => it.id === selectedIds[0]) : null;

	const [dragInfo, setDragInfo] = useState<{ id: string; startX: number; startY: number; initialX: number; initialY: number; initialW: number; initialH: number; mode: "move" | "resize" } | null>(null);
	useEffect(() => {
		const onMove = (e: MouseEvent | TouchEvent) => {
			const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
			const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
			if (dragInfo) {
				const dx = clientX - dragInfo.startX; const dy = clientY - dragInfo.startY;
				if (dragInfo.mode === "move") updateItem(dragInfo.id, { x: Math.max(0, Math.round(dragInfo.initialX + dx/scale)), y: Math.max(0, Math.round(dragInfo.initialY + dy/scale)) });
				else updateItem(dragInfo.id, { w: Math.max(10, Math.round(dragInfo.initialW + dx/scale)), h: Math.max(10, Math.round(dragInfo.initialH + dy/scale)) });
			}
		};
		const onUp = () => setDragInfo(null);
		window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
		window.addEventListener("touchmove", onMove); window.addEventListener("touchend", onUp);
		return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
	}, [dragInfo, scale]);

	const HierarchyItem = ({ it, depth = 0 }: { it: GridItem, depth?: number }) => {
		const [isOpen, setIsOpen] = useState(true);
		const isPanel = it.type === "panel-ref";
		const panel = isPanel ? panels.find(p => p.id === it.panelId) : null;
		const children = panel?.elements || [];
		const isSelected = selectedIds.includes(it.id);

		return (
			<div style={{ marginLeft: depth > 0 ? "12px" : "0" }}>
				<div 
					onClick={(e) => { e.stopPropagation(); setSelectedIds([it.id]); setShowEditor(true); }} 
					style={{ 
						padding: "6px 12px", 
						background: isSelected ? "rgba(99, 102, 241, 0.1)" : "transparent", 
						cursor: "pointer", 
						borderRadius: "8px", 
						fontSize: "11px", 
						marginBottom: "1px", 
						fontWeight: "700", 
						color: isSelected ? "#4f46e5" : "#475569",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						transition: "all 0.15s ease"
					}}>
					<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
						<div style={{ display: "flex", flexDirection: "column", gap: "2px", marginRight: "4px" }}>
							<button onClick={(e) => { e.stopPropagation(); moveItem(it.id, 1); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "8px", padding: "2px" }}>▲</button>
							<button onClick={(e) => { e.stopPropagation(); moveItem(it.id, -1); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "8px", padding: "2px" }}>▼</button>
						</div>
						{isPanel && (
							<button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", cursor: "pointer", color: "#94a3b8" }}>
								<span style={{ fontSize: "10px", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
							</button>
						)}
						<span style={{ fontSize: "14px", opacity: 0.8 }}>{isPanel ? (isOpen ? "📂" : "📁") : "📄"}</span>
						<span>{it.name.toUpperCase()}</span>
					</div>
					<button 
						onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
						style={{ background: "none", border: "none", color: "#f43f5e", opacity: isSelected ? 1 : 0, cursor: "pointer", fontSize: "12px", fontWeight: "900", padding: "4px" }}
						className="delete-hover-show"
					>✕</button>
				</div>
				{isPanel && isOpen && children.map(child => (
					<HierarchyItem key={child.id} it={child} depth={depth + 1} />
				))}
			</div>
		);
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
				if (selectedIds.length > 0) {
					selectedIds.forEach(id => removeItem(id));
					setSelectedIds([]);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedIds]);

	return (
		<div style={{ display: "flex", flex: 1, height: "100%", width: "100%", position: "relative", flexDirection: "column" }}>
            <div style={{ height: "54px", background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", zIndex: 1100 }}>
                <div style={{ display: "flex", gap: "10px" }}><span style={{ fontSize: "11px", fontWeight: 900, color: "#94a3b8", letterSpacing: "1px" }}>EDITION MODE: CONTINUOUS CANVAS</span></div>
                <div style={{ display: "flex", gap: "12px" }}>
                    <button onClick={syncToDevice} style={{ ...s.primaryBtn, padding: "10px 24px", height: "38px" }}>🚀 SYNC DEVICE</button>
                    {!isMobile && <button style={{ ...s.secondaryBtn, height: "38px", padding: "0 20px" }}>EXPORT JSON</button>}
                </div>
            </div>

            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {!isMobile && (
                    <div style={{ width: "260px", background: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
                        <div style={{ padding: "20px", borderBottom: "1px solid #f1f5f9" }}><span style={s.cardTitle}>WIDGET LIBRARY</span></div>
                            <div style={{ padding: "15px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                                {["btn", "switch", "slider", "arc", "label", "clock", "bar", "roller", "border", "nav-menu"].map(type => (
                                    <button key={type} onClick={() => addItem(type as any, 50, 50)} style={{ ...s.secondaryBtn, height: "44px", flexDirection: "column", gap: "4px", padding: "8px" }}>
                                        <div style={{ transform: "scale(1.2)" }}>{getWidgetPreview(type as ElementType, "#6366f1")}</div>
                                        <div style={{ fontSize: "8px", fontWeight: 900 }}>{type.toUpperCase()}</div>
                                    </button>
                                ))}
                            </div>
                            <div style={{ padding: "15px", borderBottom: "1px solid #f1f5f9" }}>
                                <button onClick={() => setShowKeyboard(!showKeyboard)} style={{ ...s.secondaryBtn, width: "100%", height: "44px", background: showKeyboard ? "rgba(99, 102, 241, 0.1)" : "white", borderColor: showKeyboard ? "#6366f1" : "#e2e8f0", color: showKeyboard ? "#6366f1" : "#475569" }}>⌨️ {showKeyboard ? "HIDE" : "SHOW"} KEYBOARD</button>
                            </div>
                            <div style={{ padding: "10px 20px 20px", borderTop: "1px solid #f1f5f9", flex: 1, overflowY: "auto" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "15px" }}>
                                    <span style={s.cardTitle}>LAYER HIERARCHY</span>
                                    <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900 }}>{getActiveList().length} NODES</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    {(() => {
                                        const rowsCount = Math.ceil(canvasHeight / baseHeight);
                                        const colsCount = Math.ceil(canvasWidth / baseWidth);
                                        const activeItems = getActiveList();
                                        const groupedIdSet = new Set();
                                        const pageGroups = [];

                                        for (let r = 0; r < rowsCount; r++) {
                                            for (let c = 0; c < colsCount; c++) {
                                                const pageItems = activeItems.filter(it => 
                                                    it.x >= c * baseWidth && it.x < (c + 1) * baseWidth && 
                                                    it.y >= r * baseHeight && it.y < (r + 1) * baseHeight
                                                );
                                                pageItems.forEach(it => groupedIdSet.add(it.id));
                                                pageGroups.push({ id: `PAGE R${r+1} C${c+1}`, items: pageItems });
                                            }
                                        }

                                        const orphans = activeItems.filter(it => !groupedIdSet.has(it.id));
                                        if (orphans.length > 0) pageGroups.push({ id: "OUTSIDE CANVAS", items: orphans });

                                        return pageGroups.map((group) => (
                                            <div key={group.id} style={{ marginBottom: "20px" }}>
                                                <div style={{ fontSize: "10px", fontWeight: "900", color: group.id === "OUTSIDE CANVAS" ? "#f43f5e" : "#cbd5e1", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid #f8fafc", paddingBottom: "4px" }}>
                                                    <div style={{ width: "4px", height: "4px", background: group.id === "OUTSIDE CANVAS" ? "#f43f5e" : "#cbd5e1", borderRadius: "50%" }}></div>
                                                    {group.id.toUpperCase()}
                                                </div>
                                                <div style={{ paddingLeft: "4px" }}>
                                                    {group.items.length === 0 ? (
                                                        <div style={{ padding: "8px 12px", fontSize: "10px", color: "#cbd5e1", fontStyle: "italic" }}>EMPTY PAGE</div>
                                                    ) : (
                                                        group.items.map(it => <HierarchyItem key={it.id} it={it} />)
                                                    )}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                    </div>
                )}

                <div ref={canvasContainerRef} style={{ flex: 1, background: "#f1f5f9", position: "relative", overflow: "auto", display: "flex", flexDirection: "row", alignItems: "flex-start", padding: isMobile ? "20px" : "60px", scrollBehavior: "smooth" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
						{/* Device Frame */}
						<div style={{ width: `${frameWidth}px`, height: `${frameHeight}px`, background: "#000", position: "absolute", transform: `scale(${scale})`, transformOrigin: "top left", zIndex: 0, pointerEvents: "none", boxShadow: "0 40px 100px rgba(0,0,0,0.2)", borderRadius: "12px", border: "8px solid #1a1a1a" }} />
						
						{/* Actual Canvas */}
						<div style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, background: `#${safeHex(gridBg)}`, border: `${gridBorderWidth}px solid #${safeHex(gridBorderColor)}`, boxSizing: "border-box", position: "relative", transform: `scale(${scale})`, transformOrigin: "top left", marginLeft: `${(hasDeviceSidebar ? sidebarWidth : 0) * scale}px`, marginTop: `${headerHeight * scale}px`, zIndex: 10 }}>
							<div style={{ position: "absolute", top: -headerHeight, left: -(hasDeviceSidebar ? sidebarWidth : 0), right: -(frameWidth - (hasDeviceSidebar ? sidebarWidth : 0) - canvasWidth), height: `${headerHeight}px`, background: "rgba(10, 10, 15, 0.9)", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 15px", color: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: 900, pointerEvents: "none" }}>
								<span>GRIDOS V2.4</span>
								<div style={{ display: "flex", gap: "10px" }}><span>12:45</span><span>WiFi</span><span>⚡</span></div>
							</div>
							{hasDeviceSidebar && (
								<div style={{ position: "absolute", left: -sidebarWidth, top: 0, bottom: 0, width: `${sidebarWidth}px`, background: "rgba(20, 20, 30, 0.95)", borderRight: "2px solid #2d2d3f", zIndex: 20, display: "flex", flexDirection: "column", padding: "20px 0", height: `${frameHeight - headerHeight}px`, pointerEvents: "none" }}>
									<div style={{ width: "100%", height: "20px", background: "rgba(99, 102, 241, 0.2)", marginBottom: "30px" }} />
									{[1,2,3,4].map(i => <div key={i} style={{ width: "80%", height: "30px", background: "rgba(255,255,255,0.03)", margin: "0 auto 10px", borderRadius: "4px" }} />)}
									<div style={{ marginTop: "auto", textAlign: "center", fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: 900 }}>SIDE MENU</div>
								</div>
							)}
							{Array.from({ length: Math.ceil(canvasHeight / baseHeight) }).map((_, i) => (
								<div key={`v-${i}`} style={{ position: "absolute", top: i * baseHeight, left: 0, right: 0, height: baseHeight, borderBottom: i < Math.ceil(canvasHeight / baseHeight) - 1 ? "2px dashed rgba(255,255,255,0.15)" : "none", pointerEvents: "none", zIndex: 5 }}>
									<div style={{ position: "absolute", bottom: 12, right: 20, display: "flex", alignItems: "center", gap: "15px", pointerEvents: "auto", zIndex: 10 }}>
										<span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", fontWeight: 900, letterSpacing: "2px" }}>ROW {i+1}</span>
										{canvasHeight > baseHeight && <button onClick={(e) => { e.stopPropagation(); removePage(i); }} style={s.miniDelBtn}>✕</button>}
									</div>
								</div>
							))}
							{Array.from({ length: Math.ceil(canvasWidth / baseWidth) }).map((_, i) => (
								<div key={`h-${i}`} style={{ position: "absolute", left: i * baseWidth, top: 0, bottom: 0, width: baseWidth, borderRight: i < Math.ceil(canvasWidth / baseWidth) - 1 ? "2px dashed rgba(255,255,255,0.15)" : "none", pointerEvents: "none", zIndex: 5 }}>
									<div style={{ position: "absolute", top: 12, right: 20, display: "flex", alignItems: "center", gap: "15px", pointerEvents: "auto", zIndex: 10 }}>
										<span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", fontWeight: 900, letterSpacing: "2px" }}>COLUMN {i+1}</span>
										{canvasWidth > baseWidth && <button onClick={(e) => { e.stopPropagation(); removeHorizontalPage(i); }} style={s.miniDelBtn}>✕</button>}
									</div>
								</div>
							))}
							{showKeyboard && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000 }}><VirtualKeyboard onClose={() => setShowKeyboard(false)} /></div>}
							{getActiveList().map(it => (
								<div key={it.id} onMouseDown={(e) => { e.stopPropagation(); setSelectedIds([it.id]); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "move" }); }} style={{ position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h, outline: selectedIds.includes(it.id) ? "3px solid #6366f1" : "none", outlineOffset: 3, zIndex: 10 }}>
									{renderWidget(it, panels)}
									{selectedIds.includes(it.id) && <div onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "resize" }); }} style={{ position: "absolute", right: -6, bottom: -6, width: 16, height: 16, background: "#6366f1", borderRadius: "50%", cursor: "nwse-resize", zIndex: 100 }} />}
								</div>
							))}
						</div>
						<div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
							<button onClick={() => setCanvasHeight(h => h + baseHeight)} style={{ ...s.addPageBtn, width: `${canvasWidth}px`, height: "60px" }}>➕ ADD ROW (VERTICAL)</button>
						</div>
					</div>
					<div style={{ transform: `scale(${scale})`, transformOrigin: "top left", marginLeft: "20px" }}>
						<button onClick={() => setCanvasWidth(w => w + baseWidth)} style={{ ...s.addPageBtn, width: "60px", height: `${canvasHeight}px`, flexDirection: "column" }}>
							<span style={{ transform: "rotate(90deg)", whiteSpace: "nowrap" }}>➕ ADD COLUMN (HORIZONTAL)</span>
						</button>
					</div>
                </div>

                {(!isMobile || (selectedItem && showEditor)) && (
                    <div style={{ width: isMobile ? "100%" : "300px", background: "white", borderLeft: isMobile ? "none" : "1px solid #e2e8f0", position: isMobile ? "fixed" : "static", bottom: isMobile ? 0 : "auto", left: 0, right: 0, zIndex: 10001, maxHeight: isMobile ? "75vh" : "100%", overflowY: "auto", boxShadow: isMobile ? "0 -25px 80px rgba(0,0,0,0.25)" : "none", padding: "28px", display: (isMobile && !showEditor) ? "none" : "flex", flexDirection: "column", gap: "18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                            <span style={s.cardTitle}>ELEMENT DATA</span>
                            {isMobile && <button onClick={() => setShowEditor(false)} style={{ border: "none", background: "none", fontWeight: 900, fontSize: "24px" }}>✕</button>}
                        </div>
                        {selectedItem ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                                <div style={s.formGroup}><label style={s.formLabel}>ID / NAME</label><input style={s.input} value={selectedItem.name} onChange={e => updateItem(selectedItem.id, {name: e.target.value})} /></div>
                                <div style={{ display: "flex", gap: "12px" }}>
                                    <div style={{ flex: 1 }}><label style={s.formLabel}>COOR X</label><input type="number" style={s.input} value={selectedItem.x} onChange={e => updateItem(selectedItem.id, {x: parseInt(e.target.value)||0})} /></div>
                                    <div style={{ flex: 1 }}><label style={s.formLabel}>COOR Y</label><input type="number" style={s.input} value={selectedItem.y} onChange={e => updateItem(selectedItem.id, {y: parseInt(e.target.value)||0})} /></div>
                                </div>
                                <div style={{ display: "flex", gap: "12px" }}>
                                    <div style={{ flex: 1 }}><label style={s.formLabel}>W (PX)</label><input type="number" style={s.input} value={selectedItem.w} onChange={e => updateItem(selectedItem.id, {w: parseInt(e.target.value)||0})} /></div>
                                    <div style={{ flex: 1 }}><label style={s.formLabel}>H (PX)</label><input type="number" style={s.input} value={selectedItem.h} onChange={e => updateItem(selectedItem.id, {h: parseInt(e.target.value)||0})} /></div>
                                </div>
                                <div style={s.formGroup}>
                                    <label style={s.formLabel}>DISPLAY COLOR</label>
                                    <input type="color" value={`#${safeHex(selectedItem.color)}`} onChange={e => updateItem(selectedItem.id, {color: parseInt(e.target.value.substring(1), 16)})} style={{ width: "100%", height: "50px", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "5px", background: "white" }} />
                                </div>
								<div style={{ marginTop: "10px", padding: "15px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
									<span style={{ ...s.cardTitle, fontSize: "10px", marginBottom: "10px", display: "block" }}>STYLING</span>
									<div style={{ display: "flex", gap: "10px" }}>
										<div style={{ flex: 1 }}><label style={s.formLabel}>BORDER</label><input type="number" style={s.input} value={selectedItem.borderWidth||0} onChange={e => updateItem(selectedItem.id, {borderWidth: parseInt(e.target.value)||0})} /></div>
										<div style={{ flex: 1 }}><label style={s.formLabel}>RADIUS</label><input type="number" style={s.input} value={selectedItem.radius||0} onChange={e => updateItem(selectedItem.id, {radius: parseInt(e.target.value)||0})} /></div>
									</div>
									{selectedItem.type === "nav-menu" && (
										<div style={{ marginTop: "15px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
											<span style={{ ...s.cardTitle, fontSize: "10px", marginBottom: "10px", display: "block" }}>NAV MENU SETTINGS</span>
											<div style={s.formGroup}>
												<label style={s.formLabel}>ORIENTATION</label>
												<select style={s.input} value={selectedItem.orientation} onChange={e => updateItem(selectedItem.id, {orientation: e.target.value as any})}>
													<option value="v">VERTICAL</option>
													<option value="h">HORIZONTAL</option>
												</select>
											</div>
											<div style={{ ...s.formGroup, marginTop: "10px" }}>
												<label style={s.formLabel}>MENU ITEMS (Label|Action)</label>
												<textarea style={{ ...s.input, height: "100px", fontFamily: "monospace", fontSize: "11px" }} value={selectedItem.options} onChange={e => updateItem(selectedItem.id, {options: e.target.value})} />
											</div>
										</div>
									)}
								</div>
								<div style={{ marginTop: "10px", padding: "15px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
									<span style={{ ...s.cardTitle, fontSize: "10px", marginBottom: "10px", display: "block" }}>Z-ORDER</span>
									<div style={{ display: "flex", gap: "10px" }}>
										<button onClick={() => moveItem(selectedItem.id, 1)} style={{ ...s.secondaryBtn, flex: 1, fontSize: "9px" }}>BRING FORWARD</button>
										<button onClick={() => moveItem(selectedItem.id, -1)} style={{ ...s.secondaryBtn, flex: 1, fontSize: "9px" }}>SEND BACKWARD</button>
									</div>
								</div>
                                <button onClick={() => removeItem(selectedItem.id)} style={{ ...s.secondaryBtn, color: "#f43f5e", border: "1px solid #fecaca", marginTop: "20px", height: "54px", background: "#fff5f5" }}>DELETE COMPONENT</button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
                                <span style={s.cardTitle}>SCREEN RESOLUTION</span>
                                <div style={s.formGroup}>
                                    <label style={s.formLabel}>WIDTH (PX)</label>
                                    <input type="number" style={s.input} value={baseWidth} onChange={e => setBaseWidth(parseInt(e.target.value)||1)} />
                                </div>
                                <div style={s.formGroup}>
                                    <label style={s.formLabel}>HEIGHT (PX)</label>
                                    <input type="number" style={s.input} value={baseHeight} onChange={e => setBaseHeight(parseInt(e.target.value)||1)} />
                                </div>
                                <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.5" }}>
                                    Adjust these to match your device's usable resolution if a side-menu or status bar is present.
                                </div>
								<div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
									<div style={{ flex: 1 }}>
										<label style={s.formLabel}>BG COLOR</label>
										<input type="color" value={`#${safeHex(gridBg)}`} onChange={e => setGridBg(parseInt(e.target.value.substring(1), 16))} style={{ width: "100%", height: "40px", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
									</div>
									<div style={{ flex: 1 }}>
										<label style={s.formLabel}>BORDER</label>
										<input type="color" value={`#${safeHex(gridBorderColor)}`} onChange={e => setGridBorderColor(parseInt(e.target.value.substring(1), 16))} style={{ width: "100%", height: "40px", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
									</div>
								</div>
								<div style={s.formGroup}>
									<label style={s.formLabel}>BORDER WIDTH (PX)</label>
									<input type="number" style={s.input} value={gridBorderWidth} onChange={e => setGridBorderWidth(parseInt(e.target.value)||0)} />
								</div>
								<div style={{ ...s.formGroup, marginTop: "10px" }}>
									<label style={{ ...s.formLabel, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
										<input type="checkbox" checked={hasDeviceSidebar} onChange={e => setHasDeviceSidebar(e.target.checked)} style={{ width: "16px", height: "16px" }} />
										<span>SHOW DEVICE SIDE MENU (160PX)</span>
									</label>
								</div>
                            </div>
                        )}
                    </div>
                )}
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
								<button key={type} onClick={() => addItem(type as any, 50, 50)} style={{ ...s.secondaryBtn, height: "100px", flexDirection: "column", gap: "12px" }}>
									<div style={{ transform: "scale(2)" }}>{getWidgetPreview(type as ElementType, "#6366f1")}</div>
									<div style={{ fontSize: "12px", fontWeight: "800", marginTop: "10px" }}>{type.toUpperCase()}</div>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

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
			<div style={{ color: "#6366f1", fontSize: "10px", marginBottom: "10px", fontWeight: "900" }}>-- ESP32-S3 REAL-TIME STREAM --</div>
			{logs.map((l, i) => <div key={i} style={{ fontFamily: "monospace", fontSize: "10px", color: i % 2 === 0 ? "#fff" : "#94a3b8", padding: "1px 0" }}>{l}</div>)}
		</div>
	);
}

function WifiTab({ status, onRefresh, onAPToggle }: { status: WifiStatus, onRefresh: () => void, onAPToggle: (active?: boolean) => void }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "15px", maxWidth: "800px", margin: "0 auto" }}>
			<div style={s.card}>
				<div style={s.cardTitle}>STATION</div>
				<div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
					<div><div style={s.formLabel}>STATUS</div><div style={{ fontWeight: 900, color: status?.connected ? "#10b981" : "#f43f5e" }}>{status?.connected ? "ONLINE" : "OFFLINE"}</div></div>
					<div style={{ textAlign: "right" }}><div style={s.formLabel}>LOCAL IP</div><div style={{ fontWeight: 900 }}>{status?.ip || "..."}</div></div>
				</div>
			</div>
			<div style={s.card}>
				<div style={s.cardTitle}>ACCESS POINT</div>
				<div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
					<div><div style={s.formLabel}>AP STATUS</div><div style={{ fontWeight: 900, color: status?.ap_active ? "#6366f1" : "#94a3b8" }}>{status?.ap_active ? "BROADCASTING" : "DISABLED"}</div></div>
					<div style={{ textAlign: "right" }}><div style={s.formLabel}>PORTAL IP</div><div style={{ fontWeight: 900 }}>{status?.ap_ip || "192.168.4.1"}</div></div>
				</div>
				<input style={{ ...s.input, width: "100%", marginTop: "15px" }} defaultValue={status?.ap_ssid} onBlur={async e => { await API.updateSettings({ ssid: e.target.value }); onRefresh(); }} placeholder="AP SSID" />
				<div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
					<button onClick={() => onAPToggle(true)} style={{ ...s.primaryBtn, flex: 1, padding: "12px" }}>START AP</button>
					<button onClick={() => onAPToggle(false)} style={{ ...s.secondaryBtn, flex: 1, padding: "12px", color: "#f43f5e" }}>STOP AP</button>
				</div>
			</div>
			<button onClick={onRefresh} style={{ ...s.secondaryBtn, height: "45px", marginTop: "10px" }}>REFRESH</button>
		</div>
	);
}

function MirrorTab() {
	const [width] = useWindowSize();
	const frameWidth = 800;
	const sidebarWidth = 160;
	const headerHeight = 64;
	const scale = Math.min(1, (width - 40) / frameWidth);
	return (
		<div style={{ display: "flex", flex: 1, height: "100%", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "40px" }}>
			<div style={{ transform: `scale(${scale})`, transformOrigin: "top center", width: `${frameWidth}px`, height: "480px", background: "#0e0e12", position: "relative", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", borderRadius: "12px", overflow: "hidden", border: "12px solid #1a1a1a" }}>
				 <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${headerHeight/2}px`, background: "rgba(10, 10, 15, 0.9)", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 15px", color: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: 900 }}>
					<span>GRIDOS V2.4</span>
					<div style={{ display: "flex", gap: "10px" }}><span>12:45</span><span>WiFi</span><span>⚡</span></div>
				 </div>
				 {/* Sidebar */}
				 <div style={{ position: "absolute", left: 0, top: `${headerHeight/2}px`, bottom: 0, width: `${sidebarWidth}px`, background: "rgba(20, 20, 30, 0.95)", borderRight: "2px solid #2d2d3f", zIndex: 20, display: "flex", flexDirection: "column", padding: "20px 0" }}>
					<div style={{ width: "100%", height: "20px", background: "rgba(99, 102, 241, 0.2)", marginBottom: "30px" }} />
					{[1,2,3,4].map(i => <div key={i} style={{ width: "80%", height: "30px", background: "rgba(255,255,255,0.03)", margin: "0 auto 10px", borderRadius: "4px" }} />)}
				 </div>
				 {/* Content Area */}
				 <div style={{ position: "absolute", left: sidebarWidth, top: headerHeight, right: 0, bottom: 0, overflow: "hidden" }}>
                     <GridRenderer />
				 </div>
			</div>
		</div>
	);
}

function GridRenderer() {
	const [items, setItems] = useState<GridItem[]>([]);
	const [panels, setPanels] = useState<Panel[]>([]);
	const [bg, setBg] = useState(0x0e0e12);
	const [borderColor, setBorderColor] = useState(0x222222);
	const [borderWidth, setBorderWidth] = useState(0);

	useEffect(() => {
		const active = localStorage.getItem("ds_active_scr") || "main";
		const saved = localStorage.getItem(`scr_${active}`);
		if (saved) { 
			const d = JSON.parse(saved); 
			setItems(d.items || []); 
			setBg(d.bg ?? 0x0e0e12); 
			setBorderColor(d.borderColor ?? 0x222222);
			setBorderWidth(d.borderWidth ?? 0);
		}
		const pL = localStorage.getItem("ds_panels"); if (pL) setPanels(JSON.parse(pL));
	}, []);
	const renderItem = (it: GridItem) => {
		const style: React.CSSProperties = { position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h, zIndex: 10 };
		return <div key={it.id} style={style}>{renderWidget(it, panels)}</div>;
	};
	return <div style={{ width: "100%", height: "100%", position: "relative", background: `#${safeHex(bg)}`, border: `${borderWidth}px solid #${safeHex(borderColor)}`, boxSizing: "border-box" }}>{items.map(it => renderItem(it))}</div>;
}

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

const s: Record<string, React.CSSProperties> = { 
	app: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", userSelect: "none", fontFamily: "'Outfit', sans-serif" }, 
	card: { background: "white", borderRadius: "20px", padding: "28px", boxShadow: "0 8px 30px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }, 
	primaryBtn: { background: "#4f46e5", color: "white", border: "none", borderRadius: "14px", cursor: "pointer", fontWeight: "800", transition: "0.25s", padding: "10px 24px", fontSize: "11px" }, 
	secondaryBtn: { background: "white", border: "1px solid #e2e8f0", color: "#475569", borderRadius: "14px", cursor: "pointer", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }, 
	compactBtn: { background: "white", border: "1px solid #e2e8f0", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 12px 50px rgba(0,0,0,0.15)", transition: "0.25s" },
	cardTitle: { fontSize: "13px", fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "2.5px" }, 
	formGroup: { display: "flex", flexDirection: "column", gap: "10px" },
	formLabel: { fontSize: "12px", fontWeight: 900, color: "#94a3b8", display: "block" }, 
	input: { padding: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", color: "#1e293b", fontSize: "15px", outline: "none", transition: "0.2s" },
    addPageBtn: { background: "rgba(255,255,255,0.05)", border: "2px dashed #e2e8f0", borderRadius: "20px", color: "#64748b", fontWeight: 900, fontSize: "14px", cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" },
    miniDelBtn: { background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", color: "#f43f5e", width: "24px", height: "24px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, cursor: "pointer", transition: "0.2s" }
};
