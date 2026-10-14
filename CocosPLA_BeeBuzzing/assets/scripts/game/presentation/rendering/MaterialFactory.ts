import { Color, EffectAsset, Material, Texture2D } from 'cc';
import { GAME_COLOR_HEX } from '../../infrastructure/GamePalette';

const TECH_OPAQUE = 0;
const TECH_TRANSPARENT = 1;
/** bee-master.effect (TCP2 toon port) settings for hives: pixel-constant outline. */
const TOON_OUTLINE_PIXELS = 4;
const TOON_SHADOW = new Color(150, 130, 160, 255);

export interface SolidMaterialOptions {
    edge?: boolean;
    /** RGB multiplier (e.g. 0.6 for dimmed queue hives). */
    shade?: number;
    transparent?: boolean;
    texture?: Texture2D | null;
}

/**
 * Creates and caches materials built on voxel-lit.effect. Every material has GPU
 * instancing on, so identical mesh + material pairs (bees, flying cubes) batch into a
 * single draw call regardless of how many are on screen.
 */
export class MaterialFactory {
    private readonly effect: EffectAsset;
    private readonly toonEffect: EffectAsset | null;
    private readonly cache = new Map<string, Material>();

    constructor(effect: EffectAsset, toonEffect: EffectAsset | null = null) {
        this.effect = effect;
        this.toonEffect = toonEffect;
    }

    /**
     * Toon-shaded material with the effect's built-in pixel outline (bee-master.effect),
     * in a game color. Needs a directional light. Falls back to the solid material when the
     * toon effect is unavailable (warned once at load).
     */
    toonGameColor(color: number, shade = 1): Material {
        const hex = GAME_COLOR_HEX[color];
        if (!hex) throw new Error(`[MaterialFactory] unknown game color ${color}`);
        const toon = this.toonEffect;
        if (!toon) return this.solid(hex, { shade });
        return this.getOrCreate(`toon:${hex}:${shade}`, () => {
            const mat = new Material();
            mat.initialize({ effectAsset: toon, technique: TECH_OPAQUE, defines: { USE_OUTLINE: true, OUTLINE_PIXEL_SIZE: 1, USE_INSTANCING: true } });
            const c = new Color().fromHEX(hex);
            c.set(Math.round(c.r * shade), Math.round(c.g * shade), Math.round(c.b * shade), 255);
            mat.setProperty('mainColor', c);
            mat.setProperty('shadowColor', TOON_SHADOW);
            mat.setProperty('outlineColor', Color.BLACK);
            mat.setProperty('outlineWidth', TOON_OUTLINE_PIXELS);
            return mat;
        });
    }

    /** Vertex-colored, edge-darkened material for the merged sculpture mesh. */
    sculpture(): Material {
        return this.getOrCreate('sculpture', () => this.create(TECH_OPAQUE, {
            USE_VERTEX_COLOR: true, USE_EDGE: true,
        }, Color.WHITE));
    }

    /** Single-color material keyed by hex color + options. */
    solid(hex: string, options: SolidMaterialOptions = {}): Material {
        const shade = options.shade ?? 1;
        const key = `solid:${hex}:${options.edge ? 1 : 0}:${options.transparent ? 1 : 0}:${options.texture?.uuid ?? ''}:${shade}`;
        return this.getOrCreate(key, () => {
            const defines: Record<string, boolean> = { USE_INSTANCING: true };
            if (options.edge) defines.USE_EDGE = true;
            if (options.texture) defines.USE_TEXTURE = true;
            const color = new Color().fromHEX(hex);
            color.set(Math.round(color.r * shade), Math.round(color.g * shade), Math.round(color.b * shade), color.a);
            const mat = this.create(options.transparent ? TECH_TRANSPARENT : TECH_OPAQUE, defines, color);
            if (options.texture) mat.setProperty('mainTexture', options.texture);
            return mat;
        });
    }

    /** Solid material in a game palette color. */
    gameColor(color: number, options: SolidMaterialOptions = {}): Material {
        const hex = GAME_COLOR_HEX[color];
        if (!hex) throw new Error(`[MaterialFactory] unknown game color ${color}`);
        return this.solid(hex, options);
    }

    private getOrCreate(key: string, factory: () => Material): Material {
        let mat = this.cache.get(key);
        if (!mat) {
            mat = factory();
            this.cache.set(key, mat);
        }
        return mat;
    }

    private create(technique: number, defines: Record<string, boolean>, color: Color): Material {
        const mat = new Material();
        mat.initialize({ effectAsset: this.effect, technique, defines });
        mat.setProperty('mainColor', color);
        return mat;
    }
}
