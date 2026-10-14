import { EffectAsset, JsonAsset, Prefab, SpriteFrame, TTFFont } from 'cc';
import { LevelData } from '../domain/LevelTypes';
import { decodeLevel } from './LevelDecoder';
import { loadFirst, loadResource, loadSpriteFrame } from './ResourceLoader';

const LEVEL_PATH = 'bee/levels/teddy.level';
const EFFECT_PATH = 'bee/effects/voxel-lit';
const FONT_PATH = 'font/LilitaOne';
const SPRITES = 'bee/sprites';
/** FBX prefab sub-asset path differs between importer versions; try both. */
const modelPaths = (name: string) => [`bee/models/${name}/${name}`, `bee/models/${name}`];

export interface BackdropSprites {
    readonly tile: SpriteFrame;
    readonly leaves: SpriteFrame;
    readonly hive: SpriteFrame;
    readonly slot: SpriteFrame;
}

export interface BeeAssets {
    readonly level: LevelData;
    readonly effect: EffectAsset;
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
    const [tile, leaves, hive, slot] = await Promise.all(
        ['dark-bg', 'leaf-border', 'hive-hanging', 'slot'].map((n) => loadSpriteFrame(`${SPRITES}/${n}`)),
    );
    return { tile, leaves, hive, slot };
}

/** Loads everything the level needs from `resources/bee` in parallel. Required assets throw. */
export async function loadBeeAssets(): Promise<BeeAssets> {
    const [levelAsset, effect, bee, hive, cube, font, backdrop, hand] = await Promise.all([
        loadResource(LEVEL_PATH, JsonAsset),
        loadResource(EFFECT_PATH, EffectAsset),
        loadFirst(modelPaths('bee'), Prefab),
        loadFirst(modelPaths('hive-hexa'), Prefab),
        loadFirst(modelPaths('bee-cube'), Prefab),
        optional('font', loadResource(FONT_PATH, TTFFont)),
        optional('backdrop sprites', loadBackdropSprites()),
        optional('tutorial hand', loadSpriteFrame(`${SPRITES}/hand`)),
    ]);
    return { level: decodeLevel(levelAsset.json), effect, bee, hive, cube, font, backdrop, hand };
}
