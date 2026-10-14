import {SdkType} from "db://assets/PlayableParamterTool/GameConfig";
import {
    AudioParameter, BooleanParameter, ColorParameter, NumberParameter, ObjectParameter, RangeParameter,
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

export const CURRENT_SDK = SdkType.THE_ONE;

/**
 * parameter Categories
 */
const Categories = {
    Default: "Default",
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
 * PlayableConfig - Configuration parameters for Liquid Jam Playable Ad
 */
export const PlayableConfig = {
    MainCamera: new ObjectParameter<CameraParameter>("Camera", new CameraParameter({
        rotation: {x: 0, y: 0, z: 0},
        position: {x: 0, y: 0, z: 0},
    }), Categories.Default),

    RedirectAfterClicks: new ObjectParameter<RedirectParameter>("Redirect After Clicks", new RedirectParameter(
        new BooleanParameter("Active", false),
        new NumberParameter("Count", 3)
    ), Categories.Default),

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
        position: {x: 0, y: -300},
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
    LoadingBackgroundColor: new ColorParameter("Loading Background Color", "#4A9FF8", Categories.Loading),
    LoadingIcon: new ObjectParameter<SpriteParameter>("Loading Icon", new SpriteParameter({
        position: {x: 0, y: 120},
        contentSize: {x: 200, y: 200},
        spriteColor: "#FFFFFF",
        spriteFrame: "",
    }), Categories.Loading),
    LoadingGameName: new ObjectParameter<LabelParameter>("Loading Game Name", new LabelParameter({
        position: {x: 0, y: 319.224},
        string: "Game",
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