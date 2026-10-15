import {SdkType} from "db://assets/PlayableParamterTool/GameConfig";
import {
    AudioParameter, BooleanParameter, ColorParameter, NumberParameter, ObjectParameter, RangeParameter, TextParameter,
} from "db://assets/PlayableParamterTool/parameter/BaseParameter";
import {
    ButtonParameter,
    CameraParameter,
    RedirectParameter,
    SpriteParameter,
    LabelParameter,
    UINodeParameter,
    NodeParameter
} from "db://assets/scripts/parameter/config/CustomParameter";
import {DEFAULT_GAMEPLAY_CONFIG} from "db://assets/scripts/game/application/GameplayConfig";

export const CURRENT_SDK = SdkType.THE_ONE;

/**
 * parameter Categories
 */
const Categories = {
    Default: "Default",
    Gameplay: "Gameplay",
    Audio: "Audio",
    GamePlayUI: "GamePlayUI",
    CTA: "CTA",
    Logo: "Logo",
    Tutorial: "Tutorial",
    Loading: "Loading",
    EndCardWin: "EndCard Win",
    EndCardLose: "EndCard Lose",
};

/**
 * PlayableConfig - Configuration parameters for Bee Cube Playable Ad
 */
export const PlayableConfig = {
    // The world root auto-scales to fit this frustum (BeeGameBootstrap.frameWorld).
    MainCamera: new ObjectParameter<CameraParameter>("Camera", new CameraParameter({
        rotation: {x: 0, y: 0, z: 0},
        position: {x: 0, y: 0, z: 16},
        fov: 45,
    }), Categories.Default),

    RedirectAfterClicks: new ObjectParameter<RedirectParameter>("Redirect After Clicks", new RedirectParameter(
        new BooleanParameter("Active", false),
        new NumberParameter("Count", 3)
    ), Categories.Default),

    // === Gameplay (Bee Cube) — defaults come from GameplayConfig (SSOT) ===
    SlotCount: new RangeParameter("Slot Count", DEFAULT_GAMEPLAY_CONFIG.slotCount, {min: 3, max: 7, step: 1}, Categories.Gameplay),
    MaxTurns: new RangeParameter("Bee Max 90° Turns", DEFAULT_GAMEPLAY_CONFIG.maxTurns, {min: 0, max: 4, step: 1}, Categories.Gameplay),
    FireInterval: new RangeParameter("Fire Interval (s)", DEFAULT_GAMEPLAY_CONFIG.fireInterval, {min: 0.02, max: 0.3, step: 0.01}, Categories.Gameplay),
    BeeSpeed: new RangeParameter("Bee Speed", DEFAULT_GAMEPLAY_CONFIG.beeSpeed, {min: 2, max: 30, step: 1}, Categories.Gameplay),
    AutoRotateSpeed: new RangeParameter("Auto Rotate Speed", DEFAULT_GAMEPLAY_CONFIG.autoRotateSpeed, {min: 0, max: 40, step: 1}, Categories.Gameplay),
    InitialTilt: new RangeParameter("Initial Tilt", DEFAULT_GAMEPLAY_CONFIG.initialTilt, {min: -30, max: 60, step: 1}, Categories.Gameplay),
    SpeedButton: new BooleanParameter("X2 Speed Button", DEFAULT_GAMEPLAY_CONFIG.speedButtonEnabled, Categories.Gameplay),
    // Paste a .level.json (Bee Level Viewer → "Copy .level.json"); empty = bundled level.
    LevelJson: new TextParameter("Level (.level.json)", DEFAULT_GAMEPLAY_CONFIG.levelJson, Categories.Gameplay),

    MusicVolume: new RangeParameter("Music Volume", 0.5, {min: 0, max: 1, step: 0.1}, Categories.Default),
    SxfVolume: new RangeParameter("SFX Volume", 0.5, {min: 0, max: 1, step: 0.1}, Categories.Default),
    BGM: new AudioParameter("Background Music", "", Categories.Audio),
    // Logo
    Logo: new ObjectParameter<SpriteParameter>("Logo", new SpriteParameter({
        enable: false,
        position: {x: -416.949, y: -771.667},
        contentSize: {x: 150, y: 150},
        spriteColor: "#FFFFFF",
    }), Categories.Logo),

    // cta Button (ButtonParameter = SpriteParameter + label fields với prefix)
    CTA: new ObjectParameter<ButtonParameter>("cta Button", new ButtonParameter({
        enable: true,
        position: {x: 350, y: -775},       // bottom-right, mirrors the X2 SPEED button
        spriteColor: "#FF5500",              // sprite color (từ SpriteParameter)
        string: "Install Now",    // label text
        labelColor: "#FFFFFF",         // label color
        fontSize: 36,             // label fontSize
    }), Categories.CTA),

    // Tutorial Text
    Tut: new ObjectParameter<LabelParameter>("Tutorial Text", new LabelParameter({
        position: {x: 0, y: 200},
        string: "Tap to play!",
        labelColor: "#FFFFFF",
        fontSize: 32,
    }), Categories.Tutorial),

    // Hand Tutorial
    HandTut: new ObjectParameter<SpriteParameter>("Hand Tutorial", new SpriteParameter({
        position: {x: 0, y: 0},
        contentSize: {x: 200, y: 200},
        spriteColor: "#FFFFFF",
    }), Categories.Tutorial),

    // === Loading Screen Parameters ===
    LoadingBackgroundColor: new ColorParameter("Loading Background Color", "#FFFFFF", Categories.Loading),
    LoadingIcon: new ObjectParameter<SpriteParameter>("Loading Icon", new SpriteParameter({
        position: {x: 0, y: 120},
        contentSize: {x: 200, y: 200},
        spriteColor: "#FFFFFF",
        spriteFrame: "",
    }), Categories.Loading),
    LoadingGameName: new ObjectParameter<LabelParameter>("Loading Game Name", new LabelParameter({
        position: {x: 0, y: 319.224},
        string: "Bee Buzzing",
        labelColor: "#FFFFFF",
        fontSize: 60,
    }), Categories.Loading),

    // EndCard Win CTA Button
    EndCardWinCTA: new ObjectParameter<ButtonParameter>("Win CTA Button", new ButtonParameter({
        enable: true,
        position: {x: 0, y: -666},
        spriteColor: "#FFFFFF",
        string: "Continue",
        labelColor: "#FFFFFF",
        fontSize: 40,
    }), Categories.EndCardWin),

    // EndCard Lose CTA Button
    EndCardLoseCTA: new ObjectParameter<ButtonParameter>("Lose CTA Button", new ButtonParameter({
        enable: true,
        position: {x: 0, y: -666},
        spriteColor: "#FFFFFF",
        string: "Retry",
        labelColor: "#FFFFFF",
        fontSize: 40,
    }), Categories.EndCardLose),
};
