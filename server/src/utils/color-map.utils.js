
const COLOR_MAP = {
    'beige': '#f0e6d3',
    'combo màu tự nhiên đệm be': '#d9c5a5',
    'nâu be': '#a0785a',
    'sofa nệm be': '#d9c5a5',

    'cam': '#e8722a',

    'camel': '#c19a6b',

    'combo nâu': '#6f4e37',
    'màu nâu': '#6f4e37',
    'màu nâu/xám': '#8b7d7b',
    'màu nâu/nệm xám': '#8b7d7b',
    'nâu': '#6f4e37',
    'nau': '#6f4e37',
    'nâu phối trắng': '#a07855',

    'giường màu trắng 1m6': '#f0f0f0',
    'giường màu trắng 1m8': '#f0f0f0',
    'giường trắng 1m6': '#f0f0f0',
    'giường trắng 1m8': '#f0f0f0',
    'màu trắng': '#f0f0f0',
    'trắng': '#f0f0f0',
    'trắng - xám': '#d0d0d0',
    'gỗ phối trắng': '#e8ddd0',

    'giường tự nhiên 1m6': '#c8a97e',
    'màu tự nhiên': '#c8a97e',
    'màu tự nhiên ': '#c8a97e',
    'màu tự nhiên': '#c8a97e',

    'olive': '#808000',

    'sofa nệm xám': '#9e9e9e',
    'xám': '#9e9e9e',

    'xanh dương': '#1565c0',

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
