import React, { useState, useEffect, useContext, useMemo } from "react";
import { GridContext } from "../../context/GridContext";
import { 
    type GridItem, 
    type Page, 
    type Screen, 
    type Panel, 
    type ElementType,
    SMART_COMPONENTS 
} from "../../types";

const createGhostImage = (label: string, w: number, h: number) => {
    const ghost = document.createElement('div');
    ghost.style.width = `${w}px`;
    ghost.style.height = `${h}px`;
    ghost.style.background = '#6366f1';
    ghost.style.color = 'white';
    ghost.style.borderRadius = '8px';
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.justifyContent = 'center';
    ghost.style.fontWeight = '900';
    ghost.style.fontSize = '12px';
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.style.fontFamily = 'system-ui, sans-serif';
    ghost.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.3)';
    ghost.innerText = label;
    document.body.appendChild(ghost);
    return ghost;
};

export const Sidebar: React.FC = () => {
    const { 
        project, 
        activeScreenId, 
        setActiveScreenId, 
        selections, 
        setSelectedEntity, 
        addItem,
        addScreen,
        updateScreen,
        updatePage,
        addPanel,
        removePanel,
        updatePanel,
        selectedEntity,
        theme,
        remoteIp
    } = useContext(GridContext) as any;

    const [dynamicSensors, setDynamicSensors] = useState<any[]>([]);

    useEffect(() => {
        if (!remoteIp) return;
        fetch(`http://${remoteIp}/api/sensors`)
            .then(res => res.json())
            .then(data => {
                if (data.sensors) setDynamicSensors(data.sensors);
            })
            .catch(err => console.warn("Failed to fetch sensors from device:", err));
    }, [remoteIp]);

    const [showPalette, setShowPalette] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const handlePaletteClick = (e: React.MouseEvent, type: ElementType, meta?: any, panelId?: string) => {
        const screen = project?.screens?.find((s: any) => s.id === activeScreenId) || project?.screens?.[0];
        if (!screen) return;

        const activeTarget = selectedEntity;
        let targetPageId = '';
        let parentId: string | undefined = undefined;

        if (activeTarget?.type === 'page') {
            targetPageId = activeTarget.id;
        } else if (activeTarget?.type === 'panel') {
            targetPageId = activeTarget.id;
        } else if (activeTarget?.type === 'item') {
            const item = project?.screens?.find((s: any) => s.id === activeScreenId)?.pages.flatMap((p: any) => p.items).find((it: any) => it.id === activeTarget.id);
            if (item && item.type === 'nav-menu') {
                parentId = item.id;
                targetPageId = activeTarget.pageId!;
            } else {
                targetPageId = activeTarget.pageId!;
            }
        } else if (screen?.pages?.length > 0) {
            targetPageId = screen.pages[0].id;
        }

        if (!targetPageId) return;

        if (e.detail >= 2) {
            addItem(type, targetPageId, parentId, panelId, 20, 20, meta, true);
        } else {
            if (activeTarget?.type !== 'page' && activeTarget?.type !== 'item') {
                setSelectedEntity({ type: 'page', id: targetPageId }, activeScreenId, true);
            }
        }
    };

    const WIDGET_PALETTE = useMemo(() => [
      {
        id: 'basic', label: 'BASIC', icon: '▣',
        widgets: [
          { type: 'label',   label: 'Label',      icon: 'Aa',  defaultW: 200, defaultH: 40 },
          { type: 'btn',     label: 'Button',     icon: '⬡',   defaultW: 160, defaultH: 50 },
          { type: 'clock',   label: 'Clock',      icon: '⏱',   defaultW: 200, defaultH: 60 },
          { type: 'border',  label: 'Frame',      icon: '□',   defaultW: 200, defaultH: 120 },
        ]
      },
      {
        id: 'controls', label: 'CONTROLS', icon: '⚙',
        widgets: [
          { type: 'switch',   label: 'Switch',    icon: '⇌',   defaultW: 100, defaultH: 40 },
          { type: 'slider',   label: 'Slider',    icon: '—◉',  defaultW: 200, defaultH: 40 },
          { type: 'arc',      label: 'Arc',       icon: '◔',   defaultW: 120, defaultH: 120 },
          { type: 'bar',      label: 'Bar',       icon: '▮▯',  defaultW: 200, defaultH: 30 },
          { type: 'checkbox', label: 'Checkbox',  icon: '☑',   defaultW: 140, defaultH: 40 },
          { type: 'dropdown', label: 'Dropdown',  icon: '▾',   defaultW: 180, defaultH: 40 },
          { type: 'roller',   label: 'Roller',    icon: '⊛',   defaultW: 140, defaultH: 100 },
        ]
      },
      {
        id: 'nav', label: 'NAVIGATION', icon: '◫',
        widgets: [
          { type: 'nav-menu',  label: 'Nav Menu',  icon: '☰',  defaultW: 180, defaultH: 300 },
          { type: 'nav-item',  label: 'Nav Item',  icon: '▶ —', defaultW: 180, defaultH: 50 },
          { type: 'menu-item', label: 'Menu Item', icon: '• —', defaultW: 180, defaultH: 50 },
        ]
      },
      {
        id: 'smart', label: 'SMART', icon: '🧩',
        widgets: SMART_COMPONENTS.map(sc => ({
          type: 'component' as ElementType,
          label: sc.label.split(' ')[1] || sc.label,
          icon: sc.icon,
          defaultW: sc.defaultW || 200,
          defaultH: sc.defaultH || 100,
          meta: { component: sc.id }
        }))
      },
      {
        id: 'sensors', label: 'ON DEVICE SENSORS', icon: '📡',
        widgets: [
            { type: 'battery_icon', label: 'Battery', icon: '🔋', defaultW: 100, defaultH: 100, meta: { mqttStateTopic: 'system/battery' } },
            { type: 'label', label: 'WiFi Signal', icon: '📶', defaultW: 160, defaultH: 50, meta: { mqttStateTopic: 'system/wifi/rssi', name: 'WiFi: %v dBm' } },
            { type: 'label', label: 'Uptime', icon: '⏱️', defaultW: 160, defaultH: 50, meta: { mqttStateTopic: 'system/uptime', name: 'Uptime: %v s' } },
            { type: 'label', label: 'IP Address', icon: '🌐', defaultW: 200, defaultH: 40, meta: { mqttStateTopic: 'system/ip' } },
            ...dynamicSensors.map((s: any) => ({
                type: 'label' as ElementType,
                label: s.label,
                icon: s.icon || '📡',
                defaultW: 160,
                defaultH: 50,
                meta: { mqttStateTopic: s.topic, name: `${s.label}: %v ${s.unit}` }
            }))
        ]
      },
      {
        id: 'advanced', label: 'ADVANCED', icon: '◈',
        widgets: [
          { type: 'panel-ref', label: 'Panel Ref',  icon: '❏',  defaultW: 240, defaultH: 300 },
          { type: 'pane-grid', label: 'Pane Grid',  icon: '⊞',  defaultW: 800, defaultH: 400 },
        ]
      }
    ], [dynamicSensors]);

    return (
        <div className={`sidebar ${!showPalette ? 'palette-hidden' : ''}`} onClick={(e) => e.stopPropagation()} style={{
            width: showPalette ? '480px' : '300px',
            background: theme === 'dark' ? '#0f172a' : '#ffffff',
            borderRight: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`,
            display: 'flex',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden'
        }}>
            {/* LAYERS SIDE */}
            <div className="layers-side" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '300px' }}>
                <div className="layers-header" style={{ padding: '20px', borderBottom: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="layers-title" style={{ fontWeight: 800, fontSize: '12px', color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Project</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                            className="add-screen-btn" 
                            style={{ background: 'none', border: '1px solid var(--border-main)', color: 'var(--text-muted)', padding: '5px 8px', fontSize: '14px', cursor: 'pointer' }}
                            onClick={() => setShowPalette(!showPalette)}
                            title="Toggle Palette"
                        >
                            🧰
                        </button>
                        <button className="add-screen-btn" style={{ background: '#6366f1', border: 'none', borderRadius: '4px', color: 'white', padding: '6px 12px', fontSize: '11px', cursor: 'pointer' }} onClick={() => addScreen && addScreen()}>＋ Screen</button>
                    </div>
                </div>
                <div className="sidebar-panel visible" style={{ flex: 1, overflowY: 'auto' }}>
                    <div className="tree" style={{ padding: '10px' }}>
                        {project.screens.map((scr: Screen) => (
                            <ScreenNode key={scr.id} scr={scr} isActive={activeScreenId === scr.id} />
                        ))}
                        <div style={{ marginTop: '20px' }}>
                            <div className="layers-header" style={{ padding: '10px', borderBottom: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="layers-title" style={{ fontWeight: 800, fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Master Panels</span>
                                <div style={{display:'flex', gap:'4px'}}>
                                    <button className="add-screen-btn" style={{fontSize:'9px', padding:'4px 8px'}} onClick={() => addPanel({ name: "New Sidebar", width: 160, height: 416, bg: 0x1e1e2d })}>＋ Sidebar</button>
                                    <button className="add-screen-btn" style={{fontSize:'9px', padding:'4px 8px'}} onClick={() => addPanel({ name: "New Header", width: 800, height: 60, bg: 0x2d2d3f })}>＋ Header</button>
                                </div>
                            </div>
                            {project.panels.map((pan: Panel) => (
                                <PanelNode key={pan.id} pan={pan} isActive={selections[activeScreenId]?.id === pan.id} />
                            ))}
                        </div>
                    </div>
                    <div className="quick-add-hint" style={{ padding: '20px', fontSize: '11px', color: '#94a3b8', borderTop: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, display: 'flex', gap: '8px' }}>
                        <span>💡</span>
                        <span>Click an item to select it on the canvas — and vice versa.</span>
                    </div>
                </div>
                {/* Bottom Bar: Layout Info */}
                <div style={{ 
                    borderTop: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, 
                    padding: '12px', 
                    background: theme === 'dark' ? '#0f172a' : '#f8fafc',
                    fontSize: '11px',
                    color: theme === 'dark' ? '#64748b' : '#94a3b8'
                }}>
                    <div style={{ fontWeight: 800, color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>LAYOUT</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{project?.screens?.length || 0} Screens / {project?.panels?.length || 0} Panels</span>
                    </div>
                </div>
            </div>

            {/* PALETTE SIDE */}
            {showPalette && (
                <div className="palette-side" style={{ 
                    width: '220px',
                    overflowY: 'auto', 
                    background: theme === 'dark' ? '#0f172a' : '#ffffff', 
                    borderLeft: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Search Header */}
                    <div style={{ padding: '12px', borderBottom: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}` }}>
                        <input 
                            placeholder="Search widgets..."
                            onChange={e => setSearchQuery(e.target.value.toLowerCase())}
                            style={{
                                width: '100%',
                                background: theme === 'dark' ? '#1e293b' : '#f1f5f9',
                                border: `1px solid ${theme === 'dark' ? '#334155' : '#cbd5e1'}`,
                                borderRadius: '6px',
                                color: theme === 'dark' ? 'white' : '#0f172a',
                                padding: '8px 12px',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
                        {WIDGET_PALETTE.map((cat: any) => {
                            const filteredWidgets = cat.widgets.filter((w: any) => 
                                w.label.toLowerCase().includes(searchQuery) || 
                                cat.label.toLowerCase().includes(searchQuery)
                            );
                            
                            if (searchQuery && filteredWidgets.length === 0) return null;

                            return (
                                <PaletteSection 
                                    key={cat.id} 
                                    category={cat} 
                                    widgets={filteredWidgets}
                                    handlePaletteClick={handlePaletteClick} 
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENTS ---

const PaletteCard = ({ widget, handlePaletteClick }: { widget: any, handlePaletteClick: any }) => {
    const [isHovered, setIsHovered] = useState(false);
    const { theme } = useContext(GridContext) as any;

    const bgColor = theme === 'dark' 
        ? (isHovered ? '#1e293b' : '#111827')
        : (isHovered ? '#f1f5f9' : '#ffffff');
    
    const borderColor = theme === 'dark'
        ? (isHovered ? '#6366f1' : '#1e293b')
        : (isHovered ? '#6366f1' : '#e2e8f0');

    return (
        <div
            draggable
            onMouseDown={(e) => handlePaletteClick(e, widget.type, widget.meta)}
            onDragStart={(e) => {
                e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: widget.type, meta: widget.meta }));
                e.dataTransfer.effectAllowed = "copy";
                const ghost = createGhostImage(widget.label, widget.defaultW || 120, widget.defaultH || 40);
                e.dataTransfer.setDragImage(ghost, (widget.defaultW || 120)/2, (widget.defaultH || 40)/2);
                setTimeout(() => ghost.remove(), 0);
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                padding: '14px 8px',
                cursor: 'grab',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s',
                userSelect: 'none',
                minHeight: '80px',
                justifyContent: 'center',
                boxShadow: theme === 'light' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
        >
            <div style={{ fontSize: '24px', opacity: isHovered ? 1 : 0.7, transform: isHovered ? 'scale(1.1)' : 'scale(1)', transition: '0.2s' }}>{widget.icon}</div>
            <div style={{ fontSize: '10px', color: isHovered ? (theme === 'dark' ? '#e2e8f0' : '#475569') : '#94a3b8', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {widget.label}
            </div>
        </div>
    );
};

const PaletteSection = ({ category, widgets, handlePaletteClick }: { category: any, widgets: any[], handlePaletteClick: any }) => {
    const { theme } = useContext(GridContext) as any;
    const [isOpen, setIsOpen] = useState(category.id !== 'advanced' && category.id !== 'sensors');
    
    if (widgets.length === 0) return null;

    const labelBg = theme === 'dark' 
        ? (isOpen ? 'rgba(30, 41, 59, 0.3)' : 'transparent')
        : (isOpen ? '#f8fafc' : 'transparent');

    return (
        <div style={{ marginBottom: '4px' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '12px 16px', 
                    cursor: 'pointer', 
                    color: theme === 'dark' ? '#64748b' : '#475569',
                    fontSize: '10px', 
                    fontWeight: 800, 
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    background: labelBg,
                    borderBottom: isOpen ? `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}` : 'none'
                }}
            >
                <span style={{ fontSize: '8px', color: theme === 'dark' ? '#475569' : '#94a3b8', width: '10px' }}>{isOpen ? '▼' : '▶'}</span>
                <span style={{ fontSize: '14px' }}>{category.icon}</span>
                <span>{category.label}</span>
                <span style={{ 
                    marginLeft: 'auto', 
                    background: theme === 'dark' ? '#1e293b' : '#e2e8f0', 
                    color: theme === 'dark' ? '#94a3b8' : '#64748b',
                    padding: '2px 8px', 
                    borderRadius: '10px',
                    fontSize: '9px',
                    fontWeight: 'bold'
                }}>
                    {widgets.length}
                </span>
            </div>
            {isOpen && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    padding: '12px',
                    background: theme === 'dark' ? 'transparent' : '#f8fafc'
                }}>
                    {widgets.map((w: any) => (
                        <PaletteCard key={w.label + w.type} widget={w} handlePaletteClick={handlePaletteClick} />
                    ))}
                </div>
            )}
        </div>
    );
};

const HierarchyItem = ({ it, pageId, screenId }: { it: GridItem, pageId: string, screenId: string }) => {
	const { project, selections, setSelectedEntity, setActiveScreenId, removeItem, updateItem, moveItemHierarchy } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(it.name);
    const isSelected = selections[screenId]?.id === it.id;
    const isContainer = it.type === "panel-ref" || it.type === "nav-menu";

    useEffect(() => { setEditName(it.name); }, [it.name]);

	let children: GridItem[] = [];
	if (it.type === "panel-ref") {
		const panel = project.panels.find((p: any) => p.id === it.panelId);
		children = panel?.elements || [];
	} else if (it.type === "nav-menu") {
		children = it.children || [];
	}

    const saveEdit = () => {
        updateItem(pageId, it.id, { name: editName });
        setIsEditing(false);
    };

	return (
        <div className="item-node" draggable onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("draggedId", it.id); e.dataTransfer.effectAllowed = "move"; }}>
            <div 
                className={`item-row ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveScreenId(screenId); setSelectedEntity({ type: 'item', id: it.id, pageId }, screenId); }}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
                <div className="item-dot"></div>
                {isEditing ? (
                    <input autoFocus className="node-input" value={editName} onChange={e => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} onClick={e => e.stopPropagation()} />
                ) : (
                    <span className="item-name">{it.name}</span>
                )}
                <span className="item-type">{it.type}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isContainer && children.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#94a3b8', cursor: 'pointer' }}>
                            {isOpen ? '▼' : '▶'}
                        </button>
                    )}
                    <button className="delete-item-btn" style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); removeItem(pageId, it.id); }}>✕</button>
                </div>
            </div>
            {isOpen && children.length > 0 && (
                <div className="item-list" style={{ paddingLeft: '12px' }}>
                    {children.map((child: any) => (
                        <HierarchyItem key={child.id} it={child} pageId={it.type === 'panel-ref' ? it.panelId! : pageId} screenId={screenId} />
                    ))}
                </div>
            )}
        </div>
	);
};

const PageNode = ({ pg, screenId }: { pg: Page, screenId: string }) => {
	const { selections, setSelectedEntity, setActiveScreenId, updatePage, removePage } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(pg.name);
	const isSelected = selections[screenId]?.type === 'page' && selections[screenId]?.id === pg.id;

    useEffect(() => { setEditName(pg.name); }, [pg.name]);

    const saveEdit = () => {
        updatePage(screenId, pg.id, { name: editName });
        setIsEditing(false);
    };

	return (
		<div className="page-node">
			<div 
                className={`page-row ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveScreenId(screenId); setSelectedEntity({ type: 'page', id: pg.id }, screenId); }}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
				<span className={`screen-chevron ${isOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>{isOpen ? '▼' : '▶'}</span>
				<span className="page-icon">📄</span>
				{isEditing ? (
                    <input autoFocus className="node-input" value={editName} onChange={e => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} onClick={e => e.stopPropagation()} />
                ) : (
                    <span className="page-name">{pg.name}</span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {(pg.x !== 0 || pg.y !== 0) && (
                        <button className="delete-item-btn" style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); removePage(screenId, pg.id); }}>✕</button>
                    )}
                </div>
			</div>
			{isOpen && (
                <div className="item-list" style={{ paddingLeft: '12px' }}>
                    {pg.items.map((it: any) => (
                        <HierarchyItem key={it.id} it={it} pageId={pg.id} screenId={screenId} />
                    ))}
                </div>
            )}
		</div>
	);
};

const ScreenNode = ({ scr, isActive }: { scr: Screen, isActive: boolean }) => {
	const { setActiveScreenId, setSelectedEntity, updateScreen } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(isActive);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(scr.name);

    useEffect(() => { setEditName(scr.name); }, [scr.name]);

    const saveEdit = () => {
        updateScreen(scr.id, { name: editName });
        setIsEditing(false);
    };

	return (
		<div className="screen-node">
			<div 
                className={`screen-row ${isActive ? 'active' : ''}`}
                onClick={() => { setActiveScreenId(scr.id); setSelectedEntity({ type: 'screen', id: scr.id }); }}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
				<span className="screen-chevron" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>{isOpen ? '▼' : '▶'}</span>
				<span className="screen-icon">🖥</span>
				{isEditing ? (
                    <input autoFocus className="node-input" value={editName} onChange={e => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} onClick={e => e.stopPropagation()} />
                ) : (
                    <span className="screen-name">{scr.name}</span>
                )}
				<span className="screen-badge">{scr.pages.length} pages</span>
			</div>
			{isOpen && (
				<div className="page-list" style={{ paddingLeft: '12px' }}>
					{scr.pages.map((pg: any) => <PageNode key={pg.id} pg={pg} screenId={scr.id} />)}
				</div>
			)}
		</div>
	);
};

const PanelNode = ({ pan, isActive }: { pan: Panel, isActive: boolean }) => {
	const { setSelectedEntity, setActiveScreenId, activeScreenId, addItem, updatePanel, removePanel } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(pan.name);
    const isPanelMode = activeScreenId === 'panel';

    useEffect(() => { setEditName(pan.name); }, [pan.name]);

    const saveEdit = () => {
        updatePanel(pan.id, { name: editName });
        setIsEditing(false);
    };
	
	return (
		<div className="screen-node" draggable onDragStart={(e) => { e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: 'panel-ref', panelId: pan.id })); e.dataTransfer.effectAllowed = "copy"; const ghost = createGhostImage(pan.name, 160, 160); e.dataTransfer.setDragImage(ghost, 80, 80); setTimeout(() => ghost.remove(), 0); }}>
			<div 
                className={`screen-row ${isPanelMode && isActive ? 'active' : ''}`}
                onClick={() => { setActiveScreenId('panel'); setSelectedEntity({ type: 'panel', id: pan.id }, 'panel'); }}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
				<span className="screen-chevron" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>{isOpen ? '▼' : '▶'}</span>
				<span className="screen-icon">🔲</span>
				{isEditing ? (
                    <input autoFocus className="node-input" value={editName} onChange={e => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }} onClick={e => e.stopPropagation()} />
                ) : (
                    <span className="screen-name">{pan.name}</span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="add-item-mini" onClick={(e) => { e.stopPropagation(); addItem('nav-item', pan.id); }}>＋</button>
                    <button className="add-item-mini" style={{ background: '#fee2e2', color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this Master Panel?')) removePanel(pan.id); }}>✕</button>
                </div>
			</div>
			{isOpen && (
				<div className="item-list" style={{ paddingLeft: '12px' }}>
					{pan.elements.map((it: any) => (
                        <HierarchyItem key={it.id} it={it} pageId={pan.id} screenId="panel" />
                    ))}
				</div>
			)}
		</div>
	);
};
