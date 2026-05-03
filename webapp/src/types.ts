export type ElementType = "btn" | "switch" | "slider" | "label" | "clock" | "panel-ref" | "arc" | "checkbox" | "dropdown" | "roller" | "bar" | "border" | "nav-menu" | "side-menu" | "menu-item" | "nav-item" | "native-wifi" | "native-wifi-info" | "native-system" | "native-sd" | "native-tests" | "component" | "shape_circle" | "battery_icon" | "rounded_rect" | "pane-grid" | "chart" | "grid" | "grid-item";

export type GridItem = {
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
	itemBg?: number;
	value?: number;
	min?: number;
	max?: number;
	options?: string;
	borderWidth?: number;
	radius?: number;
	orientation?: "v" | "h";
	fontSize?: number;
	textAlign?: "left" | "center" | "right";
	children?: GridItem[];
	component?: string;
	borderColor?: number;
	bg?: number;
	targetScreenId?: string;
	opacity?: number;
	hidden?: boolean;
	scrollable?: boolean;
	mqttTopic?: string;
	mqttStateTopic?: string;
	padding?: number;
	gap?: number;
	icon?: string;
	onClick?: string;
	onDoubleClick?: string;
	onLongPress?: string;
	apTargetScreenId?: string;
	ipTargetScreenId?: string;
    // Chart specific
    chartType?: 'line' | 'bar' | 'scatter' | 'area';
    chartPoints?: number;
    chartColor?: number;
	chartSecondaryColor?: number;
	pinned?: boolean;
	noBg?: boolean;
	// Grid specific
	cols?: number;
	rows?: number;
	locked?: boolean;
	col?: number;
	row?: number;
	topText?: string;
	bottomText?: string;
	parentId?: string;
	paneGridId?: string;
};

export type Page = {
	id: string;
	name: string;
	x: number;
	y: number;
	items: GridItem[];
};

export type Screen = {
	id: string;
	name: string;
	pages: Page[];
	x?: number;
	y?: number;
	bg?: number;
	borderColor?: number;
	borderWidth?: number;
};

export type Panel = {
	id: string;
	name: string;
	width: number;
	height: number;
	bg: number;
	itemBg: number;
	elements: GridItem[];
	layout?: "v" | "h" | "free";
	gap?: number;
};

export type Pane = {
    id: string;
    title: string;
    icon?: string;
    bg?: number;
    textColor?: number;
    childWidget?: GridItem;
    mqttStateTopic?: string;
    mqttTopic?: string;
    haEntity?: string;
    onClick?: string;
    onDoubleClick?: string;
    onLongPress?: string;
    valueUnit?: string;
    valueFormat?: string;
};

export type PaneGrid = {
    id: string;
    name: string;
    cols: number;
    rows: number;
    gap: number;
    paneW?: number;
    paneH?: number;
    panes: Pane[];
};

export type Project = {
	screens: Screen[];
	panels: Panel[];
    paneGrids?: PaneGrid[];
};

export const SMART_COMPONENTS = [
	{ id: "wifi-panel",       label: "📡 WiFi",     desc: "Scan & connect to networks",    preview: "/assets/wifi_preview.png",     defaultW: 640, defaultH: 350, icon: "📶" },
	{ id: "sd-browser",       label: "💾 SD Card",   desc: "Browse & view SD card files",   preview: "/assets/sd_preview.png",       defaultW: 640, defaultH: 350, icon: "💾" },
	{ id: "system-settings",  label: "⚙️ Settings",  desc: "System configuration panel",    preview: "/assets/settings_preview.png", defaultW: 640, defaultH: 350, icon: "⚙️" },
	{ id: "shape-circle",     label: "⭕ Circle",    desc: "Native ESPHome circle primitive", preview: "", defaultW: 100, defaultH: 100, icon: "⭕", type: "shape_circle" },
	{ id: "battery-icon",     label: "🔋 Battery",   desc: "Dynamic battery indicator",     preview: "", defaultW: 60,  defaultH: 80,  icon: "🔋", type: "battery_icon" },
	{ id: "rounded-rect",     label: "▢ RoundRect",  desc: "Custom rounded rectangle",      preview: "", defaultW: 100, defaultH: 100, icon: "▢", type: "rounded_rect" },
	{ id: "wifi-info",        label: "🌐 IP Address", desc: "Dynamic IP/SSID display",       preview: "", defaultW: 150, defaultH: 30,  icon: "🌐", type: "native-wifi-info" },
];
