import { Asset, Constructor, resources, SpriteFrame, Texture2D } from 'cc';

/** Promise wrapper around resources.load with a descriptive error. */
export function loadResource<T extends Asset>(path: string, type: Constructor<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        resources.load(path, type, (err, asset) => {
            if (err || !asset) reject(new Error(`[ResourceLoader] failed to load '${path}': ${err?.message ?? 'not found'}`));
            else resolve(asset);
        });
    });
}

/** Loads the first path that resolves (sub-asset paths differ between importers). */
export async function loadFirst<T extends Asset>(paths: readonly string[], type: Constructor<T>): Promise<T> {
    let lastError: unknown = null;
    for (const path of paths) {
        try {
            return await loadResource(path, type);
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError ?? new Error('[ResourceLoader] no paths given');
}

/** SpriteFrame from an image imported as plain texture (no sprite-frame meta needed). */
export async function loadSpriteFrame(imagePath: string): Promise<SpriteFrame> {
    const texture = await loadResource(`${imagePath}/texture`, Texture2D);
    const frame = new SpriteFrame();
    frame.texture = texture;
    return frame;
}
