import { Color, EffectAsset, Material, Texture2D } from 'cc';
import { GAME_COLOR_HEX } from '../../infrastructure/GamePalette';

const TECH_OPAQUE = 0;
const TECH_TRANSPARENT = 1;

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
    private readonly cache = new Map<string, Material>();

    constructor(effect: EffectAsset) {
        this.effect = effect;
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
