import { Mat4, Vec3 } from 'cc';

const tmpA = new Vec3();
const tmpB = new Vec3();

/**
 * A polyline in sculpture-local space evaluated through the sculpture's *current*
 * world matrix, so bees keep tracking their cube while the model rotates.
 * Distances are rigid-invariant, so lengths computed once at launch stay valid.
 */
export class BeeFlightPath {
    /** Flat local xyz. */
    readonly points: number[] = [];
    readonly cumulative: number[] = [];

    get length(): number {
        return this.cumulative.length ? this.cumulative[this.cumulative.length - 1] : 0;
    }

    get pointCount(): number {
        return this.points.length / 3;
    }

    reset(): void {
        this.points.length = 0;
        this.cumulative.length = 0;
    }

    push(x: number, y: number, z: number): void {
        const n = this.points.length;
        let acc = 0;
        if (n > 0) {
            const dx = x - this.points[n - 3], dy = y - this.points[n - 2], dz = z - this.points[n - 1];
            acc = this.cumulative[this.cumulative.length - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        this.points.push(x, y, z);
        this.cumulative.push(acc);
    }

    /** World position at distance s (clamped) along the path. */
    sampleWorld(s: number, world: Mat4, out: Vec3): Vec3 {
        const n = this.pointCount;
        if (n === 0) return out.set(0, 0, 0);
        const c = this.cumulative;
        if (s <= 0 || n === 1) return this.pointWorld(0, world, out);
        if (s >= c[n - 1]) return this.pointWorld(n - 1, world, out);
        let i = 1;
        while (i < n - 1 && c[i] < s) i++;
        const seg = c[i] - c[i - 1];
        const t = seg > 0 ? (s - c[i - 1]) / seg : 0;
        this.pointLocal(i - 1, tmpA);
        this.pointLocal(i, tmpB);
        Vec3.lerp(out, tmpA, tmpB, t);
        return Vec3.transformMat4(out, out, world);
    }

    pointWorld(i: number, world: Mat4, out: Vec3): Vec3 {
        this.pointLocal(i, out);
        return Vec3.transformMat4(out, out, world);
    }

    private pointLocal(i: number, out: Vec3): Vec3 {
        return out.set(this.points[i * 3], this.points[i * 3 + 1], this.points[i * 3 + 2]);
    }
}
