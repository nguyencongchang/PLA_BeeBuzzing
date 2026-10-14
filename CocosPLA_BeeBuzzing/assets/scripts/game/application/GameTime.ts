/**
 * Gameplay clock. Every gameplay timer / motion multiplies engine dt by `scale`, so the
 * X2 SPEED button speeds up the level without touching UI tweens or audio.
 */
export class GameTime {
    static scale = 1;

    static scaled(dt: number): number {
        return dt * GameTime.scale;
    }
}
