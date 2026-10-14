import { Color, Graphics } from 'cc';

/** Texture-free scenery drawing helpers (everything is vector → zero build bytes). */

const tmp = new Color();

/** Vertical gradient as stacked bands (Graphics has no native gradients). */
export function fillVerticalGradient(
    g: Graphics, left: number, top: number, width: number, height: number, from: Color, to: Color, bands = 24,
): void {
    const step = height / bands;
    for (let i = 0; i < bands; i++) {
        Color.lerp(tmp, from, to, i / (bands - 1));
        g.fillColor = tmp;
        // +1 overlap hides seams between bands.
        g.rect(left, top - (i + 1) * step, width, step + 1);
        g.fill();
    }
}

/** Flat-top hexagon (matches the hive mesh orientation). */
export function hexagonPath(g: Graphics, cx: number, cy: number, radius: number): void {
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const x = cx + radius * Math.cos(a);
        const y = cy + radius * Math.sin(a) * 0.93;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
    g.close();
}

export function fillEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number, color: Color): void {
    g.fillColor = color;
    g.ellipse(cx, cy, rx, ry);
    g.fill();
}
