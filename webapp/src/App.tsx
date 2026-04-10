import type React from "react";
import {
	Component,
	type ErrorInfo,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type WifiStatus = {
	connected: boolean;
	ip: string;
	ssid: string;
} | null;

type SDFile = {
	name: string;
	size: number;
	isDir?: boolean;
};

type Network = {
	ssid: string;
	rssi: number;
};

type PlaylistItem = {
	name: string;
	enabled: boolean;
};

type ImageInfo = {
	width: number;
	height: number;
	url: string;
	isLocal: boolean;
};

type GridItem = {
	name: string;
	type: "btn" | "switch" | "slider" | "label" | "clock";
	x: number;
	y: number;
	w: number;
	h: number;
	scale: number;
	innerX: number;
	innerY: number;
	color: number;
	textColor: number;
	action: string;
};

type AppInfo = { file: string } | null;

const BUILD_ID = "v80-NUCLEAR-SYNC";

interface ErrorBoundaryProps {
	children: ReactNode;
}
interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}
	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}
	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("ErrorBoundary caught:", error, errorInfo);
	}
	render() {
		if (this.state.hasError) {
			return (
				<div
					style={{
						padding: "40px",
						background: "#700",
						color: "#fff",
						fontFamily: "monospace",
						minHeight: "100vh",
					}}
				>
					<h1>☢️ CORE RENDER CRASH</h1>
					<p>
						The React application failed to mount. This is likely due to a data
						inconsistency or a missing browser feature.
					</p>
					<pre
						style={{
							background: "#200",
							padding: "20px",
							borderRadius: "8px",
							overflow: "auto",
						}}
					>
						{this.state.error?.toString()}
						{"\n\nStack Trace:\n"}
						{this.state.error?.stack}
					</pre>
					<button
						onClick={() => window.location.reload()}
						style={{
							padding: "12px 24px",
							background: "#fff",
							color: "#000",
							border: "none",
							borderRadius: "4px",
							fontWeight: "bold",
						}}
					>
						Reload Page
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}

const safeHex = (num: any, fallback = "000000") => {
	if (num === null || num === undefined || isNaN(num)) return fallback;
	return num.toString(16).padStart(6, "0");
};

export default function SafeApp() {
	return (
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	);
}

function App() {
	const [activeTab, setActiveTab] = useState<
		"wifi" | "sd" | "settings" | "grid"
	>("grid");
	const [status, setStatus] = useState<WifiStatus>(null);
	const [appInfo, setAppInfo] = useState<AppInfo>(null);

	useEffect(() => {
		fetch("/api/spa/info")
			.then((r) => r.json())
			.then((data) => setAppInfo(data))
			.catch((e) => console.error("SPA info fetch failed:", e));
	}, []);

	const fetchStatus = useCallback(() => {
		fetch("/api/wifi/status")
			.then((r) => r.json())
			.then((d) => setStatus(d))
			.catch(() => setStatus({ connected: false, ip: "", ssid: "" }));
	}, []);

	useEffect(() => {
		fetchStatus();
		const timer = setInterval(fetchStatus, 5000);
		return () => clearInterval(timer);
	}, [fetchStatus]);

	return (
		<div
			style={{
				...s.app,
				padding: "20px",
				width: "100%",
				maxWidth: "1600px",
				margin: "0 auto",
			}}
		>
			<header className="glass" style={{ ...s.header, marginBottom: "32px" }}>
				<div style={s.headerLeft}>
					<span
						style={{
							...s.headerTitle,
							animation: "pulseGlow 3s ease-in-out infinite",
						}}
					>
						NUCLEAR-SYNC
					</span>
					<nav style={s.nav}>
						<button
							onClick={() => setActiveTab("grid")}
							style={{
								...s.navBtn,
								color:
									activeTab === "grid" ? "var(--primary)" : "var(--text-dim)",
								textShadow:
									activeTab === "grid"
										? "0 0 15px var(--primary-glow)"
										: "none",
								borderBottom:
									activeTab === "grid"
										? "2px solid var(--primary)"
										: "2px solid transparent",
							}}
						>
							DASHBOARD
						</button>
						<button
							onClick={() => setActiveTab("sd")}
							style={{
								...s.navBtn,
								color:
									activeTab === "sd" ? "var(--primary)" : "var(--text-dim)",
								textShadow:
									activeTab === "sd" ? "0 0 15px var(--primary-glow)" : "none",
								borderBottom:
									activeTab === "sd"
										? "2px solid var(--primary)"
										: "2px solid transparent",
							}}
						>
							DIRECTOR
						</button>
						<button
							onClick={() => setActiveTab("wifi")}
							style={{
								...s.navBtn,
								color:
									activeTab === "wifi" ? "var(--primary)" : "var(--text-dim)",
								textShadow:
									activeTab === "wifi"
										? "0 0 15px var(--primary-glow)"
										: "none",
								borderBottom:
									activeTab === "wifi"
										? "2px solid var(--primary)"
										: "2px solid transparent",
							}}
						>
							NETWORK
						</button>
						<button
							onClick={() => setActiveTab("settings")}
							style={{
								...s.navBtn,
								color:
									activeTab === "settings"
										? "var(--primary)"
										: "var(--text-dim)",
								textShadow:
									activeTab === "settings"
										? "0 0 15px var(--primary-glow)"
										: "none",
								borderBottom:
									activeTab === "settings"
										? "2px solid var(--primary)"
										: "2px solid transparent",
							}}
						>
							SYSTEM
						</button>
					</nav>
				</div>
				<WifiStatusBadge status={status} />
			</header>

			<main className="animate-in">
				{activeTab === "grid" ? (
					<GridTab appInfo={appInfo} status={status} />
				) : activeTab === "wifi" ? (
					<WifiTab status={status} onFetchStatus={fetchStatus} />
				) : activeTab === "sd" ? (
					<SDTab />
				) : (
					<SettingsTab />
				)}
			</main>
		</div>
	);
}

function useLongPress(callback: (e: any) => void, ms = 600) {
	const timerRef = useRef<any>(null);
	const [longPressed, setLongPressed] = useState(false);

	const start = useCallback(
		(e: any) => {
			setLongPressed(false);
			const event = {
				clientX: e.clientX || (e.touches && e.touches[0].clientX),
				clientY: e.clientY || (e.touches && e.touches[0].clientY),
			};
			timerRef.current = setTimeout(() => {
				setLongPressed(true);
				callback(event);
			}, ms);
		},
		[callback, ms],
	);

	const stop = useCallback(() => clearTimeout(timerRef.current), []);

	return {
		onMouseDown: start,
		onMouseUp: stop,
		onMouseLeave: stop,
		onTouchStart: start,
		onTouchEnd: stop,
		onTouchMove: stop,
		onContextMenu: (e: any) => e.preventDefault(),
		longPressed,
	};
}

function SDTab() {
	const [genFiles, setGenFiles] = useState<SDFile[]>([]);
	const [genPath, setGenPath] = useState("");
	const [genLoading, setGenLoading] = useState(true);

	const [convFiles, setConvFiles] = useState<SDFile[]>([]);
	const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
	const [convLoading, setConvLoading] = useState(true);
	const [search, setSearch] = useState("");

	const [selectedFile, setSelectedFile] = useState<{
		name: string;
		size: number;
		path: string;
	} | null>(null);
	const [inspectInfo, setInspectInfo] = useState<ImageInfo | null>(null);

	const [uploading, setUploading] = useState(false);
	const [uploadMsg, setUploadMsg] = useState("");
	const [slideshowActive, setSlideshowActive] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [ctxMenu, setCtxMenu] = useState<{
		x: number;
		y: number;
		name: string;
		pathPrefix: string;
	} | null>(null);

	const fetchGen = () => {
		setGenLoading(true);
		fetch(`/api/sd/list?path=${encodeURIComponent(genPath)}`)
			.then((r) => r.json())
			.then((d) => {
				setGenFiles(
					((d.files as SDFile[]) ?? [])
						.filter((f: SDFile) => f.name !== "." && f.name !== "..")
						.sort(
							(a: SDFile, b: SDFile) => (b.isDir ? 1 : 0) - (a.isDir ? 1 : 0),
						),
				);
			})
			.catch(() => setGenFiles([]))
			.finally(() => setGenLoading(false));
	};

	const fetchConv = async () => {
		setConvLoading(true);
		try {
			const resList = await fetch(`/api/sd/list?path=conv`);
			const dList = await resList.json();
			const files = ((dList.files as SDFile[]) ?? []).filter(
				(f: SDFile) => !f.isDir && f.name.match(/\.(jpg|jpeg|png)$/i),
			);
			setConvFiles(files);

			const resPl = await fetch(`/api/sd/file/playlist.json`);
			if (resPl.ok) {
				const dPl = await resPl.json();
				const pl: PlaylistItem[] = dPl.items ?? [];
				const matchedPl = files.map((f) => {
					const existing = pl.find((p) => p.name === f.name);
					return existing || { name: f.name, enabled: true };
				});
				setPlaylist(matchedPl);
			} else {
				setPlaylist(files.map((f) => ({ name: f.name, enabled: true })));
			}
		} catch {
			setConvFiles([]);
		} finally {
			setConvLoading(false);
		}
	};

	useEffect(fetchGen, [genPath]);
	useEffect(() => {
		fetchConv();
	}, []);

	const savePlaylist = (p: PlaylistItem[]) => {
		const blob = new Blob([JSON.stringify({ items: p })], {
			type: "application/json",
		});
		fetch(`/api/sd/upload?path=playlist.json`, {
			method: "POST",
			body: blob,
		}).catch((err) => console.error("Pl update failed", err));
	};

	const startSlideshow = () => {
		fetch("/api/slideshow/start", { method: "POST" }).then(() =>
			setSlideshowActive(true),
		);
	};

	const stopSlideshow = () => {
		fetch("/api/slideshow/stop", { method: "POST" }).then(() =>
			setSlideshowActive(false),
		);
	};

	const toggleItem = (name: string) => {
		const next = playlist.map((item) =>
			item.name === name ? { ...item, enabled: !item.enabled } : item,
		);
		setPlaylist(next);
		savePlaylist(next);
	};

	const moveItem = (index: number, dir: number) => {
		const next = [...playlist];
		const target = index + dir;
		if (target < 0 || target >= next.length) return;
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		setPlaylist(next);
		savePlaylist(next);
	};

	const filteredPlaylist = useMemo(() => {
		return playlist.filter((p) =>
			p.name.toLowerCase().includes(search.toLowerCase()),
		);
	}, [playlist, search]);

	const handleStageLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setSelectedFile({ name: file.name, size: file.size, path: "local" });
		const img = new Image();
		const url = URL.createObjectURL(file);
		img.onload = () =>
			setInspectInfo({
				width: img.width,
				height: img.height,
				url,
				isLocal: true,
			});
		img.onerror = () => setUploadMsg("Error displaying preview.");
		img.src = url;
	};

	const handleInspectSD = (f: SDFile, pathPrefix: string) => {
		if (f.isDir)
			return setGenPath(pathPrefix ? `${pathPrefix}/${f.name}` : f.name);
		const fullPath = pathPrefix ? `${pathPrefix}/${f.name}` : f.name;
		const url = `/api/sd/file/${fullPath}`;
		setSelectedFile({ name: f.name, size: f.size, path: fullPath });
		setInspectInfo(null);
		const img = new Image();
		img.onload = () =>
			setInspectInfo({
				width: img.width,
				height: img.height,
				url,
				isLocal: false,
			});
		img.onerror = () => setUploadMsg("Failed to load SD preview.");
		img.src = url;
	};

	const handleUpload = async (optimize: boolean) => {
		if (!selectedFile || !inspectInfo) return;
		setUploading(true);
		setUploadMsg(optimize ? "1/3 Optimizing..." : "Uploading...");

		try {
			const response = await fetch(inspectInfo.url);
			const sourceBlob = await response.blob();

			let finalBlob: Blob;
			let finalName = selectedFile.name;

			if (optimize) {
				finalBlob = await optimizeImage(sourceBlob);
				const namePart = selectedFile.name
					.replace(/\.[^/.]+$/, "")
					.substring(0, 5)
					.replace(/[^a-zA-Z0-9]/g, "");
				finalName = namePart + "_s.jpg";
			} else {
				finalBlob = sourceBlob;
			}

			const targetPath = optimize
				? `conv/${finalName}`
				: genPath
					? `${genPath}/${finalName}`
					: finalName;
			const uploadRes = await fetch(
				`/api/sd/upload?path=${encodeURIComponent(targetPath)}`,
				{
					method: "POST",
					body: finalBlob,
				},
			);

			if (uploadRes.ok) {
				setUploadMsg("Success!");
				fetchGen();
				fetchConv();
			} else {
				const txt = await uploadRes.text();
				throw new Error(txt || `Error ${uploadRes.status}`);
			}
		} catch (err: any) {
			setUploadMsg(`Error: ${err.message}`);
		} finally {
			setUploading(false);
		}
	};

	const handleDelete = (name: string, pathPrefix: string) => {
		if (!confirm(`Delete ${name}?`)) return;
		const full = pathPrefix ? `${pathPrefix}/${name}` : name;
		fetch(`/api/sd/delete?path=${encodeURIComponent(full)}`, {
			method: "POST",
		}).then(() => {
			fetchGen();
			fetchConv();
			setCtxMenu(null);
		});
	};

	const LongPressRow = ({
		f,
		pathPrefix,
		onSelect,
		children,
		style,
	}: {
		f: SDFile;
		pathPrefix: string;
		onSelect: () => void;
		children?: React.ReactNode;
		style?: any;
	}) => {
		const { longPressed, ...bind } = useLongPress((e) => {
			setCtxMenu({ x: e.clientX, y: e.clientY, name: f.name, pathPrefix });
		});

		const onClick = (e: React.MouseEvent) => {
			if (longPressed) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			onSelect();
		};

		return (
			<div
				{...bind}
				style={{
					...s.fileRow,
					...style,
					background:
						selectedFile?.path ===
						(pathPrefix ? pathPrefix + "/" + f.name : f.name)
							? "rgba(139, 92, 246, 0.15)"
							: "transparent",
				}}
				onClick={onClick}
			>
				{children || (
					<>
						<div style={s.fileMain}>
							<span style={s.fileIcon}>{f.isDir ? "📁" : "📄"}</span>
							<span style={s.fileName}>{f.name}</span>
						</div>
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleDelete(f.name, pathPrefix);
							}}
							style={s.inlineDel}
						>
							✕
						</button>
					</>
				)}
			</div>
		);
	};

	return (
		<div className="app-layout" onClick={() => setCtxMenu(null)}>
			<div style={s.browserStack}>
				<div
					className="glass"
					style={{
						padding: "24px",
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
					}}
				>
					<div style={s.browserHeader}>
						<div style={s.breadcrumbs}>
							<span style={s.crumb} onClick={() => setGenPath("")}>
								STORAGE
							</span>
							{genPath
								.split("/")
								.filter((p) => p)
								.map((p, i, arr) => (
									<span
										key={i}
										style={s.crumb}
										onClick={() => setGenPath(arr.slice(0, i + 1).join("/"))}
									>
										{" "}
										/ {p.toUpperCase()}
									</span>
								))}
						</div>
						<button
							onClick={() => fileInputRef.current?.click()}
							style={s.stageBtn}
						>
							+ UPLOAD
						</button>
						<input
							type="file"
							ref={fileInputRef}
							style={{ display: "none" }}
							onChange={handleStageLocal}
						/>
					</div>
					<div style={s.fileScroll}>
						{genPath && (
							<div
								style={{ ...s.fileRow, color: "var(--primary)" }}
								onClick={() => {
									const parts = genPath.split("/");
									parts.pop();
									setGenPath(parts.join("/"));
								}}
							>
								<span style={s.fileIcon}>⤴</span> BACK
							</div>
						)}
						{genLoading ? (
							<p
								style={{
									textAlign: "center",
									padding: "20px",
									color: "var(--text-dim)",
								}}
							>
								SCANNING...
							</p>
						) : (
							genFiles.map((f, i) => (
								<LongPressRow
									key={i}
									f={f}
									pathPrefix={genPath}
									onSelect={() => handleInspectSD(f, genPath)}
								/>
							))
						)}
					</div>
				</div>

				<div
					className="glass"
					style={{
						padding: "24px",
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
					}}
				>
					<div style={s.browserHeader}>
						<span style={s.cardTitle}>STATION PLAYLIST (/CONV)</span>
						<button
							onClick={slideshowActive ? stopSlideshow : startSlideshow}
							style={{
								...s.stageBtn,
								background: slideshowActive ? "#ef4444" : "var(--primary)",
								boxShadow: slideshowActive
									? "0 0 15px rgba(239, 68, 68, 0.4)"
									: "0 0 15px var(--primary-glow)",
							}}
						>
							{slideshowActive ? "■ STOP SS" : "▶ SLIDESHOW"}
						</button>
						<input
							type="text"
							placeholder="FILTER..."
							style={s.miniInput}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<div style={s.fileScroll}>
						{convLoading ? (
							<p
								style={{
									textAlign: "center",
									padding: "20px",
									color: "var(--text-dim)",
								}}
							>
								SYNCHRONIZING...
							</p>
						) : (
							filteredPlaylist.map((p, i) => (
								<LongPressRow
									key={p.name}
									f={{ name: p.name, size: 0 }}
									pathPrefix="conv"
									onSelect={() =>
										handleInspectSD({ name: p.name, size: 0 }, "conv")
									}
									style={s.playlistRow}
								>
									<input
										type="checkbox"
										checked={p.enabled}
										onChange={() => toggleItem(p.name)}
										style={s.check}
										onClick={(e) => e.stopPropagation()}
									/>
									<div style={s.fileMain}>
										<span
											style={{
												...s.fileName,
												color: p.enabled
													? "var(--text-main)"
													: "var(--text-dim)",
												opacity: p.enabled ? 1 : 0.5,
											}}
										>
											{p.name}
										</span>
									</div>
									<div style={s.sortControl}>
										<button
											style={s.sortBtn}
											onClick={(e) => {
												e.stopPropagation();
												moveItem(i, -1);
											}}
										>
											▲
										</button>
										<button
											style={s.sortBtn}
											onClick={(e) => {
												e.stopPropagation();
												moveItem(i, 1);
											}}
										>
											▼
										</button>
									</div>
								</LongPressRow>
							))
						)}
					</div>
				</div>
			</div>

			<div className="inspector-panel" style={s.inspector}>
				{selectedFile ? (
					<div
						className="glass animate-in"
						style={{ padding: "24px", minWidth: "360px" }}
					>
						<span style={s.cardTitle}>ASSET INSPECTOR</span>
						{inspectInfo ? (
							<div style={s.previewWrap}>
								<img src={inspectInfo.url} style={s.previewImg} alt="insp" />
								<div style={s.imgBadge}>
									{inspectInfo.width} × {inspectInfo.height} PX
								</div>
							</div>
						) : (
							<div style={s.previewWrap}>
								<p>LOADING PREVIEW...</p>
							</div>
						)}
						<div style={s.infoList}>
							<div style={s.infoItem}>
								<span>FILEID</span>{" "}
								<span style={s.val}>{selectedFile.name}</span>
							</div>
							<div style={s.infoItem}>
								<span>SOURCE</span>{" "}
								<span style={s.val}>{selectedFile.path}</span>
							</div>
						</div>
						<div style={s.actionRow}>
							{inspectInfo?.isLocal && (
								<button
									onClick={() => handleUpload(false)}
									disabled={uploading}
									style={{
										...s.rawBtn,
										background: "transparent",
										border: "1px solid var(--border-glass)",
										color: "var(--text-main)",
									}}
								>
									RAW SYNC
								</button>
							)}
							<button
								onClick={() => handleUpload(true)}
								disabled={uploading}
								style={{
									...s.convBtn,
									gridColumn: inspectInfo?.isLocal ? "unset" : "span 2",
									marginTop: 0,
								}}
							>
								OPTIMIZE (800×470)
							</button>
						</div>
						{uploadMsg && <p style={s.statusMsg}>{uploadMsg.toUpperCase()}</p>}
					</div>
				) : (
					<div
						style={{
							...s.emptyLab,
							opacity: 0.5,
							border: "2px dashed var(--border-glass)",
							borderRadius: "24px",
							padding: "40px",
							textAlign: "center",
						}}
					>
						<p>
							SELECT AN ASSET TO
							<br />
							INSPECT PROPERTIES
						</p>
					</div>
				)}
			</div>

			{ctxMenu && (
				<div style={{ ...s.floatingMenu, left: ctxMenu.x, top: ctxMenu.y }}>
					<button
						style={{ ...s.menuItem, color: "#f87171" }}
						onClick={(e) => {
							e.stopPropagation();
							handleDelete(ctxMenu.name, ctxMenu.pathPrefix);
						}}
					>
						🗑 DELETE {ctxMenu.name.toUpperCase()}
					</button>
					<button style={s.menuItem} onClick={() => setCtxMenu(null)}>
						✕ CANCEL
					</button>
				</div>
			)}
		</div>
	);
}

function SettingsTab() {
	const [tz, setTz] = useState("Jerusalem");
	return (
		<div style={s.centreCol}>
			<div
				className="glass animate-in"
				style={{
					padding: "32px",
					display: "flex",
					flexDirection: "column",
					gap: "24px",
				}}
			>
				<span style={s.cardTitle}>SYSTEM PREFERENCES</span>
				<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
					<div style={s.formGroup}>
						<label style={s.formLabel}>GEOGRAPHIC OFFSET</label>
						<select
							value={tz}
							onChange={(e) => setTz(e.target.value)}
							style={s.input as any}
						>
							<option value="Jerusalem">Asia/Jerusalem (IST)</option>
							<option value="UTC">UTC (Universal)</option>
							<option value="London">Europe/London (GMT)</option>
							<option value="NewYork">America/New_York (EST)</option>
						</select>
					</div>
					<p
						style={{
							fontSize: "0.8rem",
							color: "var(--text-dim)",
							lineHeight: "1.6",
						}}
					>
						NTP SYNCHRONIZATION USES THIS OFFSET TO CALIBRATE THE INTERNAL
						STATION CLOCK.
					</p>
				</div>
			</div>
		</div>
	);
}

function WifiTab({
	status,
	onFetchStatus,
}: {
	status: WifiStatus;
	onFetchStatus: () => void;
}) {
	const [networks, setNetworks] = useState<Network[]>([]);
	const [scanning, setScanning] = useState(false);
	const [selectedSsid, setSelectedSsid] = useState("");
	const [password, setPassword] = useState("");
	const [connecting, setConnecting] = useState(false);

	const scan = () => {
		setScanning(true);
		fetch("/api/wifi/scan")
			.then((r) => r.json())
			.then((d) => setNetworks(d.networks ?? []))
			.finally(() => setScanning(false));
	};
	const connect = () => {
		if (!selectedSsid) return;
		setConnecting(true);
		fetch("/api/wifi/connect", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ssid: selectedSsid, password }),
		})
			.then(() => setTimeout(onFetchStatus, 4000))
			.finally(() => setConnecting(false));
	};
	return (
		<div style={s.centreCol} className="animate-in">
			<div
				className="glass"
				style={{
					padding: "32px",
					display: "flex",
					flexDirection: "column",
					gap: "24px",
				}}
			>
				<div style={s.scanHeader}>
					<span style={s.cardTitle}>AVAIABLE HOTSPOTS</span>
					<button
						onClick={scan}
						disabled={scanning}
						style={{ ...s.stageBtn, padding: "8px 16px", borderRadius: "8px" }}
					>
						{scanning ? "SCANNING..." : "REFRESH LIST"}
					</button>
				</div>
				<div
					style={{
						...s.fileScroll,
						maxHeight: "300px",
						border: "1px solid var(--border-glass)",
						borderRadius: "16px",
						padding: "8px",
					}}
				>
					{networks.length === 0 ? (
						<p
							style={{
								textAlign: "center",
								padding: "40px",
								color: "var(--text-dim)",
								fontSize: "0.8rem",
							}}
						>
							NO NETWORKS DETECTED
						</p>
					) : (
						networks.map((n, i) => (
							<div
								key={i}
								style={{
									...s.fileRow,
									padding: "16px",
									cursor: "pointer",
									background:
										selectedSsid === n.ssid
											? "rgba(139, 92, 246, 0.1)"
											: "transparent",
									marginBottom: "4px",
								}}
								onClick={() => setSelectedSsid(n.ssid)}
							>
								<span style={{ fontWeight: 600 }}>{n.ssid}</span>
								<span
									style={{
										...s.fileSize,
										color: n.rssi > -60 ? "var(--accent)" : "var(--text-dim)",
									}}
								>
									{n.rssi} DBM
								</span>
							</div>
						))
					)}
				</div>
			</div>
			{selectedSsid && (
				<div
					className="glass"
					style={{
						padding: "32px",
						display: "flex",
						flexDirection: "column",
						gap: "20px",
						marginTop: "24px",
					}}
				>
					<span style={s.cardTitle}>
						AUTHENTICATION: {selectedSsid.toUpperCase()}
					</span>
					<input
						type="password"
						placeholder="SECURITY KEY"
						style={s.input}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
					<button onClick={connect} style={{ ...s.convBtn, marginTop: 0 }}>
						{connecting ? "SYNCHRONIZING..." : "JOIN NETWORK"}
					</button>
				</div>
			)}
		</div>
	);
}

function WifiStatusBadge({ status }: { status: WifiStatus }) {
	return (
		<div
			style={{
				fontSize: "0.8rem",
				fontWeight: 800,
				color: status?.connected ? "var(--accent)" : "#f87171",
			}}
		>
			<span style={{ marginRight: "8px", verticalAlign: "middle" }}>
				{status?.connected ? "●" : "○"}
			</span>
			{status?.connected ? `SYSTEM ONLINE (${status.ip})` : "SYSTEM OFFLINE"}
		</div>
	);
}

function GridTab({
	appInfo,
	status,
}: {
	appInfo: AppInfo;
	status: WifiStatus;
}) {
	const getWidgetBaseSize = (type: string) => {
		if (type === "slider") return { w: 64, h: 12 }; // base slider assumes 80% of 1x1
		if (type === "switch") return { w: 50, h: 25 };
		return { w: 60, h: 40 };
	};

	const [items, setItems] = useState<GridItem[]>([]);
	const canvasHeight = 480;
	const [gridBg, setGridBg] = useState(0x0e0e0e);
	const [selected, setSelected] = useState<number | null>(null);
	const [editingInner, setEditingInner] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [syncStatus, setSyncStatus] = useState<string>("");
	const [time, setTime] = useState(new Date().toLocaleTimeString());

	useEffect(() => {
		const timer = setInterval(
			() => setTime(new Date().toLocaleTimeString()),
			1000,
		);
		return () => clearInterval(timer);
	}, []);

	const [dragInfo, setDragInfo] = useState<{
		idx: number;
		startX: number;
		startY: number;
		initialX: number;
		initialY: number;
		initialW: number;
		initialH: number;
		initialScale: number;
		mode: "move" | "resize" | "inner-resize";
	} | null>(null);
	const [clipboard, setClipboard] = useState<GridItem | null>(null);

	useEffect(() => {
		fetch("/api/grid/config")
			.then((r) => r.json())
			.then((d) => {
				setItems(d.items || []);
				if (d.bg !== undefined) setGridBg(d.bg);
			})
			.catch((e) => console.error("Failed to load grid", e));
	}, []);

	const save = () => {
		setSaving(true);
		setSyncStatus("Syncing...");

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);

		fetch("/api/grid/config", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ items, bg: gridBg }),
			signal: controller.signal,
		})
			.then((r) => {
				if (!r.ok) throw new Error("Sync failed");
				setSyncStatus("Pushed");
				setTimeout(() => setSyncStatus(""), 3000);
			})
			.catch((err) => {
				setSyncStatus(err.name === "AbortError" ? "Timed Out" : "Error");
				setTimeout(() => setSyncStatus(""), 5000);
			})
			.finally(() => {
				clearTimeout(timeoutId);
				setSaving(false);
			});
	};
	
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) return;

			if (e.key === "Escape") {
				setEditingInner(null);
				setSelected(null);
				setDragInfo(null);
			}

			if ((e.key === "Delete" || e.key === "d") && selected !== null) {
				removeItem(selected);
			}

			if (e.ctrlKey || e.metaKey) {
				if (e.key === "c" && selected !== null) {
					setClipboard({ ...items[selected] });
					setSyncStatus("Copied");
					setTimeout(() => setSyncStatus(""), 1000);
				}
				if (e.key === "v" && clipboard) {
					const newItem = {
						...clipboard,
						x: Math.min(7, clipboard.x + 1),
						y: Math.min(4, clipboard.y + 1),
					};
					setItems([...items, newItem]);
					setSelected(items.length);
					setSyncStatus("Pasted");
					setTimeout(() => setSyncStatus(""), 1000);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selected, items, clipboard]);

	const updateItem = (idx: number, patch: Partial<GridItem>) => {
		const next = [...items];
		next[idx] = { ...next[idx], ...patch };
		setItems(next);
	};

	const addItem = () => {
		setItems([
			...items,
			{
				name: "New Block",
				type: "btn",
				x: 0,
				y: 0,
				w: 2,
				h: 2,
				scale: 100,
				innerX: 50,
				innerY: 50,
				color: 0x1c2828,
				textColor: 0xffffff,
				action: "",
			},
		]);
		setSelected(items.length);
	};

	const removeItem = (idx: number) => {
		setItems(items.filter((_, i) => i !== idx));
		setSelected(null);
	};

	const onMouseDown = (
		e: React.MouseEvent,
		idx: number,
		mode: "move" | "resize" | "inner-resize",
	) => {
		e.preventDefault();
		if (editingInner === idx && mode === "move") {
			setDragInfo({
				idx,
				startX: e.clientX,
				startY: e.clientY,
				initialX: items[idx].innerX,
				initialY: items[idx].innerY,
				initialW: 0,
				initialH: 0,
				initialScale: 0,
				mode: "move",
			});
			return;
		}
		setDragInfo({
			idx,
			startX: e.clientX,
			startY: e.clientY,
			initialX: items[idx].x,
			initialY: items[idx].y,
			initialW: items[idx].w,
			initialH: items[idx].h,
			initialScale: items[idx].scale,
			mode,
		});
	};

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragInfo) return;

			const next = [...items];
			if (dragInfo.mode === "move") {
				if (editingInner === dragInfo.idx) {
					const it = items[dragInfo.idx];
					const blockW = it.w * 80;
					const blockH = it.h * 80;
					const base = getWidgetBaseSize(it.type);
					const wP = ((base.w * it.scale) / 100 / blockW) * 100;
					const hP = ((base.h * it.scale) / 100 / blockH) * 100;

					const dxP = ((e.clientX - dragInfo.startX) / blockW) * 100;
					const dyP = ((e.clientY - dragInfo.startY) / blockH) * 100;
					next[dragInfo.idx].innerX = Math.round(
						Math.max(0, Math.min(100 - wP, dragInfo.initialX + dxP)),
					);
					next[dragInfo.idx].innerY = Math.round(
						Math.max(0, Math.min(100 - hP, dragInfo.initialY + dyP)),
					);
				} else {
					const dx = Math.round((e.clientX - dragInfo.startX) / 80);
					const dy = Math.round((e.clientY - dragInfo.startY) / 80);
					next[dragInfo.idx].x = Math.max(
						0,
						Math.min(8 - dragInfo.initialW, dragInfo.initialX + dx),
					);
					next[dragInfo.idx].y = Math.max(0, dragInfo.initialY + dy);
				}
			} else if (dragInfo.mode === "inner-resize") {
				const it = items[dragInfo.idx];
				const dx = e.clientX - dragInfo.startX;
				let newScale = Math.max(10, Math.min(300, dragInfo.initialScale + dx / 2));

				const blockW = it.w * 80;
				const blockH = it.h * 80;
				const base = getWidgetBaseSize(it.type);

				// Max scale is limited by current inner position
				const maxW = (blockW * (1 - it.innerX / 100) * 100) / base.w;
				const maxH = (blockH * (1 - it.innerY / 100) * 100) / base.h;
				newScale = Math.min(newScale, maxW, maxH);

				next[dragInfo.idx].scale = Math.round(newScale);
			} else {
				const dx = Math.round((e.clientX - dragInfo.startX) / 80);
				const dy = Math.round((e.clientY - dragInfo.startY) / 80);
				next[dragInfo.idx].w = Math.max(
					1,
					Math.min(8 - items[dragInfo.idx].x, dragInfo.initialW + dx),
				);
				next[dragInfo.idx].h = Math.max(1, dragInfo.initialH + dy);
			}
			setItems(next);
		};
		const onUp = () => {
			setDragInfo(null);
			document.body.style.cursor = "default";
		};
		if (dragInfo) {
			document.body.style.cursor =
				dragInfo.mode === "move" ? "move" : "nwse-resize";
			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
		}
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [dragInfo, items, editingInner]);

	return (
		<div className="app-layout">
			<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
				<div
					className="glass"
					style={{
						padding: "24px",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<div>
						<h2
							style={{
								fontSize: "1.1rem",
								fontWeight: 900,
								color: "var(--primary)",
								letterSpacing: "0.05em",
							}}
						>
							BLUEPRINT MIRROR
						</h2>
						<p
							style={{
								fontSize: "0.75rem",
								color: "var(--text-dim)",
								marginTop: "4px",
							}}
						>
							{appInfo?.file
								? `ACTIVE: ${appInfo.file.split("/").pop()}`
								: "NO ACTIVE BLUEPRINT"}
						</p>
					</div>
					<button onClick={addItem} style={s.stageBtn}>
						+ ADD COMPONENT
					</button>
				</div>

				<div className="device-mirror-container">
					<div className="device-mirror">
						<div
							className="device-screen"
							onMouseDown={() => {
								setSelected(null);
								setEditingInner(null);
							}}
						>
							<div className="mirror-layout">
								<div
									className="mirror-header"
									style={{ backgroundColor: `#${safeHex(gridBg, "0e0e0e")}` }}
								>
									<div
										style={{
											flex: 1,
											display: "flex",
											alignItems: "center",
											gap: "10px",
											fontSize: "12px",
											fontWeight: 900,
											color: "#00CED1",
										}}
									>
										esphome1
										<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>
											{time}
										</span>
									</div>
									<div
										style={{
											padding: "4px 10px",
											borderRadius: 4,
											border: "1px solid rgba(255,255,255,0.1)",
											fontSize: "10px",
											fontWeight: 800,
											color: "var(--accent)",
										}}
									>
										{status?.ip || "10.100.102.46"}
									</div>
								</div>

								<div className="mirror-body">
									<div className="mirror-sidebar">
										{["HOME", "SYSTEM", "WIFI", "SD"].map((name, i) => (
											<div
												key={i}
												className={`mirror-sidebar-item ${i === 0 ? "active" : ""}`}
											>
												<div
													style={{
														width: 8,
														height: 8,
														borderRadius: 4,
														background: "currentColor",
													}}
												/>
												<span style={{ fontWeight: 900 }}>{name}</span>
											</div>
										))}
									</div>

									<div
										className="mirror-main"
										style={{ backgroundColor: `#${safeHex(gridBg, "0e0e0e")}` }}
									>
										<div
											onMouseDown={() => {
												setSelected(null);
												setEditingInner(null);
											}}
											style={{
												...s.gridV,
												width: "100%",
												height: "100%",
												position: "absolute",
												top: 0,
												left: 0,
											}}
										>
											{Array.from({ length: 8 }).map((_, i) => (
												<div
													key={i}
													style={{ ...s.gridLineV, left: (i + 1) * 80 }}
												/>
											))}
											{Array.from({ length: 5 }).map((_, i) => (
												<div
													key={i}
													style={{ ...s.gridLineH, top: (i + 1) * 80 }}
												/>
											))}
											{items.map((it, i) => (
												<div
													key={i}
													onDoubleClick={(e) => {
														e.stopPropagation();
														setEditingInner(i);
													}}
													onMouseDown={(e) => {
														if ((e.target as any).dataset?.handle) return;
														setSelected(i);
														onMouseDown(e, i, "move");
														e.stopPropagation();
													}}
													style={{
														...s.gridItem,
														left: it.x * 80,
														top: it.y * 80,
														width: it.w * 80,
														height: it.h * 80,
														backgroundColor: `#${safeHex(it.color, "333333")}`,
														border:
															editingInner === i
																? "4px solid var(--primary)"
																: selected === i
																	? "2px solid var(--primary)"
																	: "1px solid rgba(255,255,255,0.1)",
														boxShadow:
															editingInner === i
																? "0 0 30px var(--primary-glow)"
																: selected === i
																	? "0 0 15px var(--primary-glow)"
																	: "none",
														zIndex:
															editingInner === i ? 20 : selected === i ? 10 : 1,
														transform:
															selected === i ? "scale(1.02)" : "scale(1)",
														transition:
															"transform 0.1s ease, border 0.2s ease, box-shadow 0.2s ease",
														overflow: "hidden",
													}}
												>
													{(() => {
														const itAny = it as any;
														const base = getWidgetBaseSize(itAny.type);
														const isOverflow =
															itAny.innerX +
																((base.w * itAny.scale) / 100 / (itAny.w * 80)) * 100 >
																100.1 ||
															itAny.innerY +
																((base.h * itAny.scale) / 100 / (itAny.h * 80)) * 100 >
																100.1;

														return (
															isOverflow && (
																<div
																	style={{
																		position: "absolute",
																		top: "8px",
																		right: "8px",
																		background: "#ff4444",
																		color: "#fff",
																		fontSize: "0.6rem",
																		padding: "4px 8px",
																		borderRadius: "6px",
																		fontWeight: 900,
																		zIndex: 500,
																		boxShadow: "0 10px 15px -3px rgba(255, 0, 0, 0.4)",
																		border: "2px solid rgba(255,255,255,0.4)",
																		pointerEvents: "none",
																	}}
																>
																	CLIP!
																</div>
															)
														);
													})()}
													<div
														style={{
															display: "flex",
															flexDirection: "column",
															alignItems: "center",
															justifyContent: "center",
															width: "100%",
															height: "100%",
															padding: "5px",
															pointerEvents: "none",
															userSelect: "none",
															position: "relative",
														}}
													>
														<div
															style={{
																position: "absolute",
																left: `${it.innerX}%`,
																top: `${it.innerY}%`,
																display: "flex",
																flexDirection: "column",
																width: "fit-content",
																border: selected === i ? "1.5px dashed var(--primary)" : "1.5px solid transparent",
																padding: "4px",
																margin: "-4px",
																borderRadius: "8px",
																pointerEvents: "auto",
															}}
														>
															{it.type === "label" && (
																<span
																	style={{
																		...s.gridLabel,
																		color: `#${safeHex(it.textColor, "ffffff")}`,
																		fontSize: `${(0.8 * (it.scale || 100)) / 100}rem`,
																	}}
																>
																	{it.name}
																</span>
															)}
															{it.type === "switch" && (
																<div
																	style={{
																		width: Math.min((50 * it.scale) / 100, it.w * 80),
																		height: Math.min((25 * it.scale) / 100, it.h * 80),
																		borderRadius: (12 * it.scale) / 100,
																		background: "rgba(255,255,255,0.15)",
																		position: "relative",
																	}}
																>
																	<div
																		style={{
																			width: (20 * it.scale) / 100,
																			height: (20 * it.scale) / 100,
																			borderRadius: "50%",
																			background: "#fff",
																			position: "absolute",
																			right: (3 * it.scale) / 100,
																			top: (2.5 * it.scale) / 100,
																			boxShadow: "0 0 10px rgba(0,0,0,0.5)",
																		}}
																	/>
																</div>
															)}
															{it.type === "slider" && (
																<div
																	style={{
																		width: "80%",
																		height: Math.min((12 * it.scale) / 100, it.h * 80),
																		borderRadius: (6 * it.scale) / 100,
																		background: "rgba(255,255,255,0.15)",
																		position: "relative",
																	}}
																>
																	<div
																		style={{
																			width: "60%",
																			height: "100%",
																			background: "var(--primary)",
																			borderRadius: (6 * it.scale) / 100,
																			boxShadow: "0 0 15px var(--primary-glow)",
																		}}
																	/>
																</div>
															)}
															{it.type === "btn" && (
																<div
																	style={{
																		width: Math.min((60 * it.scale) / 100, it.w * 80),
																		height: Math.min((40 * it.scale) / 100, it.h * 80),
																		borderRadius: (8 * it.scale) / 100,
																		background: "var(--primary)",
																		boxShadow: "0 0 20px var(--primary-glow)",
																		opacity: 0.8,
																	}}
																/>
															)}
															{it.type === "clock" && (
																<span
																	style={{
																		fontSize: `${(1.2 * it.scale) / 100}rem`,
																		fontWeight: 800,
																		marginTop: "4px",
																	}}
																>
																	{time}
																</span>
															)}
															{selected === i && (
																<div
																	data-handle="inner-resize"
																	onMouseDown={(e) => {
																		e.stopPropagation();
																		onMouseDown(e, i, "inner-resize");
																	}}
																	style={{
																		position: "absolute",
																		bottom: "-8px",
																		right: "-8px",
																		width: "16px",
																		height: "16px",
																		background: "var(--primary)",
																		borderRadius: "50%",
																		cursor: "nwse-resize",
																		zIndex: 200,
																		boxShadow: "0 0 10px rgba(0,0,0,0.5)",
																		border: "3px solid #fff",
																	}}
																/>
															)}
														</div>
													</div>
													{selected === i && (
														<div
															data-handle="resize"
															onMouseDown={(e) => {
																e.stopPropagation();
																onMouseDown(e, i, "resize");
															}}
															style={s.resizeHandle}
														/>
													)}
												</div>
											))}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="inspector-panel" style={s.inspector}>
				<div className="glass" style={{ padding: "24px", minWidth: "360px" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "32px",
						}}
					>
						<span style={{ ...s.cardTitle, marginBottom: 0 }}>
							{selected !== null ? "COMPONENT" : "SYSTEM"}
						</span>
						{syncStatus && (
							<span
								style={{
									fontSize: "0.7rem",
									fontWeight: 900,
									color: "var(--primary)",
								}}
							>
								{syncStatus.toUpperCase()}
							</span>
						)}
					</div>

					{selected !== null ? (
						<div
							style={{ display: "flex", flexDirection: "column", gap: "20px" }}
						>
							<div style={s.formGroup}>
								<label style={s.formLabel}>LABEL</label>
								<input
									style={s.input}
									value={items[selected].name}
									onChange={(e) =>
										updateItem(selected, { name: e.target.value })
									}
								/>
							</div>
							<div style={s.formGroup}>
								<label style={s.formLabel}>WIDGET CLASS</label>
								<select
									style={s.input as any}
									value={items[selected].type}
									onChange={(e) =>
										updateItem(selected, { type: e.target.value as any })
									}
								>
									<option value="btn">Momentary Button</option>
									<option value="switch">Binary Switch</option>
									<option value="slider">Analog Slider</option>
									<option value="label">Static Label</option>
									<option value="clock">Real-time Clock</option>
								</select>
							</div>

							<div
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: "16px",
								}}
							>
								<div style={s.formGroup}>
									<label style={s.formLabel}>
										SCALE ({items[selected].scale}%)
									</label>
									<input
										type="range"
										min="10"
										max="200"
										style={{ accentColor: "var(--primary)" }}
										value={items[selected].scale}
										onChange={(e) =>
											updateItem(selected, { scale: parseInt(e.target.value) })
										}
									/>
								</div>
								<div style={s.formGroup}>
									<label style={s.formLabel}>GRID LOCK</label>
									<div
										style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}
									>
										{items[selected].x},{items[selected].y} [{items[selected].w}
										x{items[selected].h}]
									</div>
								</div>
							</div>

							<div style={s.formGroup}>
								<label style={s.formLabel}>
									ANCHOR POINT (X:{items[selected].innerX}% Y:
									{items[selected].innerY}%)
								</label>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "8px",
									}}
								>
									<input
										type="range"
										min="0"
										max="100"
										style={{ accentColor: "var(--primary)" }}
										value={items[selected].innerX}
										onChange={(e) =>
											updateItem(selected, { innerX: parseInt(e.target.value) })
										}
									/>
									<input
										type="range"
										min="0"
										max="100"
										style={{ accentColor: "var(--primary)" }}
										value={items[selected].innerY}
										onChange={(e) =>
											updateItem(selected, { innerY: parseInt(e.target.value) })
										}
									/>
								</div>
							</div>

							<div
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: "16px",
								}}
							>
								<div style={s.formGroup}>
									<label style={s.formLabel}>THEME COLOR</label>
									<div style={s.colorPreview}>
										<div
											style={{
												width: "100%",
												height: "100%",
												background: `#${safeHex(items[selected].color)}`,
											}}
										/>
										<input
											type="color"
											style={s.colorInput}
											value={`#${safeHex(items[selected].color)}`}
											onChange={(e) =>
												updateItem(selected, {
													color:
														parseInt(e.target.value.replace("#", ""), 16) || 0,
												})
											}
										/>
									</div>
								</div>
								<div style={s.formGroup}>
									<label style={s.formLabel}>TEXT COLOR</label>
									<div style={s.colorPreview}>
										<div
											style={{
												width: "100%",
												height: "100%",
												background: `#${safeHex(items[selected].textColor)}`,
											}}
										/>
										<input
											type="color"
											style={s.colorInput}
											value={`#${safeHex(items[selected].textColor)}`}
											onChange={(e) =>
												updateItem(selected, {
													textColor:
														parseInt(e.target.value.replace("#", ""), 16) || 0,
												})
											}
										/>
									</div>
								</div>
							</div>

							<div style={s.formGroup}>
								<label style={s.formLabel}>MQTT PROTOCOL</label>
								<input
									style={s.input}
									placeholder="mqtt:cmd/payload"
									value={items[selected].action}
									onChange={(e) =>
										updateItem(selected, { action: e.target.value })
									}
								/>
							</div>

							<button
								onClick={() => removeItem(selected)}
								style={{
									...s.rawBtn,
									color: "#f87171",
									marginTop: "12px",
									background: "rgba(248, 113, 113, 0.1)",
									border: "1px solid rgba(248, 113, 113, 0.2)",
								}}
							>
								REMOVE COMPONENT
							</button>
						</div>
					) : (
						<div
							style={{ display: "flex", flexDirection: "column", gap: "20px" }}
						>
							<div style={s.formGroup}>
								<label style={s.formLabel}>WORKSPACE BACKGROUND</label>
								<div
									style={{ display: "flex", gap: "16px", alignItems: "center" }}
								>
									<div style={s.colorPreview}>
										<div
											style={{
												width: "100%",
												height: "100%",
												background: `#${safeHex(gridBg)}`,
											}}
										/>
										<input
											type="color"
											style={s.colorInput}
											value={`#${safeHex(gridBg)}`}
											onChange={(e) =>
												setGridBg(
													parseInt(e.target.value.replace("#", ""), 16) || 0,
												)
											}
										/>
									</div>
									<code
										style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}
									>
										#{safeHex(gridBg).toUpperCase()}
									</code>
								</div>
							</div>
							<p
								style={{
									color: "var(--text-dim)",
									textAlign: "center",
									fontSize: "0.8rem",
									marginTop: "20px",
									lineHeight: "1.6",
								}}
							>
								SELECT A COMPONENT ON THE MIRROR TO ACCESS GRANULAR
								CONFIGURATION OPTIONS.
							</p>
						</div>
					)}

					<hr
						style={{
							margin: "32px 0",
							border: "none",
							borderTop: "1px solid var(--border-glass)",
						}}
					/>
					<button onClick={save} disabled={saving} style={s.convBtn}>
						{saving ? "PREPARING SYNC..." : "DEPLOY TO STATION"}
					</button>
				</div>
			</div>
		</div>
	);
}

const s: Record<string, React.CSSProperties> = {
	app: {
		transition: "all 0.3s ease",
		display: "flex",
		flexDirection: "column",
		minHeight: "100vh",
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "24px 40px",
		borderRadius: "24px",
	},
	headerLeft: { display: "flex", alignItems: "center", gap: 60 },
	headerTitle: {
		fontWeight: 900,
		fontSize: "1.4rem",
		color: "var(--primary)",
		letterSpacing: "0.15em",
	},
	nav: { display: "flex", gap: 32 },
	navBtn: {
		background: "none",
		border: "none",
		fontWeight: 800,
		fontSize: "0.75rem",
		cursor: "pointer",
		letterSpacing: "0.1em",
		transition: "all 0.3s ease",
		padding: "8px 0",
	},
	main: { flex: 1, position: "relative" },
	layout: { display: "grid", gridTemplateColumns: "1fr 400px", gap: "32px" },
	inspector: { position: "sticky", top: 20, height: "fit-content" },
	cardTitle: {
		display: "block",
		fontSize: "0.75rem",
		fontWeight: 900,
		color: "var(--text-dim)",
		textTransform: "uppercase",
		letterSpacing: "0.15em",
	},
	stageBtn: {
		background: "var(--primary)",
		color: "#fff",
		border: "none",
		borderRadius: "12px",
		padding: "12px 24px",
		fontWeight: 900,
		fontSize: "0.75rem",
		cursor: "pointer",
		boxShadow: "0 8px 20px var(--primary-glow)",
		transition: "all 0.2s",
	},
	fileScroll: {
		maxHeight: "500px",
		overflowY: "auto",
		display: "flex",
		flexDirection: "column",
		gap: "4px",
	},
	fileRow: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "14px 20px",
		borderRadius: "16px",
		cursor: "pointer",
		transition: "all 0.2s",
	},
	fileMain: { display: "flex", alignItems: "center", gap: "12px" },
	fileIcon: { fontSize: "1.1rem", opacity: 0.7 },
	fileName: { fontSize: "0.9rem", fontWeight: 600, letterSpacing: "0.02em" },
	fileSize: { fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 800 },
	inlineDel: {
		background: "rgba(255,255,255,0.05)",
		border: "none",
		color: "var(--text-dim)",
		cursor: "pointer",
		fontSize: "0.8rem",
		width: "24px",
		height: "24px",
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	gridV: { width: "100%", height: "100%", position: "relative" },
	gridLineV: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: "1px",
		background: "rgba(255,255,255,0.02)",
	},
	gridLineH: {
		position: "absolute",
		left: 0,
		right: 0,
		height: "1px",
		background: "rgba(255,255,255,0.02)",
	},
	gridItem: {
		position: "absolute",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		cursor: "pointer",
	},
	gridLabel: {
		fontWeight: 800,
		color: "#fff",
		textShadow: "0 2px 10px rgba(0,0,0,0.5)",
	},
	formGroup: { display: "flex", flexDirection: "column", gap: "10px" },
	formLabel: {
		fontSize: "0.65rem",
		fontWeight: 900,
		color: "var(--text-dim)",
		letterSpacing: "0.1em",
	},
	input: {
		width: "100%",
		padding: "16px 20px",
		background: "var(--bg-input)",
		border: "1px solid var(--border-glass)",
		borderRadius: "14px",
		color: "#fff",
		fontSize: "0.9rem",
		transition: "all 0.2s",
	},
	convBtn: {
		width: "100%",
		background: "var(--primary)",
		color: "#fff",
		border: "none",
		borderRadius: "14px",
		padding: "18px",
		fontWeight: 900,
		fontSize: "0.85rem",
		cursor: "pointer",
		boxShadow: "0 10px 25px var(--primary-glow)",
		transition: "all 0.2s",
	},
	resizeHandle: {
		position: "absolute",
		right: 2,
		bottom: 2,
		width: "16px",
		height: "16px",
		cursor: "nwse-resize",
		background: "linear-gradient(135deg, transparent 50%, #fff 50%)",
		borderRadius: "2px",
		opacity: 0.4,
	},
	colorInput: {
		position: "absolute",
		top: 0,
		left: 0,
		width: "100%",
		height: "100%",
		cursor: "pointer",
		opacity: 0,
	} as any,
	colorPreview: {
		position: "relative",
		width: "100%",
		height: 48,
		borderRadius: 14,
		overflow: "hidden",
		border: "1px solid var(--border-glass)",
	},
	browserStack: {
		display: "flex",
		flexDirection: "column",
		gap: "32px",
		flex: 1,
	},
	browserHeader: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: "24px",
	},
	breadcrumbs: {
		display: "flex",
		gap: "8px",
		fontSize: "0.75rem",
		fontWeight: 900,
		color: "var(--text-dim)",
		letterSpacing: "0.1em",
	},
	crumb: { cursor: "pointer", transition: "color 0.2s" },
	miniInput: {
		background: "var(--bg-input)",
		border: "1px solid var(--border-glass)",
		borderRadius: "10px",
		padding: "8px 16px",
		color: "#fff",
		fontSize: "0.75rem",
		outline: "none",
	},
	playlistRow: { padding: "14px 20px" },
	check: {
		width: "20px",
		height: "20px",
		cursor: "pointer",
		accentColor: "var(--primary)",
	},
	sortControl: { display: "flex", gap: "8px" },
	sortBtn: {
		background: "rgba(255,255,255,0.05)",
		border: "none",
		borderRadius: "6px",
		color: "var(--text-main)",
		fontSize: "0.7rem",
		padding: "6px 10px",
		cursor: "pointer",
	},
	centreCol: { maxWidth: "680px", margin: "0 auto", width: "100%" },
	scanHeader: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
	},
	previewWrap: {
		width: "100%",
		aspectRatio: "16/9",
		borderRadius: "20px",
		overflow: "hidden",
		background: "#000",
		marginBottom: "24px",
		position: "relative",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		border: "1px solid var(--border-glass)",
	},
	previewImg: { width: "100%", height: "100%", objectFit: "contain" },
	imgBadge: {
		position: "absolute",
		top: "16px",
		right: "16px",
		background: "rgba(0,0,0,0.6)",
		backdropFilter: "blur(4px)",
		padding: "6px 12px",
		borderRadius: "8px",
		fontSize: "0.7rem",
		fontWeight: 900,
	},
	infoList: {
		display: "flex",
		flexDirection: "column",
		gap: "12px",
		marginBottom: "32px",
	},
	infoItem: {
		display: "flex",
		justifyContent: "space-between",
		fontSize: "0.85rem",
		color: "var(--text-dim)",
	},
	val: { color: "var(--text-main)", fontWeight: 600 },
	actionRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
	rawBtn: {
		borderRadius: "14px",
		padding: "16px",
		fontWeight: 800,
		fontSize: "0.8rem",
		cursor: "pointer",
		transition: "all 0.2s",
	},
	statusMsg: {
		textAlign: "center",
		marginTop: "20px",
		fontSize: "0.8rem",
		color: "var(--primary)",
		fontWeight: 900,
		letterSpacing: "0.05em",
	},
	floatingMenu: {
		position: "fixed",
		background: "rgba(10, 10, 20, 0.95)",
		backdropFilter: "blur(20px)",
		border: "1px solid var(--border-glass)",
		borderRadius: "16px",
		padding: "8px",
		boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
		zIndex: 9999,
		minWidth: "200px",
	},
	menuItem: {
		background: "none",
		border: "none",
		color: "var(--text-main)",
		padding: "12px 20px",
		textAlign: "left",
		borderRadius: "10px",
		cursor: "pointer",
		fontSize: "0.85rem",
		fontWeight: 700,
		width: "100%",
	} as any,
	emptyLab: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		height: "200px",
		color: "var(--text-dim)",
		fontSize: "0.75rem",
		fontWeight: 900,
		letterSpacing: "0.1em",
		lineHeight: "1.8",
	},
};

async function optimizeImage(blob: Blob): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = 800;
			canvas.height = 470;
			const ctx = canvas.getContext("2d");
			if (!ctx) return reject("No canvas context");
			const scale = Math.max(800 / img.width, 470 / img.height);
			const w = img.width * scale;
			const h = img.height * scale;
			ctx.drawImage(img, (800 - w) / 2, (470 - h) / 2, w, h);
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject("Canvas blob failed")),
				"image/jpeg",
				0.85,
			);
		};
		img.onerror = reject;
		img.src = URL.createObjectURL(blob);
	});
}
