export const safeHex = (num: any, fallback = "000000") => {
    if (num === undefined || num === null) return fallback;
    return num.toString(16).padStart(6, '0').toUpperCase();
};
