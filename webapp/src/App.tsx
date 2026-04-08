import { useCallback, useEffect, useState, useRef, useMemo } from "react";

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
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  textColor: number;
  action: string;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"wifi" | "sd" | "settings" | "grid">("grid");
  const [status, setStatus] = useState<WifiStatus>(null);

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
    <div style={s.app}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerTitle}>MEDIA STATION</span>
          <nav style={s.nav}>
            <button onClick={() => setActiveTab("grid")} style={{ ...s.navBtn, color: activeTab === "grid" ? "#a78bfa" : "#64748b" }}>DASHBOARD</button>
            <button onClick={() => setActiveTab("sd")} style={{ ...s.navBtn, color: activeTab === "sd" ? "#a78bfa" : "#64748b" }}>DIRECTOR</button>
            <button onClick={() => setActiveTab("wifi")} style={{ ...s.navBtn, color: activeTab === "wifi" ? "#a78bfa" : "#64748b" }}>WIFI</button>
            <button onClick={() => setActiveTab("settings")} style={{ ...s.navBtn, color: activeTab === "settings" ? "#a78bfa" : "#64748b" }}>SETTINGS</button>
          </nav>
        </div>
        <WifiStatusBadge status={status} />
      </header>

      <main style={s.main}>
        {activeTab === "grid" ? <GridTab /> : 
         activeTab === "wifi" ? <WifiTab status={status} onFetchStatus={fetchStatus} /> : 
         activeTab === "sd" ? <SDTab /> : 
         <SettingsTab />}
      </main>
    </div>
  );
}

function useLongPress(callback: (e: any) => void, ms = 600) {
  const timerRef = useRef<any>(null);
  const [longPressed, setLongPressed] = useState(false);

  const start = useCallback((e: any) => {
    setLongPressed(false);
    const event = {
        clientX: e.clientX || (e.touches && e.touches[0].clientX),
        clientY: e.clientY || (e.touches && e.touches[0].clientY),
    };
    timerRef.current = setTimeout(() => {
        setLongPressed(true);
        callback(event);
    }, ms);
  }, [callback, ms]);

  const stop = useCallback(() => clearTimeout(timerRef.current), []);

  return { 
    onMouseDown: start, onMouseUp: stop, onMouseLeave: stop,
    onTouchStart: start, onTouchEnd: stop, onTouchMove: stop,
    onContextMenu: (e: any) => e.preventDefault(),
    longPressed
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

  const [selectedFile, setSelectedFile] = useState<{name: string, size: number, path: string} | null>(null);
  const [inspectInfo, setInspectInfo] = useState<ImageInfo | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ctxMenu, setCtxMenu] = useState<{ x: number, y: number, name: string, pathPrefix: string } | null>(null);

  const fetchGen = () => {
    setGenLoading(true);
    fetch(`/api/sd/list?path=${encodeURIComponent(genPath)}`)
      .then(r => r.json())
      .then(d => {
        setGenFiles((d.files as SDFile[] ?? []).filter((f: SDFile) => f.name !== "." && f.name !== "..").sort((a: SDFile, b: SDFile) => (b.isDir ? 1 : 0) - (a.isDir ? 1 : 0)));
      })
      .catch(() => setGenFiles([]))
      .finally(() => setGenLoading(false));
  };

  const fetchConv = async () => {
    setConvLoading(true);
    try {
      const resList = await fetch(`/api/sd/list?path=conv`);
      const dList = await resList.json();
      const files = (dList.files as SDFile[] ?? []).filter((f: SDFile) => !f.isDir && f.name.match(/\.(jpg|jpeg|png)$/i));
      setConvFiles(files);

      const resPl = await fetch(`/api/sd/file/playlist.json`);
      if (resPl.ok) {
        const dPl = await resPl.json();
        const pl: PlaylistItem[] = dPl.items ?? [];
        const matchedPl = files.map(f => {
            const existing = pl.find(p => p.name === f.name);
            return existing || { name: f.name, enabled: true };
        });
        setPlaylist(matchedPl);
      } else {
        setPlaylist(files.map(f => ({ name: f.name, enabled: true })));
      }
    } catch {
      setConvFiles([]);
    } finally {
      setConvLoading(false);
    }
  };

  useEffect(fetchGen, [genPath]);
  useEffect(() => { fetchConv(); }, []);

  const savePlaylist = (p: PlaylistItem[]) => {
    const blob = new Blob([JSON.stringify({ items: p })], { type: "application/json" });
    fetch(`/api/sd/upload?path=playlist.json`, { method: "POST", body: blob }).catch(err => console.error("Pl update failed", err));
  };

  const toggleItem = (name: string) => {
    const next = playlist.map(item => item.name === name ? { ...item, enabled: !item.enabled } : item);
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
    return playlist.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [playlist, search]);

  const handleStageLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile({ name: file.name, size: file.size, path: "local" });
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => setInspectInfo({ width: img.width, height: img.height, url, isLocal: true });
    img.onerror = () => setUploadMsg("Error displaying preview.");
    img.src = url;
  };

  const handleInspectSD = (f: SDFile, pathPrefix: string) => {
    if (f.isDir) return setGenPath(pathPrefix ? `${pathPrefix}/${f.name}` : f.name);
    const fullPath = pathPrefix ? `${pathPrefix}/${f.name}` : f.name;
    const url = `/api/sd/file/${fullPath}`;
    setSelectedFile({ name: f.name, size: f.size, path: fullPath });
    setInspectInfo(null);
    const img = new Image();
    img.onload = () => setInspectInfo({ width: img.width, height: img.height, url, isLocal: false });
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
        const namePart = selectedFile.name.replace(/\.[^/.]+$/, "").substring(0, 5).replace(/[^a-zA-Z0-9]/g, "");
        finalName = namePart + "_s.jpg";
      } else {
        finalBlob = sourceBlob;
      }

      const targetPath = optimize ? `conv/${finalName}` : (genPath ? `${genPath}/${finalName}` : finalName);
      const uploadRes = await fetch(`/api/sd/upload?path=${encodeURIComponent(targetPath)}`, { 
        method: "POST", 
        body: finalBlob 
      });

      if (uploadRes.ok) {
        setUploadMsg("Success!"); fetchGen(); fetchConv();
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
    fetch(`/api/sd/delete?path=${encodeURIComponent(full)}`, { method: "POST" }).then(() => { fetchGen(); fetchConv(); setCtxMenu(null); });
  };

  const LongPressRow = ({ f, pathPrefix, onSelect, children, style }: { f: SDFile, pathPrefix: string, onSelect: () => void, children?: React.ReactNode, style?: any }) => {
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
        <div {...bind} style={{ ...s.fileRow, ...style, background: selectedFile?.path === (pathPrefix?pathPrefix+'/'+f.name:f.name) ? "#26264d" : "transparent" }} onClick={onClick}>
            {children || (
                <>
                <div style={s.fileMain}>
                    <span style={s.fileIcon}>{f.isDir ? "📁" : "📄"}</span>
                    <span style={s.fileName}>{f.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(f.name, pathPrefix); }} style={s.inlineDel}>×</button>
                </>
            )}
        </div>
    );
  };

  return (
    <div style={s.layout} onClick={() => setCtxMenu(null)}>
      <div style={s.browserStack}>
        <div style={s.card}>
          <div style={s.browserHeader}>
             <div style={s.breadcrumbs}>
                <span style={s.crumb} onClick={() => setGenPath("")}>Root</span>
                {genPath.split("/").filter(p => p).map((p, i, arr) => (
                    <span key={i} style={s.crumb} onClick={() => setGenPath(arr.slice(0, i+1).join("/"))}> / {p}</span>
                ))}
             </div>
             <button onClick={() => fileInputRef.current?.click()} style={s.stageBtn}>+ New Upload</button>
             <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleStageLocal} />
          </div>
          <div style={s.fileScroll}>
            {genPath && <div style={s.fileRow} onClick={() => {
                const parts = genPath.split("/"); parts.pop(); setGenPath(parts.join("/"));
            }}><span style={s.fileIcon}>📁</span> ..</div>}
            {genLoading ? <p>Loading...</p> : genFiles.map((f, i) => (
                <LongPressRow key={i} f={f} pathPrefix={genPath} onSelect={() => handleInspectSD(f, genPath)} />
            ))}
          </div>
        </div>

        <div style={s.card}>
           <div style={s.browserHeader}>
              <span style={s.cardTitle}>Device Playlist (/conv)</span>
              <input type="text" placeholder="Filter..." style={s.miniInput} value={search} onChange={e => setSearch(e.target.value)} />
           </div>
           <div style={s.fileScroll}>
              {convLoading ? <p>Refreshing...</p> : filteredPlaylist.map((p, i) => (
                <LongPressRow key={p.name} f={{name: p.name, size: 0}} pathPrefix="conv" onSelect={() => handleInspectSD({name: p.name, size: 0}, "conv")} style={s.playlistRow}>
                   <input type="checkbox" checked={p.enabled} onChange={() => toggleItem(p.name)} style={s.check} onClick={(e) => e.stopPropagation()} />
                   <div style={s.fileMain}>
                      <span style={{ ...s.fileName, color: p.enabled ? "#e2e8f0" : "#444" }}>{p.name}</span>
                   </div>
                   <div style={s.sortControl}>
                      <button style={s.sortBtn} onClick={(e) => { e.stopPropagation(); moveItem(i, -1); }}>▲</button>
                      <button style={s.sortBtn} onClick={(e) => { e.stopPropagation(); moveItem(i, 1); }}>▼</button>
                   </div>
                </LongPressRow>
              ))}
           </div>
        </div>
      </div>

      <div style={s.inspector}>
        {selectedFile ? (
          <div style={s.card}>
            <span style={s.cardTitle}>Preview Inspector</span>
            {inspectInfo ? (
              <div style={s.previewWrap}>
                <img src={inspectInfo.url} style={s.previewImg} alt="insp" />
                <div style={s.imgBadge}>{inspectInfo.width} × {inspectInfo.height}</div>
              </div>
            ) : <div style={s.previewWrap}><p>Loading...</p></div>}
            <div style={s.infoList}>
              <div style={s.infoItem}><span>Name</span> <span style={s.val}>{selectedFile.name}</span></div>
              <div style={s.infoItem}><span>Path</span> <span style={s.val}>{selectedFile.path}</span></div>
            </div>
            <div style={s.actionRow}>
               {inspectInfo?.isLocal && <button onClick={() => handleUpload(false)} disabled={uploading} style={s.rawBtn}>Raw Upload</button>}
               <button onClick={() => handleUpload(true)} disabled={uploading} style={{ ...s.convBtn, gridColumn: inspectInfo?.isLocal ? "unset" : "span 2" }}>Optimise (800x470)</button>
            </div>
            {uploadMsg && <p style={s.statusMsg}>{uploadMsg}</p>}
          </div>
        ) : <div style={s.emptyLab}><p>Select an image to inspect details.</p></div>}
      </div>

      {ctxMenu && (
        <div style={{ ...s.floatingMenu, left: ctxMenu.x, top: ctxMenu.y }}>
            <button style={s.menuItem} onClick={(e) => { e.stopPropagation(); handleDelete(ctxMenu.name, ctxMenu.pathPrefix); }}>
                🗑 Delete {ctxMenu.name}
            </button>
            <button style={s.menuItem} onClick={() => setCtxMenu(null)}>✕ Cancel</button>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [tz, setTz] = useState("Jerusalem");
  return (
    <div style={s.centreCol}>
      <div style={s.card}>
        <span style={s.cardTitle}>Global Settings</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 700 }}>SYSTEM TIMEZONE</label>
            <select value={tz} onChange={(e) => setTz(e.target.value)} style={s.input as any}>
              <option value="Jerusalem">Asia/Jerusalem (IST)</option>
              <option value="UTC">UTC (Universal)</option>
              <option value="London">Europe/London (GMT)</option>
              <option value="NewYork">America/New_York (EST)</option>
            </select>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: "1.5" }}>
            Clock synchronizes with NTP servers using this offset.
          </p>
        </div>
      </div>
    </div>
  );
}

function WifiTab({ status, onFetchStatus }: { status: WifiStatus, onFetchStatus: () => void }) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  const scan = () => { setScanning(true); fetch("/api/wifi/scan").then(r => r.json()).then(d => setNetworks(d.networks ?? [])).finally(() => setScanning(false)); };
  const connect = () => { if (!selectedSsid) return; setConnecting(true); fetch("/api/wifi/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ssid: selectedSsid, password }), }).then(() => setTimeout(onFetchStatus, 4000)).finally(() => setConnecting(false)); };
  return (
    <div style={s.centreCol}>
      <div style={s.card}>
        <div style={s.scanHeader}>
          <span style={s.cardTitle}>Hotspots</span>
          <button onClick={scan} disabled={scanning} style={s.stageBtn}>{scanning ? "Searching..." : "Scan Environment"}</button>
        </div>
        <div style={s.fileScroll}>
           {networks.map((n, i) => <div key={i} style={{ ...s.fileRow, padding: "12px", cursor: "pointer", background: selectedSsid === n.ssid ? "#2a2a4a" : "transparent" }} onClick={() => setSelectedSsid(n.ssid)}><span>{n.ssid}</span> <span style={s.fileSize}>{n.rssi} dBm</span></div>)}
        </div>
      </div>
      {selectedSsid && <div style={s.card}><span style={s.cardTitle}>Credentials for {selectedSsid}</span> <input type="password" placeholder="Password" style={s.input} value={password} onChange={e => setPassword(e.target.value)} /> <button onClick={connect} style={s.convBtn}>{connecting ? "Syncing..." : "Apply Settings"}</button></div>}
    </div>
  );
}

function WifiStatusBadge({ status }: { status: WifiStatus }) {
  return <div style={{ fontSize: "0.85rem", color: status?.connected?"#4ade80":"#f87171" }}>● {status?.connected ? `System Online (${status.ip})` : "System Offline"}</div>;
}

function GridTab() {
  const [items, setItems] = useState<GridItem[]>([]);
  const [gridBg, setGridBg] = useState(0x0e0e0e);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  const [dragInfo, setDragInfo] = useState<{ idx: number, startX: number, startY: number, initialX: number, initialY: number, initialW: number, initialH: number, mode: 'move' | 'resize' } | null>(null);

  useEffect(() => {
    fetch("/api/grid/config").then(r => r.json()).then(d => {
      setItems(d.items || []);
      if (d.bg !== undefined) setGridBg(d.bg);
    }).catch(e => console.error("Failed to load grid", e));
  }, []);

  const save = () => {
    setSaving(true);
    setStatus("Syncing...");
    fetch("/api/grid/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, bg: gridBg })
    }).then(() => {
        setStatus("Pushed");
        setTimeout(() => setStatus(""), 3000);
    }).finally(() => setSaving(false));
  };

  const updateItem = (idx: number, patch: Partial<GridItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const addItem = () => {
      setItems([...items, { name: "New Btn", x: 0, y: 0, w: 2, h: 2, color: 0x1c2828, textColor: 0xFFFFFF, action: "" }]);
      setSelected(items.length);
  };

  const removeItem = (idx: number) => {
      setItems(items.filter((_, i) => i !== idx));
      setSelected(null);
  };

  const onMouseDown = (e: React.MouseEvent, idx: number, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(idx);
    setDragInfo({ 
        idx, 
        startX: e.clientX, 
        startY: e.clientY, 
        initialX: items[idx].x, 
        initialY: items[idx].y,
        initialW: items[idx].w,
        initialH: items[idx].h,
        mode 
    });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragInfo) return;
      const dx = Math.round((e.clientX - dragInfo.startX) / 80);
      const dy = Math.round((e.clientY - dragInfo.startY) / 80);
      
      const next = [...items];
      if (dragInfo.mode === 'move') {
        next[dragInfo.idx].x = Math.max(0, Math.min(8 - dragInfo.initialW, dragInfo.initialX + dx));
        next[dragInfo.idx].y = Math.max(0, dragInfo.initialY + dy);
      } else {
        next[dragInfo.idx].w = Math.max(1, Math.min(8 - items[dragInfo.idx].x, dragInfo.initialW + dx));
        next[dragInfo.idx].h = Math.max(1, dragInfo.initialH + dy);
      }
      setItems(next);
      // Small debounce simulation for drag smoothness
    };
    const onUp = () => setDragInfo(null);
    if (dragInfo) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragInfo, items]);

  return (
    <div style={s.layout}>
      <div style={s.card}>
        <div style={s.browserHeader}>
          <div style={{display:"flex", alignItems:"center", gap:"15px"}}>
              <span style={s.cardTitle}>GRID BLUEPRINT (640x416)</span>
              {status && <span style={s.pushStatus}>{status}</span>}
          </div>
          <button onClick={addItem} style={s.stageBtn}>Add Block</button>
        </div>
        <div style={{...s.gridContainer, backgroundColor: `#${gridBg.toString(16).padStart(6,'0')}`}}>
           {/* Grid Visualizer */}
           <div style={s.gridV}>
              {Array.from({length: 8}).map((_, i) => (
                <div key={i} style={{...s.gridLineV, left: (i+1)*80}} />
              ))}
              {Array.from({length: 5}).map((_, i) => (
                <div key={i} style={{...s.gridLineH, top: (i+1)*80}} />
              ))}
              {items.map((it, i) => (
                <div 
                  key={i} 
                  onMouseDown={(e) => onMouseDown(e, i, 'move')}
                  style={{
                    ...s.gridItem, 
                    left: it.x * 80, top: it.y * 80,
                    width: it.w * 80, height: it.h * 80,
                    backgroundColor: `#${it.color.toString(16).padStart(6, '0')}`,
                    border: selected === i ? "4px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: selected === i ? "0 0 15px #a78bfa" : "none",
                    zIndex: selected === i ? 10 : 1,
                  }}>
                    <span style={{...s.gridLabel, color: `#${it.textColor.toString(16).padStart(6,'0')}`}}>{it.name}</span>
                    {selected === i && (
                        <div onMouseDown={(e) => onMouseDown(e, i, 'resize')} style={s.resizeHandle} />
                    )}
                </div>
              ))}
           </div>
        </div>
      </div>

      <div style={s.inspector}>
        <div style={s.card}>
          <span style={s.cardTitle}>Configuration</span>
          {selected !== null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={s.formGroup}>
                <label style={s.formLabel}>BLOCK NAME</label>
                <input style={s.input} value={items[selected].name} onChange={e => updateItem(selected, {name: e.target.value})} />
              </div>
              <div style={{display:"grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
                <div style={s.formGroup}>
                  <label style={s.formLabel}>X (Col)</label>
                  <input style={s.input} type="number" value={items[selected].x} onChange={e => updateItem(selected, {x: parseInt(e.target.value)})} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.formLabel}>Y (Row)</label>
                  <input style={s.input} type="number" value={items[selected].y} onChange={e => updateItem(selected, {y: parseInt(e.target.value)})} />
                </div>
              </div>
              <div style={{display:"grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
                <div style={s.formGroup}>
                  <label style={s.formLabel}>W (Cols)</label>
                  <input style={s.input} type="number" value={items[selected].w} onChange={e => updateItem(selected, {w: parseInt(e.target.value)})} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.formLabel}>H (Rows)</label>
                  <input style={s.input} type="number" value={items[selected].h} onChange={e => updateItem(selected, {h: parseInt(e.target.value)})} />
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>BLOCK COLOR</label>
                <div style={{display:"flex", gap:"10px", alignItems: "center"}}>
                   <div style={{position:"relative", width: 48, height: 48, borderRadius: 10, overflow: "hidden", border: "1px solid #4b5563"}}>
                      <input type="color" style={s.colorInput} value={`#${items[selected].color.toString(16).padStart(6,'0')}`} onChange={e => updateItem(selected, {color: parseInt(e.target.value.replace('#',''), 16) || 0})} />
                   </div>
                   <input style={{...s.input, marginBottom: 0, flex: 1}} value={items[selected].color.toString(16).padStart(6,'0')} onChange={e => updateItem(selected, {color: parseInt(e.target.value.replace('#',''), 16) || 0})} />
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>TEXT COLOR</label>
                <div style={{display:"flex", gap:"10px", alignItems: "center"}}>
                   <div style={{position:"relative", width: 48, height: 48, borderRadius: 10, overflow: "hidden", border: "1px solid #4b5563"}}>
                      <input type="color" style={s.colorInput} value={`#${items[selected].textColor.toString(16).padStart(6,'0')}`} onChange={e => updateItem(selected, {textColor: parseInt(e.target.value.replace('#',''), 16) || 0})} />
                   </div>
                   <input style={{...s.input, marginBottom: 0, flex: 1}} value={items[selected].textColor.toString(16).padStart(6,'0')} onChange={e => updateItem(selected, {textColor: parseInt(e.target.value.replace('#',''), 16) || 0})} />
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>MQTT ACTION</label>
                <input style={s.input} placeholder="mqtt:light/toggle" value={items[selected].action} onChange={e => updateItem(selected, {action: e.target.value})} />
              </div>
              <button onClick={() => removeItem(selected)} style={{...s.rawBtn, color: "#f87171", marginTop: "20px"}}>Remove Block</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
               <div style={s.formGroup}>
                  <label style={s.formLabel}>DASHBOARD BACKGROUND</label>
                  <div style={{display:"flex", gap:"10px", alignItems: "center"}}>
                     <div style={{position:"relative", width: 48, height: 48, borderRadius: 10, overflow: "hidden", border: "1px solid #4b5563"}}>
                        <input type="color" style={s.colorInput} value={`#${gridBg.toString(16).padStart(6,'0')}`} onChange={e => setGridBg(parseInt(e.target.value.replace('#',''), 16) || 0)} />
                     </div>
                     <input style={{...s.input, marginBottom: 0, flex: 1}} value={gridBg.toString(16).padStart(6,'0')} onChange={e => setGridBg(parseInt(e.target.value.replace('#',''), 16) || 0)} />
                  </div>
               </div>
               <p style={{color: "#64748b", textAlign:"center", fontSize: "0.75rem", marginTop: "12px"}}>Select any block on the left to edit its unique properties.</p>
            </div>
          )}

          <hr style={{margin: "24px 0", opacity: 0.1}}/>
          <button onClick={save} disabled={saving} style={s.convBtn}>{saving ? "Saving..." : "Push to Device"}</button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  app: { minHeight: "100vh", background: "#0a0a14", color: "#e2e8f0", fontFamily: "Outfit, sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "#121226", borderBottom: "1px solid #1e1e3b" },
  headerLeft: { display: "flex", alignItems: "center", gap: 32 },
  headerTitle: { fontWeight: 900, fontSize: "1.1rem", color: "#a78bfa", letterSpacing: "0.1em" },
  nav: { display: "flex", gap: 16 },
  navBtn: { background: "none", border: "none", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", letterSpacing: "0.1em" },
  main: { padding: "24px" },
  layout: { display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px", maxWidth: "1400px", margin: "0 auto" },
  browserStack: { display: "flex", flexDirection: "column", gap: "24px" },
  inspector: { position: "sticky", top: 24, height: "fit-content" },
  card: { background: "#1e1e3b", borderRadius: "20px", padding: "24px", border: "1px solid #2d2d5a", display: "flex", flexDirection: "column", overflow: "hidden" },
  cardTitle: { display: "block", fontSize: "0.65rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "16px" },
  browserHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 },
  miniInput: { background: "#121226", border: "1px solid #2d2d5a", borderRadius: "6px", padding: "4px 10px", color: "#fff", fontSize: "0.8rem", width: "100px" },
  breadcrumbs: { fontSize: "0.85rem", color: "#94a3b8" },
  crumb: { cursor: "pointer" } as any,
  stageBtn: { background: "#4f46e5", color: "#fff", border: "none", borderRadius: "10px", padding: "8px 20px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" },
  scanHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  fileScroll: { maxHeight: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" },
  fileRow: { display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: "10px", cursor: "pointer" },
  playlistRow: { display: "flex", alignItems: "center", padding: "6px 12px", borderRadius: "10px", borderBottom: "1px solid #26264d" },
  fileMain: { flex: 1, display: "flex", alignItems: "center", gap: "12px", minWidth: 0 },
  fileIcon: { fontSize: "1.1rem" },
  fileName: { fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  fileSize: { fontSize: "0.75rem", color: "#64748b" },
  inlineDel: { background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "1.2rem", marginLeft: "12px" },
  check: { width: "18px", height: "18px", marginRight: "16px", cursor: "pointer" },
  sortControl: { display: "flex", flexDirection: "column", gap: "2px", margin: "0 12px" },
  sortBtn: { background: "#2d2d5a", border: "none", borderRadius: "4px", color: "#94a3b8", fontSize: "0.5rem", padding: "2px 6px", cursor: "pointer" },
  previewWrap: { width: "100%", aspectRatio: "16/9", borderRadius: "14px", overflow: "hidden", background: "#000", marginBottom: "20px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" },
  previewImg: { width: "100%", height: "100%", objectFit: "contain" },
  imgBadge: { position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.8)", padding: "4px 10px", borderRadius: "6px", fontSize: "0.65rem", fontWeight: 800 },
  infoList: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" },
  infoItem: { display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#94a3b8" },
  val: { color: "#e2e8f0", textAlign: "right", maxWidth: "200px", wordBreak: "break-all" },
  actionRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  rawBtn: { background: "#2d2d5a", color: "#fff", border: "none", borderRadius: "10px", padding: "14px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" },
  convBtn: { background: "#a78bfa", color: "#1e1e3b", border: "none", borderRadius: "10px", padding: "14px", fontWeight: 800, fontSize: "0.8rem", cursor: "pointer" },
  statusMsg: { textAlign: "center", marginTop: "16px", fontSize: "0.85rem", color: "#a78bfa", fontWeight: 600 },
  emptyLab: { height: "400px", display: "flex", textAlign: "center", alignItems: "center", justifyContent: "center", border: "2px dashed #2d2d5a", borderRadius: "20px", color: "#333", padding: "48px" },
  input: { width: "100%", padding: "14px", background: "#0f0f1a", border: "1px solid #2d2d5a", borderRadius: "10px", color: "#fff", marginBottom: "16px" },
  centreCol: { maxWidth: "500px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" },
  floatingMenu: { position: "fixed", background: "rgba(30, 30, 59, 0.95)", backdropFilter: "blur(10px)", border: "1px solid #4f46e5", borderRadius: "12px", padding: "8px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", flexDirection: "column", gap: "4px", minWidth: "160px" },
  menuItem: { background: "none", border: "none", color: "#e2e8f0", padding: "10px 16px", textAlign: "left", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, transition: "background 0.2s" } as any,
  gridContainer: { background: "#000", border: "1px solid #111", width: "640px", height: "416px", position: "relative", alignSelf: "center", borderRadius: "8px", overflow: "hidden" },
  gridV: { width: "100%", height: "100%", position: "relative" },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.05)" },
  gridLineH: { position: "absolute", left: 0, right: 0, height: "1px", background: "rgba(255,255,255,0.05)" },
  gridItem: { position: "absolute", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.1s" },
  gridLabel: { fontWeight: 800, fontSize: "0.8rem", color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  formLabel: { fontSize: "0.6rem", fontWeight: 900, color: "#4b5563", letterSpacing: "0.1em" },
  colorInput: { position: "absolute", top: "-5px", left: "-5px", width: "150%", height: "150%", cursor: "pointer", border: "none", background: "none", padding: 0 } as any,
  pushStatus: { color: "#a78bfa", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" },
  resizeHandle: { position: "absolute", right: 0, bottom: 0, width: "20px", height: "20px", cursor: "nwse-resize", background: "linear-gradient(135deg, transparent 50%, #a78bfa 50%)", borderBottomRightRadius: "8px" },
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
      canvas.toBlob(b => b ? resolve(b) : reject("Canvas blob failed"), "image/jpeg", 0.85);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
