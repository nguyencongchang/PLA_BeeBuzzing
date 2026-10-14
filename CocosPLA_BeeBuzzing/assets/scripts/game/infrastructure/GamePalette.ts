/**
 * GameColor enum → display hex (BoxyBlast cube palette). Single source of truth for
 * cube, hive and bee tints. Codes 14 and 17 are intentionally unused.
 */
export const GAME_COLOR_HEX: Readonly<Record<number, string>> = {
    0: '#7A1428',  // Burgundy
    1: '#CC3333',  // Red
    2: '#D47F7F',  // CoralRed
    3: '#8B2255',  // Berry
    4: '#CC2288',  // Magenta
    5: '#FF55AA',  // Pink
    6: '#FF88CC',  // Bubblegum
    7: '#441888',  // DeepPurple
    8: '#8844BB',  // Violet
    9: '#6644FF',  // Indigo
    10: '#AA88EE', // Lavender
    11: '#11205A', // Navy
    12: '#1212E6', // Blue
    13: '#2299EE', // SkyBlue
    15: '#118866', // Teal
    16: '#19D4E6', // Cyan
    18: '#147914', // ForestGreen
    19: '#778833', // Olive
    20: '#0FBE0F', // Green
    21: '#DD9900', // Gold
    22: '#FFDD00', // Yellow
    23: '#EE7722', // Orange
    24: '#FFAA77', // Peach
    25: '#442211', // DarkBrown
    26: '#85351B', // Rust
    27: '#BB8833', // WarmTan
    28: '#313131', // Black
    29: '#EEEEEE', // White
    30: '#6C6C7B', // Gray
};

/** RGB bytes of a game color. Throws on an unknown color so bad level data surfaces early. */
export function gameColorRgb(color: number): [number, number, number] {
    const hex = GAME_COLOR_HEX[color];
    if (!hex) throw new Error(`[GamePalette] unknown game color ${color}`);
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
