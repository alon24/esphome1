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

type ElementType = "btn" | "switch" | "slider" | "label" | "clock" | "panel-ref" | "arc" | "checkbox" | "dropdown" | "roller" | "bar";

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
};

type Panel = {
	id: string;
	name: string;
	w: number;
	h: number;
	elements: GridItem[];
};

// --- CONFIG ---
const BUILD_ID = "v99-CONDENSED-PRO";

// --- UTILS ---
const safeHex = (num: any, fallback = "000000") => {
	if (num === null || num === undefined || isNaN(num)) return fallback;
	return num.toString(16).padStart(6, "0");
};

// --- API ---
const API = {
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
			<div style={{
				...s.app,
				background: "#f1f5f9",
				color: "#1e293b",
				padding: "0"
			}}>
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
	const bodyHeight = `calc(100vh - ${headerHeight + (isMobile ? 70 : 0)}px)`;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", margin: "0 auto", overflow: "hidden" }}>
			<header style={{ 
				height: headerHeight,
				display: "flex", alignItems: "center", justifyContent: "space-between",
				padding: "0 20px", background: "white", borderBottom: "1px solid #e2e8f0",
				zIndex: 1000
			}}>
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<span style={{ fontSize: isMobile ? "14px" : "18px", fontWeight: 900, color: "#4f46e5", letterSpacing: "-0.5px" }}>GRIDOS DESIGNER</span>
				</div>
				
				{!isMobile && (
					<nav style={{ display: "flex", gap: "25px" }}>
						{[
							{ id: "grid", label: "BUILDER" },
							{ id: "mirror", label: "MIRROR" },
							{ id: "wifi", label: "WIFI" },
							{ id: "logs", label: "CONSOLE" }
						].map(tab => (
							<button 
								key={tab.id}
								onClick={() => setActiveTab(tab.id as any)} 
								style={{ 
									background: "none", border: "none", fontWeight: 900, fontSize: "11px", cursor: "pointer", 
									color: activeTab === tab.id ? "#4f46e5" : "#64748b",
									borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
									height: headerHeight, transition: "0.2s"
								}}
							>
								{tab.label}
							</button>
						))}
					</nav>
				)}

				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<WifiStatusBadge status={status} onClick={() => setActiveTab("wifi")} isMobile={isMobile} />
				</div>
			</header>

			<main style={{ 
				flex: 1, 
				height: bodyHeight,
				overflow: isMobile ? "hidden" : "auto",
				position: "relative"
			}}>
				{activeTab === "grid" ? <GridTab isMobile={isMobile} width={width} wifiStatus={status} onWifiUpdate={refreshWifi} onSettingsUpdate={handleAPToggle} /> : 
				 activeTab === "mirror" ? <MirrorTab /> :
				 activeTab === "logs" ? <LogsTab isMobile={isMobile} /> :
				 activeTab === "wifi" ? <WifiTab status={status} onRefresh={refreshWifi} onAPToggle={handleAPToggle} /> :
				 null}
			</main>

			{isMobile && (
				<nav style={{ 
					height: "70px", background: "white", borderTop: "1px solid #e2e8f0", 
					display: "flex", alignItems: "center", justifyContent: "space-around",
					zIndex: 10000, paddingBottom: "env(safe-area-inset-bottom)"
				}}>
					{[
						{ id: "grid", label: "Builder", icon: "🛠️" },
						{ id: "mirror", label: "Mirror", icon: "📱" },
						{ id: "wifi", label: "WiFi", icon: "🌐" },
						{ id: "logs", label: "Logs", icon: "🖥️" }
					].map(tab => (
						<button 
							key={tab.id}
							onClick={() => setActiveTab(tab.id as any)}
							style={{ 
								background: "none", border: "none", display: "flex", flexDirection: "column", 
								alignItems: "center", gap: "4px", flex: 1,
								color: activeTab === tab.id ? "#4f46e5" : "#64748b",
								transition: "0.2s"
							}}
						>
							<span style={{ fontSize: "20px" }}>{tab.icon}</span>
							<span style={{ fontSize: "10px", fontWeight: 700 }}>{tab.label}</span>
						</button>
					))}
				</nav>
			)}
		</div>
	);
}

// --- CONSOLE TAB ---
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

// --- WIFI TAB ---
function WifiTab({ status, onRefresh, onAPToggle }: { status: WifiStatus, onRefresh: () => void, onAPToggle: (active?: boolean) => void }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "15px", maxWidth: "800px", margin: "0 auto" }}>
			<div style={s.card}>
				<div style={s.cardTitle}>STATION</div>
				<div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
					<div>
						<div style={s.formLabel}>STATUS</div>
						<div style={{ fontWeight: 900, color: status?.connected ? "#10b981" : "#f43f5e" }}>{status?.connected ? "ONLINE" : "OFFLINE"}</div>
					</div>
					<div style={{ textAlign: "right" }}>
						<div style={s.formLabel}>LOCAL IP</div>
						<div style={{ fontWeight: 900 }}>{status?.ip || "..."}</div>
					</div>
				</div>
			</div>

			<div style={s.card}>
				<div style={s.cardTitle}>ACCESS POINT</div>
				<div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
					<div>
						<div style={s.formLabel}>AP STATUS</div>
						<div style={{ fontWeight: 900, color: status?.ap_active ? "#6366f1" : "#94a3b8" }}>{status?.ap_active ? "BROADCASTING" : "DISABLED"}</div>
					</div>
					<div style={{ textAlign: "right" }}>
						<div style={s.formLabel}>PORTAL IP</div>
						<div style={{ fontWeight: 900 }}>{status?.ap_ip || "192.168.4.1"}</div>
					</div>
				</div>
				<input 
					style={{ ...s.input, width: "100%", marginTop: "15px" }} 
					defaultValue={status?.ap_ssid} 
					onBlur={async e => { await API.updateSettings({ ssid: e.target.value }); onRefresh(); }} 
					placeholder="AP SSID"
				/>
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
	const [width] = useWindowSize();
	const scale = Math.min(1, (width - 40) / 800);
	return (
		<div style={{ display: "flex", flex: 1, height: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
			<div className="device-mirror" style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
				<div className="device-screen"><GridRenderer /></div>
			</div>
		</div>
	);
}

// --- SHARED RENDERER ---
function GridRenderer() {
	const [items, setItems] = useState<GridItem[]>([]);
	const [panels, setPanels] = useState<Panel[]>([]);
	const [bg, setBg] = useState(0x0e0e12);

	useEffect(() => {
		const active = localStorage.getItem("ds_active_scr") || "main";
		const saved = localStorage.getItem(`scr_${active}`);
		if (saved) { const d = JSON.parse(saved); setItems(d.items || []); setBg(d.bg ?? 0x0e0e12); }
		const pL = localStorage.getItem("ds_panels");
		if (pL) setPanels(JSON.parse(pL));
	}, []);

	const renderItem = (it: GridItem) => {
		const color = `#${safeHex(it.color)}`;
		const txt = `#${safeHex(it.textColor)}`;
		const style: React.CSSProperties = { position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h, color: txt, background: color, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 };
		
		if (it.type === "panel-ref") {
			const p = panels.find(pd => pd.id === it.panelId);
			return <div key={it.id} style={{ ...style, background: "none" }}>{p?.elements.map(el => renderItem({ ...el, id: `${it.id}_${el.id}` }))}</div>;
		}
		if (it.type === "clock") return <div key={it.id} style={style}>12:45</div>;
		return <div key={it.id} style={style}>{it.name.toUpperCase()}</div>;
	};

	return <div style={{ width: "100%", height: "100%", background: `#${safeHex(bg)}`, position: "relative" }}>{items.map(it => renderItem(it))}</div>;
}

// --- GRID EDITOR TAB ---
function GridTab({ isMobile, width, wifiStatus, onWifiUpdate, onSettingsUpdate }: { isMobile: boolean, width: number, wifiStatus: WifiStatus, onWifiUpdate: () => void, onSettingsUpdate: (active?: boolean) => void }) {
	const [items, setItems] = useState<GridItem[]>([]);
	const [panels, setPanels] = useState<Panel[]>([]);
	const [activeScreen, setActiveScreen] = useState("main");
	const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [gridBg, setGridBg] = useState(0x0e0e12);
	const [screens, setScreens] = useState<string[]>(["main"]);
	const [showLib, setShowLib] = useState(false);
	const [showEditor, setShowEditor] = useState(false);

	const scale = isMobile ? Math.min(1, (width - 40) / 800) : 1;

	useEffect(() => {
		const sL = localStorage.getItem("ds_scr_list"); if (sL) setScreens(JSON.parse(sL));
		const pL = localStorage.getItem("ds_panels"); if (pL) setPanels(JSON.parse(pL));
		loadScreen("main");
	}, []);

	useEffect(() => { localStorage.setItem("ds_scr_list", JSON.stringify(screens)); }, [screens]);
	useEffect(() => { localStorage.setItem("ds_panels", JSON.stringify(panels)); }, [panels]);

	useEffect(() => {
		if (activeScreen && !editingPanelId) {
			localStorage.setItem(`scr_${activeScreen}`, JSON.stringify({ items, bg: gridBg }));
			localStorage.setItem("ds_active_scr", activeScreen);
		}
	}, [items, gridBg, activeScreen, editingPanelId]);

	const loadScreen = (name: string) => {
		setSelectedIds([]); setEditingPanelId(null);
		const saved = localStorage.getItem(`scr_${name}`);
		const d = saved ? JSON.parse(saved) : { items: [], bg: 0x0e0e12 };
		setItems(d.items || []); setGridBg(d.bg ?? 0x0e0e12);
		setActiveScreen(name);
	};

	const addItem = (type: ElementType, x: number, y: number, panelId?: string) => {
		const newId = `${type}_${Math.random().toString(36).substr(2, 5)}`;
		const w = type === "panel-ref" ? 200 : (type === "slider" ? 180 : (type === "switch" ? 60 : (type === "arc" ? 80 : 120)));
		const h = type === "panel-ref" ? 150 : (type === "slider" ? 24 : (type === "switch" ? 32 : (type === "arc" ? 80 : 40)));
		const newItem: GridItem = { 
			id: newId, name: `New ${type}`, type, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), w, h, 
			textColor: 0xffffff, color: 0x4f46e5, panelId, 
			value: 50, min: 0, max: 100, options: "Item 1\nItem 2\nItem 3" 
		};
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: [...p.elements, newItem] } : p));
		else setItems(prev => [...prev, newItem]);
		setSelectedIds([newId]);
		setShowLib(false);
		setShowEditor(true);
	};

	const updateItem = (id: string, patch: Partial<GridItem>) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.map(el => el.id === id ? { ...el, ...patch } : el) } : p));
		else setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
	};

	const removeItem = (id: string) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.filter(el => el.id !== id) } : p));
		else setItems(prev => prev.filter(it => it.id !== id));
		setSelectedIds([]);
	};

	const syncToDevice = async () => {
		const s1 = await API.savePanels(panels);
		const s2 = await API.saveGrid(activeScreen, { items, bg: gridBg });
		alert((s1 && s2) ? "SYNC OK" : "SYNC FAIL");
	};

	const getActiveList = () => editingPanelId ? (panels.find(p => p.id === editingPanelId)?.elements || []) : items;
	
	const renderWidget = (it: GridItem) => {
		const color = `#${safeHex(it.color)}`;
		const txt = `#${safeHex(it.textColor)}`;
		const baseStyle: React.CSSProperties = { background: it.type === "panel-ref" ? "none" : color, border: "none", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: txt, fontWeight: 900, fontSize: "9px", width: "100%", height: "100%", position: "relative", overflow: "hidden" };
		if (it.type === "panel-ref") {
			const pt = panels.find(pd => pd.id === it.panelId);
			return <div style={{ width: "100%", height: "100%", position: "relative", border: "1px dashed #6366f1", borderRadius: 8, overflow: "hidden" }}>{pt?.elements.map(el => <div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h }}>{renderWidget(el)}</div>)}</div>;
		}
		if (it.type === "switch") return <div style={{ ...baseStyle, borderRadius: 100, background: "#e2e8f0", padding: 3 }}><div style={{ width: "40%", height: "100%", background: it.value ? color : "#94a3b8", borderRadius: "50%", marginLeft: it.value ? "auto" : "0" }} /></div>;
		if (it.type === "slider") return <div style={{ ...baseStyle, background: "#e2e8f0", borderRadius: 100, height: 8 }}><div style={{ position: "absolute", left: `${(it.value||0)}%`, top: "50%", transform: "translate(-50%, -50%)", width: 16, height: 16, background: color, borderRadius: "50%", border: "2px solid #fff" }} /></div>;
		return <div style={baseStyle}>{it.name.toUpperCase()}</div>;
	};

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
		return () => { 
			window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
			window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp);
		};
	}, [dragInfo, scale]);

	return (
		<div style={{ display: "flex", height: "100%", width: "100%", position: "relative" }}>
			{!isMobile && (
				<div style={{ width: "260px", background: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
					<div style={{ padding: "15px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
						<span style={s.cardTitle}>WIDGETS</span>
					</div>
					<div style={{ padding: "15px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
						{["btn", "switch", "slider", "arc", "label", "clock", "bar", "roller"].map(type => (
							<button key={type} onClick={() => addItem(type as any, 50, 50)} style={{ ...s.secondaryBtn, height: "40px", fontSize: "9px" }}>{type.toUpperCase()}</button>
						))}
					</div>
					<div style={{ padding: "15px", borderTop: "1px solid #f1f5f9", flex: 1, overflowY: "auto" }}>
						<span style={s.cardTitle}>SCENE TREE</span>
						<div style={{ marginTop: "10px" }}>
							{getActiveList().map(it => <div key={it.id} onClick={() => { setSelectedIds([it.id]); setShowEditor(true); }} style={{ padding: "6px 10px", background: selectedIds.includes(it.id) ? "rgba(99, 102, 241, 0.1)" : "transparent", cursor: "pointer", borderRadius: "5px", fontSize: "11px", marginBottom: "2px" }}>{it.name}</div>)}
						</div>
					</div>
				</div>
			)}

			<div style={{ flex: 1, background: "#f8fafc", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
				<div style={{ 
					width: "800px", height: "480px", background: `#${safeHex(gridBg)}`, position: "relative",
					transform: `scale(${scale})`, transformOrigin: "center center",
					boxShadow: "0 20px 50px rgba(0,0,0,0.15)"
				}}>
					{getActiveList().map(it => (
						<div key={it.id} 
						  onMouseDown={(e) => { e.stopPropagation(); setSelectedIds([it.id]); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "move" }); }} 
						  onTouchStart={(e) => { e.stopPropagation(); setSelectedIds([it.id]); setDragInfo({ id: it.id, startX: e.touches[0].clientX, startY: e.touches[0].clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "move" }); }} 
						  style={{ position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h, outline: selectedIds.includes(it.id) ? "2px solid #6366f1" : "none", outlineOffset: 2 }}>
							{renderWidget(it)}
							{selectedIds.includes(it.id) && <div onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "resize" }); }} style={{ position: "absolute", right: -4, bottom: -4, width: 12, height: 12, background: "#6366f1", borderRadius: "3px", cursor: "nwse-resize" }} />}
						</div>
					))}
				</div>

				{isMobile && (
					<div style={{ position: "absolute", bottom: "20px", left: "20px", display: "flex", gap: "10px" }}>
						<button onClick={() => setShowLib(true)} style={{ ...s.compactBtn, background: "#4f46e5", color: "white", width: "44px", height: "44px" }}>➕</button>
						<button onClick={() => setShowEditor(true)} style={{ ...s.compactBtn, width: "44px", height: "44px" }}>⚙️</button>
						<button onClick={syncToDevice} style={{ ...s.compactBtn, width: "44px", height: "44px" }}>💾</button>
					</div>
				)}
				{!isMobile && (
					<button onClick={syncToDevice} style={{ position: "absolute", top: "20px", right: "20px", ...s.primaryBtn, padding: "10px 20px" }}>SYNC DEVICE</button>
				)}
			</div>

			{(!isMobile || (selectedItem && showEditor)) && (
				<div style={{ 
					width: isMobile ? "100%" : "260px", 
					background: "white", 
					borderLeft: isMobile ? "none" : "1px solid #e2e8f0",
					position: isMobile ? "fixed" : "static",
					bottom: isMobile ? 0 : "auto", 
					left: 0, right: 0,
					zIndex: 10001,
					maxHeight: isMobile ? "60vh" : "100%",
					overflowY: "auto",
					boxShadow: isMobile ? "0 -10px 40px rgba(0,0,0,0.1)" : "none",
					padding: "20px",
					display: (isMobile && !showEditor) ? "none" : "block"
				}}>
					<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
						<span style={s.cardTitle}>PROPERTIES</span>
						{isMobile && <button onClick={() => setShowEditor(false)} style={{ border: "none", background: "none", fontWeight: 900 }}>✕</button>}
					</div>
					{selectedItem ? (
						<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
							<input style={s.input} value={selectedItem.name} onChange={e => updateItem(selectedItem.id, {name: e.target.value})} placeholder="Name" />
							<div style={{ display: "flex", gap: "10px" }}>
								<div style={{ flex: 1 }}><label style={s.formLabel}>X</label><input type="number" style={s.input} value={selectedItem.x} onChange={e => updateItem(selectedItem.id, {x: parseInt(e.target.value)||0})} /></div>
								<div style={{ flex: 1 }}><label style={s.formLabel}>Y</label><input type="number" style={s.input} value={selectedItem.y} onChange={e => updateItem(selectedItem.id, {y: parseInt(e.target.value)||0})} /></div>
							</div>
							<div style={{ display: "flex", gap: "10px" }}>
								<div style={{ flex: 1 }}><label style={s.formLabel}>W</label><input type="number" style={s.input} value={selectedItem.w} onChange={e => updateItem(selectedItem.id, {w: parseInt(e.target.value)||0})} /></div>
								<div style={{ flex: 1 }}><label style={s.formLabel}>H</label><input type="number" style={s.input} value={selectedItem.h} onChange={e => updateItem(selectedItem.id, {h: parseInt(e.target.value)||0})} /></div>
							</div>
							<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
								<label style={s.formLabel}>COLOR</label>
								<input type="color" value={`#${safeHex(selectedItem.color)}`} onChange={e => updateItem(selectedItem.id, {color: parseInt(e.target.value.substring(1), 16)})} style={{ flex: 1, border: "none", height: "30px" }} />
							</div>
							<button onClick={() => removeItem(selectedItem.id)} style={{ ...s.secondaryBtn, color: "#f43f5e", border: "1px solid #fecaca", marginTop: "10px", height: "40px" }}>DELETE</button>
						</div>
					) : (
						<div style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>SELECT OBJECT</div>
					)}
				</div>
			)}

			{isMobile && showLib && (
				<div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 20000, display: "flex", alignItems: "flex-end" }}>
					<div style={{ background: "white", width: "100%", borderRadius: "20px 20px 0 0", padding: "20px", maxHeight: "80vh", overflowY: "auto" }}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
							<span style={s.cardTitle}>ADD WIDGET</span>
							<button onClick={() => setShowLib(false)} style={{ border: "none", background: "none", fontWeight: 900 }}>✕</button>
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
							{["btn", "switch", "slider", "arc", "label", "clock", "bar", "roller"].map(type => (
								<button key={type} onClick={() => addItem(type as any, 100, 100)} style={{ ...s.secondaryBtn, height: "60px", flexDirection: "column", gap: "5px" }}>
									<div style={{ fontSize: "16px" }}>{type === "btn" ? "🔳" : type === "switch" ? "🔘" : "📦"}</div>
									<div style={{ fontSize: "9px" }}>{type.toUpperCase()}</div>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function WifiStatusBadge({ status, onClick, isMobile }: { status: WifiStatus, onClick: () => void, isMobile?: boolean }) { 
	return (
		<div 
			onClick={onClick}
			style={{ 
				fontSize: "10px", fontWeight: 900, color: status?.connected ? "#10b981" : "#f43f5e", 
				cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
				padding: "4px 12px", borderRadius: "100px", background: "#f8fafc", border: "1px solid #e2e8f0"
			}} 
		>
			<span style={{ fontSize: "12px" }}>●</span>
			{!isMobile && <span>{status?.connected ? (status.ip || "ONLINE") : "OFFLINE"}</span>}
		</div>
	); 
}

interface ErrorBoundaryProps { children: ReactNode; } interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> { constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; } static getDerivedStateFromError(error: Error) { return { hasError: true, error }; } render() { return this.state.hasError ? <div style={{ padding: "40px", background: "#fef2f2" }}><h1>CRASH</h1><pre>{this.state.error?.toString()}</pre></div> : this.props.children; } }

const s: Record<string, React.CSSProperties> = { 
	app: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", userSelect: "none", fontFamily: "sans-serif" }, 
	card: { background: "white", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #e2e8f0" }, 
	primaryBtn: { background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "800", fontSize: "11px" }, 
	secondaryBtn: { background: "white", border: "1px solid #e2e8f0", color: "#475569", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }, 
	compactBtn: { background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" },
	cardTitle: { fontSize: "10px", fontWeight: 900, color: "#1e293b", textTransform: "uppercase", letterSpacing: "1px" }, 
	formLabel: { fontSize: "9px", fontWeight: 900, color: "#94a3b8", display: "block", marginBottom: "3px" }, 
	input: { padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#1e293b", fontSize: "12px", outline: "none" }
};
