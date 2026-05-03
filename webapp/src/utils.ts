import { type GridItem } from "./types";

export const safeHex = (num: any, fallback = "000000") => {
    if (num === undefined || num === null) return fallback;
    if (typeof num === "string") {
        const clean = num.replace('#', '');
        return clean.padStart(6, "0").toUpperCase();
    }
    if (typeof num === "number") {
        return num.toString(16).padStart(6, '0').toUpperCase();
    }
    return fallback;
};

export const findItemRecursive = (items: GridItem[], id: string): GridItem | undefined => {
    for (const it of items) {
        if (it.id === id) return it;
        if (it.children) {
            const found = findItemRecursive(it.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

export const applyRecursive = (items: GridItem[], targetId: string, transform: (it: GridItem) => GridItem | null): GridItem[] => {
    return items.map(it => {
        if (it.id === targetId) return transform(it);
        if (it.children) return { ...it, children: applyRecursive(it.children, targetId, transform).filter(x => x) as GridItem[] };
        return it;
    }).filter(x => x) as GridItem[];
};

export const getAbsoluteOffset = (items: GridItem[], id: string): { x: number, y: number } => {
    const item = findItemRecursive(items, id);
    if (!item) return { x: 0, y: 0 };
    
    let x = item.x || 0;
    let y = item.y || 0;
    
    if (item.parentId) {
        const parent = findItemRecursive(items, item.parentId);
        if (parent && (parent.type === 'grid' || parent.type === 'pane-grid')) {
            const gap = parent.gap !== undefined ? parent.gap : 10;
            const cols = parent.cols || (parent.type === 'pane-grid' ? 3 : 2);
            const rows = parent.rows || 1;
            
            const colW = (parent.width - gap) / cols;
            const rowH = (parent.height - gap) / rows;
            
            const parentOffset = getAbsoluteOffset(items, parent.id);
            return {
                x: parentOffset.x + gap + (item.col || 0) * colW,
                y: parentOffset.y + gap + (item.row || 0) * rowH
            };
        }
    }
    
    return { x, y };
};

export const getParentRecursive = (items: GridItem[], id: string): GridItem | undefined => {
    for (const it of items) {
        if (it.children && it.children.some(c => c.id === id)) return it;
        if (it.children) {
            const found = getParentRecursive(it.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

export const findGridAtPositionRecursive = (items: GridItem[], x: number, y: number): GridItem | undefined => {
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const abs = getAbsoluteOffset(items, it.id);
        if (it.type === 'grid' || it.type === 'pane-grid') {
            if (x >= abs.x && x <= abs.x + it.width && y >= abs.y && y <= abs.y + it.height) {
                if (it.children) {
                    const nested = findGridAtPositionRecursive(it.children, x, y);
                    if (nested) return nested;
                }
                return it;
            }
        }
        if (it.children) {
            const found = findGridAtPositionRecursive(it.children, x, y);
            if (found) return found;
        }
    }
    return undefined;
};
