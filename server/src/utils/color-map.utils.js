/**
 * Color map: maps Vietnamese color names (as stored in ProductVariant.color)
 * to CSS hex codes for display as swatches.
 */
const COLOR_MAP = {
    // Beige variants
    'beige': '#f0e6d3',
    'combo màu tự nhiên đệm be': '#d9c5a5',
    'nâu be': '#a0785a',
    'sofa nệm be': '#d9c5a5',

    // Orange / Cam
    'cam': '#e8722a',

    // Camel
    'camel': '#c19a6b',

    // Brown variants
    'combo nâu': '#6f4e37',
    'màu nâu': '#6f4e37',
    'màu nâu/xám': '#8b7d7b',
    'màu nâu/nệm xám': '#8b7d7b',
    'nâu': '#6f4e37',
    'nau': '#6f4e37',
    'nâu phối trắng': '#a07855',

    // White / Trắng
    'giường màu trắng 1m6': '#f0f0f0',
    'giường màu trắng 1m8': '#f0f0f0',
    'giường trắng 1m6': '#f0f0f0',
    'giường trắng 1m8': '#f0f0f0',
    'màu trắng': '#f0f0f0',
    'trắng': '#f0f0f0',
    'trắng - xám': '#d0d0d0',
    'gỗ phối trắng': '#e8ddd0',

    // Natural wood
    'giường tự nhiên 1m6': '#c8a97e',
    'màu tự nhiên': '#c8a97e',
    'màu tự nhiên ': '#c8a97e',
    'màu tự nhiên': '#c8a97e',

    // Olive
    'olive': '#808000',

    // Gray / Xám
    'sofa nệm xám': '#9e9e9e',
    'xám': '#9e9e9e',

    // Blue / Xanh
    'xanh dương': '#1565c0',

    // Black / Đen
    'đen': '#1a1a1a',
};

function normalizeColorName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .normalize('NFC');
}
function getColorHex(name) {
    const normalized = normalizeColorName(name);
    return COLOR_MAP[normalized] || '#cccccc';
}

module.exports = { COLOR_MAP, getColorHex, normalizeColorName };
