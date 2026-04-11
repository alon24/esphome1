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
	ap_active?: boolean;
	ap_always_on?: boolean;
	ap_ssid?: string;
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
const BUILD_ID = "v97-STANDALONE-WIFI";

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
	async toggleAP(active: boolean, always_on: boolean, ssid?: string, password?: string) {
		try { 
			await fetch("/api/wifi/ap", {
				method: "POST",
				body: JSON.stringify({ active, always_on, ssid, password }),
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
	const [status, setStatus] = useState<WifiStatus>({ connected: true, ip: "127.0.0.1", ssid: "STATION", ap_active: false, ap_always_on: false });

	const refreshWifi = async () => {
		const s = await API.getWifi();
		if (s) setStatus(s);
	};

	useEffect(() => {
		refreshWifi();
		const t = setInterval(refreshWifi, 5000);
		return () => clearInterval(t);
	}, []);
	
	const handleAPToggle = async () => {
		const newState = !status?.ap_active;
		const success = await API.toggleAP(newState, status?.ap_always_on || false);
		if (success) refreshWifi();
	};

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
				<div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
					<button 
						onClick={() => setActiveTab("wifi")}
						title={status?.ap_active ? "Standalone AP is ACTIVE" : "Standalone AP is INACTIVE"}
						style={{ ...s.secondaryBtn, background: status?.ap_active ? "rgba(0, 206, 209, 0.2)" : "transparent", borderColor: status?.ap_active ? "var(--accent)" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px" }}
					>
						<span style={{ fontSize: "14px", filter: status?.ap_active ? "none" : "grayscale(1) opacity(0.5)" }}>📡</span>
						<span style={{ fontSize: "9px", fontWeight: 900 }}>{status?.ap_active ? "AP READY" : "AP STOPPED"}</span>
					</button>
					<WifiStatusBadge status={status} />
				</div>
			</header>
			<main style={{ flex: 1, minHeight: 0 }}>
				{activeTab === "grid" ? <GridTab wifiStatus={status} onWifiUpdate={refreshWifi} /> : 
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
function GridTab({ wifiStatus, onWifiUpdate }: { wifiStatus: WifiStatus, onWifiUpdate: () => void }) {
	const [items, setItems] = useState<GridItem[]>([]);
	const [panels, setPanels] = useState<Panel[]>([]);
	const [activeScreen, setActiveScreen] = useState("main");
	const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [gridBg, setGridBg] = useState(0x0e0e12);
	const [screens, setScreens] = useState<string[]>(["main"]);
	const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);
	const [selection, setSelection] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

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
		setSelectedIds([]); setEditingPanelId(null);
		const saved = localStorage.getItem(`scr_${name}`);
		const d = saved ? JSON.parse(saved) : { items: [], bg: 0x0e0e12 };
		setItems(d.items || []); setGridBg(d.bg ?? 0x0e0e12);
		setActiveScreen(name);
	};

	const addItem = (type: ElementType, x: number, y: number, panelId?: string) => {
		const newId = `${type}_${Math.random().toString(36).substr(2, 5)}`;
		const w = type === "panel-ref" ? 300 : (type === "slider" ? 200 : (type === "switch" ? 80 : (type === "arc" ? 100 : 160)));
		const h = type === "panel-ref" ? 200 : (type === "slider" ? 24 : (type === "switch" ? 40 : (type === "arc" ? 100 : 50)));
		const newItem: GridItem = { 
			id: newId, name: `New ${type}`, type, x: Math.max(0, x), y: Math.max(0, y), w, h, 
			textColor: 0xffffff, color: 0x2c3e50, panelId, 
			value: 50, min: 0, max: 100, options: "Item 1\nItem 2\nItem 3" 
		};
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: [...p.elements, newItem] } : p));
		else setItems(prev => [...prev, newItem]);
		setSelectedIds([newId]);
	};

	const updateItem = (id: string, patch: Partial<GridItem>) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.map(el => el.id === id ? { ...el, ...patch } : el) } : p));
		else setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
	};

	const removeItem = (id: string) => {
		if (editingPanelId) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, elements: p.elements.filter(el => el.id !== id) } : p));
		else setItems(prev => prev.filter(it => it.id !== id));
		setSelectedIds(prev => prev.filter(cur => cur !== id));
	};

	const alignElements = (mode: "left" | "top" | "right" | "bottom" | "centerX" | "centerY") => {
		const targeted = getActiveList().filter(it => selectedIds.includes(it.id));
		if (targeted.length < 2) return;
		let val = 0;
		if (mode === "left") val = Math.min(...targeted.map(it => it.x));
		if (mode === "top") val = Math.min(...targeted.map(it => it.y));
		if (mode === "right") val = Math.max(...targeted.map(it => it.x + it.w));
		if (mode === "bottom") val = Math.max(...targeted.map(it => it.y + it.h));
		if (mode === "centerX") val = targeted[0].x + targeted[0].w / 2;
		if (mode === "centerY") val = targeted[0].y + targeted[0].h / 2;
		targeted.forEach(it => {
			const patch: Partial<GridItem> = {};
			if (mode === "left") patch.x = val; if (mode === "top") patch.y = val;
			if (mode === "right") patch.x = val - it.w; if (mode === "bottom") patch.y = val - it.h;
			if (mode === "centerX") patch.x = val - it.w / 2; if (mode === "centerY") patch.y = val - it.h / 2;
			updateItem(it.id, patch);
		});
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
		const baseStyle: React.CSSProperties = { background: it.type === "panel-ref" ? "none" : color, border: "none", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: txt, fontWeight: 900, fontSize: "10px", boxShadow: it.type === "panel-ref" ? "none" : "0 4px 8px rgba(0,0,0,0.5)", width: "100%", height: "100%", position: "relative", overflow: "hidden" };
		if (it.type === "panel-ref") {
			const p = panels.find(pd => pd.id === it.panelId);
			return <div style={{ width: "100%", height: "100%", position: "relative", border: "2px dashed #10b981", borderRadius: 12, overflow: "hidden" }}><div style={{ position: "absolute", top: 4, left: 8, fontSize: "9px", fontWeight: "900", color: "#10b981", zIndex: 10, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "4px" }}>MASTER: {p?.name.toUpperCase()}</div>{p?.elements.map(el => <div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h }}>{renderWidget(el)}</div>)}</div>;
		}
		if (it.type === "clock") return <div style={baseStyle}>12:45</div>;
		if (it.type === "switch") return <div style={{ ...baseStyle, borderRadius: 100, background: "#111", padding: 4 }}><div style={{ width: "40%", height: "100%", background: it.value ? color : "#333", borderRadius: "50%", marginLeft: it.value ? "auto" : "0", transition: "0.2s" }} /></div>;
		if (it.type === "arc") return <div style={{ ...baseStyle, background: "none", boxShadow: "none" }}><div style={{ width: "80%", height: "80%", borderRadius: "50%", border: `6px solid ${color}`, borderTopColor: "transparent", transform: `rotate(${(it.value||0)*2.4 - 120}deg)`, transition: "0.2s" }} /></div>;
		if (it.type === "checkbox") return <div style={{ ...baseStyle, justifyContent: "flex-start", padding: "0 10px", gap: "10px" }}><div style={{ width: 14, height: 14, border: `2px solid ${txt}`, borderRadius: 4, background: it.value ? color : "none" }}>{it.value ? "✓" : ""}</div> {it.name.toUpperCase()}</div>;
		if (it.type === "dropdown") return <div style={{ ...baseStyle, justifyContent: "space-between", padding: "0 12px" }}>{(it.options?.split("\n")[0] || "SELECT").toUpperCase()} <span>▼</span></div>;
		if (it.type == "roller") {
			const opts = it.options?.split("\n") || ["ITEM 1", "ITEM 2", "ITEM 3"];
			return (
				<div style={{ ...baseStyle, flexDirection: "column", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
					<div style={{ opacity: 0.3, fontSize: "9px" }}>{opts[0]}</div>
					<div style={{ color: "var(--primary)", fontSize: "11px", fontWeight: "900", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)", width: "100%", textAlign: "center", padding: "2px 0" }}>{(opts[1] || opts[0]).toUpperCase()}</div>
					<div style={{ opacity: 0.3, fontSize: "9px" }}>{opts[2] || "..."}</div>
				</div>
			);
		}
		if (it.type === "bar") return <div style={{ ...baseStyle, background: "#111", padding: 4 }}><div style={{ width: `${(it.value||0)}%`, height: "100%", background: color, borderRadius: 8, transition: "0.2s" }} /></div>;
		if (it.type === "slider") return <div style={{ ...baseStyle, background: "#111", borderRadius: 100, height: 12 }}><div style={{ position: "absolute", left: `${(it.value||0)}%`, top: "50%", transform: "translate(-50%, -50%)", width: 20, height: 20, background: color, borderRadius: "50%", boxShadow: "0 0 10px rgba(0,0,0,0.5)" }} /></div>;
		return <div style={baseStyle}>{it.name.toUpperCase()}</div>;
	};

	const [dragInfo, setDragInfo] = useState<{ id: string; startX: number; startY: number; initialX: number; initialY: number; initialW: number; initialH: number; mode: "move" | "resize" } | null>(null);
	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (dragInfo) {
				const dx = e.clientX - dragInfo.startX; const dy = e.clientY - dragInfo.startY;
				if (dragInfo.mode === "move") updateItem(dragInfo.id, { x: Math.max(0, Math.round(dragInfo.initialX + dx)), y: Math.max(0, Math.round(dragInfo.initialY + dy)) });
				else updateItem(dragInfo.id, { w: Math.max(10, Math.round(dragInfo.initialW + dx)), h: Math.max(10, Math.round(dragInfo.initialH + dy)) });
			} else if (selection) { const r = document.getElementById("canvas-surface")?.getBoundingClientRect(); if (r) setSelection(prev => prev ? { ...prev, x2: e.clientX - r.left, y2: e.clientY - r.top } : null); }
		};
		const onUp = () => {
			if (selection) {
				const xMin = Math.min(selection.x1, selection.x2); const xMax = Math.max(selection.x1, selection.x2);
				const yMin = Math.min(selection.y1, selection.y2); const yMax = Math.max(selection.y1, selection.y2);
				const inside = getActiveList().filter(it => it.x >= xMin && it.x + it.w <= xMax && it.y >= yMin && it.y + it.h <= yMax).map(it => it.id);
				if (inside.length > 0) setSelectedIds(inside); setSelection(null);
			}
			setDragInfo(null);
		};
		window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
		return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
	}, [dragInfo, selection]);

	const [draggingFromLib, setDraggingFromLib] = useState<{ type: ElementType, panelId?: string } | null>(null);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (selectedIds.length > 0 && (e.key === "Delete" || e.key === "Backspace")) { if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return; selectedIds.forEach(id => removeItem(id)); }
		};
		const closeMenu = () => setMenu(null);
		window.addEventListener("keydown", handleKeyDown); window.addEventListener("click", closeMenu);
		return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("click", closeMenu); };
	}, [selectedIds]);

	const selectedItem = selectedIds.length === 1 ? getActiveList().find(it => it.id === selectedIds[0]) : null;

	return (
		<div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr 340px", gap: "20px", height: "100%", overflow: "hidden" }}>
			<div style={{ display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
				<div style={{ ...s.glassCard, height: "300px", display: "flex", flexDirection: "column" }}>
					<div style={s.cardTitle}>WIDGET LIBRARY</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "16px", overflowY: "auto", flex: 1, position: "relative" }}>
						{[
							{ type: "btn", label: "BUTTON", icon: "⬚" },
							{ type: "switch", label: "TOGGLE", icon: "◒" },
							{ type: "slider", label: "SLIDE", icon: "▰" },
							{ type: "arc", label: "ARC", icon: "◔" },
							{ type: "checkbox", label: "CHECK", icon: "☑" },
							{ type: "dropdown", label: "DROP", icon: "▼" },
							{ type: "roller", label: "ROLL", icon: "≡" },
							{ type: "bar", label: "BAR", icon: "▂" },
							{ type: "label", label: "TEXT", icon: "T" },
							{ type: "clock", label: "TIME", icon: "⊙" }
						].map(t => (
							<div key={t.type} draggable onDragStart={() => setDraggingFromLib({ type: t.type as any })} onDragEnd={() => setDraggingFromLib(null)} onDoubleClick={() => addItem(t.type as any, 40, 40)} style={{ padding: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", cursor: "grab", textAlign: "center" }} className="glass-hover">
								<div style={{ fontSize: "1.2rem", color: "var(--primary)", marginBottom: "4px" }}>{t.icon}</div>
								<div style={{ fontSize: "8px", fontWeight: "900", color: "#888" }}>{t.label}</div>
							</div>
						))}
						<div style={{ position: "absolute", bottom: 4, right: 4, fontSize: "8px", fontWeight: "900", color: "var(--primary)", opacity: 0.4, animation: "bounceX 2s infinite" }}>SCROLL →</div>
					</div>
				</div>
				<div style={{ ...s.glassCard, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
					<div style={s.cardTitle}>SCENE TREE</div>
					<div style={{ flex: 1, overflowY: "auto", marginTop: "10px" }}>
						{getActiveList().map(it => <div key={it.id} onClick={(e) => { e.stopPropagation(); if (e.shiftKey) setSelectedIds(prev => [...prev, it.id]); else setSelectedIds([it.id]); }} style={{ padding: "8px 12px", background: selectedIds.includes(it.id) ? "rgba(139,92,246,0.2)" : "transparent", borderRadius: "8px", fontSize: "10px", fontWeight: "900", marginBottom: "2px", cursor: "pointer" }}>{it.type.toUpperCase()}: {it.name}</div>)}
					</div>
				</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px" }}>
					<span style={{ fontSize: "12px", fontWeight: 900, color: "var(--text-dim)" }}>{editingPanelId ? `[MASTER] ${editingPanelId}` : `[SCREEN] ${activeScreen}`}</span>
					<div style={{ display: "flex", gap: "10px" }}>
						<button style={s.secondaryBtn} onClick={() => { const n = prompt("Screen name?"); if (n) { setScreens([...screens, n]); loadScreen(n); } }}>+ SCREEN</button>
						<button style={{ ...s.secondaryBtn, borderColor: "var(--accent)" }} onClick={() => { const id = `p_${Math.random().toString(36).substr(2, 5)}`; const n = prompt("Panel name?"); if (n) { setPanels([...panels, { id, name: n, w: 300, h: 200, elements: [] }]); setEditingPanelId(id); } }}>+ PANEL</button>
						<button style={s.primaryBtn} onClick={syncToDevice}>SYNC TO DEVICE</button>
					</div>
				</div>
				<div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!draggingFromLib) return; const r = e.currentTarget.getBoundingClientRect(); addItem(draggingFromLib.type, e.clientX-r.left-40, e.clientY-r.top-20, draggingFromLib.panelId); }} onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }} style={{ flex: 1, background: "#050510", borderRadius: "32px", border: "1px solid #111", overflow: "auto", position: "relative" }}>
					<div id="canvas-surface" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSelectedIds([]); const r = e.currentTarget.getBoundingClientRect(); setSelection({ x1: e.clientX - r.left, y1: e.clientY - r.top, x2: e.clientX - r.left, y2: e.clientY - r.top }); } }} style={{ width: "2400px", height: "3200px", position: "relative", background: `#${safeHex(gridBg)}` }}>
						{Array.from({ length: 10 }).map((_, i) => (<div key={i} style={{ position: "absolute", top: (i + 1) * 420, left: 0, right: 0, height: "1px", borderTop: "1px dashed rgba(255,255,255,0.05)", pointerEvents: "none" }} />))}
						{getActiveList().map(it => (
							<div key={it.id} onMouseDown={(e) => { e.stopPropagation(); if (it.id && !e.shiftKey && !selectedIds.includes(it.id)) setSelectedIds([it.id]); else if (e.shiftKey) setSelectedIds(prev => prev.includes(it.id) ? prev.filter(cur => cur !== it.id) : [...prev, it.id]); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "move" }); }} style={{ position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h, outline: selectedIds.includes(it.id) ? "3px solid var(--primary)" : "none", outlineOffset: 2, borderRadius: 12, zIndex: selectedIds.includes(it.id) ? 100 : 1 }}>
								{renderWidget(it)}
								{selectedIds.length === 1 && selectedIds[0] === it.id && <div onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ id: it.id, startX: e.clientX, startY: e.clientY, initialX: it.x, initialY: it.y, initialW: it.w, initialH: it.h, mode: "resize" }); }} style={{ position: "absolute", right: -5, bottom: -5, width: 14, height: 14, background: "var(--primary)", borderRadius: "50%", cursor: "nwse-resize", border: "2px solid #fff" }} />}
							</div>
						))}
						{selection && <div style={{ position: "absolute", border: "1px solid var(--primary)", background: "rgba(139,92,246,0.1)", left: Math.min(selection.x1, selection.x2), top: Math.min(selection.y1, selection.y2), width: Math.abs(selection.x2 - selection.x1), height: Math.abs(selection.y2 - selection.y1), pointerEvents: "none", zIndex: 1000 }} />}
					</div>
				</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
				<div style={{ ...s.glassCard, flex: 1, overflowY: "auto" }}>
					<div style={s.cardTitle}>PROPERTY EDITOR</div>
					<div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }} onMouseDown={e => e.stopPropagation()}>
						{selectedItem ? (
							<>
								<div style={s.formGroup}><label style={s.formLabel}>ID: <span style={{ color: "#555" }}>{selectedItem.id}</span></label></div>
								<div style={s.formGroup}><label style={s.formLabel}>ITEM TYPE</label>
									<select style={s.input} value={selectedItem.type} onChange={e => updateItem(selectedItem.id, {type: e.target.value as any})}>
										{["btn", "switch", "slider", "arc", "checkbox", "dropdown", "roller", "bar", "label", "clock"].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
									</select>
								</div>
								<div style={s.formGroup}><label style={s.formLabel}>LABEL / NAME</label><input style={s.input} value={selectedItem.name} onChange={e => updateItem(selectedItem.id, {name: e.target.value})} /></div>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}><div style={s.formGroup}><label style={s.formLabel}>X</label><input type="number" style={s.input} value={selectedItem.x} onChange={e => updateItem(selectedItem.id, {x: parseInt(e.target.value)||0})} /></div><div style={s.formGroup}><label style={s.formLabel}>Y</label><input type="number" style={s.input} value={selectedItem.y} onChange={e => updateItem(selectedItem.id, {y: parseInt(e.target.value)||0})} /></div></div>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}><div style={s.formGroup}><label style={s.formLabel}>WIDTH</label><input type="number" style={s.input} value={selectedItem.w} onChange={e => updateItem(selectedItem.id, {w: parseInt(e.target.value)||0})} /></div><div style={s.formGroup}><label style={s.formLabel}>HEIGHT</label><input type="number" style={s.input} value={selectedItem.h} onChange={e => updateItem(selectedItem.id, {h: parseInt(e.target.value)||0})} /></div></div>
								<div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "10px 0" }} />
								{["arc", "slider", "bar", "checkbox", "switch"].includes(selectedItem.type) && <div style={s.formGroup}><label style={s.formLabel}>HARDWARE STATE / VAL</label><input type="range" min={selectedItem.min||0} max={selectedItem.max||100} style={{ width: "100%" }} value={selectedItem.value||0} onChange={e => updateItem(selectedItem.id, {value: parseInt(e.target.value)})} /><div style={{ fontSize: "10px", textAlign: "right", marginTop: "4px" }}>{selectedItem.value}</div></div>}
								{["dropdown", "roller"].includes(selectedItem.type) && <div style={s.formGroup}><label style={s.formLabel}>OPTIONS (NEWLINE SEP)</label><textarea style={{ ...s.input, minHeight: "80px" }} value={selectedItem.options} onChange={e => updateItem(selectedItem.id, {options: e.target.value})} /></div>}
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}><div style={s.formGroup}><label style={s.formLabel}>MAIN COLOR</label><div style={{ display: "flex", gap: "8px" }}><div style={{ width: 24, height: 24, borderRadius: 6, background: `#${safeHex(selectedItem.color)}`, border: "1px solid #444" }} /><input type="text" style={{ ...s.input, flex: 1, padding: "4px 8px" }} value={safeHex(selectedItem.color)} onChange={e => updateItem(selectedItem.id, {color: parseInt(e.target.value, 16)})} /></div></div><div style={s.formGroup}><label style={s.formLabel}>TEXT COLOR</label><div style={{ display: "flex", gap: "8px" }}><div style={{ width: 24, height: 24, borderRadius: 6, background: `#${safeHex(selectedItem.textColor)}`, border: "1px solid #444" }} /><input type="text" style={{ ...s.input, flex: 1, padding: "4px 8px" }} value={safeHex(selectedItem.textColor)} onChange={e => updateItem(selectedItem.id, {textColor: parseInt(e.target.value, 16)})} /></div></div></div>
								<div style={s.formGroup}><label style={s.formLabel}>ACTION / KEY</label><input style={s.input} value={selectedItem.action} onChange={e => updateItem(selectedItem.id, {action: e.target.value})} /></div>
								<button onClick={() => removeItem(selectedItem.id)} style={{ ...s.secondaryBtn, color: "#f87171", border: "1px solid rgba(248,113,113,0.3)", width: "100%", marginTop: "20px" }}>DELETE OBJECT</button>
							</>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
								<div style={s.formGroup}><label style={s.formLabel}>SCREEN BACKGROUND</label><div style={{ display: "flex", gap: "8px" }}><div style={{ width: 32, height: 32, borderRadius: 8, background: `#${safeHex(gridBg)}`, border: "1px solid #444" }} /><input type="text" style={{ ...s.input, flex: 1 }} value={safeHex(gridBg)} onChange={e => setGridBg(parseInt(e.target.value, 16))} /></div></div>
								<div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
								<div style={s.cardTitle}>WIFI AP SETTINGS</div>
								<div style={{ display: "flex", alignItems: "center", gap: "10px" }}><input type="checkbox" checked={wifiStatus?.ap_always_on} onChange={async e => { const success = await API.toggleAP(wifiStatus?.ap_active || false, e.target.checked); if (success) onWifiUpdate(); }} id="always_on" /><label htmlFor="always_on" style={{ fontSize: "11px", fontWeight: "900", cursor: "pointer" }}>AP ALWAYS ON (PERSISTED)</label></div>
								<div style={s.formGroup}><label style={s.formLabel}>AP SSID</label><input style={s.input} defaultValue={wifiStatus?.ap_ssid} onBlur={async e => { await API.toggleAP(wifiStatus?.ap_active || false, wifiStatus?.ap_always_on || false, e.target.value); onWifiUpdate(); }} /></div>
								<div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
									<button onClick={async () => { await API.toggleAP(true, wifiStatus?.ap_always_on || false); onWifiUpdate(); }} style={{ ...s.primaryBtn, flex: 1 }}>START AP</button>
									<button onClick={async () => { await API.toggleAP(false, wifiStatus?.ap_always_on || false); onWifiUpdate(); }} style={{ ...s.secondaryBtn, flex: 1, borderColor: "#f44" }}>STOP AP</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{menu && (
				<div style={{ position: "fixed", top: menu.y, left: menu.x, background: "rgba(10,10,20,0.95)", border: "1px solid var(--primary)", borderRadius: "12px", padding: "8px", zIndex: 10000, minWidth: "160px", backdropFilter: "blur(20px)", boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }}>
					{selectedIds.length > 1 ? (
						<><div style={{ fontSize: "8px", fontWeight: 900, color: "var(--primary)", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "4px" }}>ALIGN ELEMENTS</div><div onClick={() => alignElements("left")} style={s.menuItem} className="menu-item-hover">ALIGN LEFT</div><div onClick={() => alignElements("centerX")} style={s.menuItem} className="menu-item-hover">ALIGN CENTER X</div><div onClick={() => alignElements("right")} style={s.menuItem} className="menu-item-hover">ALIGN RIGHT</div><div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "4px 0" }} /><div onClick={() => alignElements("top")} style={s.menuItem} className="menu-item-hover">ALIGN TOP</div><div onClick={() => alignElements("centerY")} style={s.menuItem} className="menu-item-hover">ALIGN CENTER Y</div><div onClick={() => alignElements("bottom")} style={s.menuItem} className="menu-item-hover">ALIGN BOTTOM</div></>
					) : (
						<><div style={{ fontSize: "8px", fontWeight: 900, color: "var(--primary)", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "4px" }}>INSERT WIDGET</div>{["btn", "switch", "slider", "arc", "checkbox", "dropdown", "roller", "bar", "label", "clock"].map(t => (<div key={t} onClick={() => { const r = document.getElementById("canvas-surface")?.getBoundingClientRect(); if (r) addItem(t as any, menu.x - r.left - 40, menu.y - r.top - 20); setMenu(null); }} style={s.menuItem} className="menu-item-hover">{t.toUpperCase()}</div>))}
						<div style={{ fontSize: "8px", fontWeight: 900, color: "var(--accent)", padding: "4px 8px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "4px" }}>INSERT PANEL</div>{panels.map(p => (<div key={p.id} onClick={() => { const r = document.getElementById("canvas-surface")?.getBoundingClientRect(); if (r) addItem("panel-ref", menu.x - r.left - 40, menu.y - r.top - 20, p.id); setMenu(null); }} style={s.menuItem} className="menu-item-hover">📦 {p.name.toUpperCase()}</div>))}</>
					)}
				</div>
			)}
		</div>
	);
}

function WifiStatusBadge({ status }: { status: WifiStatus }) { return <div style={{ fontSize: "10px", fontWeight: 900, color: status?.connected ? "var(--accent)" : "#f44" }}>● {status?.connected ? "ONLINE" : "OFFLINE"}</div>; }
interface ErrorBoundaryProps { children: ReactNode; } interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> { constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; } static getDerivedStateFromError(error: Error) { return { hasError: true, error }; } render() { return this.state.hasError ? <div style={{ padding: "40px", background: "#200", color: "#fff" }}><h1>ERROR</h1><pre>{this.state.error?.toString()}</pre></div> : this.props.children; } }
const s: Record<string, React.CSSProperties> = { app: { transition: "all 0.3s ease", display: "flex", flexDirection: "column", height: "100vh", background: "#06060c", color: "#e2e8f0" }, glassCard: { background: "rgba(10, 10, 20, 0.7)", backdropFilter: "blur(40px)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "24px", padding: "20px" }, primaryBtn: { background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", color: "white", border: "none", padding: "12px 24px", borderRadius: "14px", cursor: "pointer", fontWeight: "900", fontSize: "10px" }, secondaryBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 16px", borderRadius: "12px", cursor: "pointer", fontSize: "10px", fontWeight: "900" }, header: { display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" }, headerLeft: { display: "flex", alignItems: "center", gap: 40 }, headerTitle: { fontWeight: 900, fontSize: "14px", color: "var(--primary)", letterSpacing: "2px" }, nav: { display: "flex", gap: 30 }, navBtn: { background: "none", border: "none", fontWeight: 900, fontSize: "11px", cursor: "pointer", color: "inherit", height: "60px" }, cardTitle: { fontSize: "10px", fontWeight: 900, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "2px" }, formGroup: { display: "flex", flexDirection: "column", gap: "6px" }, formLabel: { fontSize: "9px", fontWeight: 900, color: "var(--text-dim)" }, input: { padding: "12px", background: "#000", border: "1px solid #222", borderRadius: "10px", color: "#fff", fontSize: "12px" }, menuItem: { padding: "8px 12px", cursor: "pointer", fontSize: "10px", fontWeight: "900", borderRadius: "6px" } };
