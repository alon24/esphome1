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

type ElementType = "btn" | "switch" | "slider" | "label" | "clock" | "panel-ref" | "arc" | "checkbox" | "dropdown" | "roller" | "bar" | "border" | "nav-menu" | "menu-item" | "native-wifi" | "native-system" | "native-sd" | "native-tests" | "component";

type GridItem = {
	id: string;
	name: string;
	type: ElementType;
	x: number;
	y: number;
	width: number;
	height: number;
	panelId?: string;     
	textColor?: number;   
	action?: string;      
	color?: number;       
	itemBg?: number;     // 5.1 Added
	value?: number;
	min?: number;
	max?: number;
	options?: string;
	borderWidth?: number;
	radius?: number;
	orientation?: "v" | "h";
	fontSize?: number;
	children?: GridItem[];
	component?: string;  // used when type === 'component', e.g. 'wifi-panel'
	mqttTopic?: string;
};

type Page = {
	id: string;
	name: string;
	x: number;
	y: number;
	items: GridItem[];
};

type Screen = {
	id: string;
	name: string;
	pages: Page[];
	bg?: number;
	borderColor?: number;
	borderWidth?: number;
};

type Panel = {
	id: string;
	name: string;
	width: number;
	height: number;
	bg: number;
	itemBg: number;
	elements: GridItem[];
};

type Project = {
	screens: Screen[];
	panels: Panel[];
};

// --- SMART COMPONENTS REGISTRY ---
// Each entry describes a native C++ component that can be placed anywhere on a screen.
const SMART_COMPONENTS = [
	{ id: "wifi-panel",       label: "📡 WiFi",     desc: "Scan & connect to networks",    preview: "/assets/wifi_preview.png",     defaultW: 640, defaultH: 350 },
	{ id: "sd-browser",       label: "💾 SD Card",   desc: "Browse & view SD card files",   preview: "/assets/sd_preview.png",       defaultW: 640, defaultH: 350 },
	{ id: "system-settings",  label: "⚙️ Settings",  desc: "System configuration panel",    preview: "/assets/settings_preview.png", defaultW: 640, defaultH: 350 },
];

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
		case "menu-item": return <div style={{ width: 14, height: 6, background: color, border: `1px solid ${color}` }} />;
		case "native-wifi": return <div style={{...s, fontSize: "8px"}}>📡</div>;
		case "native-system": return <div style={{...s, fontSize: "8px"}}>⚙️</div>;
		case "native-sd": return <div style={{...s, fontSize: "8px"}}>💾</div>;
		case "native-tests": return <div style={{...s, fontSize: "8px"}}>🧪</div>;
		case "component": return <div style={{...s, fontSize: "8px"}}>🧩</div>;
		default: return <div style={s}>?</div>;
	}
};

const renderWidget = (it: GridItem, panels: Panel[], pageId: string, onSelect?: (id: string, pgId: string) => void, selectedId?: string) => {
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
		const localItems = it.children || [];
		return (
			<div style={{ width: "100%", height: "100%", position: "relative", background: pt ? `#${safeHex(pt.bg)}` : "rgba(255,255,255,0.05)", borderRadius: it.radius || 0, overflow: "hidden" }}>
				<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "10px", height: "100%" }}>
					{pt?.elements.map(el => (
						<div key={el.id} style={{ cursor: onSelect ? "pointer" : "default", width: "100%" }} onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(el.id, pageId); } }}>
							{renderWidget({ ...el, radius: 8 }, panels, pageId, onSelect, selectedId)}
						</div>
					))}
					{localItems.map(el => (
						<div key={el.id} style={{ cursor: onSelect ? "pointer" : "default", width: "100%" }} onMouseDown={(e) => { if(onSelect) { e.stopPropagation(); onSelect(el.id, pageId); } }}>
							{renderWidget({ ...el, radius: 8 }, panels, pageId, onSelect, selectedId)}
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
						{renderWidget(c, panels, pageId, onSelect, selectedId)}
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
				boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
			}}>
				{it.name}
			</div>
		);
	}

	if (it.type === "component") {
		const comp = SMART_COMPONENTS.find(c => c.id === it.component);
		const isLight = brightness(color) > 160;
		return (
			<div style={{ 
				...baseStyle, 
				background: color,
				border: selectedId === it.id ? "3px solid #6366f1" : "2px dashed rgba(99,102,241,0.5)",
				borderRadius: "12px",
				position: "relative",
				overflow: "hidden",
			}}>
				{/* The preview image as a subtle overlay if requested, or just the color */}
				{comp && <div style={{ position: "absolute", inset: 0, opacity: 0.3, background: `url(${comp.preview}) center/cover no-repeat`, mixBlendMode: isLight ? "multiply" : "screen" }} />}
				<div style={{ position: "absolute", inset: 0, background: isLight ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }} />
				
				<div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
					<div style={{ background: isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 12, 41, 0.85)", backdropFilter: "blur(8px)", borderRadius: "100px", padding: "4px 14px", fontSize: "10px", fontWeight: 900, color: isLight ? "#000" : "white", letterSpacing: "0.5px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: "6px", border: `1px solid ${isLight ? "#ddd" : "rgba(165, 180, 252, 0.3)"}` }}>
						<span style={{ fontSize: "14px" }}>{comp?.label.split(' ')[0] || "🧩"}</span>
						{comp?.label.split(' ')[1] || it.component?.toUpperCase() || "COMPONENT"}
					</div>
					<div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", borderRadius: "100px", padding: "3px 12px", fontSize: "9px", fontWeight: 900, color: "white", boxShadow: "0 4px 10px rgba(79, 70, 229, 0.4)" }}>NATIVE</div>
				</div>
			</div>
		);
	}
		if (it.type.startsWith("native-")) {
		const nativeNames: any = { "native-wifi": "NATIVE WIFI SCREEN", "native-system": "NATIVE SYSTEM SCREEN", "native-sd": "NATIVE SD CARD SCREEN", "native-tests": "NATIVE TESTS SCREEN" };
		const nativePreviews: any = { 
			"native-wifi": "/assets/wifi_preview.png", 
			"native-system": "/assets/settings_preview.png", 
			"native-sd": "/assets/sd_preview.png" 
		};
		const preview = nativePreviews[it.type];

		return (
			<div style={{ 
				...baseStyle, 
				background: preview ? `url(${preview}) center/cover no-repeat` : "rgba(99, 102, 241, 0.1)",
				border: preview ? "none" : "2px dashed #6366f1", 
				borderRadius: "8px", 
				flexDirection: "column", 
				justifyContent: "center", 
				color: "#6366f1", 
				fontWeight: 900, 
				fontSize: "14px", 
				textAlign: "center",
				position: "relative"
			}}>
				{!preview && <div>{nativeNames[it.type]}</div>}
				{preview && (
					<div style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: "100px", fontSize: "10px", color: "white", backdropFilter: "blur(4px)" }}>
						SYSTEM UI PREVIEW
					</div>
				)}
				{!preview && <div style={{ fontSize: "10px", marginTop: "4px", fontWeight: 400 }}>Rendered natively on device</div>}
			</div>
		);
	}

	if (it.type === "label") return (
		<div style={{ ...baseStyle, justifyContent: "flex-start", fontSize: "16px", padding: "0 10px" }}>{it.name}</div>
	);

	return <div style={baseStyle}>{it.name}</div>;
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

const GridContext = React.createContext<any>(null);

const HierarchyItem = ({ it, pageId, screenId, depth = 0, isLast = false }: { it: GridItem, pageId: string, screenId: string, depth?: number, isLast?: boolean }) => {
	const { project, selections, setSelectedEntity, setActiveScreenId, setShowEditor, addItem, removeItem, moveItemHierarchy, updateItem } = React.useContext(GridContext);
	const [isOpen, setIsOpen] = useState(true);
	const [isOver, setIsOver] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const isContainer = it.type === "panel-ref" || it.type === "nav-menu";
	
	let children: GridItem[] = [];
	if (it.type === "panel-ref") {
		const panel = project.panels.find((p: any) => p.id === it.panelId);
		children = panel?.elements || [];
	} else if (it.type === "nav-menu") {
		children = it.children || [];
	}

	const selectedEntity = selections[screenId];
	const isSelected = selectedEntity?.id === it.id;

	return (
		<div 
			draggable 
			onDragStart={(e) => { e.dataTransfer.setData("itemId", it.id); e.dataTransfer.effectAllowed = "move"; }}
			onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
			onDragLeave={() => setIsOver(false)}
			onDrop={(e) => { 
				e.preventDefault(); 
				setIsOver(false); 
				const draggedId = e.dataTransfer.getData("itemId");
				if (draggedId && draggedId !== it.id) moveItemHierarchy(draggedId, it.id);
			}}
			style={{ position: "relative", opacity: isOver ? 0.5 : 1, borderTop: isOver ? "2px solid #6366f1" : "none" }}>
			{depth > 0 && <div style={{ position: "absolute", left: -14, top: 0, bottom: isLast ? 14 : 0, width: "1px", background: "#e2e8f0" }} />}
			{depth > 0 && <div style={{ position: "absolute", left: -14, top: 14, width: "10px", height: "1px", background: "#e2e8f0" }} />}
			
			<div 
				onClick={(e) => { e.stopPropagation(); setActiveScreenId(screenId); setSelectedEntity({ type: 'item', id: it.id, pageId }); setShowEditor(true); }} 
				style={{ padding: "4px 8px", background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent", border: isSelected ? "1.5px dashed #4f46e5" : "1.5px solid transparent", cursor: "grab", borderRadius: "4px", fontSize: "11px", marginBottom: "1px", fontWeight: "700", color: isSelected ? "#4f46e5" : "#64748b", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", minHeight: "28px", boxSizing: "border-box" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					{isContainer ? (
						<button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ width: "12px", height: "12px", border: "1px solid #2563eb", borderRadius: "0px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "white", color: "#2563eb", fontSize: "10px", fontWeight: 900, padding: 0, lineHeight: "10px" }}>{isOpen ? "-" : "+"}</button>
					) : <div style={{ width: "12px" }} />}
					<span style={{ fontSize: "13px", opacity: 0.9 }}>{isContainer ? (isOpen ? "📂" : "📁") : "📄"}</span>
					{isEditing ? (
						<input
							autoFocus
							value={it.name}
							onChange={(e) => updateItem(pageId, it.id, { name: e.target.value })}
							onBlur={() => setIsEditing(false)}
							onKeyDown={(e) => { if(e.key === 'Enter') setIsEditing(false); }}
							style={{ fontSize: "13px", fontWeight: isContainer ? 700 : 500, border: "1px solid #cbd5e1", borderRadius: "2px", outline: "none", padding: "0 2px", width: "80px", background: "transparent" }}
							onClick={(e) => e.stopPropagation()}
						/>
					) : (
						<span onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ fontSize: "13px", fontWeight: isContainer ? 700 : 500, color: "#000000", cursor: "text" }}>{it.name}</span>
					)}
					{isContainer && <span style={{ color: "#4b5563", fontWeight: 400 }}>({children.length})</span>}
				</div>
				<div style={{ display: "flex", gap: "4px" }}>
					{it.type === "nav-menu" && <button onClick={(e) => { e.stopPropagation(); addItem('menu-item', pageId, it.id); }} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "0 6px", fontSize: "10px", fontWeight: 900 }}>+ ITEM</button>}
					<button onClick={(e) => { e.stopPropagation(); removeItem(pageId, it.id); }} style={{ background: "none", border: "none", color: "#f43f5e", opacity: isSelected ? 1 : 0, cursor: "pointer", fontSize: "12px", fontWeight: "900" }}>✕</button>
				</div>
			</div>
			{isOpen && children.length > 0 && <div style={{ marginLeft: "22px" }}>{children.map((child: any, idx: number) => <HierarchyItem key={child.id} it={child} pageId={pageId} screenId={screenId} depth={depth + 1} isLast={idx === children.length - 1} />)}</div>}
		</div>
	);
};

const PageNode = ({ pg, screenId }: { pg: Page, screenId: string }) => {
	const { selections, setSelectedEntity, setActiveScreenId, updatePage, removePage, addItem } = React.useContext(GridContext);
	const [isOpen, setIsOpen] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const selectedEntity = selections[screenId];
	const isSelected = selectedEntity?.type === 'page' && selectedEntity.id === pg.id;
	return (
		<div style={{ marginBottom: "1px" }}>
			<div onClick={(e) => { e.stopPropagation(); setActiveScreenId(screenId); setSelectedEntity({ type: 'page', id: pg.id }); }} style={{ padding: "4px 8px", background: isSelected ? "rgba(99, 102, 241, 0.05)" : "transparent", border: isSelected ? "1.5px dashed #4f46e5" : "1.5px solid transparent", cursor: "pointer", borderRadius: "4px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: isSelected ? "#4f46e5" : "#1e293b", boxSizing: "border-box" }}>
				<button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ width: "12px", height: "12px", border: "1px solid #2563eb", borderRadius: "0px", background: "white", color: "#2563eb", fontSize: "10px", fontWeight: 900, padding: 0, lineHeight: "10px" }}>{isOpen ? "-" : "+"}</button>
				📄 
				{isEditing ? (
					<input
						autoFocus
						value={pg.name}
						onChange={(e) => updatePage(screenId, pg.id, { name: e.target.value })}
						onBlur={() => setIsEditing(false)}
						onKeyDown={(e) => { if(e.key === 'Enter') setIsEditing(false); }}
						style={{ fontSize: "12px", fontWeight: "700", border: "1px solid #cbd5e1", borderRadius: "2px", outline: "none", padding: "0 2px", width: "100px", background: "transparent" }}
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<span onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ cursor: "text" }}>{pg.name}</span>
				)}
				<span style={{ color: "#4b5563", fontWeight: 400 }}>({pg.items.length})</span>
				<button onClick={(e) => { e.stopPropagation(); addItem('btn', pg.id); }} style={{ marginLeft: "auto", fontSize: "10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 6px" }}>+ ADD</button>
				<button onClick={(e) => { e.stopPropagation(); removePage(screenId, pg.id); }} style={{ background: "none", border: "none", color: "#f43f5e", opacity: isSelected ? 1 : 0.5, cursor: "pointer", fontSize: "12px", fontWeight: "900", marginLeft: "4px" }}>✕</button>
			</div>
			{isOpen && <div style={{ paddingLeft: "22px", borderLeft: "1px solid #e2e8f0", marginLeft: "14px" }}>{pg.items.length === 0 ? <div style={{ padding: "4px 8px", fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>Empty Page</div> : pg.items.map((it: any, idx: number) => <HierarchyItem key={it.id} it={it} pageId={pg.id} screenId={screenId} isLast={idx === pg.items.length-1} />)}</div>}
		</div>
	);
};

const ScreenNode = ({ scr, isActive }: { scr: Screen, isActive: boolean }) => {
	const { setActiveScreenId, selections, setSelectedEntity, updateScreen, removeScreen, moveScreen } = React.useContext(GridContext);
	const [isOpen, setIsOpen] = useState(isActive);
	const [isEditing, setIsEditing] = useState(false);
	useEffect(() => { if (isActive) setIsOpen(true); }, [isActive]);
	const [isOver, setIsOver] = useState(false);
	const selectedEntity = selections[scr.id];
	const isSelected = selectedEntity?.type === 'screen' && selectedEntity.id === scr.id;
	return (
		<div 
			draggable 
			onDragStart={(e) => { e.dataTransfer.setData("screenId", scr.id); e.dataTransfer.effectAllowed = "move"; }}
			onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
			onDragLeave={() => setIsOver(false)}
			onDrop={(e) => { 
				e.preventDefault(); 
				setIsOver(false); 
				const draggedId = e.dataTransfer.getData("screenId");
				if (draggedId && draggedId !== scr.id) moveScreen(draggedId, scr.id);
			}}
			style={{ marginBottom: "10px", position: "relative", opacity: isOver ? 0.5 : 1, borderTop: isOver ? "2px solid #6366f1" : "none" }}>
			<div onClick={() => { setActiveScreenId(scr.id); setSelectedEntity({ type: 'screen', id: scr.id }); }} style={{ padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "900", color: isSelected ? "#2563eb" : "#4b5563", background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent", border: isSelected ? "1.5px dashed #2563eb" : "1.5px solid transparent", borderRadius: "6px", boxSizing: "border-box" }}>
				<button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ width: "16px", height: "16px", border: "2px solid #2563eb", borderRadius: "0px", background: "white", color: "#2563eb", fontSize: "12px", fontWeight: 900, padding: 0, lineHeight: "12px" }}>{isOpen ? "-" : "+"}</button>
				📺 
				{isEditing ? (
					<input
						autoFocus
						value={scr.name}
						onChange={(e) => updateScreen(scr.id, { name: e.target.value })}
						onBlur={() => setIsEditing(false)}
						onKeyDown={(e) => { if(e.key === 'Enter') setIsEditing(false); }}
						style={{ fontSize: "13px", fontWeight: "800", border: "1px solid #cbd5e1", borderRadius: "2px", outline: "none", padding: "0 2px", width: "120px", background: "transparent" }}
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<span onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ cursor: "text" }}>{scr.name}</span>
				)}
				{scr.id !== "main" && (
					<button onClick={(e) => { e.stopPropagation(); removeScreen(scr.id); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#f43f5e", opacity: isSelected ? 1 : 0.5, cursor: "pointer", fontSize: "14px", fontWeight: "900" }}>✕</button>
				)}
			</div>
			{isOpen && (
				<div style={{ paddingLeft: "10px" }}>
					{scr.pages.map((pg: any) => <PageNode key={pg.id} pg={pg} screenId={scr.id} />)}
				</div>
			)}
		</div>
	);
};

const PanelNode = ({ pan, isActive }: { pan: Panel, isActive: boolean }) => {
	const [isOpen, setIsOpen] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const { setSelectedEntity, updatePanel, removePanel, addItem, removeItem, updateItem, selections } = React.useContext(GridContext)!;
	
	return (
		<div style={{ marginBottom: "10px", position: "relative" }}>
			<div onClick={() => setSelectedEntity({ type: 'panel', id: pan.id })} style={{ padding: "6px 0", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "800", color: isActive ? "#000" : "#4b5563" }}>
				<button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ width: "12px", height: "12px", border: "1px solid #2563eb", borderRadius: "0px", background: "white", color: "#2563eb", fontSize: "10px", fontWeight: 900, padding: 0, lineHeight: "10px" }}>{isOpen ? "-" : "+"}</button>
				🔲 
				{isEditing ? (
					<input 
						autoFocus 
						value={pan.name} 
						onChange={e => updatePanel(pan.id, { name: e.target.value })} 
						onBlur={() => setIsEditing(false)}
						onKeyDown={e => e.key === 'Enter' && setIsEditing(false)}
						style={{ fontSize: "13px", fontWeight: "800", border: "1px solid #cbd5e1", borderRadius: "2px", outline: "none", padding: "0 2px", width: "120px", background: "transparent" }}
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<span onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ cursor: "text" }}>{pan.name}</span>
				)}
				<button onClick={(e) => { e.stopPropagation(); addItem('menu-item', 'panel', pan.id); }} style={{ marginLeft: "8px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "8px", fontWeight: 900, padding: "2px 6px" }}>+ ITEM</button>
				<button onClick={(e) => { e.stopPropagation(); removePanel(pan.id); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#f43f5e", opacity: isActive ? 1 : 0.5, cursor: "pointer", fontSize: "12px", fontWeight: "900" }}>✕</button>
			</div>
			{isOpen && (
				<div style={{ paddingLeft: "10px" }}>
					{pan.elements.map((it: any, i: number) => {
						const isSelected = selections['panel']?.id === it.id;
						const hasChildren = it.type === 'nav-menu';
						return (
							<div key={it.id} style={{ paddingLeft: "10px" }}>
								<div onClick={() => setSelectedEntity({ type: 'item', id: it.id, pageId: 'panel' })} style={{ padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: isSelected ? "#2563eb" : "#4b5563", background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent", border: isSelected ? "1.5px dashed #2563eb" : "1.5px solid transparent", borderRadius: "4px", boxSizing: "border-box" }}>
									{hasChildren && <button onClick={(e) => { e.stopPropagation(); }} style={{ width: "12px", height: "12px", border: "1px solid #94a3b8", borderRadius: "0px", background: "white", color: "#64748b", fontSize: "8px", fontWeight: 900, padding: 0, lineHeight: "8px" }}>-</button>}
									{!hasChildren && <div style={{ width: "12px" }} />}
									{it.type === 'nav-menu' ? '🚥' : (it.type === 'menu-item' ? '📄' : '📦')} 
									{isEditing ? (
										<input 
											autoFocus 
											value={it.name} 
											onChange={e => updateItem('panel', it.id, { name: e.target.value })} 
											onBlur={() => setIsEditing(false)}
											onKeyDown={e => e.key === 'Enter' && setIsEditing(false)}
											style={{ fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "2px", outline: "none", padding: "0 2px", width: "100px" }}
											onClick={(e) => e.stopPropagation()}
										/>
									) : (
										<span onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ cursor: "text" }}>{it.name}</span>
									)}
									{it.type === 'nav-menu' && (
										<button onClick={(e) => { e.stopPropagation(); addItem('menu-item', 'panel', it.id); }} style={{ marginLeft: "6px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "8px", fontWeight: 900, padding: "2px 4px" }}>+ ITEM</button>
									)}
									<div style={{ marginLeft: "auto", display: "flex", gap: "4px", alignItems: "center" }}>
										{i > 0 && <button onClick={(e) => { e.stopPropagation(); const newElements = [...pan.elements]; const temp = newElements[i]; newElements[i] = newElements[i-1]; newElements[i-1] = temp; updatePanel(pan.id, { elements: newElements }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: 0 }}>↑</button>}
										{i < pan.elements.length - 1 && <button onClick={(e) => { e.stopPropagation(); const newElements = [...pan.elements]; const temp = newElements[i]; newElements[i] = newElements[i+1]; newElements[i+1] = temp; updatePanel(pan.id, { elements: newElements }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: 0 }}>↓</button>}
										<button onClick={(e) => { e.stopPropagation(); removeItem('panel', it.id); }} style={{ background: "none", border: "none", color: "#f43f5e", opacity: isSelected ? 1 : 0.4, cursor: "pointer", fontSize: "10px", fontWeight: "900", padding: 0, marginLeft: "4px" }}>✕</button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

// --- GRID TAB (BUILDER) ---

function GridTab({ isMobile, width, wifiStatus, onWifiUpdate, onSettingsUpdate }: { isMobile: boolean, width: number, wifiStatus: WifiStatus, onWifiUpdate: () => void, onSettingsUpdate: (active?: boolean) => void }) {
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
	const [activeScreenId, setActiveScreenId] = useState("main");
	const [remoteIp, setRemoteIp] = useState(() => localStorage.getItem("ds_remote_ip") || "");
	
    useEffect(() => { localStorage.setItem("ds_remote_ip", remoteIp); }, [remoteIp]);
    useEffect(() => { localStorage.setItem("ds_active_screen", activeScreenId); }, [activeScreenId]);

	const [selections, setSelections] = useState<Record<string, { type: 'screen' | 'page' | 'item' | 'panel' | 'component', id: string, pageId?: string } | null>>({
		main: { type: 'screen', id: 'main' }
	});
	const selectedEntity = selections[activeScreenId] || null;

	const setSelectedEntity = (ent: { type: 'screen' | 'page' | 'item' | 'panel' | 'component', id: string, pageId?: string } | null) => {
		if (ent?.type === 'screen') {
			const scr = project.screens.find(s => s.id === ent.id);
			if (scr?.pages[0]) {
				setSelections(prev => ({ ...prev, [ent.id]: { type: 'page', id: scr.pages[0].id } }));
				return;
			}
		}
		setSelections(prev => ({ ...prev, [activeScreenId]: ent }));
	};

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
	const removeScreen = (id: string) => {
		if (id === "main") return;
		setProject(prev => ({ ...prev, screens: prev.screens.filter(s => s.id !== id) }));
		setActiveScreenId("main");
	};

	const addPanel = () => {
		const newPanel: Panel = {
			id: `pan_${Math.random().toString(36).substr(2, 5)}`,
			name: `Navigation ${project.panels.length+1}`,
			width: 160,
			height: 480,
			bg: 0x4f46e5,
			itemBg: 0x6366f1,
			elements: []
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
	
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Delete" || e.key === "Backspace") {
				// Don't delete if we're typing in an input
				if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
				
				if (selectedEntity?.type === 'item') {
					removeItem(selectedEntity.pageId!, selectedEntity.id);
				} else if (selectedEntity?.type === 'page') {
					removePage(activeScreenId, selectedEntity.id);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedEntity, activeScreenId]);
	
	const panelsTotalWidth = isMobile ? 0 : 560;
	const scale = isMobile ? Math.min(1, (width - 40) / frameWidth) : Math.min(1, (width - panelsTotalWidth - 100) / frameWidth);
	const canvasContainerRef = useRef<HTMLDivElement>(null);

	const applyRecursive = (items: GridItem[], targetId: string, transform: (it: GridItem) => GridItem | null): GridItem[] => {
		return items.map(it => {
			if (it.id === targetId) return transform(it);
			if (it.children) return { ...it, children: applyRecursive(it.children, targetId, transform).filter(x => x) as GridItem[] };
			return it;
		}).filter(x => x) as GridItem[];
	};

	const addItem = (type: ElementType, pageId: string, parentId?: string, panelId?: string, forceX?: number, forceY?: number, itemOverride?: Partial<GridItem>) => {
		const newId = `${type}_${Math.random().toString(36).substr(2, 5)}`;
		const newItem: GridItem = { id: newId, name: `New ${type}`, type, x: forceX ?? 20, y: forceY ?? 20, width: type === 'panel-ref' ? 160 : 120, height: type === 'panel-ref' ? 416 : 40, textColor: 0xffffff, color: 0x4f46e5, value: 50, min: 0, max: 100, options: "Item 1\nItem 2\nItem 3", borderWidth: 0, radius: 0, panelId, ...itemOverride };
		
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
			screens: prev.screens.map(s => s.id === activeScreenId ? {
				...s,
				pages: s.pages.map(p => p.id === pageId ? { 
					...p, 
					items: parentId 
						? applyRecursive(p.items, parentId, pit => ({ ...pit, children: [...(pit.children || []), newItem] }))
						: [...p.items, newItem] 
				} : p)
			} : s)
		}));
		setSelectedEntity({ type: 'item', id: newId, pageId });
		setShowEditor(true);
	};

	const updateItem = (pageId: string, id: string, patch: Partial<GridItem>) => {
		if (pageId === 'panel' && editingPanel) {
			setProject(prev => ({
				...prev,
				panels: prev.panels.map(p => p.id === editingPanel.id ? { ...p, elements: p.elements.map(e => e.id === id ? { ...e, ...patch } : e) } : p)
			}));
			return;
		}
		setProject(prev => ({
			...prev,
			screens: prev.screens.map(s => s.id === activeScreenId ? {
				...s,
				pages: s.pages.map(p => p.id === pageId ? { 
					...p, 
					items: applyRecursive(p.items, id, it => ({ ...it, ...patch }))
				} : p)
			} : s)
		}));
	};

	const removeItem = (pageId: string, id: string) => {
		if (pageId === 'panel' && editingPanel) {
			setProject(prev => ({
				...prev,
				panels: prev.panels.map(p => p.id === editingPanel.id ? { ...p, elements: p.elements.filter(e => e.id !== id) } : p)
			}));
			setSelectedEntity(null);
			return;
		}
		setProject(prev => ({
			...prev,
			screens: prev.screens.map(s => s.id === activeScreenId ? {
				...s,
				pages: s.pages.map(p => p.id === pageId ? { 
					...p, 
					items: applyRecursive(p.items, id, () => null)
				} : p)
			} : s)
		}));
		if (selectedEntity?.id === id) setSelectedEntity(null);
	};

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

			return { ...prev, screens: newScreens };
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

	useEffect(() => {
		const onMove = (e: MouseEvent | TouchEvent) => {
			const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
			const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
			if (dragInfo) {
				const dx = clientX - dragInfo.startX; const dy = clientY - dragInfo.startY;
				if (dragInfo.mode === "move") updateItem(dragInfo.pageId, dragInfo.id, { x: Math.max(0, Math.round(dragInfo.initialX + dx/scale)), y: Math.max(0, Math.round(dragInfo.initialY + dy/scale)) });
				else updateItem(dragInfo.pageId, dragInfo.id, { width: Math.max(10, Math.round(dragInfo.initialWidth + dx/scale)), height: Math.max(10, Math.round(dragInfo.initialHeight + dy/scale)) });
			}
		};
		const onUp = () => setDragInfo(null);
		window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
		window.addEventListener("touchmove", onMove); window.addEventListener("touchend", onUp);
		return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
	}, [dragInfo, scale]);

	return (
		<GridContext.Provider value={{ project, selectedEntity, setSelectedEntity, selections, setSelections, setShowEditor, addItem, removeItem, moveItemHierarchy, setActiveScreenId, updateScreen, removeScreen, moveScreen, updatePage, removePage, updateItem, addPage, addPanel, updatePanel, removePanel }}>
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
                {!isMobile && (
                    <div style={{ width: "260px", background: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflowY: "auto", position: "relative" }}>
                        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "white", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={s.cardTitle}>WIDGET LIBRARY</span>
                            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 800 }}>DRAG & DROP</span>
                        </div>
                            <div style={{ padding: "15px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                {["btn", "switch", "slider", "label", "clock", "arc", "checkbox", "dropdown", "roller", "bar", "nav-menu", "menu-item"].map(type => (
                                    <button 
										key={type} 
										onClick={() => {
											// Just select (clear other selections)
											setSelectedEntity(null);
										}}
										onDoubleClick={() => { 
											if (isEditingPanel && editingPanel) addItem(type as any, 'panel');
											else if (selectedEntity?.type === 'page') addItem(type as any, selectedEntity.id); 
											else if (activeScreen.pages[0]) addItem(type as any, activeScreen.pages[0].id); 
										}} 
										style={{ ...s.secondaryBtn, height: "44px", flexDirection: "column", gap: "4px", padding: "8px" }}
									>
                                        <div style={{ transform: "scale(1.2)" }}>{getWidgetPreview(type as ElementType, "#6366f1")}</div>
                                        <div style={{ fontSize: "8px", fontWeight: 900 }}>{type === 'nav-menu' ? 'MENU' : (type === 'menu-item' ? 'ITEM' : type.toUpperCase())}</div>
                                    </button>
                                ))}
                            </div>

							<div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", position: "sticky", top: "54px", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ ...s.cardTitle, fontSize: "10px" }}>MASTER PANELS</span>
                                <span style={{ fontSize: "9px", color: "#6366f1", fontWeight: 900 }}>REUSABLE</span>
                            </div>
							<div style={{ padding: "15px", display: "flex", flexDirection: "column", gap: "8px" }}>
								{project.panels.map(p => {
									const isSec = isEditingPanel && (editingPanel?.id === p.id);
									return (
										<div key={p.id} style={{ display: "flex", gap: "4px" }}>
											<button 
												draggable
												onDragStart={(e) => { e.dataTransfer.setData("type", "panel-ref"); e.dataTransfer.setData("panelId", p.id); }}
												onClick={() => setSelectedEntity({ type: 'panel', id: p.id })} 
												onDoubleClick={() => {
													const targetPageId = selectedEntity?.type === 'page' ? selectedEntity.id : (activeScreen.pages[0]?.id ?? '');
													if (targetPageId) addItem('panel-ref', targetPageId, undefined, p.id);
												}}
												style={{ ...s.secondaryBtn, flex: 1, justifyContent: "flex-start", padding: "0 12px", height: "32px", fontSize: "11px", fontWeight: 700, background: isSec ? "rgba(99, 102, 241, 0.05)" : "white", cursor: "grab", border: isSec ? "1px solid #6366f1" : "1px solid #e2e8f0" }}>
												🔲 {p.name}
											</button>
											<button onClick={() => setSelectedEntity({ type: 'panel', id: p.id })} style={{ border: `1px solid ${isSec ? "#6366f1" : "#e2e8f0"}`, background: isSec ? "rgba(99, 102, 241, 0.1)" : "white", borderRadius: "4px", width: "32px", fontSize: "12px" }}>⚙️</button>
											<button onClick={(e) => { e.stopPropagation(); removePanel(p.id); }} style={{ border: "1px solid #fecaca", background: "white", borderRadius: "4px", width: "32px", fontSize: "12px", color: "#f43f5e", cursor: "pointer" }}>✕</button>
										</div>
									);
								})}
								<button onClick={addPanel} style={{ ...s.secondaryBtn, border: "1px dashed #cbd5e1", marginTop: "5px" }}>+ NEW PANEL</button>
							</div>

							<div style={{ padding: "12px 20px", background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", borderTop: "1px solid #4c1d95", borderBottom: "1px solid #4c1d95", position: "sticky", top: "98px", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "10px", fontWeight: 900, letterSpacing: "1px", color: "#a5b4fc" }}>🧩 SMART COMPONENTS</span>
                                <span style={{ fontSize: "9px", color: "#818cf8", fontWeight: 900 }}>INTERACTIVE</span>
                            </div>
							<div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px", background: "#f5f3ff" }}>
								{SMART_COMPONENTS.map(comp => (
									<div
										key={comp.id}
										draggable
										onDragStart={(e) => { e.dataTransfer.setData("type", "component"); e.dataTransfer.setData("component", comp.id); e.dataTransfer.setData("w", String(comp.defaultW)); e.dataTransfer.setData("h", String(comp.defaultH)); }}
										onClick={() => {
											// Selection only
											setSelectedEntity({ type: 'component' as any, id: comp.id } as any);
										}}
										onDoubleClick={() => {
											const targetPageId = selectedEntity?.type === 'page' ? selectedEntity.id : (activeScreen.pages[0]?.id ?? '');
											if (targetPageId) addItem("component", targetPageId, undefined, undefined, 160, 0, { name: comp.label, component: comp.id, width: comp.defaultW, height: comp.defaultH, color: 0x0e0e0e });
										}}
										style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "white", border: "1px solid #ddd6fe", borderRadius: "8px", cursor: "grab", userSelect: "none", transition: "all 0.15s" }}
										onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(99,102,241,0.2)")}
										onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
									>
										<div style={{ width: "40px", height: "40px", borderRadius: "8px", background: `url(${comp.preview}) center/cover no-repeat`, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0, boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)" }}>
											<div style={{ background: "rgba(0,0,0,0.4)", borderRadius: "4px", padding: "2px 4px", color: "white", fontSize: "10px", fontWeight: 900 }}>{comp.label.split(' ')[0]}</div>
										</div>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ fontSize: "11px", fontWeight: 800, color: "#1e1b4b" }}>{comp.label.toUpperCase()}</div>
											<div style={{ fontSize: "9px", color: "#6366f1", fontWeight: 500 }}>{comp.desc}</div>
										</div>
									</div>
								))}
							</div>
                            <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9", borderTop: "1px solid #f1f5f9", position: "sticky", top: "142px", zIndex: 30, background: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ ...s.cardTitle, marginBottom: "0", display: "block" }}>PROJECT HIERARCHY</span>
                                <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900 }}>{project.screens.length} SCREENS</span>
                            </div>
                            <div style={{ padding: "20px", flex: 1 }}>
                                {project.screens.map(scr => <ScreenNode key={scr.id} scr={scr} isActive={scr.id === activeScreenId} />)}
								
								<div style={{ marginTop: "30px", paddingTop: "15px", borderTop: "1px dashed #e2e8f0" }}>
									<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "15px" }}>
                                        <span style={{ ...s.cardTitle, fontSize: "10px", color: "#94a3b8" }}>GLOBAL TEMPLATES</span>
                                        <button onClick={addPanel} style={{ background: "none", border: "none", color: "#6366f1", fontSize: "10px", fontWeight: 900, cursor: "pointer" }}>+ NEW</button>
                                    </div>
									{project.panels.map(pan => <PanelNode key={pan.id} pan={pan} isActive={isEditingPanel && editingPanel?.id === pan.id} />)}
								</div>
								
								<button onClick={() => updateProject({ screens: [...project.screens, { id: `scr_${project.screens.length+1}`, name: `Screen ${project.screens.length+1}`, pages: [{ id: `p1`, name: "Page 1", x: 0, y: 0, items: [] }] }] })} style={{ ...s.primaryBtn, width: "100%", height: "40px", marginTop: "20px", fontSize: "11px" }}>+ ADD NEW SCREEN</button>
                            </div>
                    </div>
                )}

                <div ref={canvasContainerRef} style={{ flex: 1, background: "#f1f5f9", position: "relative", overflow: "auto", display: "flex", flexDirection: "row", alignItems: "flex-start", padding: isMobile ? "20px" : "60px" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
						{(() => {
							const canvasWidth = isEditingPanel ? (editingPanel?.width || 160) : Math.max(...activeScreen.pages.map(p => p.x + baseWidth), baseWidth);
							const canvasHeight = Math.max(...activeScreen.pages.map(p => p.y + baseHeight), baseHeight);
							const totalFrameWidth = isEditingPanel ? canvasWidth : Math.max(canvasWidth, frameWidth);
							const totalFrameHeight = Math.max(canvasHeight + headerHeight, frameHeight);

							return (
								<>
									<div style={{ width: `${totalFrameWidth}px`, height: `${totalFrameHeight}px`, background: "#000", position: "absolute", transform: `scale(${scale})`, transformOrigin: "top left", zIndex: 0, pointerEvents: "none", boxShadow: "0 40px 100px rgba(0,0,0,0.2)", borderRadius: isEditingPanel ? "0" : "12px", border: isEditingPanel ? "none" : "8px solid #1a1a1a" }} />
									<div style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, background: isEditingPanel ? `#${safeHex(editingPanel?.bg)}` : `#${safeHex(activeScreen.bg)}`, border: isEditingPanel ? "none" : `${activeScreen.borderWidth}px solid rgba(255,255,255,0.1)`, boxSizing: "border-box", position: "relative", transform: `scale(${scale})`, transformOrigin: "top left", marginTop: `${headerHeight * scale}px`, zIndex: 10 }}>
										<div style={{ position: "absolute", top: -headerHeight, left: 0, width: `${canvasWidth}px`, height: `${headerHeight}px`, background: "rgba(10, 10, 15, 0.9)", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 15px", color: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: 900, pointerEvents: "none" }}>
											<span>{isEditingPanel ? `MASTER: ${editingPanel?.name}` : `GRIDOS - ${activeScreen.name}`}</span>
											{!isEditingPanel && <div style={{ display: "flex", gap: "10px" }}><span>12:45</span><span>WiFi</span><span>⚡</span></div>}
										</div>
										{isEditingPanel ? (
											<div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "transparent", display: "flex", flexDirection: "column", gap: "10px", padding: "10px" }}>
												{editingPanel?.elements.map(it => (
													<div key={it.id} onMouseDown={(e) => { e.stopPropagation(); setSelectedEntity({ type: 'item', id: it.id, pageId: 'panel' }); }} style={{ position: "relative", outline: selectedEntity?.id === it.id ? "3px solid #6366f1" : "none", outlineOffset: 3, zIndex: 10, flex: "0 0 auto", width: "100%" }}>
														{renderWidget(it, project.panels, 'panel', (id, pId) => setSelectedEntity({ type: 'item', id, pageId: pId }), selectedEntity?.id)}
													</div>
												))}
											</div>
										) : (
											<>
												{activeScreen.pages.length === 0 && (
													<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
														<button onClick={() => addPage(activeScreen.id, 0, 0)} style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#6366f1", color: "white", border: "none", cursor: "pointer", fontSize: "40px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 40px rgba(99, 102, 241, 0.4)", transition: "0.2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>+</button>
													</div>
												)}
												{activeScreen.pages.map(pg => (
													<div 
														key={pg.id} 
														onDragOver={(e) => e.preventDefault()}
														onDrop={(e) => {
															e.preventDefault();
															const type = e.dataTransfer.getData("type");
															const panelId = e.dataTransfer.getData("panelId");
															if (type === "panel-ref" && panelId) {
																const rect = e.currentTarget.getBoundingClientRect();
																const x = Math.round((e.clientX - rect.left) / scale);
																const y = Math.round((e.clientY - rect.top) / scale);
																addItem('panel-ref', pg.id, undefined, panelId, x, y);
															}
														}}
														style={{ position: "absolute", left: pg.x, top: pg.y, width: baseWidth, height: baseHeight, outline: selectedEntity?.id === pg.id ? "3px solid orange" : "none", border: "2px dashed rgba(99, 102, 241, 0.4)" }}>
														{pg.items.map(it => (
															<div key={it.id} onMouseDown={(e) => { e.stopPropagation(); setSelectedEntity({ type: 'item', id: it.id, pageId: pg.id }); setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "move" }); }} style={{ position: "absolute", left: it.x, top: it.y, width: it.width, height: it.type === 'panel-ref' ? baseHeight : it.height, outline: selectedEntity?.id === it.id ? "3px solid #6366f1" : "none", outlineOffset: 3, zIndex: 10 }}>
																{renderWidget(it, project.panels, pg.id, (id, pId) => setSelectedEntity({ type: 'item', id, pageId: pId }), selectedEntity?.id)}
																{selectedEntity?.id === it.id && (
																	<div onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ id: it.id, pageId: pg.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialWidth: it.width, initialHeight: it.height, mode: "resize" }); }} style={{ position: "absolute", right: -6, bottom: it.type === 'panel-ref' ? "50%" : -6, width: 16, height: 16, background: "#6366f1", borderRadius: "50%", cursor: it.type === 'panel-ref' ? "ew-resize" : "nwse-resize", zIndex: 100 }} />
																)}
															</div>
														))}
														<button onClick={(e) => { e.stopPropagation(); addPage(activeScreen.id, pg.x + 800, pg.y); }} style={{ position: "absolute", right: -15, top: "50%", transform: "translateY(-50%)", width: "30px", height: "30px", borderRadius: "50%", background: "#6366f1", color: "white", border: "none", cursor: "pointer", zIndex: 100, fontSize: "20px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>+</button>
														<button onClick={(e) => { e.stopPropagation(); addPage(activeScreen.id, pg.x, pg.y + 416); }} style={{ position: "absolute", bottom: -15, left: "50%", transform: "translateX(-50%)", width: "30px", height: "30px", borderRadius: "50%", background: "#6366f1", color: "white", border: "none", cursor: "pointer", zIndex: 100, fontSize: "20px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>+</button>
													</div>
												))}
											</>
										)}
										{showKeyboard && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000 }}><VirtualKeyboard onClose={() => setShowKeyboard(false)} /></div>}
									</div>
								</>
							);
						})()}
					</div>
				</div>

                {(!isMobile || (selectedItem && showEditor)) && (
                    <div style={{ width: isMobile ? "100%" : "300px", background: "white", borderLeft: isMobile ? "none" : "1px solid #e2e8f0", zIndex: 10001, maxHeight: "100%", overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                            <span style={s.cardTitle}>{selectedEntity?.type.toUpperCase() || "GLOBAL"} EDITOR</span>
                            {isMobile && <button onClick={() => setShowEditor(false)} style={{ border: "none", background: "none", fontWeight: 900, fontSize: "24px" }}>✕</button>}
                        </div>

						<div style={{ display: "flex", gap: "10px", marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #f1f5f9" }}>
							<button onClick={() => {
								const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
								const url = URL.createObjectURL(blob);
								const a = document.createElement("a");
								a.href = url;
								a.download = `gridos_project_${new Date().toISOString().split('T')[0]}.json`;
								a.click();
							}} style={{ ...s.secondaryBtn, flex: 1, height: "36px", fontSize: "11px" }}>📥 EXPORT</button>
							<button onClick={() => {
								const input = document.createElement("input");
								input.type = "file";
								input.accept = ".json";
								input.onchange = (e: any) => {
									const file = e.target.files[0];
									if (!file) return;
									const reader = new FileReader();
									reader.onload = (re: any) => {
										try {
											const imported = JSON.parse(re.target.result);
											if (imported.screens) setProject(imported);
										} catch(err) { alert("Invalid JSON file"); }
									};
									reader.readAsText(file);
								};
								input.click();
							}} style={{ ...s.secondaryBtn, flex: 1, height: "36px", fontSize: "11px" }}>📤 IMPORT</button>
						</div>

                        {selectedItem && selectedEntity?.pageId ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                                <div style={s.formGroup}><label style={s.formLabel}>ID / NAME</label><input style={s.input} value={selectedItem.name} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {name: e.target.value})} /></div>
                                {selectedItem.type !== "menu-item" && (
									<>
										<div style={{ display: "flex", gap: "12px" }}>
											<div style={{ flex: 1 }}><label style={s.formLabel}>COOR X</label><input type="number" style={s.input} value={selectedItem.x} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {x: parseInt(e.target.value)||0})} /></div>
											<div style={{ flex: 1 }}><label style={s.formLabel}>COOR Y</label><input type="number" style={s.input} value={selectedItem.y} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {y: parseInt(e.target.value)||0})} /></div>
										</div>
										<div style={{ display: "flex", gap: "12px" }}>
											<div style={{ flex: 1 }}><label style={s.formLabel}>WIDTH (PX)</label><input type="number" style={s.input} value={selectedItem.width} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {width: parseInt(e.target.value)||0})} /></div>
											<div style={{ flex: 1 }}><label style={s.formLabel}>HEIGHT (PX)</label><input type="number" style={s.input} value={selectedItem.height} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {height: parseInt(e.target.value)||0})} /></div>
										</div>
									</>
								)}
								{selectedItem.type === "menu-item" && (
									<div style={s.formGroup}>
										<label style={s.formLabel}>ACTION (DESTINATION)</label>
										<select style={s.input} value={selectedItem.action || ""} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {action: e.target.value})}>
											<option value="">-- None --</option>
											{project.screens.map(scr => (
												<option key={`scr:${scr.id}`} value={`scr:${scr.id}`}>Screen: {scr.name}</option>
											))}
											<option value="scr:main">Screen: Main (Built-in)</option>
										</select>
									</div>
								)}
                                <div style={{ display: "flex", gap: "12px" }}>
									<div style={{ flex: 1 }}>
										<label style={s.formLabel}>BG COLOR</label>
										<input type="color" value={`#${safeHex(selectedItem.color)}`} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {color: parseInt(e.target.value.substring(1), 16)})} style={{ width: "100%", height: "40px", border: "1px solid #cbd5e1", borderRadius: "10px" }} />
									</div>
									<div style={{ flex: 1 }}>
										<label style={s.formLabel}>TXT COLOR</label>
										<input type="color" value={`#${safeHex(selectedItem.textColor)}`} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {textColor: parseInt(e.target.value.substring(1), 16)})} style={{ width: "100%", height: "40px", border: "1px solid #cbd5e1", borderRadius: "10px" }} />
									</div>
								</div>
								<div style={s.formGroup}><label style={s.formLabel}>MQTT TOPIC</label><input style={{...s.input, color: "#4f46e5", fontWeight: 700}} placeholder="home/sensor/value" value={selectedItem.mqttTopic || ""} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {mqttTopic: e.target.value})} /></div>
								
								{["arc", "slider", "bar"].includes(selectedItem.type) && (
									<div style={{ display: "flex", gap: "12px", background: "#f5f3ff", padding: "12px", borderRadius: "10px", border: "1px solid #ddd6fe" }}>
										<div style={{ flex: 1 }}><label style={{...s.formLabel, color: "#6366f1"}}>MIN</label><input type="number" style={s.input} value={selectedItem.min || 0} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {min: parseInt(e.target.value)||0})} /></div>
										<div style={{ flex: 1 }}><label style={{...s.formLabel, color: "#6366f1"}}>MAX</label><input type="number" style={s.input} value={selectedItem.max || 100} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {max: parseInt(e.target.value)||0})} /></div>
										<div style={{ flex: 1 }}><label style={{...s.formLabel, color: "#6366f1"}}>VALUE</label><input type="number" style={s.input} value={selectedItem.value || 0} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {value: parseInt(e.target.value)||0})} /></div>
									</div>
								)}

								{["roller", "dropdown"].includes(selectedItem.type) && (
									<div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
										<label style={{...s.formLabel, color: "#16a34a"}}>OPTIONS (NEW LINE SEP)</label>
										<textarea style={{...s.input, height: "80px", fontSize: "12px"}} placeholder="Option 1\nOption 2\nOption 3" value={selectedItem.options || ""} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {options: e.target.value})} />
									</div>
								)}

								<div style={s.formGroup}><label style={s.formLabel}>FONT SIZE (PX)</label><input type="number" style={s.input} value={selectedItem.fontSize || 10} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {fontSize: parseInt(e.target.value)||1})} /></div>
								<div style={{ display: "flex", gap: "12px" }}>
									<div style={{ flex: 1 }}><label style={s.formLabel}>BORDER</label><input type="number" style={s.input} value={selectedItem.borderWidth || 0} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {borderWidth: parseInt(e.target.value)||0})} /></div>
									<div style={{ flex: 1 }}><label style={s.formLabel}>RADIUS</label><input type="number" style={s.input} value={selectedItem.radius || 0} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {radius: parseInt(e.target.value)||0})} /></div>
								</div>
								
								{selectedItem.type === "nav-menu" && (
									<div style={{ marginTop: "15px", borderTop: "1px solid #f1f5f9", paddingTop: "15px" }}>
										<div style={{ ...s.formGroup, marginBottom: "15px" }}>
											<label style={s.formLabel}>ORIENTATION</label>
											<select style={s.input} value={selectedItem.orientation || "v"} onChange={e => updateItem(selectedEntity.pageId!, selectedItem.id, {orientation: e.target.value as any})}>
												<option value="v">VERTICAL</option>
												<option value="h">HORIZONTAL</option>
											</select>
										</div>
										<span style={{ ...s.cardTitle, fontSize: "10px", marginBottom: "12px", display: "block" }}>CONTAINED ITEMS</span>
										<div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
											{(selectedItem.children || []).map((c) => (
												<div key={c.id} style={{ display: "flex", gap: "6px", alignItems: "center", background: "#f8fafc", padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
													<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
														<input style={{ ...s.input, padding: "4px 8px", height: "28px", fontSize: "12px" }} value={c.name} placeholder="Label" onChange={e => updateItem(selectedEntity.pageId!, c.id, { name: e.target.value })} />
														<select style={{ ...s.input, padding: "4px 8px", height: "28px", fontSize: "11px", opacity: 0.8 }} value={c.action || ""} onChange={e => updateItem(selectedEntity.pageId!, c.id, { action: e.target.value })}>
															<option value="">-- No Action --</option>
															{project.screens.map(scr => <option key={`scr:${scr.id}`} value={`scr:${scr.id}`}>{scr.name}</option>)}
															<option value="scr:main">Main</option>
														</select>
													</div>
													<button onClick={() => removeItem(selectedEntity.pageId!, c.id)} style={{ ...s.miniDelBtn, width: "24px", height: "24px" }}>✕</button>
												</div>
											))}
										</div>
										<button onClick={() => addItem('menu-item', selectedEntity.pageId!, selectedItem.id)} style={{ ...s.secondaryBtn, height: "34px", fontSize: "10px", marginTop: "10px", width: "100%" }}>+ ADD ITEM</button>
									</div>
								)}

                                <button onClick={() => removeItem(selectedEntity.pageId!, selectedItem.id)} style={{ ...s.secondaryBtn, color: "#f43f5e", border: "1px solid #fecaca", marginTop: "20px", height: "45px" }}>DELETE</button>
                            </div>
                        ) : selectedEntity?.type === 'screen' ? (
							<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
								<div style={s.formGroup}><label style={s.formLabel}>SCREEN NAME</label><input style={s.input} value={activeScreen.name} onChange={e => updateScreen(activeScreenId, {name: e.target.value})} /></div>
								<div style={s.formGroup}><label style={s.formLabel}>BACKGROUND</label><input type="color" value={`#${safeHex(activeScreen.bg)}`} onChange={e => updateScreen(activeScreenId, {bg: parseInt(e.target.value.substring(1), 16)})} style={{ width: "100%", height: "40px" }} /></div>
							</div>
						) : selectedEntity?.type === 'panel' ? (
							<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
								{(() => {
									const pan = project.panels.find(p => p.id === selectedEntity.id);
									if (!pan) return null;
									return (
										<>
											<div style={s.formGroup}><label style={s.formLabel}>PANEL NAME</label><input style={s.input} value={pan.name} onChange={e => updatePanel(pan.id, { name: e.target.value })} /></div>
											<div style={s.formGroup}><label style={s.formLabel}>WIDTH</label><input type="number" style={s.input} value={pan.width} onChange={e => updatePanel(pan.id, { width: parseInt(e.target.value)||0 })} /></div>
											<div style={s.formGroup}><label style={s.formLabel}>BG COLOR</label><input type="color" value={`#${safeHex(pan.bg)}`} onChange={e => updatePanel(pan.id, { bg: parseInt(e.target.value.substring(1), 16) })} style={{ width: "100%", height: "40px" }} /></div>
											<div style={s.formGroup}><label style={s.formLabel}>ITEM BG COLOR</label><input type="color" value={`#${safeHex(pan.itemBg)}`} onChange={e => updatePanel(pan.id, { itemBg: parseInt(e.target.value.substring(1), 16) })} style={{ width: "100%", height: "40px" }} /></div>
											
											<div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "15px", marginTop: "10px" }}>
												<span style={s.formLabel}>MASTER MENU ITEMS ({pan.elements.length})</span>
												<button onClick={() => updatePanel(pan.id, { elements: [...pan.elements, { id: `men_${Math.random().toString(36).substr(2,5)}`, name: "New Link", type: "menu-item", action: "", x:0, y:0, width:0, height:36 }] })} style={{ ...s.primaryBtn, width: "100%", marginTop: "10px" }}>+ ADD MASTER ITEM</button>
												{pan.elements.map((el, idx) => (
													<div key={el.id} style={{ border: "1px solid #f1f5f9", padding: "10px", borderRadius: "8px", marginTop: "10px", background: "#f8fafc" }}>
														<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
															<span style={{ fontSize: "10px", fontWeight: 800 }}>MASTER ITEM #{idx+1}</span>
															<button onClick={() => updatePanel(pan.id, { elements: pan.elements.filter(e => e.id !== el.id) })} style={{ border: "none", background: "none", color: "#f43f5e", fontWeight: 900 }}>✕</button>
														</div>
														<div style={s.formGroup}><label style={{...s.formLabel, fontSize: "9px"}}>NAME</label><input style={s.input} value={el.name} onChange={e => updatePanel(pan.id, { elements: pan.elements.map(item => item.id === el.id ? { ...item, name: e.target.value } : item) })} /></div>
														<div style={s.formGroup}><label style={{...s.formLabel, fontSize: "9px"}}>GO TO SCREEN</label><input style={{ ...s.input, fontSize: "10px" }} placeholder="scr_main / scr_wifi / etc" value={el.action} onChange={e => updatePanel(pan.id, { elements: pan.elements.map(item => item.id === el.id ? { ...item, action: e.target.value } : item) })} /></div>
													</div>
												))}
											</div>
											<button onClick={() => removePanel(pan.id)} style={{ ...s.secondaryBtn, color: "#f43f5e", borderColor: "#fecaca", marginTop: "20px" }}>DELETE MASTER PANEL</button>
										</>
									)
								})()}
							</div>
						) : selectedEntity?.type === 'component' ? (
								<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
									<div style={{...s.cardTitle, background: "linear-gradient(135deg, #1e1b4b, #312e81)", color: "white", padding: "10px 15px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
										<span style={{ fontSize: "18px" }}>{SMART_COMPONENTS.find(c => c.id === selectedEntity.id)?.label.split(' ')[0]}</span>
										{SMART_COMPONENTS.find(c => c.id === selectedEntity.id)?.label.split(' ')[1]}
									</div>
									<div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
										{SMART_COMPONENTS.find(c => c.id === selectedEntity.id)?.desc}
									</div>
									<div style={{ padding: "15px", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "10px", fontSize: "11px", color: "#6366f1", fontWeight: 600 }}>
										💡 <span style={{ color: "#1e1b4b" }}>PRO TIP:</span><br/>
										Double-click this component to add it to your current active page, or drag it directly onto the canvas.
									</div>
									<div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
										<div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8" }}>NATIVE COMPONENT METADATA</div>
										<div style={{ fontSize: "12px", background: "#f8fafc", padding: "10px", borderRadius: "6px", fontFamily: "monospace" }}>ID: {selectedEntity.id}</div>
									</div>
								</div>
						) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Select a screen, page, or widget to edit.</span>
								<div style={s.formGroup}><label style={s.formLabel}>GLOBAL PAGE WIDTH</label><input type="number" style={s.input} value={baseWidth} onChange={e => setBaseWidth(parseInt(e.target.value)||1)} /></div>
								<div style={s.formGroup}><label style={s.formLabel}>GLOBAL PAGE HEIGHT</label><input type="number" style={s.input} value={baseHeight} onChange={e => setBaseHeight(parseInt(e.target.value)||1)} /></div>
								<button onClick={() => { if(confirm("Clear everything and start fresh?")) setProject({ screens: [{ id: "main", name: "Main", bg: 0x000000, pages: [{ id: "p1", name: "Page 1", x: 0, y: 0, items: [] }] }], panels: [] }); }} style={{ ...s.secondaryBtn, color: "#f43f5e", borderColor: "#fecaca", marginTop: "20px", height: "40px" }}>⚠️ RESET PROJECT</button>
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
							{renderWidget(it, project.panels, pg.id, undefined, undefined)}
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
