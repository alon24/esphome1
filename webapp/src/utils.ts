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
