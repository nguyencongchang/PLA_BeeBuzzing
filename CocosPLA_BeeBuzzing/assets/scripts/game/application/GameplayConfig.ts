/**
 * Gameplay tunables. Defaults live here; the parameter dashboard overrides them via
 * PlayableConfig → ParameterController before the level starts.
 */
export interface GameplayConfig {
    /** Number of slots active hives jump into. */
    slotCount: number;
    /** Max 90° turns a bee may take to escape toward the camera. */
    maxTurns: number;
    /** Min dot(face direction, to-camera) for a face to count as camera-facing. */
    facingThreshold: number;
    /** Seconds between two bees of the same hive (x1 speed). */
    fireInterval: number;
    /** Bee flight speed in world units / second (x1 speed). */
    beeSpeed: number;
    /** Hard cap of simultaneous bees (frame-rate guard). */
    maxBeesInFlight: number;
    /** Idle sculpture spin in degrees / second. */
    autoRotateSpeed: number;
    /** Initial sculpture tilt toward the camera, degrees. */
    initialTilt: number;
    /** Show the X2 SPEED button. */
    speedButtonEnabled: boolean;
}

export const DEFAULT_GAMEPLAY_CONFIG: Readonly<GameplayConfig> = {
    slotCount: 5,
    maxTurns: 2,
    facingThreshold: 0.3,
    fireInterval: 0.16,
    beeSpeed: 3,
    maxBeesInFlight: 160,
    autoRotateSpeed: 8,
    initialTilt: 10,
    speedButtonEnabled: true,
};

/** Live config instance (mutated by parameter updates before gameplay starts). */
export const gameplayConfig: GameplayConfig = { ...DEFAULT_GAMEPLAY_CONFIG };
