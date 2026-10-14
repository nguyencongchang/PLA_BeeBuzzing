import {
    BooleanParameter,
    ColorParameter,
    CoordinatesParameter,
    ImageParameter,
    NumberParameter,
    TextParameter
} from "../../../PlayableParamterTool/parameter/BaseParameter";
import {ButtonConfig, CameraConfig, LabelConfig, NodeConfig, SpriteConfig, UINodeConfig} from "./ParameterConfig";

// ============== Default Ranges ==============
const POS_RANGE = {min: -2000, max: 2000, step: 1};
const ROT_RANGE = {min: -360, max: 360, step: 1};
const SCALE_RANGE = {min: 0, max: 10, step: 0.01};
const SIZE_RANGE = {min: 0, max: 2000, step: 1};
const FONT_SIZE_RANGE = {min: 1, max: 200, step: 1};
const LINE_HEIGHT_RANGE = {min: 0, max: 300, step: 1};
const OUTLINE_RANGE = {min: 0, max: 20, step: 1};
const SHADOW_OFFSET_RANGE = {min: -50, max: 50, step: 1};
const CAM_RANGE = {min: -1000, max: 1000, step: 1};

export class RedirectParameter {
    active: BooleanParameter;
    count: NumberParameter;

    constructor(active: BooleanParameter, count: NumberParameter) {
        this.active = active;
        this.count = count;
    }
}

// ============== Node parameter (3D) ==============
export class NodeParameter {
    position?: CoordinatesParameter;
    rotation?: CoordinatesParameter;
    scale?: CoordinatesParameter;

    constructor(config: NodeConfig = {}) {
        this.position = config.position && new CoordinatesParameter("Position", config.position, POS_RANGE, POS_RANGE, POS_RANGE);
        this.rotation = config.rotation && new CoordinatesParameter("Rotation", config.rotation, ROT_RANGE, ROT_RANGE, ROT_RANGE);
        this.scale = config.scale && new CoordinatesParameter("Scale", config.scale, SCALE_RANGE, SCALE_RANGE, SCALE_RANGE);
    }
}

// ============== UI Node parameter ==============
export class UINodeParameter extends NodeParameter {
    enable?: BooleanParameter;
    contentSize?: CoordinatesParameter;

    constructor(config: UINodeConfig = {}) {
        super(config);
        this.enable = config.enable !== undefined ? new BooleanParameter("Enable", config.enable) : undefined;
        this.contentSize = config.contentSize && new CoordinatesParameter("Content Size", config.contentSize, SIZE_RANGE, SIZE_RANGE);
    }
}

// ============== Sprite & Label ==============
export class SpriteParameter extends UINodeParameter {
    spriteFrame?: ImageParameter;
    color?: ColorParameter;

    constructor(config: SpriteConfig = {}) {
        super(config);
        // Check !== undefined để hỗ trợ empty string ""
        this.spriteFrame = config.spriteFrame !== undefined ? new ImageParameter("Sprite Frame", config.spriteFrame) : undefined;
        this.color = config.spriteColor && new ColorParameter("Color", config.spriteColor);
    }
}

export class LabelParameter extends UINodeParameter {
    string?: TextParameter;
    color?: ColorParameter;
    fontSize?: NumberParameter;
    lineHeight?: NumberParameter;
    isBold?: BooleanParameter;
    isItalic?: BooleanParameter;
    isUnderline?: BooleanParameter;
    outlineColor?: ColorParameter;
    outlineWidth?: NumberParameter;
    shadowColor?: ColorParameter;
    shadowOffset?: CoordinatesParameter;

    constructor(config: LabelConfig = {}) {
        super(config);
        this.string = config.string && new TextParameter("String", config.string);
        this.color = config.labelColor && new ColorParameter("Color", config.labelColor);
        this.fontSize = config.fontSize && new NumberParameter("Font Size", config.fontSize);
        this.lineHeight = config.lineHeight && new NumberParameter("Line Height", config.lineHeight);
        this.isBold = config.isBold !== undefined ? new BooleanParameter("Bold", config.isBold) : undefined;
        this.isItalic = config.isItalic !== undefined ? new BooleanParameter("Italic", config.isItalic) : undefined;
        this.isUnderline = config.isUnderline !== undefined ? new BooleanParameter("Underline", config.isUnderline) : undefined;
        this.outlineColor = config.outlineColor && new ColorParameter("Outline Color", config.outlineColor);
        this.outlineWidth = config.outlineWidth && new NumberParameter("Outline Width", config.outlineWidth);
        this.shadowColor = config.shadowColor && new ColorParameter("Shadow Color", config.shadowColor);
        this.shadowOffset = config.shadowOffset && new CoordinatesParameter("Shadow Offset", config.shadowOffset, SHADOW_OFFSET_RANGE, SHADOW_OFFSET_RANGE);
    }
}

// ============== Camera parameter ==============
export class CameraParameter extends NodeParameter {
    fov?: NumberParameter;

    constructor(config: CameraConfig = {}) {
        super(config);
        this.fov = config.fov && new NumberParameter("FOV", config.fov);
    }
}

// ============== Button parameter (kế thừa SpriteParameter + thêm label fields với prefix) ==============
export class ButtonParameter extends SpriteParameter {
    labelString?: TextParameter;
    labelColor?: ColorParameter;
    labelFontSize?: NumberParameter;
    labelLineHeight?: NumberParameter;
    labelBold?: BooleanParameter;
    labelItalic?: BooleanParameter;
    labelUnderline?: BooleanParameter;
    labelOutlineColor?: ColorParameter;
    labelOutlineWidth?: NumberParameter;
    labelShadowColor?: ColorParameter;
    labelShadowOffset?: CoordinatesParameter;

    constructor(config: ButtonConfig = {}) {
        super(config);
        this.labelString = config.string && new TextParameter("Label String", config.string);
        this.labelColor = config.labelColor && new ColorParameter("Label Color", config.labelColor);
        this.labelFontSize = config.fontSize && new NumberParameter("Label Font Size", config.fontSize);
        this.labelLineHeight = config.lineHeight && new NumberParameter("Label Line Height", config.lineHeight);
        this.labelBold = config.isBold !== undefined ? new BooleanParameter("Label Bold", config.isBold) : undefined;
        this.labelItalic = config.isItalic !== undefined ? new BooleanParameter("Label Italic", config.isItalic) : undefined;
        this.labelUnderline = config.isUnderline !== undefined ? new BooleanParameter("Label Underline", config.isUnderline) : undefined;
        this.labelOutlineColor = config.outlineColor && new ColorParameter("Label Outline Color", config.outlineColor);
        this.labelOutlineWidth = config.outlineWidth && new NumberParameter("Label Outline Width", config.outlineWidth);
        this.labelShadowColor = config.shadowColor && new ColorParameter("Label Shadow Color", config.shadowColor);
        this.labelShadowOffset = config.shadowOffset && new CoordinatesParameter("Label Shadow Offset", config.shadowOffset, SHADOW_OFFSET_RANGE, SHADOW_OFFSET_RANGE);
    }
}