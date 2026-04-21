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

export const Sidebar: React.FC = () => {
    const { 
        project, 
        activeScreenId, 
        setActiveScreenId, 
        selections, 
        setSelectedEntity, 
        addItem,
        addScreen,
        sidebarTab,
        setSidebarTab
    } = useContext(GridContext) as any;

    const handlePaletteClick = (e: React.MouseEvent, type: ElementType, meta?: any, panelId?: string) => {
        const screen = project.screens.find((s: any) => s.id === activeScreenId) || project.screens[0];
        if (!screen) return;

        const activeTarget = selections[activeScreenId];
        let targetPageId = '';

        if (activeTarget?.type === 'page') {
            targetPageId = activeTarget.id;
        } else if (activeTarget?.type === 'item' && activeTarget.pageId) {
            targetPageId = activeTarget.pageId;
        } else if (screen.pages.length > 0) {
            targetPageId = screen.pages[0].id;
        }

        if (!targetPageId) return;

        if (e.detail >= 2) {
            addItem(type, targetPageId, undefined, panelId, 20, 20, meta, true);
        } else {
            if (activeTarget?.type !== 'page' && activeTarget?.type !== 'item') {
                setSelectedEntity({ type: 'page', id: targetPageId }, activeScreenId, true);
            }
        }
    };

    return (
        <div className="sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-tabs">
                <div 
                    className={`stab ${sidebarTab === 'palette' ? 'active' : ''}`} 
                    onClick={() => setSidebarTab('palette')}
                >
                    PALETTE
                </div>
                <div 
                    className={`stab ${sidebarTab === 'layers' ? 'active' : ''}`} 
                    onClick={() => setSidebarTab('layers')}
                >
                    LAYERS
                </div>
            </div>

            {/* PALETTE PANEL */}
            <div className={`sidebar-panel ${sidebarTab === 'palette' ? 'visible' : ''}`}>
                <div>
                    <div className="section-label">Basic Widgets</div>
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
                            { type: 'nav-menu', label: 'Nav Menu', icon: '☰', cls: 'wc-nav' },
                        ].map((w: any) => (
                            <div 
                                key={w.type} 
                                className={`widget-chip ${w.cls}`}
                                onMouseDown={(e) => handlePaletteClick(e, w.type as ElementType)}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: w.type }));
                                    e.dataTransfer.effectAllowed = "copy";
                                }}
                            >
                                <span className="wicon">{w.icon}</span>
                                {w.label}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="section-label">Master Panels</div>
                    <div style={{display:'flex', flexDirection:'column', gap:'7px'}}>
                        {project.panels.map((pan: Panel) => (
                            <div 
                                key={pan.id} 
                                className="panel-card" 
                                onMouseDown={(e) => handlePaletteClick(e, 'panel-ref', undefined, pan.id)}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: 'panel-ref', panelId: pan.id }));
                                    e.dataTransfer.effectAllowed = "copy";
                                }}
                            >
                                <span style={{fontSize:'18px'}}>🧩</span>
                                <span className="pname">{pan.name}</span>
                                <span className="pdim">{pan.width}×{pan.height}</span>
                            </div>
                        ))}
                        <div 
                            className="panel-card" 
                            style={{borderStyle:'dashed', color:'#94a3b8', justifyContent:'center', gap:'6px', fontSize:'13px', fontWeight:700}}
                            onClick={() => addItem('panel-ref', selections[activeScreenId]?.id || 'p1')}
                        >
                            <span>＋</span> New Panel
                        </div>
                    </div>
                </div>
                <div>
                    <div className="section-label">Smart Components</div>
                    <div style={{display:'flex', flexDirection:'column', gap:'7px'}}>
                        {SMART_COMPONENTS.map((comp: any) => (
                            <div 
                                key={comp.id} 
                                className={`comp-card comp-${comp.id.split('-')[0]}`} 
                                onMouseDown={(e) => handlePaletteClick(e, 'component', { component: comp.id })}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("application/gridos-item", JSON.stringify({ type: 'component', meta: { component: comp.id } }));
                                    e.dataTransfer.effectAllowed = "copy";
                                }}
                            >
                                <span className="comp-icon">{comp.icon}</span>
                                <div className="comp-info">
                                    <div className="cname">{comp.label}</div>
                                    <div className="cdesc">{comp.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* LAYERS PANEL */}
            <div className={`layers-panel ${sidebarTab === 'layers' ? 'visible' : ''}`}>
                <div className="layers-header">
                    <span className="layers-title">Project</span>
                    <button className="add-screen-btn" onClick={() => addScreen && addScreen()}>＋ Screen</button>
                </div>
                <div className="tree">
                    {project.screens.map((scr: Screen) => (
                        <ScreenNode key={scr.id} scr={scr} isActive={activeScreenId === scr.id} />
                    ))}
                    <div style={{ marginTop: '20px' }}>
                        <div className="section-label">Master Panels</div>
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
    );
};

const HierarchyItem = ({ it, pageId, screenId }: { it: GridItem, pageId: string, screenId: string }) => {
	const { project, selections, setSelectedEntity, setActiveScreenId, addItem, removeItem, updateItem } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(true);
    const isSelected = selections[screenId]?.id === it.id;
    const isContainer = it.type === "panel-ref" || it.type === "nav-menu";

	let children: GridItem[] = [];
	if (it.type === "panel-ref") {
		const panel = project.panels.find((p: any) => p.id === it.panelId);
		children = panel?.elements || [];
	} else if (it.type === "nav-menu") {
		children = it.children || [];
	}

	return (
        <div className="item-node">
            <div 
                className={`item-row ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveScreenId(screenId); setSelectedEntity({ type: 'item', id: it.id, pageId }, screenId); }}
            >
                <div className="item-dot"></div>
                <span className="item-name">{it.name}</span>
                <span className="item-type">{it.type}</span>
                {isContainer && (
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#94a3b8', cursor: 'pointer' }}>
                        {isOpen ? '▼' : '▶'}
                    </button>
                )}
            </div>
            {isOpen && children.length > 0 && (
                <div className="item-list">
                    {children.map((child: any) => (
                        <HierarchyItem key={child.id} it={child} pageId={pageId} screenId={screenId} />
                    ))}
                </div>
            )}
        </div>
	);
};

const PageNode = ({ pg, screenId }: { pg: Page, screenId: string }) => {
	const { selections, setSelectedEntity, setActiveScreenId, addItem } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(true);
	const isSelected = selections[screenId]?.type === 'page' && selections[screenId]?.id === pg.id;
    const isChildSelected = pg.items.some((it: any) => selections[screenId]?.id === it.id);

    useEffect(() => {
        if (isSelected || isChildSelected) setIsOpen(true);
    }, [isSelected, isChildSelected]);

	return (
		<div className="page-node">
			<div 
                className={`page-row ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveScreenId(screenId); setSelectedEntity({ type: 'page', id: pg.id }, screenId); }}
            >
				<span className={`screen-chevron ${isOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>{isOpen ? '▼' : '▶'}</span>
				<span className="page-icon">📄</span>
				<span className="page-name">{pg.name}</span>
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
	const { setActiveScreenId, setSelectedEntity, selections } = useContext(GridContext) as any;
	const [isOpen, setIsOpen] = useState(isActive);

    useEffect(() => {
        const hasSelection = selections[scr.id] !== null;
        if (hasSelection) setIsOpen(true);
    }, [selections, scr.id]);

	return (
		<div className="screen-node">
			<div 
                className={`screen-row ${isActive ? 'active' : ''}`}
                onClick={() => { setActiveScreenId(scr.id); setSelectedEntity({ type: 'screen', id: scr.id }); }}
            >
				<span className="screen-chevron" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>{isOpen ? '▼' : '▶'}</span>
				<span className="screen-icon">🖥</span>
				<span className="screen-name">{scr.name}</span>
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
	const { setSelectedEntity, selections } = useContext(GridContext) as any;
	
	return (
		<div className="screen-node">
			<div onClick={() => setSelectedEntity({ type: 'panel', id: pan.id })} className={`screen-row ${isActive ? 'active' : ''}`}>
				<span className="screen-chevron" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>{isOpen ? '▼' : '▶'}</span>
				<span className="screen-icon">🔲</span>
				<span className="screen-name">{pan.name}</span>
			</div>
			{isOpen && (
				<div className="item-list">
					{pan.elements.map((it: any) => {
						const isSelected = selections['panel']?.id === it.id;
						return (
							<div 
                                key={it.id} 
                                className={`item-row ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedEntity({ type: 'item', id: it.id, pageId: 'panel' })}
                            >
								<div className="item-dot"></div>
								<span className="item-name">{it.name}</span>
								<span className="item-type">{it.type}</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};
