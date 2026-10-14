import { Color, Graphics } from 'cc';

/** Texture-free scenery drawing helpers (everything is vector → zero build bytes). */

export function fillEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number, color: Color): void {
    g.fillColor = color;
    g.ellipse(cx, cy, rx, ry);
    g.fill();
}
