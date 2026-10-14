import { ImageAsset, SpriteFrame, Texture2D } from 'cc';

/**
 * Pre-repeats a small tile into a larger texture (pattern unchanged). A TILED sprite emits one
 * quad per tile, so a 50px tile over a large screen overflows the UI vertex-buffer chunk;
 * an 8x pre-tiled texture needs 64x fewer quads. Falls back to the original frame (with a
 * warning) when no 2D canvas is available.
 */
export function pretileSpriteFrame(frame: SpriteFrame, repeat: number): SpriteFrame {
    const source = frame.texture instanceof Texture2D ? frame.texture.image?.data : null;
    if (typeof document === 'undefined' || !source || !(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) {
        console.warn('[TextureTiling] cannot pre-tile this texture, using the small tile');
        return frame;
    }
    const canvas = document.createElement('canvas');
    canvas.width = source.width * repeat;
    canvas.height = source.height * repeat;
    const ctx = canvas.getContext('2d');
    const pattern = ctx?.createPattern(source, 'repeat');
    if (!ctx || !pattern) {
        console.warn('[TextureTiling] 2D canvas unavailable, using the small tile');
        return frame;
    }
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new Texture2D();
    texture.image = new ImageAsset(canvas);
    const tiled = new SpriteFrame();
    tiled.texture = texture;
    return tiled;
}
