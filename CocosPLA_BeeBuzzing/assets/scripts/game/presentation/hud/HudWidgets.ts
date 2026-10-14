import { Color, Graphics, Label, Layers, Node, TTFFont, UITransform } from 'cc';

/** Small factory helpers for code-built UI (no textures → nothing added to the build). */

/** Code-built UI node; inherits the parent's layer so it is drawn by the parent canvas camera. */
export function uiNode(name: string, parent: Node, width = 0, height = 0): Node {
    const node = new Node(name);
    node.layer = parent.layer || Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(width, height);
    node.setParent(parent);
    return node;
}

export function uiLabel(parent: Node, text: string, fontSize: number, font: TTFFont | null, color = Color.WHITE): Label {
    const label = uiNode('Label', parent).addComponent(Label);
    if (font) {
        label.useSystemFont = false;
        label.font = font;
    }
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.1;
    label.color = color;
    label.enableOutline = true;
    label.outlineColor = new Color(45, 25, 5, 255);
    label.outlineWidth = Math.max(2, Math.round(fontSize / 12));
    return label;
}

export function drawRoundRect(g: Graphics, w: number, h: number, r: number, fill: Color, stroke?: Color, lineWidth = 0): void {
    g.clear();
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fillColor = fill;
    g.fill();
    if (stroke && lineWidth > 0) {
        g.lineWidth = lineWidth;
        g.strokeColor = stroke;
        g.stroke();
    }
}
