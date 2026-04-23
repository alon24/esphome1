import React, { useState, useEffect, useContext } from "react";
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
        updatePanel,
        addPanel,
        removePanel,
        selectedEntity
    } = useContext(GridContext) as any;

    const [editingScreenId, setEditingScreenId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const [showPalette, setShowPalette] = useState(true);

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
            // Check if selected item is a container
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

    return (
        <div className={`sidebar ${!showPalette ? 'palette-hidden' : ''}`} onClick={(e) => e.stopPropagation()}>
            {/* LAYERS SIDE */}
            <div className="layers-side">
                <div className="layers-header">
                    <span className="layers-title">Project</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                            className="add-screen-btn" 
                            style={{ background: 'none', border: '1px solid var(--border-main)', color: 'var(--text-muted)', padding: '5px 8px', fontSize: '14px' }}
                            onClick={() => setShowPalette(!showPalette)}
                            title="Toggle Palette"
                        >
                            🧰
                        </button>
                        <button className="add-screen-btn" onClick={() => addScreen && addScreen()}>＋ Screen</button>
                    </div>
                </div>
                <div className="sidebar-panel visible">
                    <div className="tree">
                        {project.screens.map((scr: Screen) => (
                            <ScreenNode key={scr.id} scr={scr} isActive={activeScreenId === scr.id} />
                        ))}
                        <div style={{ marginTop: '20px' }}>
                            <div className="layers-header" style={{ paddingLeft: 0, paddingRight: 0, background: 'transparent', borderBottom: '1px solid var(--border-dim)' }}>
                                <span className="layers-title">Master Panels</span>
                                <div style={{display:'flex', gap:'4px'}}>
                                    <button className="add-screen-btn" style={{fontSize:'10px', padding:'4px 8px'}} onClick={() => addPanel({ name: "New Sidebar", width: 160, height: 480, bg: 0x1e1e2d })}>＋ Sidebar</button>
                                    <button className="add-screen-btn" style={{fontSize:'10px', padding:'4px 8px'}} onClick={() => addPanel({ name: "New Header", width: 800, height: 60, bg: 0x2d2d3f })}>＋ Header</button>
                                </div>
                            </div>
                            {project.panels.map((pan: Panel) => (
                                <PanelNode key={pan.id} pan={pan} isActive={selections['panel']?.id === pan.id} />
                            ))}
                        </div>
                    </div>
                    <div className="quick-add-hint">
                        <span>💡</span>
                        <span>Click an item to select it on the canvas — and vice versa.</span>
                    </div>
                </div>
            </div>

            {/* PALETTE STRIP */}
            {showPalette && (
                <div className="palette-side">
                    <div className="section-label" style={{marginTop:'10px'}}>Widgets</div>
                    <div className="widget-grid">
                        {[
                            { type: 'btn', label: 'Button', icon: '🔘', cls: 'wc-btn' },
                            { type: 'label', label: 'Label', icon: '🏷️', cls: 'wc-label' },
                            { type: 'switch', label: 'Switch', icon: '⚡', cls: 'wc-switch' },
                            { type: 'slider', label: 'Slider', icon: '〰️', cls: 'wc-slider' },
                            { type: 'arc', label: 'Arc', icon: '🔵', cls: 'wc-arc' },
                            { type: 'checkbox', label: 'Checkbox', icon: '☑️', cls: 'wc-check' },
                            { type: 'dropdown', label: 'Dropdown', icon: '⬇️', cls: 'wc-drop' },
                            { type: 'roller', label: 'Roller', icon: '🎚️', cls: 'wc-roller' },
                            { type: 'bar', label: 'Bar', icon: '📊', cls: 'wc-bar' },
                            { type: 'clock', label: 'Clock', icon: '🕐', cls: 'wc-clock' },
                            { type: 'border', label: 'Border', icon: '▭', cls: 'wc-border' },
                            { type: 'nav-menu', label: 'Nav', icon: '☰', cls: 'wc-nav' },
                            { type: 'side-menu', label: 'Side', icon: '𝄃', cls: 'wc-nav' },
                            { type: 'menu-item', label: 'Menu', icon: '🔘', cls: 'wc-menu' },
                        ].map((w: any) => (
                            <div 
                                key={w.type} 
                                className={`widget-chip ${w.cls}`}
                                onMouseDown={(e) => handlePaletteClick(e, w.type as ElementType)}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: w.type }));
                                    e.dataTransfer.effectAllowed = "copy";
                                    const ghost = createGhostImage(w.label, 120, 40);
                                    e.dataTransfer.setDragImage(ghost, 60, 20);
                                    setTimeout(() => ghost.remove(), 0);
                                }}
                                title={w.label}
                            >
                                <span className="wicon">{w.icon}</span>
                                <span style={{fontSize:'8px', marginTop:'2px'}}>{w.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="section-label" style={{marginTop:'20px'}}>Smart</div>
                    <div className="widget-grid" style={{marginBottom:'20px'}}>
                        {SMART_COMPONENTS.map((comp: any) => (
                            <div 
                                key={comp.id} 
                                className={`comp-card comp-${comp.id.split('-')[0]}`} 
                                onMouseDown={(e) => handlePaletteClick(e, 'component', { component: comp.id })}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: 'component', meta: { component: comp.id } }));
                                    e.dataTransfer.effectAllowed = "copy";
                                    const ghost = createGhostImage(comp.label, 140, 60);
                                    e.dataTransfer.setDragImage(ghost, 70, 30);
                                    setTimeout(() => ghost.remove(), 0);
                                }}
                                data-label={comp.label.split(' ')[1]}
                                title={comp.label}
                            >
                                <span className="comp-icon">{comp.icon}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const HierarchyItem = ({ it, pageId, screenId }: { it: GridItem, pageId: string, screenId: string }) => {
	const { project, selections, setSelectedEntity, setActiveScreenId, addItem, removeItem, updateItem, moveItemHierarchy } = useContext(GridContext) as any;
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
        <div 
            className="item-node"
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData("draggedId", it.id);
                e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const draggedId = e.dataTransfer.getData("draggedId");
                if (draggedId && draggedId !== it.id) {
                    moveItemHierarchy(draggedId, it.id);
                }
            }}
        >
            <div 
                className={`item-row ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveScreenId(screenId); setSelectedEntity({ type: 'item', id: it.id, pageId }, screenId); }}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
                <div className="item-dot"></div>
                {isEditing ? (
                    <input 
                        autoFocus
                        className="node-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="item-name">{it.name}</span>
                )}
                <span className="item-type">{it.type}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isContainer && children.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}>
                            {isOpen ? '▼' : '▶'}
                        </button>
                    )}
                    <button 
                        className="delete-item-btn"
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', opacity: isSelected ? 1 : 0.4, padding: '2px 4px' }}
                        onClick={(e) => { e.stopPropagation(); if(window.confirm(`Delete ${it.name}?`)) removeItem(pageId, it.id); }}
                        title="Delete Item"
                    >✕</button>
                </div>
            </div>
            {isOpen && children.length > 0 && (
                <div className="item-list">
                    {children.map((child: any) => (
                        <HierarchyItem key={child.id} it={child} pageId={it.type === 'panel-ref' ? it.panelId! : pageId} screenId={screenId} />
                    ))}
                </div>
            )}
        </div>
	);
};

const PageNode = ({ pg, screenId }: { pg: Page, screenId: string }) => {
	const { selections, setSelectedEntity, setActiveScreenId, updatePage } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(pg.name);
	const isSelected = selections[screenId]?.type === 'page' && selections[screenId]?.id === pg.id;
    const isChildSelected = pg.items.some((it: any) => selections[screenId]?.id === it.id);

    useEffect(() => {
        if (isSelected || isChildSelected) setIsOpen(true);
    }, [isSelected, isChildSelected]);

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
                    <input 
                        autoFocus
                        className="node-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="page-name">{pg.name}</span>
                )}
			</div>
			{isOpen && (
                <div className="item-list">
                    {pg.items.map((it: any) => (
                        <HierarchyItem key={it.id} it={it} pageId={pg.id} screenId={screenId} />
                    ))}
                    {pg.items.length === 0 && <div style={{ padding: '4px 20px', fontSize: '11px', color: '#cbd5e1' }}>Empty Page</div>}
                </div>
            )}
		</div>
	);
};

const ScreenNode = ({ scr, isActive }: { scr: Screen, isActive: boolean }) => {
	const { setActiveScreenId, setSelectedEntity, selections, updateScreen } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(isActive);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(scr.name);

    useEffect(() => {
        const hasSelection = selections?.[scr.id] != null;
        if (hasSelection) setIsOpen(true);
    }, [selections, scr.id]);

    useEffect(() => { setEditName(scr.name); }, [scr.name]);

    useEffect(() => {
        if (isActive) setIsOpen(true);
    }, [isActive]);

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
                    <input 
                        autoFocus
                        className="node-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="screen-name">{scr.name}</span>
                )}
				<span className="screen-badge">{scr.pages.length} pages</span>
			</div>
			{isOpen && (
				<div className="page-list">
					{scr.pages.map((pg: any) => <PageNode key={pg.id} pg={pg} screenId={scr.id} />)}
				</div>
			)}
		</div>
	);
};

const PanelNode = ({ pan, isActive }: { pan: Panel, isActive: boolean }) => {
	const [isOpen, setIsOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(pan.name);
	const { setSelectedEntity, setActiveScreenId, selections, activeScreenId, addItem, updatePanel, removePanel } = useContext(GridContext) as any;
    const isPanelMode = activeScreenId === 'panel';

    useEffect(() => { setEditName(pan.name); }, [pan.name]);

    const saveEdit = () => {
        updatePanel(pan.id, { name: editName });
        setIsEditing(false);
    };
	
	return (
		<div 
            className="screen-node"
            draggable={true}
            onDragStart={(e) => {
                e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: 'panel-ref', panelId: pan.id }));
                e.dataTransfer.effectAllowed = "copy";
                const ghost = createGhostImage(pan.name, 160, 160);
                e.dataTransfer.setDragImage(ghost, 80, 80);
                setTimeout(() => ghost.remove(), 0);
            }}
        >
			<div 
                className={`screen-row ${isPanelMode && isActive ? 'active' : ''}`}
                onClick={() => { setActiveScreenId('panel'); setSelectedEntity({ type: 'panel', id: pan.id }, 'panel'); }}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
				<span className="screen-chevron" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>{isOpen ? '▼' : '▶'}</span>
				<span className="screen-icon">🔲</span>
				{isEditing ? (
                    <input 
                        autoFocus
                        className="node-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="screen-name">{pan.name}</span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button 
                        className="add-item-mini"
                        onClick={(e) => { e.stopPropagation(); addItem('nav-item', pan.id); }}
                        title="Add Nav Item"
                    >＋</button>
                    <button 
                        className="add-item-mini"
                        style={{ background: '#fee2e2', color: '#ef4444', fontSize: '10px' }}
                        onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this Master Panel?')) removePanel(pan.id); }}
                        title="Delete Panel"
                    >✕</button>
                </div>
			</div>
			{isOpen && (
				<div className="item-list">
					{pan.elements.map((it: any) => (
                        <HierarchyItem key={it.id} it={it} pageId={pan.id} screenId="panel" />
                    ))}
                    {pan.elements.length === 0 && <div style={{ padding: '4px 20px', fontSize: '11px', color: '#cbd5e1' }}>Empty Panel</div>}
				</div>
			)}
		</div>
	);
};
