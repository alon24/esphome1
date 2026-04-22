export type ElementType = "btn" | "switch" | "slider" | "label" | "clock" | "panel-ref" | "arc" | "checkbox" | "dropdown" | "roller" | "bar" | "border" | "nav-menu" | "menu-item" | "nav-item" | "native-wifi" | "native-system" | "native-sd" | "native-tests" | "component";

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
	mqttTopic?: string;
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
};

export type Project = {
	screens: Screen[];
	panels: Panel[];
};

export const SMART_COMPONENTS = [
	{ id: "wifi-panel",       label: "📡 WiFi",     desc: "Scan & connect to networks",    preview: "/assets/wifi_preview.png",     defaultW: 640, defaultH: 350, icon: "📶" },
	{ id: "sd-browser",       label: "💾 SD Card",   desc: "Browse & view SD card files",   preview: "/assets/sd_preview.png",       defaultW: 640, defaultH: 350, icon: "💾" },
	{ id: "system-settings",  label: "⚙️ Settings",  desc: "System configuration panel",    preview: "/assets/settings_preview.png", defaultW: 640, defaultH: 350, icon: "⚙️" },
];
