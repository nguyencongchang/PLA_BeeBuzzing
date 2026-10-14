// ============== Base config Interfaces ==============

export interface NodeConfig {
    position?: {x: number, y: number, z?: number};
    rotation?: {x: number, y: number, z?: number};
    scale?: {x: number, y: number, z?: number};
}

export interface UINodeConfig extends NodeConfig {
    enable?: boolean;
    contentSize?: {x: number, y: number};
}


export interface SpriteStyle {
    spriteFrame?: string;
    spriteColor?: string;
}

export interface LabelStyle {
    string?: string;
    labelColor?: string;
    fontSize?: number;
    lineHeight?: number;
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    outlineColor?: string;
    outlineWidth?: number;
    shadowColor?: string;
    shadowOffset?: {x: number, y: number};
}


export interface CameraConfig extends NodeConfig {
    fov?: number;
}

export interface SpriteConfig extends UINodeConfig, SpriteStyle {}

export interface LabelConfig extends UINodeConfig, LabelStyle {}


export interface ButtonConfig extends SpriteConfig, LabelStyle {}