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
        if (parent) {
            const parentOffset = getAbsoluteOffset(items, parent.id);
            const gap = parent.gap !== undefined ? parent.gap : 10;

            if (parent.type === 'pane-grid') {
                // No padding — gap only between cells
                const cols = parent.cols || 4;
                const rows = parent.rows || 4;
                const cellW = (parent.width - gap * (cols - 1)) / cols;
                const cellH = (parent.height - gap * (rows - 1)) / rows;
                return {
                    x: parentOffset.x + (item.col || 0) * (cellW + gap),
                    y: parentOffset.y + (item.row || 0) * (cellH + gap),
                };
            } else if (parent.type === 'grid') {
                // padding: gap on all sides
                const cols = parent.cols || 2;
                const rows = parent.rows || 1;
                const colW = (parent.width - (cols + 1) * gap) / cols;
                const rowH = (parent.height - (rows + 1) * gap) / rows;
                return {
                    x: parentOffset.x + gap + (item.col || 0) * (colW + gap),
                    y: parentOffset.y + gap + (item.row || 0) * (rowH + gap),
                };
            }
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

// Clamp all grid/pane-grid children to fit within their parent's col/row bounds.
// Call before syncing to device to prevent out-of-range placements.
export const normalizeGridChildren = (items: GridItem[]): GridItem[] => {
    return items.map(it => {
        if ((it.type === 'pane-grid' || it.type === 'grid') && it.children?.length) {
            const gCols = it.cols || 4;
            const gRows = it.rows || 4;
            const children = it.children.map(child => {
                const col = Math.max(0, Math.min(child.col || 0, gCols - 1));
                const row = Math.max(0, Math.min(child.row || 0, gRows - 1));
                const cols = Math.max(1, Math.min(child.cols || 1, gCols - col));
                const rows = Math.max(1, Math.min(child.rows || 1, gRows - row));
                return { ...child, col, row, cols, rows };
            });
            return { ...it, children: normalizeGridChildren(children) };
        }
        if (it.children?.length) return { ...it, children: normalizeGridChildren(it.children) };
        return it;
    });
};

export const findFirstFreePosition = (
    items: GridItem[],
    w: number,
    h: number,
    startX = 40,
    startY = 40
): { x: number; y: number } => {
    const topLevel = items.filter(it => !(it as any).parentId);
    for (let attempt = 0; attempt < 14; attempt++) {
        const tx = startX + attempt * 24;
        const ty = startY + attempt * 24;
        const overlaps = topLevel.some(it =>
            !(tx + w <= it.x || tx >= it.x + it.width || ty + h <= it.y || ty >= it.y + it.height)
        );
        if (!overlaps) return { x: tx, y: ty };
    }
    return { x: startX, y: startY + 14 * 24 };
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
