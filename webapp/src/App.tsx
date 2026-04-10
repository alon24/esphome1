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

type GridElement = {
	id: string;
	name: string;
	type: "btn" | "switch" | "slider" | "label" | "clock";
	innerX: number;
	innerY: number;
	innerW: number;
	innerH: number;
	textColor: number;
	action: string;
};

type GridItem = {
	id: string;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
	color: number;
	elements: GridElement[];
};

type AppInfo = { file: string } | null;

const BUILD_ID = "v88-MULTI-ELEMENT";
const isDev = window.location.hostname === "localhost" || 
              window.location.hostname === "127.0.0.1" || 
              window.location.port === "5173" ||
              window.location.hostname.includes("codeserver") ||
              window.location.hostname.includes("gitpod") ||
              window.location.hostname.includes("github.dev");

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
		if (isDev) {
			setAppInfo({ file: "/root/claude-dev/projects/esphome1/mock_dev.json" });
			return;
		}
		fetch("/api/spa/info")
			.then((r) => r.json())
			.then((data) => setAppInfo(data))
			.catch((e) => console.error("SPA info fetch failed:", e));
	}, []);

	const fetchStatus = useCallback(() => {
		if (isDev) {
			setStatus({ connected: true, ip: "127.0.0.1", ssid: "MOCK_WIFI" });
			return;
		}
		fetch("/api/wifi/status")
			.then((r) => r.json())
			.then((d) => setStatus(d))
			.catch(() => setStatus({ connected: false, ip: "", ssid: "" }));
	}, []);

	useEffect(() => {
		fetchStatus();
		if (isDev) return;
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
				<div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
					{isDev && (
						<button 
							onClick={() => {
								if (confirm("CLEAR ALL MOCK STORAGE? This will erase all local screens.")) {
									localStorage.clear();
									window.location.reload();
								}
							}}
							style={{
								background: "rgba(244, 63, 94, 0.15)",
								color: "#f43f5e",
								border: "1px solid rgba(244, 63, 94, 0.3)",
								borderRadius: "10px",
								padding: "8px 16px",
								fontSize: "0.65rem",
								fontWeight: 900,
								cursor: "pointer",
								letterSpacing: "0.1em",
								transition: "all 0.2s"
							}}
							className="glass-hover"
						>
							RESET MOCK
						</button>
					)}
					<WifiStatusBadge status={status} />
				</div>
			</header>

			<main className="animate-in">
				{activeTab === "grid" ? (
					<GridTab appInfo={appInfo} status={status} />
				) : activeTab === "wifi" ? (
					<div style={{ padding: "40px" }}><WifiTab status={status} onFetchStatus={fetchStatus} /></div>
				) : activeTab === "sd" ? (
					<div style={{ padding: "40px" }}><SDTab /></div>
				) : (
					<div style={{ padding: "40px" }}><SettingsTab /></div>
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
	const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
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

	const migrateData = (itemsArr: any[]): GridItem[] => {
		return itemsArr.map((it, i) => {
			if (it.elements) return it as GridItem;
			const compId = it.id || `comp_${Math.random().toString(36).substr(2, 5)}`;
			return {
				id: compId,
				name: it.name || `Component ${i + 1}`,
				x: it.x || 0,
				y: it.y || 0,
				w: it.w || 2,
				h: it.h || 2,
				color: it.color || 0x1c2828,
				elements: [
					{
						id: `${compId}_el0`,
						name: "Main Element",
						type: (it as any).type || "btn",
						innerX: (it as any).innerX !== undefined ? (it as any).innerX : 5,
						innerY: (it as any).innerY !== undefined ? (it as any).innerY : 5,
						innerW: (it as any).innerW !== undefined ? (it as any).innerW : 60,
						innerH: (it as any).innerH !== undefined ? (it as any).innerH : 40,
						textColor: (it as any).textColor !== undefined ? (it as any).textColor : 0xffffff,
						action: (it as any).action || ""
					}
				]
			};
		});
	};

	const [dragInfo, setDragInfo] = useState<{
		idx: number;
		elId?: string;
		startX: number;
		startY: number;
		initialX: number;
		initialY: number;
		initialW: number;
		initialH: number;
		initialInnerW: number;
		initialInnerH: number;
		mode: "move" | "resize" | "inner-resize";
	} | null>(null);
	const [clipboard, setClipboard] = useState<GridItem | null>(null);
	const [activeScreen, setActiveScreen] = useState("main");
	const [screenName, setScreenName] = useState("Main Dashboard");
	const [screenId, setScreenId] = useState("main_scr");
	const [screenIsDefault, setScreenIsDefault] = useState(true);
	const [screens, setScreens] = useState<string[]>(["main"]);
	const mirrorScrollRef = useRef<HTMLDivElement>(null);

	const selectItem = (idx: number | null) => {
		setSelected(idx);
		if (idx !== null && mirrorScrollRef.current) {
			const item = items[idx];
			mirrorScrollRef.current.scrollTo({
				top: item.y * 80 - 100,
				behavior: "smooth"
			});
		}
	};

	const loadScreen = (name: string) => {
		setSyncStatus(`Loading ${name}...`);
		if (isDev) {
			const saved = localStorage.getItem(`scr_${name}`);
			if (saved) {
				const d = JSON.parse(saved);
				setItems(migrateData(d.items || []));
				if (d.bg !== undefined) setGridBg(d.bg);
				setScreenName(d.name || name);
				setScreenId(d.id || `${name}_scr`);
				setScreenIsDefault(d.isDefault || name === "main");
			} else {
				setItems([]);
				setScreenName(name);
				setScreenId(`${name}_scr`);
				setScreenIsDefault(name === "main");
			}
			setActiveScreen(name);
			setSyncStatus("Local Cache");
			return;
		}
		fetch(`/api/grid/config?name=${name}`)
			.then((r) => r.json())
			.then((d) => {
				setItems(migrateData(d.items || []));
				if (d.bg !== undefined) setGridBg(d.bg);
				setScreenName(d.name || name);
				setScreenId(d.id || `${name}_scr`);
				setScreenIsDefault(d.isDefault || name === "main");
				setActiveScreen(name);
				setSyncStatus("");
			});
	};

	const refreshScreens = () => {
		if (isDev) {
			const keys = Object.keys(localStorage).filter(k => k.startsWith("scr_")).map(k => k.replace("scr_", ""));
			setScreens(["main", ...keys.filter(k => k !== "main")]);
			return;
		}
		fetch("/api/grid/screens")
			.then((r) => r.json())
			.then((d) => setScreens(d.screens || ["main"]));
	};

	const renameScreen = (oldName: string) => {
		if (oldName === "main") return;
		const newName = prompt("New name for screen:", oldName);
		if (!newName || newName === oldName) return;
		
		if (isDev) {
			const data = localStorage.getItem(`scr_${oldName}`);
			if (data) {
				localStorage.setItem(`scr_${newName}`, data);
				localStorage.removeItem(`scr_${oldName}`);
				setActiveScreen(newName);
				refreshScreens();
			}
			return;
		}
		// TODO: Hardware rename via SD/FS move
	};

	const deleteScreen = (name: string) => {
		if (name === "main") {
			alert("Cannot delete main screen.");
			return;
		}
		if (!confirm(`Delete screen '${name}'? This cannot be undone.`)) return;

		if (isDev) {
			localStorage.removeItem(`scr_${name}`);
			if (activeScreen === name) loadScreen("main");
			refreshScreens();
			return;
		}
		// TODO: Hardware delete
	};

	useEffect(() => {
		loadScreen("main");
		refreshScreens();
	}, []);

	const save = () => {
		const payload = { 
			items, 
			bg: gridBg,
			name: screenName,
			id: screenId,
			isDefault: screenIsDefault
		};

		if (isDev) {
			localStorage.setItem(`scr_${activeScreen}`, JSON.stringify(payload));
			setSyncStatus("Saved Locally");
			refreshScreens();
			return;
		}
		setSaving(true);
		setSyncStatus("Syncing...");

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);

		fetch(`/api/grid/config?name=${activeScreen}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
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
				if (e.key === "d" && selected !== null) {
					e.preventDefault();
					const newItem = {
						...items[selected],
						x: Math.min(7, items[selected].x + 0.5),
						y: Math.min(15, items[selected].y + 0.5),
					};
					setItems([...items, newItem]);
					setSelected(items.length);
					setSyncStatus("Duplicated");
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

	const updateElement = (compIdx: number, elId: string, patch: Partial<GridElement>) => {
		const next = [...items];
		const elIdx = next[compIdx].elements.findIndex(e => e.id === elId);
		if (elIdx !== -1) {
			next[compIdx].elements[elIdx] = { ...next[compIdx].elements[elIdx], ...patch };
			setItems(next);
		}
	};

	const addItem = () => {
		const newId = `comp_${Math.random().toString(36).substr(2, 5)}`;
		const newItem: GridItem = {
			id: newId,
			name: `Component ${items.length + 1}`,
			x: 0, y: 0, w: 2, h: 2,
			color: 0x1c2828,
			elements: [
				{
					id: `${newId}_el0`,
					name: "Default Element",
					type: "btn",
					innerX: 5, innerY: 5, innerW: 60, innerH: 40,
					textColor: 0xffffff,
					action: ""
				}
			],
		};
		setItems([ ...items, newItem ]);
		setSelected(items.length);
		setSelectedElementId(`${newId}_el0`);
	};

	const addElement = (compIdx: number) => {
		const it = items[compIdx];
		const newId = `${it.id}_el${it.elements.length}`;
		const newEl: GridElement = {
			id: newId,
			name: `Element ${it.elements.length + 1}`,
			type: "label",
			innerX: 10, innerY: 10, innerW: 50, innerH: 30,
			textColor: 0xffffff,
			action: ""
		};
		const next = [...items];
		next[compIdx].elements = [...next[compIdx].elements, newEl];
		setItems(next);
		setSelectedElementId(newId);
	};

	const removeItem = (idx: number) => {
		setItems(items.filter((_, i) => i !== idx));
		setSelected(null);
		setSelectedElementId(null);
	};

	const removeElement = (compIdx: number, elId: string) => {
		const next = [...items];
		next[compIdx].elements = next[compIdx].elements.filter(e => e.id !== elId);
		setItems(next);
		setSelectedElementId(null);
	};

	const onMouseDown = (
		e: React.MouseEvent,
		idx: number,
		mode: "move" | "resize" | "inner-resize",
		elId?: string
	) => {
		e.preventDefault();
		const it = items[idx];
		const el = elId ? it.elements.find(e => e.id === elId) : null;

		setDragInfo({
			idx,
			elId,
			startX: e.clientX,
			startY: e.clientY,
			initialX: mode === "inner-resize" || (editingInner === idx && el) ? el!.innerX : it.x,
			initialY: mode === "inner-resize" || (editingInner === idx && el) ? el!.innerY : it.y,
			initialW: it.w,
			initialH: it.h,
			initialInnerW: el ? el.innerW : 60,
			initialInnerH: el ? el.innerH : 40,
			mode,
		});
		if (elId) setSelectedElementId(elId);
	};

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragInfo) return;

			const next = [...items];
			const it = next[dragInfo.idx];
			
			if (dragInfo.mode === "move") {
				if (editingInner === dragInfo.idx || selected === dragInfo.idx) {
					if (selected === dragInfo.idx && editingInner !== dragInfo.idx) {
						// DRAG WHOLE BLOCK
						const dx = Math.round((e.clientX - dragInfo.startX) / 80);
						const dy = Math.round((e.clientY - dragInfo.startY) / 80);
						it.x = Math.max(0, Math.min(8 - dragInfo.initialW, dragInfo.initialX + dx));
						it.y = Math.max(0, dragInfo.initialY + dy);
					} else if (dragInfo.elId) {
						// DRAG INNER ELEMENT (Top-Left anchored)
						const el = it.elements.find(e => e.id === dragInfo.elId);
						if (el) {
							const blockW = it.w * 80;
							const blockH = it.h * 80;
							const dxP = ((e.clientX - dragInfo.startX) / blockW) * 100;
							const dyP = ((e.clientY - dragInfo.startY) / blockH) * 100;
							el.innerX = Math.max(0, Math.min(100, dragInfo.initialX + dxP));
							el.innerY = Math.max(0, Math.min(100, dragInfo.initialY + dyP));
						}
					}
				}
			} else if (dragInfo.mode === "resize") {
				// RESIZE BLOCK
				const dx = Math.round((e.clientX - dragInfo.startX) / 80);
				const dy = Math.round((e.clientY - dragInfo.startY) / 80);
				it.w = Math.max(1, Math.min(8 - it.x, dragInfo.initialW + dx));
				it.h = Math.max(1, dragInfo.initialH + dy);
			} else if (dragInfo.mode === "inner-resize" && dragInfo.elId) {
				// RESIZE INNER ELEMENT
				const el = it.elements.find(e => e.id === dragInfo.elId);
				if (el) {
					const blockW = it.w * 80;
					const blockH = it.h * 80;
					const dxP = ((e.clientX - dragInfo.startX) / blockW) * 100;
					const dyP = ((e.clientY - dragInfo.startY) / blockH) * 100;
					el.innerW = Math.max(5, Math.min(200, dragInfo.initialInnerW + dxP));
					el.innerH = Math.max(5, Math.min(200, dragInfo.initialInnerH + dyP));
				}
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
		<div className="app-layout" style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr 400px", gap: "32px", padding: "0 24px 24px 24px", boxSizing: "border-box", overflow: "hidden", height: "calc(100vh - 120px)" }}>
				{/* --- LAYERS / HIERARCHY NAVIGATOR --- */}
				<div className="navigator-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
					<div style={{ ...s.glassCard, height: "100%", display: "flex", flexDirection: "column" }}>
						<button 
							onClick={() => addItem()}
							className="glass-btn primary" 
							style={{ marginBottom: "20px", padding: "14px", width: "100%" }}
						>
							<span style={{ fontSize: "0.7rem", fontWeight: 900 }}>+ NEW COMPONENT</span>
						</button>
						
						<div style={{ ...s.cardTitle, marginBottom: "16px" }}>
							SCREENS
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
							{screens.map(sName => (
								<div 
									key={sName} 
									style={{ 
										display: "flex", 
										alignItems: "center", 
										gap: "4px",
										background: activeScreen === sName ? "rgba(139, 92, 246, 0.15)" : "transparent",
										padding: "2px",
										borderRadius: "8px",
										border: activeScreen === sName ? "1px solid var(--primary)" : "1px solid transparent",
									}}
								>
									<button 
										onClick={() => loadScreen(sName)}
										style={{
											background: "none",
											color: activeScreen === sName ? "#fff" : "var(--text-dim)",
											border: "none",
											padding: "6px 12px",
											fontSize: "0.75rem",
											fontWeight: 800,
											cursor: "pointer",
											flex: 1,
											textAlign: "left"
										}}
									>
										{sName === "main" || sName === activeScreen && screenIsDefault ? `* ${sName.toUpperCase()}` : sName.toUpperCase()}
									</button>
								</div>
							))}
							<button 
								onClick={() => {
									const name = prompt("Enter screen name:");
									if (name) {
										setItems([]);
										setActiveScreen(name);
										setScreens([...screens, name]);
										setScreenName(name);
										setScreenId(`${name}_scr`);
										setScreenIsDefault(false);
									}
								}}
								style={{
									background: "rgba(16, 185, 129, 0.1)",
									color: "#10b981",
									border: "1px dashed rgba(16, 185, 129, 0.3)",
									borderRadius: "8px",
									padding: "8px",
									fontSize: "0.7rem",
									fontWeight: 900,
									marginTop: "4px",
									cursor: "pointer"
								}}
							>
								+ NEW SCREEN
							</button>
						</div>

						<div style={{ ...s.cardTitle, marginBottom: "12px" }}>
							HIERARCHY
						</div>
						<div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
							{/* LEVEL 1: ACTIVE SCREEN */}
							<div style={{ 
								padding: "10px", 
								fontSize: "0.8rem", 
								fontWeight: 900, 
								color: "#fff", 
								display: "flex", 
								alignItems: "center", 
								gap: "8px",
								borderBottom: "1px solid rgba(255,255,255,0.05)"
							}}>
								<span style={{ color: "var(--primary)" }}>▣</span> {screenName.toUpperCase()} 
								<span style={{ fontSize: "0.6rem", color: "var(--text-dim)", opacity: 0.5 }}>[{screenId}]</span>
							</div>

							<div style={{ marginLeft: "12px", borderLeft: "1px solid rgba(255,255,255,0.05)", paddingLeft: "12px", marginTop: "12px" }}>
								{items.map((it, i) => (
									<div key={it.id || i} style={{ marginBottom: "16px" }}>
										{/* LEVEL 2: COMPONENT */}
										<div 
											onClick={() => selectItem(i)}
											style={{
												padding: "8px",
												background: selected === i ? "rgba(168, 85, 247, 0.2)" : "transparent",
												borderRadius: "6px",
												cursor: "pointer",
												display: "flex",
												alignItems: "center",
												gap: "8px",
												border: selected === i ? "1px solid var(--primary)" : "1px solid transparent"
											}}
										>
											<span style={{ color: "var(--accent)", fontSize: "0.7rem" }}>⬚</span>
											<div style={{ flex: 1 }}>
												<div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>{it.name}</div>
												<div style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>ID: {it.id || `C_${i}`} • {it.w}x{it.h} Grid</div>
											</div>
											<button 
												onClick={(e) => { e.stopPropagation(); addElement(i); }}
												style={{
													background: "rgba(139, 92, 246, 0.2)",
													border: "1px solid var(--primary)",
													color: "var(--primary)",
													width: "24px",
													height: "24px",
													borderRadius: "4px",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													fontSize: "1rem",
													fontWeight: 900,
													cursor: "pointer",
													transition: "all 0.2s"
												}}
												onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "#fff"; }}
												onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)"; e.currentTarget.style.color = "var(--primary)"; }}
											>
												+
											</button>
										</div>

										{/* LEVEL 3: ELEMENTS (Nested Widgets) */}
										<div style={{ marginLeft: "20px", marginTop: "6px", borderLeft: "1px dashed rgba(255,255,255,0.15)", paddingLeft: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
											{it.elements?.map(el => (
												<div 
													key={el.id}
													onClick={(e) => { e.stopPropagation(); selectItem(i); setSelectedElementId(el.id); }}
													style={{
														padding: "4px 8px",
														fontSize: "0.65rem",
														color: selectedElementId === el.id && selected === i ? "var(--primary)" : "#888",
														cursor: "pointer",
														display: "flex",
														alignItems: "center",
														gap: "6px",
														background: selectedElementId === el.id && selected === i ? "rgba(139, 92, 246, 0.1)" : "transparent",
														borderRadius: "4px",
														border: selectedElementId === el.id && selected === i ? "1px solid rgba(139, 92, 246, 0.2)" : "1px solid transparent"
													}}
												>
													<span>◈</span>
													<div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
														<span style={{ fontWeight: 800 }}>{el.name.toUpperCase()}</span>
														<span style={{ opacity: 0.5, fontSize: "0.55rem" }}>{el.type}</span>
													</div>
												</div>
											))}
											{(!it.elements || it.elements.length === 0) && (
												<div style={{ fontSize: "0.6rem", color: "var(--text-dim)", opacity: 0.5, padding: "4px" }}>NO WIDGETS</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>

				<div 
					className="center-column"
					style={{ 
						flex: 1, 
						display: "flex", 
						flexDirection: "column", 
						padding: "32px", 
						gap: "32px", 
						overflow: "hidden" 
					}}
				>
					{/* --- BLUEPRINT MIRROR HEADER --- */}
					<div style={{ ...s.glassCard, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px" }}>
						<div>
							<h1 style={{ ...s.headerTitle, margin: 0, fontSize: "1.2rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>BLUEPRINT MIRROR</h1>
							<div style={{ opacity: 0.5, fontSize: "11px", marginTop: "4px", fontWeight: 800 }}>
								{appInfo?.file ? `ACTIVE: ${appInfo.file.split("/").pop()}` : "NO ACTIVE BLUEPRINT"}
							</div>
						</div>
						<button 
							onClick={() => addItem()}
							style={s.primaryBtn}
							onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
							onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
						>
							<span style={{ fontSize: "18px" }}>+</span> ADD COMPONENT
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
										{isDev && <span style={{ color: "#ff4444", fontSize: "10px", padding: "2px 6px", background: "rgba(255,0,0,0.1)", borderRadius: "4px", marginLeft: "8px" }}>MOCK MODE</span>}
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
											ref={mirrorScrollRef}
											onMouseDown={() => {
												selectItem(null);
												setEditingInner(null);
											}}
											style={{
												...s.gridV,
												width: "100%",
												height: 1600,
												position: "absolute",
												top: 0,
												left: 0,
											}}
										>
											{Array.from({ length: 8 }).map((_, i) => (
												<div
													key={i}
													style={{ ...s.gridLineV, left: (i + 1) * 80, height: "100%" }}
												/>
											))}
											{Array.from({ length: 20 }).map((_, i) => (
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
																width: "100%",
																height: "100%",
																position: "relative",
																pointerEvents: "none",
															}}
														>
															{/* Inner Resize Corner */}
															{selected === i && (
																<div 
																	onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, i, "inner-resize"); }}
																	style={{
																		position: "absolute",
																		right: -8,
																		bottom: -8,
																		width: 12,
																		height: 12,
																		background: "var(--primary)",
																		borderRadius: "2px",
																		cursor: "nwse-resize",
																		zIndex: 100,
																		boxShadow: "0 0 10px var(--primary-glow)"
																	}}
																/>
															)}
															{it.elements?.map((el) => {
																const isElSelected = selectedElementId === el.id && selected === i;
																return (
																	<div
																		key={el.id}
																		onMouseDown={(e) => {
																			if (selected === i) {
																				e.stopPropagation();
																				onMouseDown(e as any, i, "move", el.id);
																			}
																		}}
																		style={{
																			position: "absolute",
																			left: `${el.innerX}%`,
																			top: `${el.innerY}%`,
																			display: "flex",
																			flexDirection: "column",
																			width: "fit-content",
																			border: isElSelected ? "2px dashed var(--primary)" : "1.5px solid transparent",
																			padding: "4px",
																			margin: "-4px",
																			borderRadius: "8px",
																			pointerEvents: "auto",
																			cursor: selected === i ? "move" : "default",
																			zIndex: isElSelected ? 100 : 10,
																			background: isElSelected ? "rgba(139, 92, 246, 0.1)" : "transparent",
																		}}
																	>
																		{/* Element Resize */}
																		{isElSelected && (
																			<div 
																				onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e as any, i, "inner-resize", el.id); }}
																				style={{
																					position: "absolute",
																					right: -8,
																					bottom: -8,
																					width: 12,
																					height: 12,
																					background: "var(--primary)",
																					borderRadius: "2px",
																					cursor: "nwse-resize",
																					zIndex: 100,
																					boxShadow: "0 0 10px var(--primary-glow)"
																				}}
																			/>
																		)}

																		{el.type === "label" && (
																			<span
																				style={{
																					...s.gridLabel,
																					color: `#${safeHex(el.textColor, "ffffff")}`,
																					fontSize: `${(1.2 * (el.innerW || 100)) / 100}rem`,
																					whiteSpace: "nowrap",
																				}}
																			>
																				{el.name}
																			</span>
																		)}
																		{el.type === "switch" && (
																			<div
																				style={{
																					width: (60 * (el.innerW || 100)) / 100,
																					height: (32 * (el.innerW || 100)) / 100,
																					borderRadius: "100px",
																					background: "var(--primary)",
																					position: "relative",
																					boxShadow: "0 0 15px var(--primary-glow)",
																					display: "flex",
																					alignItems: "center"
																				}}
																			>
																				<div
																					style={{
																						width: (22 * (el.innerW || 100)) / 100,
																						height: (22 * (el.innerW || 100)) / 100,
																						borderRadius: "50%",
																						background: "#fff",
																						position: "absolute",
																						right: (6 * (el.innerW || 100)) / 100,
																						boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
																					}}
																				/>
																			</div>
																		)}
																		{el.type === "slider" && (
																			<div
																				style={{
																					width: (120 * (el.innerW || 100)) / 100,
																					height: (8 * (el.innerW || 100)) / 100,
																					borderRadius: "100px",
																					background: "rgba(255,255,255,0.1)",
																					position: "relative",
																					display: "flex",
																					alignItems: "center"
																				}}
																			>
																				<div
																					style={{
																						width: "60%",
																						height: "100%",
																						background: "var(--primary)",
																						borderRadius: "100px",
																						boxShadow: "0 0 10px var(--primary-glow)",
																					}}
																				/>
																			</div>
																		)}
																		{el.type === "btn" && (
																			<div
																				style={{
																					width: Math.min((60 * (el.innerW || 100)) / 100, it.w * 80),
																					height: Math.min((40 * (el.innerW || 100)) / 100, it.h * 80),
																					borderRadius: (8 * (el.innerW || 100)) / 100,
																					background: "linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)",
																					boxShadow: "0 0 25px var(--primary-glow)",
																					display: "flex",
																					alignItems: "center",
																					justifyContent: "center",
																					color: "#fff",
																					fontSize: "0.6rem",
																					fontWeight: 900
																				}}
																			>
																				{el.name?.substring(0, 4) || "PUSH"}
																			</div>
																		)}
																		{el.type === "clock" && (
																			<span
																				style={{
																					fontSize: `${(1.6 * (el.innerW || 100)) / 100}rem`,
																					fontWeight: 900,
																					color: "var(--primary)",
																					textShadow: "0 0 15px var(--primary-glow)",
																					letterSpacing: "0.05em",
																					fontFamily: "monospace"
																				}}
																			>
																				{time}
																			</span>
																		)}
																	</div>
																);
															})}
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
					<div style={{ ...s.glassCard, height: "100%", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "32px",
						}}
					>
						<span style={{ ...s.cardTitle, marginBottom: 0 }}>
							{selectedElementId ? "ELEMENT" : selected !== null ? "COMPONENT" : "SYSTEM"}
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

					{selected !== null ? (() => {
						const it = items[selected];
						const el = selectedElementId ? it.elements.find(e => e.id === selectedElementId) : null;

						if (selectedElementId && el) {
							return (
								<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
									<div style={s.formGroup}>
										<label style={s.formLabel}>NAME</label>
										<input
											style={s.input}
											value={el.name}
											onChange={(e) => updateElement(selected, el.id, { name: e.target.value })}
										/>
									</div>
									<div style={s.formGroup}>
										<label style={s.formLabel}>WIDGET TYPE</label>
										<select
											style={{ ...s.input as any, border: "1px solid var(--primary)", boxShadow: "0 0 10px var(--primary-glow)" }}
											value={el.type}
											onChange={(e) => updateElement(selected, el.id, { type: e.target.value as any })}
										>
											<option value="btn">Momentary Button</option>
											<option value="switch">Binary Switch</option>
											<option value="slider">Analog Slider</option>
											<option value="label">Static Label</option>
											<option value="clock">Real-time Clock</option>
										</select>
									</div>
									<div style={s.formGroup}>
										<label style={s.formLabel}>X-POSITION (%)</label>
										<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
											<input type="range" min="0" max="100" style={{ flex: 1, accentColor: "var(--primary)" }} value={el.innerX} onChange={(e) => updateElement(selected, el.id, { innerX: parseInt(e.target.value) })} />
											<input type="number" style={{ ...s.input, width: "70px", padding: "6px", textAlign: "center" }} value={Math.round(el.innerX)} onChange={(e) => updateElement(selected, el.id, { innerX: parseInt(e.target.value) || 0 })} />
										</div>
									</div>
									<div style={s.formGroup}>
										<label style={s.formLabel}>Y-POSITION (%)</label>
										<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
											<input type="range" min="0" max="100" style={{ flex: 1, accentColor: "var(--primary)" }} value={el.innerY} onChange={(e) => updateElement(selected, el.id, { innerY: parseInt(e.target.value) })} />
											<input type="number" style={{ ...s.input, width: "70px", padding: "6px", textAlign: "center" }} value={Math.round(el.innerY)} onChange={(e) => updateElement(selected, el.id, { innerY: parseInt(e.target.value) || 0 })} />
										</div>
									</div>
									<div style={s.formGroup}>
										<label style={s.formLabel}>WIDGET WIDTH (%)</label>
										<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
											<input type="range" min="5" max="200" style={{ flex: 1, accentColor: "var(--primary)" }} value={el.innerW} onChange={(e) => updateElement(selected, el.id, { innerW: parseInt(e.target.value) })} />
											<input type="number" style={{ ...s.input, width: "70px", padding: "6px", textAlign: "center" }} value={Math.round(el.innerW)} onChange={(e) => updateElement(selected, el.id, { innerW: parseInt(e.target.value) || 0 })} />
										</div>
									</div>
									<div style={s.formGroup}>
										<label style={s.formLabel}>WIDGET HEIGHT (%)</label>
										<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
											<input type="range" min="5" max="200" style={{ flex: 1, accentColor: "var(--primary)" }} value={el.innerH} onChange={(e) => updateElement(selected, el.id, { innerH: parseInt(e.target.value) })} />
											<input type="number" style={{ ...s.input, width: "70px", padding: "6px", textAlign: "center" }} value={Math.round(el.innerH)} onChange={(e) => updateElement(selected, el.id, { innerH: parseInt(e.target.value) || 0 })} />
										</div>
									</div>
									<div style={s.formGroup}>
										<label style={s.formLabel}>TEXT COLOR</label>
										<div style={s.colorPreview}>
											<div style={{ width: "100%", height: "100%", background: `#${safeHex(el.textColor)}` }} />
											<input type="color" style={s.colorInput} value={`#${safeHex(el.textColor)}`} onChange={(e) => updateElement(selected, el.id, { textColor: parseInt(e.target.value.replace("#", ""), 16) || 0 })} />
										</div>
									</div>
									<div style={s.formGroup}>
										<label style={s.formLabel}>ACTION / NAVIGATION</label>
										<input
											style={s.input}
											placeholder="mqtt:cmd or goto:screen_name"
											value={el.action}
											onChange={(e) => updateElement(selected, el.id, { action: e.target.value })}
										/>
									</div>
									<div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
										<button onClick={() => setSelectedElementId(null)} style={{ ...s.secondaryBtn, flex: 1 }}>BACK TO BLOCK</button>
										<button onClick={() => removeElement(selected, el.id)} style={{ ...s.dangerBtn, flex: 1, padding: "8px" }}>DELETE EL</button>
									</div>
								</div>
							);
						}

						return (
							<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
								<div style={s.formGroup}>
									<label style={s.formLabel}>BLOCK NAME</label>
									<input
										style={s.input}
										value={it.name}
										onChange={(e) => updateItem(selected, { name: e.target.value })}
									/>
								</div>
								<div style={s.formGroup}>
									<label style={s.formLabel}>GRID POSITION</label>
									<div style={{ fontSize: "0.8rem", color: "var(--text-dim)", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
										X: {it.x}, Y: {it.y} | SIZE: {it.w}x{it.h}
									</div>
								</div>
								<div style={s.formGroup}>
									<label style={s.formLabel}>CONTAINER COLOR</label>
									<div style={s.colorPreview}>
										<div style={{ width: "100%", height: "100%", background: `#${safeHex(it.color)}` }} />
										<input type="color" style={s.colorInput} value={`#${safeHex(it.color)}`} onChange={(e) => updateItem(selected, { color: parseInt(e.target.value.replace("#", ""), 16) || 0 })} />
									</div>
								</div>
								
								<div style={{ ...s.card, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}>
									<label style={{ ...s.formLabel, marginBottom: "12px" }}>NESTED ELEMENTS ({it.elements.length})</label>
									<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
										{it.elements.map(e => (
											<div key={e.id} 
												onClick={() => setSelectedElementId(e.id)}
												style={{
													padding: "8px 12px", 
													background: "rgba(255,255,255,0.05)", 
													borderRadius: "6px", 
													fontSize: "0.75rem", 
													cursor: "pointer",
													display: "flex",
													justifyContent: "space-between",
													border: "1px solid transparent",
													transition: "all 0.2s"
												}}
												onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
												onMouseLeave={(e) => e.currentTarget.style.borderColor = "transparent"}
											>
												<span style={{ fontWeight: 900 }}>{e.name.toUpperCase()}</span>
												<span style={{ opacity: 0.5 }}>{e.type.toUpperCase()}</span>
											</div>
										))}
										<button onClick={() => addElement(selected)} style={{ ...s.secondaryBtn, marginTop: "8px", fontSize: "0.7rem", padding: "8px" }}>+ ADD WIDGET</button>
									</div>
								</div>

								<button onClick={() => removeItem(selected)} style={{ ...s.dangerBtn, marginTop: "20px" }}>DELETE COMPONENT</button>
							</div>
						);
					})() : (
						<div
							style={{ display: "flex", flexDirection: "column", gap: "24px" }}
						>
							<div style={{ ...s.cardTitle, marginBottom: "8px" }}>
								SCREEN MASTER
							</div>

							<div style={s.formGroup}>
								<label style={s.formLabel}>BOARD NAME</label>
								<input
									style={s.input}
									value={screenName}
									onChange={(e) => setScreenName(e.target.value)}
									placeholder="e.g. Living Room Dashboard"
								/>
							</div>

							<div style={s.formGroup}>
								<label style={s.formLabel}>SCREEN ID (UNIQUE)</label>
								<input
									style={s.input}
									value={screenId}
									onChange={(e) => setScreenId(e.target.value)}
									placeholder="e.g. main_scr"
								/>
							</div>

							<div style={{ ...s.formGroup, flexDirection: "row", justifyContent: "space-between", alignItems: "center", display: "flex" }}>
								<label style={s.formLabel}>DEFAULT BOOT SCREEN</label>
								<input 
									type="checkbox"
									checked={screenIsDefault}
									onChange={(e) => setScreenIsDefault(e.target.checked)}
									style={{ width: "20px", height: "20px", accentColor: "var(--primary)" }}
								/>
							</div>

							<hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.05)", margin: "8px 0" }} />

							<div style={s.formGroup}>
								<label style={s.formLabel}>GLOBAL CANVAS COLOR</label>
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
									<code style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
										#{safeHex(gridBg).toUpperCase()}
									</code>
								</div>
							</div>
						</div>
					)}

					<hr style={{ margin: "32px 0", border: "none", borderTop: "1px solid rgba(255,255,255,0.05)" }} />
					<button 
						onClick={save} 
						disabled={saving} 
						style={s.deployBtn}
						onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
						onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
					>
						{saving ? "SAVING..." : "DEPLOY TO STATION"}
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
		background: "#08080f",
		color: "#e2e8f0",
	},
	glassCard: {
		background: "rgba(15, 15, 25, 0.6)",
		backdropFilter: "blur(20px)",
		border: "1px solid rgba(255, 255, 255, 0.08)",
		borderRadius: "20px",
		boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
		padding: "24px",
		transition: "all 0.3s ease",
	},
	primaryBtn: {
		background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
		color: "white",
		border: "none",
		padding: "12px 24px",
		borderRadius: "12px",
		cursor: "pointer",
		fontWeight: "600",
		fontSize: "13px",
		letterSpacing: "1px",
		textTransform: "uppercase" as const,
		boxShadow: "0 4px 15px rgba(139, 92, 246, 0.4), 0 0 20px rgba(139, 92, 246, 0.2)",
		transition: "all 0.3s ease",
		display: "flex",
		alignItems: "center",
		gap: "8px",
	},
	deployBtn: {
		width: "100%",
		padding: "18px",
		background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
		color: "white",
		borderRadius: "14px",
		fontSize: "14px",
		fontWeight: "bold",
		textTransform: "uppercase" as const,
		letterSpacing: "2px",
		border: "none",
		boxShadow: "0 8px 25px rgba(139, 92, 246, 0.5), inset 0 0 15px rgba(255,255,255,0.2)",
		cursor: "pointer",
		marginTop: "24px",
		transition: "all 0.3s ease",
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
	inspector: { 
		display: "flex", 
		flexDirection: "column", 
		width: "100%", 
		minWidth: "400px",
		height: "100%",
		overflowY: "auto",
		paddingRight: "8px"
	},
	cardTitle: {
		display: "block",
		fontSize: "0.75rem",
		fontWeight: 900,
		color: "var(--primary)",
		textTransform: "uppercase",
		letterSpacing: "0.15em",
		textShadow: "0 0 12px var(--primary-glow)",
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
	gridV: { width: "100%", height: "100%", position: "relative", backgroundColor: "#111827" },
	gridLineV: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: "1px",
		background: "rgba(255,255,255,0.05)",
	},
	gridLineH: {
		position: "absolute",
		left: 0,
		right: 0,
		height: "1px",
		background: "rgba(255,255,255,0.05)",
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
		border: "1px solid rgba(255,255,255,0.15)",
		borderRadius: "14px",
		color: "var(--text-main)",
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
		background: "linear-gradient(135deg, transparent 50%, var(--primary) 50%)",
		borderRadius: "2px",
		opacity: 0.6,
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
		border: "1px solid rgba(255,255,255,0.1)",
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
