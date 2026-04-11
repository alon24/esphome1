import React from "react";
import {
	Component,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

// --- TYPES ---
type WifiStatus = {
	connected: boolean;
	ip: string;
	ssid: string;
} | null;

type ElementType = "btn" | "switch" | "slider" | "label" | "clock" | "panel-ref";

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
	elements?: GridItem[]; 
};

type Panel = {
	id: string;
	name: string;
	w: number;
	h: number;
	elements: GridItem[];
};

type AppExport = {
	screens: Record<string, { items: GridItem[]; bg: number }>;
	panels: Panel[];
	version: string;
	exportedAt: string;
};

// --- CONFIG ---
const BUILD_ID = "v94-CONTEXT-MENU-PRO";

// --- UTILS ---
const safeHex = (num: any, fallback = "000000") => {
	if (num === null || num === undefined || isNaN(num)) return fallback;
	return num.toString(16).padStart(6, "0");
};

// --- API ---
const API = {
	async getWifi() {
		try { const res = await fetch("/api/wifi/status"); return await res.json(); } catch(e) { return null; }
	},
	async getScreens() {
		try { const res = await fetch("/api/grid/screens"); return await res.json(); } catch(e) { return { screens: ["main"] }; }
	},
	async getGrid(name: string) {
		try { const res = await fetch(`/api/grid/config?name=${name}`); return await res.json(); } catch(e) { return null; }
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

// --- CORE APP ---
export default function SafeApp() {
	return (
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	);
}

function App() {
	const [activeTab, setActiveTab] = useState<"grid" | "mirror" | "wifi" | "logs">("grid");
	const [status, setStatus] = useState<WifiStatus>({ connected: true, ip: "127.0.0.1", ssid: "STATION_AP" });
	const [isExportOpen, setIsExportOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);

	useEffect(() => {
		const poll = async () => {
			const s = await API.getWifi();
			if (s) setStatus(s);
		};
		poll();
		const t = setInterval(poll, 5000);
		return () => clearInterval(t);
	}, []);
	
	return (
		<div style={{ ...s.app, padding: "20px", width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
			<header className="glass" style={{ ...s.header, marginBottom: "20px" }}>
				<div style={s.headerLeft}>
					<div onClick={() => window.location.reload()} style={{ display: "flex", flexDirection: "column", cursor: "pointer" }}>
						<span style={{ ...s.headerTitle, animation: "pulseGlow 3s ease-in-out infinite" }}>GRIDOS DESIGNER</span>
						<span style={{ fontSize: "8px", fontWeight: 900, color: "var(--accent)", letterSpacing: "2px", marginTop: "-4px" }}>CORE V2 | {BUILD_ID}</span>
					</div>
					<nav style={s.nav}>
						<button onClick={() => setActiveTab("grid")} style={{ ...s.navBtn, color: activeTab === "grid" ? "var(--primary)" : "var(--text-dim)", borderBottom: activeTab === "grid" ? "2px solid var(--primary)" : "2px solid transparent" }}>BUILDER</button>
						<button onClick={() => setActiveTab("mirror")} style={{ ...s.navBtn, color: activeTab === "mirror" ? "var(--primary)" : "var(--text-dim)", borderBottom: activeTab === "mirror" ? "2px solid var(--primary)" : "2px solid transparent" }}>MIRROR</button>
						<button onClick={() => setActiveTab("wifi")} style={{ ...s.navBtn, color: activeTab === "wifi" ? "var(--primary)" : "var(--text-dim)", borderBottom: activeTab === "wifi" ? "2px solid var(--primary)" : "2px solid transparent" }}>WIFI</button>
						<button onClick={() => setActiveTab("logs")} style={{ ...s.navBtn, color: activeTab === "logs" ? "var(--primary)" : "var(--text-dim)", borderBottom: activeTab === "logs" ? "2px solid var(--primary)" : "2px solid transparent" }}>CONSOLE</button>
					</nav>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<button style={{ ...s.secondaryBtn, padding: "8px 16px", fontSize: "10px" }} onClick={() => setIsExportOpen(true)}>EXPORT</button>
					<button style={{ ...s.secondaryBtn, padding: "8px 16px", fontSize: "10px" }} onClick={() => setIsImportOpen(true)}>IMPORT</button>
					<div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.1)", margin: "0 10px" }} />
					<WifiStatusBadge status={status} />
				</div>
			</header>
			<main style={{ flex: 1, minHeight: 0 }}>
				{activeTab === "grid" ? <GridTab isExportOpen={isExportOpen} setIsExportOpen={setIsExportOpen} isImportOpen={isImportOpen} setIsImportOpen={setIsImportOpen} /> : 
				 activeTab === "mirror" ? <MirrorTab /> :
				 activeTab === "logs" ? <LogsTab /> :
				 <div style={{ padding: "40px", opacity: 0.5, textAlign: "center" }}>MODULE {activeTab.toUpperCase()} ACTIVE</div>}
			</main>
		</div>
	);
}

// --- CONSOLE TAB ---
function LogsTab() {
	const [logs, setLogs] = useState<string[]>([]);
	const scrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const es = new EventSource("/events");
		es.onmessage = (e) => setLogs(prev => [...prev, e.data].slice(-200));
		return () => es.close();
	}, []);
	useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);
	return (
		<div style={{ ...s.glassCard, height: "100%", overflowY: "auto", background: "#050510", padding: "12px", border: "1px solid #1a1a2e" }} ref={scrollRef}>
			<div style={{ color: "var(--accent)", fontSize: "10px", marginBottom: "10px", fontWeight: "900" }}>-- ESP32-S3 REAL-TIME STREAM --</div>
			{logs.map((l, i) => <div key={i} style={{ fontFamily: "monospace", fontSize: "10px", color: i % 2 === 0 ? "#ccc" : "#888", padding: "1px 0" }}>{l}</div>)}
		</div>
	);
}

// --- MIRROR TAB ---
function MirrorTab() {
	return (
		<div style={{ display: "flex", flex: 1, height: "100%", alignItems: "center", justifyContent: "center" }}>
			<div className="device-mirror">
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
function GridTab({ isExportOpen, setIsExportOpen, isImportOpen, setIsImportOpen }: any) {
	const [items, setItems] = useState<GridItem[]>([]);
	const [panels, setPanels] = useState<Panel[]>([]);
	const [activeScreen, setActiveScreen] = useState("main");
	const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [gridBg, setGridBg] = useState(0x0e0e12);
	const [screens, setScreens] = useState<string[]>(["main"]);
	const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);

	// Lifecycle
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

	// Actions
	const loadScreen = (name: string) => {
		setSelectedItemId(null); setEditingPanelId(null);
		const saved = localStorage.getItem(`scr_${name}`);
		const d = saved ? JSON.parse(saved) : { items: [], bg: 0x0e0e12 };
		setItems(d.items || []); setGridBg(d.bg ?? 0x0e0e12);
		setActiveScreen(name);
	};

	const addItem = (type: ElementType, x: number, y: number, panelId?: string) => {
		const newId = `${type}_${Math.random().toString(36).substr(2, 5)}`;
		const w = type === "panel-ref" ? 300 : (type === "slider" ? 200 : (type === "switch" ? 80 : 160));
		const h = type === "panel-ref" ? 200 : (type === "slider" ? 24 : (type === "switch" ? 40 : 50));
		const newItem: GridItem = { id: newId, name: `New ${type}`, type, x: Math.max(0, x), y: Math.max(0, y), w, h, textColor: 0xffffff, color: 0x2c3e50, panelId };
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: [...p.elements, newItem] } : p));
		else setItems(prev => [...prev, newItem]);
		setSelectedItemId(newId);
	};

	const updateItem = (id: string, patch: Partial<GridItem>) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.map(el => el.id === id ? { ...el, ...patch } : el) } : p));
		else setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
	};

	const removeItem = (id: string) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.filter(el => el.id !== id) } : p));
		else setItems(prev => prev.filter(it => it.id !== id));
		setSelectedItemId(null);
	};

	const syncToDevice = async () => {
		const s1 = await API.savePanels(panels);
		const s2 = await API.saveGrid(activeScreen, { items, bg: gridBg });
		alert((s1 && s2) ? "✓ SYNC SUCCESS" : "✗ SYNC ERROR");
	};

	// --- RENDERERS ---
	const getActiveList = () => editingPanelId ? (panels.find(p => p.id === editingPanelId)?.elements || []) : items;
	
	const renderWidget = (it: GridItem) => {
		const color = `#${safeHex(it.color)}`;
		const txt = `#${safeHex(it.textColor)}`;
		
		// Style for the widget itself (common for all types)
		const baseStyle: React.CSSProperties = { 
			background: it.type === "panel-ref" ? "none" : color, 
			border: "none", 
			borderRadius: 12, 
			display: "flex", 
			alignItems: "center", 
			justifyContent: "center", 
			color: txt, 
			fontWeight: 900, 
			fontSize: "10px", 
			boxShadow: it.type === "panel-ref" ? "none" : "0 4px 8px rgba(0,0,0,0.5)",
			width: "100%",
			height: "100%"
		};

		if (it.type === "panel-ref") {
			const p = panels.find(pd => pd.id === it.panelId);
			return (
				<div style={{ width: "100%", height: "100%", position: "relative", border: "2px dashed #10b981", borderRadius: 12, overflow: "hidden" }}>
					<div style={{ position: "absolute", top: 4, left: 8, fontSize: "9px", fontWeight: "900", color: "#10b981", zIndex: 10, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "4px" }}>MASTER: {p?.name.toUpperCase()}</div>
					{p?.elements.map(el => (
						<div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h }}>
							{renderWidget(el)}
						</div>
					))}
				</div>
			);
		}
		
		if (it.type === "clock") return <div style={baseStyle}>12:45</div>;
		if (it.type === "switch") return <div style={{ ...baseStyle, borderRadius: 100, background: "#111", padding: 4 }}><div style={{ width: "70%", height: "100%", background: color, borderRadius: "50%", marginLeft: "auto" }} /></div>;
		return <div style={baseStyle}>{it.name.toUpperCase()}</div>;
	};

	const [dragInfo, setDragInfo] = useState<{ id: string; startX: number; startY: number; initialX: number; initialY: number; initialW: number; initialH: number; mode: "move" | "resize" } | null>(null);
	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragInfo) return;
			const dx = e.clientX - dragInfo.startX;
			const dy = e.clientY - dragInfo.startY;
			if (dragInfo.mode === "move") updateItem(dragInfo.id, { x: Math.max(0, Math.round(dragInfo.initialX + dx)), y: Math.max(0, Math.round(dragInfo.initialY + dy)) });
			else updateItem(dragInfo.id, { w: Math.max(10, Math.round(dragInfo.initialW + dx)), h: Math.max(10, Math.round(dragInfo.initialH + dy)) });
		};
		const onUp = () => setDragInfo(null);
		if (dragInfo) { window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); }
		return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
	}, [dragInfo]);

	const [draggingFromLib, setDraggingFromLib] = useState<{ type: ElementType, panelId?: string } | null>(null);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (selectedItemId && (e.key === "Delete" || e.key === "Backspace")) {
				if (document.activeElement?.tagName === "INPUT") return;
				removeItem(selectedItemId);
			}
		};
		const closeMenu = () => setMenu(null);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("click", closeMenu);
		return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("click", closeMenu); };
	}, [selectedItemId]);

	return (
		<div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr 340px", gap: "20px", height: "100%", overflow: "hidden" }}>
			
			{/* LEFT PANEL: LIBRARY + PROJECT NAV + SCENE TREE */}
			<div style={{ display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
				
				{/* WIDGET LIBRARY on TOP */}
				<div style={{ ...s.glassCard, height: "180px" }}>
					<div style={s.cardTitle}>WIDGET LIBRARY</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "16px" }}>
						{[
							{ type: "btn", label: "BUTTON", icon: "⬚" },
							{ type: "switch", label: "TOGGLE", icon: "◒" },
							{ type: "slider", label: "SLIDE", icon: "▰" },
							{ type: "label", label: "TEXT", icon: "T" },
							{ type: "clock", label: "TIME", icon: "⊙" }
						].map(t => (
							<div 
								key={t.type} draggable 
								onDragStart={() => setDraggingFromLib({ type: t.type as any })} 
								onDragEnd={() => setDraggingFromLib(null)} 
								style={{ padding: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", cursor: "grab", textAlign: "center", transition: "all 0.2s" }} 
								className="glass-hover"
							>
								<div style={{ fontSize: "1.2rem", color: "var(--primary)", marginBottom: "#4px" }}>{t.icon}</div>
								<div style={{ fontSize: "8px", fontWeight: "900", color: "#888", letterSpacing: "1px" }}>{t.label}</div>
							</div>
						))}
					</div>
				</div>

				{/* PROJECT MANAGER BELOW LIBRARY */}
				<div style={{ ...s.glassCard, minHeight: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<div style={s.cardTitle}>PROJECT MANAGER</div>
						<div style={{ display: "flex", gap: "5px" }}>
							<button onClick={() => { const n = prompt("Screen name?"); if (n) setScreens([...screens, n]); }} style={{ ...s.secondaryBtn, padding: "4px 8px", fontSize: "9px" }}>+ SCR</button>
							<button onClick={() => { const id = `p_${Math.random().toString(36).substr(2, 5)}`; const n = prompt("Panel name?"); if (n) { setPanels([...panels, { id, name: n, w: 300, h: 200, elements: [] }]); setEditingPanelId(id); } }} style={{ ...s.secondaryBtn, padding: "4px 8px", fontSize: "9px", borderColor: "var(--accent)" }}>+ PANEL</button>
						</div>
					</div>
					
					<div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
						<div style={{ ...s.formLabel, color: "var(--primary)" }}>SCREENS</div>
						<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
							{screens.map(sn => <div key={sn} onClick={() => loadScreen(sn)} style={{ padding: "6px 12px", background: (activeScreen === sn && !editingPanelId) ? "var(--primary)" : "rgba(255,255,255,0.05)", borderRadius: "8px", cursor: "pointer", fontSize: "10px", fontWeight: 900, transition: "0.2s" }}>{sn.toUpperCase()}</div>)}
						</div>

						<div style={{ ...s.formLabel, color: "var(--accent)", marginTop: "10px" }}>MASTER PANELS</div>
						<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
							{panels.map(p => (
								<div 
									key={p.id} 
									onClick={() => setEditingPanelId(p.id)} 
									onDoubleClick={() => addItem("panel-ref", 40, 40, p.id)}
									draggable onDragStart={() => setDraggingFromLib({ type: "panel-ref", panelId: p.id })}
									style={{ padding: "8px 12px", background: editingPanelId === p.id ? "rgba(0, 206, 209, 0.2)" : "rgba(255,255,255,0.02)", border: editingPanelId === p.id ? "1px solid var(--accent)" : "1px solid transparent", borderRadius: "10px", cursor: "pointer", fontSize: "10px", fontWeight: "900", display: "flex", alignItems: "center", gap: "8px" }}
								>
									<span>📦</span> {p.name}
								</div>
							))}
							{panels.length === 0 && <div style={{ fontSize: "9px", opacity: 0.3, textAlign: "center" }}>NO MASTERS</div>}
						</div>
					</div>
				</div>
				
				{/* SCENE TREE on BOTTOM */}
				<div style={{ ...s.glassCard, flex: 1, display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden" }}>
					<div style={s.cardTitle}>SCENE TREE</div>
					<div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px", marginTop: "10px" }} onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}>
						<div style={{ padding: "8px 12px", background: "rgba(139,92,246,0.1)", borderRadius: "8px", marginBottom: "8px", border: "1px solid rgba(139,92,246,0.2)" }}>
							<span style={{ fontSize: "10px", fontWeight: "900", color: "var(--primary)" }}>CONTEXT: {editingPanelId ? "MASTER PANEL" : "SCREEN"}</span>
						</div>
						{getActiveList().map(it => (
							<React.Fragment key={it.id}>
								<div 
									onClick={() => setSelectedItemId(it.id)} 
									style={{ 
										padding: "10px", 
										paddingLeft: "20px", 
										background: selectedItemId === it.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.01)", 
										border: it.type === "panel-ref" ? "1px dashed #10b981" : (selectedItemId === it.id ? "1px solid var(--primary)" : "1px solid transparent"),
										borderRadius: "10px", 
										cursor: "pointer", 
										display: "flex", 
										justifyContent: "space-between", 
										alignItems: "center", 
										transition: "all 0.2s",
										marginBottom: "2px"
									}}
								>
									<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
										<span style={{ fontSize: "14px", color: it.type === "panel-ref" ? "#10b981" : "var(--primary)" }}>{it.type === "panel-ref" ? "📦" : "📄"}</span>
										<span style={{ fontSize: "11px", fontWeight: "900", color: it.type === "panel-ref" ? "#10b981" : "#fff" }}>{it.name}</span>
									</div>
									{selectedItemId === it.id && <button onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontWeight: "900", fontSize: "10px" }}>DEL</button>}
								</div>
								{it.type === "panel-ref" && (
									<div style={{ marginLeft: "40px", borderLeft: "1px dashed rgba(255,255,255,0.1)", paddingLeft: "10px", display: "flex", flexDirection: "column", gap: "2px" }}>
										{(panels.find(p => p.id === it.panelId)?.elements || []).map(child => (
											<div key={child.id} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", fontSize: "9px", color: "#aaa", display: "flex", alignItems: "center", gap: "8px" }}>
												<span>∟</span>
												<span>{child.type.toUpperCase()}:</span>
												<span style={{ color: "#fff" }}>{child.name}</span>
											</div>
										))}
									</div>
								)}
							</React.Fragment>
						))}
						{getActiveList().length === 0 && <div style={{ opacity: 0.3, fontSize: "10px", textAlign: "center", marginTop: "40px" }}>EMPTY CANVAS</div>}
					</div>
				</div>
			</div>

			{/* CENTER: CANVAS */}
			<div style={{ display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px" }}>
					<span style={{ fontSize: "12px", fontWeight: 900, color: "var(--text-dim)" }}>{editingPanelId ? `[PANEL] ${editingPanelId}` : `[SCREEN] ${activeScreen}`}</span>
					<button style={s.primaryBtn} onClick={syncToDevice}>SAVE TO DEVICE</button>
				</div>
				<div 
					onDragOver={e => e.preventDefault()}
					onDrop={e => {
						e.preventDefault(); if (!draggingFromLib) return;
						const r = e.currentTarget.getBoundingClientRect();
						addItem(draggingFromLib.type, e.clientX-r.left-40, e.clientY-r.top-20, draggingFromLib.panelId);
					}}
					onContextMenu={e => {
						e.preventDefault();
						setMenu({ x: e.clientX, y: e.clientY });
					}}
					style={{ flex: 1, background: "#050510", borderRadius: "32px", border: "1px solid #111", overflow: "auto", position: "relative" }}
				>
					<div id="canvas-surface" style={{ width: "2400px", height: "3200px", position: "relative", background: `#${safeHex(gridBg)}` }} onMouseDown={() => setSelectedItemId(null)}>
						{/* Origin Indicator for Panels */}
						{editingPanelId && (
							<div style={{ position: "absolute", top: 0, left: 0, zIndex: 1000, pointerEvents: "none" }}>
								<div style={{ position: "absolute", top: -1, left: -1, width: "40px", height: "1px", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
								<div style={{ position: "absolute", top: -1, left: -1, width: "1px", height: "40px", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
								<div style={{ position: "absolute", top: 10, left: 10, fontSize: "10px", fontWeight: "900", color: "#10b981", textShadow: "0 0 5px #000" }}>ORIGIN (0,0)</div>
							</div>
						)}

						{Array.from({ length: 8 }).map((_, i) => {
							const h = 420; // usable height per page
							return (
								<div key={i} style={{ position: "absolute", top: (i + 1) * h, left: 0, right: 0, height: "1px", borderTop: "1px dashed rgba(255,255,255,0.15)", pointerEvents: "none", zIndex: 5 }}>
									<span style={{ position: "absolute", top: 4, left: 10, fontSize: "9px", fontWeight: "900", color: "rgba(255,255,255,0.2)", letterSpacing: "1px" }}>PAGE {i+2} START</span>
								</div>
							);
						})}
						{getActiveList().map(it => (
							<div key={it.id} onMouseDown={(e) => { e.stopPropagation(); setSelectedItemId(it.id); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "move" }); }} style={{ position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h, outline: selectedItemId === it.id ? "3px solid var(--primary)" : "none", outlineOffset: 2, borderRadius: 12, zIndex: selectedItemId === it.id ? 100 : 1 }}>
								{renderWidget(it)}
								{selectedItemId === it.id && <div onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "resize" }); }} style={{ position: "absolute", right: -10, bottom: -10, width: 24, height: 24, background: "var(--primary)", borderRadius: "50%", cursor: "nwse-resize", border: "3px solid #fff" }} />}
							</div>
						))}
						{getActiveList().some(it => it.y + it.h > 460) && (
							<div style={{ position: "sticky", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(139,92,246,0.9)", padding: "8px 20px", borderRadius: "100px", color: "#fff", fontSize: "10px", fontWeight: "900", boxShadow: "0 0 20px rgba(139,92,246,0.5)", zIndex: 1000, pointerEvents: "none", animation: "pulseGlow 2s infinite" }}>
								↓ SCROLL FOR MORE CONTENT
							</div>
						)}
					</div>
				</div>
			</div>

			{/* RIGHT: PROPERTIES */}
			<div style={{ display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
				<div style={{ ...s.glassCard, flex: 1 }}>
					<div style={s.cardTitle}>PROPERTIES</div>
					<div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }} onMouseDown={e => e.stopPropagation()}>
						{selectedItemId ? (
							<>
								<div style={s.formGroup}><label style={s.formLabel}>NAME</label><input style={s.input} value={getActiveList().find(it=>it.id===selectedItemId)?.name} onChange={e => updateItem(selectedItemId, {name: e.target.value})} /></div>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
									<div style={s.formGroup}><label style={s.formLabel}>X</label><input type="number" style={s.input} value={getActiveList().find(it=>it.id===selectedItemId)?.x} onChange={e => updateItem(selectedItemId, {x: parseInt(e.target.value)||0})} /></div>
									<div style={s.formGroup}><label style={s.formLabel}>Y</label><input type="number" style={s.input} value={getActiveList().find(it=>it.id===selectedItemId)?.y} onChange={e => updateItem(selectedItemId, {y: parseInt(e.target.value)||0})} /></div>
								</div>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
									<div style={s.formGroup}><label style={s.formLabel}>WIDTH</label><input type="number" style={s.input} value={getActiveList().find(it=>it.id===selectedItemId)?.w} onChange={e => updateItem(selectedItemId, {w: parseInt(e.target.value)||0})} /></div>
									<div style={s.formGroup}><label style={s.formLabel}>HEIGHT</label><input type="number" style={s.input} value={getActiveList().find(it=>it.id===selectedItemId)?.h} onChange={e => updateItem(selectedItemId, {h: parseInt(e.target.value)||0})} /></div>
								</div>
								<button onClick={() => removeItem(selectedItemId)} style={{ ...s.secondaryBtn, color: "#f87171", border: "1px solid rgba(248,113,113,0.3)", width: "100%", marginTop: "20px" }}>DELETE OBJECT</button>
							</>
						) : <div style={{ opacity: 0.3, textAlign: "center" }}>SELECT AN OBJECT</div>}
					</div>
				</div>
			</div>

			{/* CONTEXT MENU */}
			{menu && (
				<div style={{ position: "fixed", top: menu.y, left: menu.x, background: "rgba(10,10,20,0.95)", border: "1px solid var(--primary)", borderRadius: "12px", padding: "8px", zIndex: 10000, minWidth: "160px", backdropFilter: "blur(20px)", boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }}>
					<div style={{ fontSize: "8px", fontWeight: 900, color: "var(--primary)", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "4px" }}>INSERT WIDGET</div>
					{["btn", "switch", "slider", "label", "clock"].map(t => (
						<div key={t} onClick={() => { 
							const r = document.getElementById("canvas-surface")?.getBoundingClientRect();
							if (r) addItem(t as any, menu.x - r.left - 40, menu.y - r.top - 20);
							setMenu(null);
						}} style={{ padding: "8px 12px", cursor: "pointer", fontSize: "10px", fontWeight: "900", borderRadius: "6px" }} className="menu-item-hover">{t.toUpperCase()}</div>
					))}
					<div style={{ fontSize: "8px", fontWeight: 900, color: "var(--accent)", padding: "4px 8px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "4px", marginBottom: "4px" }}>INSERT PANEL</div>
					{panels.map(p => (
						<div key={p.id} onClick={() => { 
							const r = document.getElementById("canvas-surface")?.getBoundingClientRect();
							if (r) addItem("panel-ref", menu.x - r.left - 40, menu.y - r.top - 20, p.id);
							setMenu(null);
						}} style={{ padding: "8px 12px", cursor: "pointer", fontSize: "10px", fontWeight: "900", borderRadius: "6px" }} className="menu-item-hover">📦 {p.name.toUpperCase()}</div>
					))}
				</div>
			)}
		</div>
	);
}

function WifiStatusBadge({ status }: { status: WifiStatus }) { return <div style={{ fontSize: "10px", fontWeight: 900, color: status?.connected ? "var(--accent)" : "#f44" }}>● {status?.connected ? "ONLINE" : "OFFLINE"}</div>; }

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; }
	static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
	render() { return this.state.hasError ? <div style={{ padding: "40px", background: "#200", color: "#fff" }}><h1>ERROR</h1><pre>{this.state.error?.toString()}</pre></div> : this.props.children; }
}

const s: Record<string, React.CSSProperties> = {
	app: { transition: "all 0.3s ease", display: "flex", flexDirection: "column", height: "100vh", background: "#06060c", color: "#e2e8f0" },
	glassCard: { background: "rgba(10, 10, 20, 0.7)", backdropFilter: "blur(40px)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "24px", padding: "20px" },
	primaryBtn: { background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", color: "white", border: "none", padding: "12px 24px", borderRadius: "14px", cursor: "pointer", fontWeight: "900", fontSize: "10px" },
	secondaryBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 16px", borderRadius: "12px", cursor: "pointer" },
	header: { display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" },
	headerLeft: { display: "flex", alignItems: "center", gap: 40 },
	headerTitle: { fontWeight: 900, fontSize: "14px", color: "var(--primary)", letterSpacing: "2px" },
	nav: { display: "flex", gap: 30 },
	navBtn: { background: "none", border: "none", fontWeight: 900, fontSize: "11px", cursor: "pointer", color: "inherit", height: "60px" },
	cardTitle: { fontSize: "10px", fontWeight: 900, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "2px" },
	formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
	formLabel: { fontSize: "9px", fontWeight: 900, color: "var(--text-dim)" },
	input: { padding: "12px", background: "#000", border: "1px solid #222", borderRadius: "10px", color: "#fff", fontSize: "12px" },
};
