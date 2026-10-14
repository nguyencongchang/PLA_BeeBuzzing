import {Node, Vec3, Vec2, Label, Color, Sprite, UITransform, Camera, SpriteRenderer} from 'cc';
import {NodeParameter, UINodeParameter, LabelParameter, SpriteParameter, CameraParameter, ButtonParameter} from "db://assets/scripts/parameter/config/CustomParameter";
import {ColorParameter, NumberParameter, TextParameter, BooleanParameter, CoordinatesParameter} from "db://assets/PlayableParamterTool/parameter/BaseParameter";
import {replaceParameterSprite} from "db://assets/PlayableParamterTool/assetParameterUtils/ParameterReplacedAssetsHandler";

/**
 * Apply NodeParameter to a Node (position, rotation, scale)
 * Chỉ apply các field được định nghĩa (không undefined)
 */
export function applyNodeParams(node: Node, params: NodeParameter) {
    if (!node || !params) return;

    if (params.position) {
        node.position = new Vec3(
            params.position.default.x,
            params.position.default.y,
            params.position.default.z ?? 0
        );
    }

    if (params.rotation) {
        node.setRotationFromEuler(
            params.rotation.default.x,
            params.rotation.default.y,
            params.rotation.default.z ?? 0
        );
    }

    if (params.scale) {
        node.scale = new Vec3(
            params.scale.default.x,
            params.scale.default.y,
            params.scale.default.z ?? 1
        );
    }
}

/**
 * Apply UINodeParameter to a Node (enable, position, rotation, scale, contentSize)
 */
export function applyUINodeParams(node: Node, params: UINodeParameter) {
    if (!node || !params) return;

    if (params.enable) {
        node.active = params.enable.default;
    }

    applyNodeParams(node, params);

    if (params.contentSize) {
        const uiTransform = node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(
                params.contentSize.default.x,
                params.contentSize.default.y
            );
        }
    }
}

/**
 * Apply CameraParameter to a Camera component
 */
export function applyCameraParams(camera: Camera, params: CameraParameter) {
    if (!camera || !params) return;

    applyNodeParams(camera.node, params);

    if (params.fov) {
        camera.fov = params.fov.default;
    }
}

/**
 * Apply SpriteParameter to a Sprite component
 * Returns a Promise if spriteFrame needs to be loaded from base64
 */
export function applySpriteParams(sprite: Sprite | SpriteRenderer, params: SpriteParameter): Promise<void> | void {
    if (!sprite || !params) return;

    applyUINodeParams(sprite.node, params);

    if (params.color && sprite instanceof Sprite) {
        let color = new Color();
        sprite.color = Color.fromHEX(color, params.color.default);
    }

    if (params.spriteFrame) {
        return replaceParameterSprite(sprite, params.spriteFrame);
    }
}

/**
 * Helper: Apply label style (string, color, fontSize, lineHeight, bold, italic, underline, outline, shadow)
 * Dùng chung cho LabelParameter và ButtonParameter
 */
function applyLabelStyle(label: Label, params: {
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
}) {
    if (params.string) {
        label.string = params.string.default;
    }
    if (params.fontSize) {
        label.fontSize = params.fontSize.default;
    }
    if (params.color) {
        let color = new Color();
        label.color = Color.fromHEX(color, params.color.default);
    }
    if (params.lineHeight) {
        label.lineHeight = params.lineHeight.default;
    }
    if (params.isBold) {
        label.isBold = params.isBold.default;
    }
    if (params.isItalic) {
        label.isItalic = params.isItalic.default;
    }
    if (params.isUnderline) {
        label.isUnderline = params.isUnderline.default;
    }
    if (params.outlineWidth !== undefined || params.outlineColor !== undefined) {
        label.enableOutline = true;
        if (params.outlineWidth) {
            label.outlineWidth = params.outlineWidth.default;
        }
        if (params.outlineColor) {
            let color = new Color();
            label.outlineColor = Color.fromHEX(color, params.outlineColor.default);
        }
    }
    if (params.shadowOffset !== undefined || params.shadowColor !== undefined) {
        label.enableShadow = true;
        if (params.shadowColor) {
            let color = new Color();
            label.shadowColor = Color.fromHEX(color, params.shadowColor.default);
        }
        if (params.shadowOffset) {
            label.shadowOffset = new Vec2(
                params.shadowOffset.default.x,
                params.shadowOffset.default.y
            );
        }
    }
}

/**
 * Apply LabelParameter to a Label component
 */
export function applyLabelParams(label: Label, params: LabelParameter) {
    if (!label || !params) return;

    applyUINodeParams(label.node, params);
    applyLabelStyle(label, params);
}

/**
 * Apply ButtonParameter to a Button node
 * ButtonParameter extends SpriteParameter + label fields (với prefix label*)
 * Button node structure: Node (with Sprite) -> Label (child)
 */
export function applyButtonParams(buttonNode: Node, params: ButtonParameter): Promise<void> | void {
    if (!buttonNode || !params) return;

    // Apply sprite params (kế thừa từ SpriteParameter: enable, position, scale, contentSize, color, spriteFrame)
    const sprite = buttonNode.getComponent(Sprite);
    if (sprite) {
        const promise = applySpriteParams(sprite, params);

        // Apply label fields to child Label
        const labelComp = buttonNode.getComponentInChildren(Label);
        if (labelComp) {
            applyLabelStyle(labelComp, {
                string: params.labelString,
                color: params.labelColor,
                fontSize: params.labelFontSize,
                lineHeight: params.labelLineHeight,
                isBold: params.labelBold,
                isItalic: params.labelItalic,
                isUnderline: params.labelUnderline,
                outlineColor: params.labelOutlineColor,
                outlineWidth: params.labelOutlineWidth,
                shadowColor: params.labelShadowColor,
                shadowOffset: params.labelShadowOffset,
            });
        }

        return promise;
    }
}