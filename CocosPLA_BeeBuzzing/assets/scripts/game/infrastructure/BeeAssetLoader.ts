import { EffectAsset, JsonAsset, Prefab, SpriteFrame, TTFFont } from 'cc';
import { LevelData } from '../domain/LevelTypes';
import { decodeLevel } from './LevelDecoder';
import { loadFirst, loadResource, loadSpriteFrame } from './ResourceLoader';

const LEVEL_PATH = 'bee/levels/teddy.level';
const EFFECT_PATH = 'bee/effects/voxel-lit';
const TOON_EFFECT_PATH = 'bee/effects/bee-master';
const FONT_PATH = 'font/LilitaOne';
const SPRITES = 'bee/sprites';
/** FBX prefab sub-asset path differs between importer versions; try both. */
const modelPaths = (name: string) => [`bee/models/${name}/${name}`, `bee/models/${name}`];

export interface BackdropSprites {
    readonly tile: SpriteFrame;
    readonly leaves: SpriteFrame;
    readonly hive: SpriteFrame;
    /** Same hive with the entrance cut out, drawn in front of the bees. */
    readonly hiveFront: SpriteFrame;
    readonly slot: SpriteFrame;
}

export interface BeeAssets {
    readonly level: LevelData;
    readonly effect: EffectAsset;
    /** Toon effect for hives (cosmetic: falls back to `effect`). */
    readonly toonEffect: EffectAsset | null;
    readonly bee: Prefab;
    readonly hive: Prefab;
    readonly cube: Prefab;
    /** Cosmetic assets: null when missing (logged), the game still runs without them. */
    readonly font: TTFFont | null;
    readonly backdrop: BackdropSprites | null;
    readonly hand: SpriteFrame | null;
}

function optional<T>(what: string, promise: Promise<T>): Promise<T | null> {
    return promise.catch((e) => {
        console.warn(`[BeeGame] ${what} unavailable, continuing without it`, e);
        return null;
    });
}

async function loadBackdropSprites(): Promise<BackdropSprites> {
    const [tile, leaves, hive, hiveFront, slot] = await Promise.all(
        ['dark-bg', 'leaf-border', 'hive-hanging', 'hive-hanging-front', 'slot'].map((n) => loadSpriteFrame(`${SPRITES}/${n}`)),
    );
    return { tile, leaves, hive, hiveFront, slot };
}

/**
 * The dashboard level (compact .level.json text) when set and valid; otherwise the bundled one.
 * A broken override is logged and ignored so a bad paste never blanks the ad.
 */
async function loadLevel(levelJson: string): Promise<LevelData> {
    if (levelJson.trim()) {
        try {
            return decodeLevel(JSON.parse(levelJson));
        } catch (e) {
            console.error('[BeeGame] level parameter is not a valid .level.json, using the bundled level', e);
        }
    }
    return decodeLevel((await loadResource(LEVEL_PATH, JsonAsset)).json);
}

/** Loads everything the level needs from `resources/bee` in parallel. Required assets throw. */
export async function loadBeeAssets(levelJson: string): Promise<BeeAssets> {
    const [level, effect, toonEffect, bee, hive, cube, font, backdrop, hand] = await Promise.all([
        loadLevel(levelJson),
        loadResource(EFFECT_PATH, EffectAsset),
        optional('toon effect', loadResource(TOON_EFFECT_PATH, EffectAsset)),
        loadFirst(modelPaths('bee'), Prefab),
        loadFirst(modelPaths('hive-hexa'), Prefab),
        loadFirst(modelPaths('bee-cube'), Prefab),
        optional('font', loadResource(FONT_PATH, TTFFont)),
        optional('backdrop sprites', loadBackdropSprites()),
        optional('tutorial hand', loadSpriteFrame(`${SPRITES}/hand`)),
    ]);
    return { level, effect, toonEffect, bee, hive, cube, font, backdrop, hand };
}
