import { _decorator, Camera, Color, Component, Label, Layers, math, Node, Quat, TTFFont, tween, Tween, UITransform, Vec3 } from 'cc';
import { HiveBoard, HiveState } from '../../domain/HiveBoard';
import { ModelKit } from '../rendering/ModelKit';
import { BOARD_LAYOUT, queuePosition, slotPosition } from './BoardLayout';

const { ccclass } = _decorator;

const JUMP_DURATION = 0.32;
const JUMP_HEIGHT = 1.1;
const ADVANCE_DURATION = 0.22;
const LABEL_FONT_SIZE = 40;
/** Bees leave from the top-front of the hive. */
const LAUNCH_OFFSET = new Vec3(0, 0.15, 0.6);
/** Hives face the camera, tilted a little further so they read as seen from below (reference). */
const FACE_TILT = new Quat();
Quat.fromAxisAngle(FACE_TILT, Vec3.UNIT_X, math.toRadian(-6));

interface HiveView {
    readonly hive: HiveState;
    readonly node: Node;
    readonly label: Label;
    punch: number;
    /** Ammo currently shown, to avoid re-setting the label string every frame. */
    shownAmmo: number;
}

/**
 * 3D hives for every queued / active hive plus their ammo labels (UI overlay).
 * Pure view: the HiveBoard domain object decides, this only animates the result.
 */
@ccclass('HiveBoardView')
export class HiveBoardView extends Component {
    private board: HiveBoard = null!;
    private kit: ModelKit = null!;
    private camera: Camera = null!;
    private readonly views = new Map<number, HiveView>();
    private readonly tmp = new Vec3();
    private readonly tmpUi = new Vec3();

    init(board: HiveBoard, kit: ModelKit, camera: Camera, labelRoot: Node, font: TTFFont | null): void {
        this.board = board;
        this.kit = kit;
        this.camera = camera;
        for (let line = 0; line < board.lineCount; line++) {
            board.line(line).forEach((hive) => {
                const node = kit.createHive(hive.spec.color);
                node.setParent(this.node);
                const label = this.createLabel(labelRoot, font);
                this.views.set(hive.spec.id, { hive, node, label, punch: 0, shownAmmo: -1 });
            });
            this.layoutLine(line, false);
        }
    }

    /** Hive jumped from the front of its line into a slot. */
    onHiveActivated(hive: HiveState, slot: number): void {
        const view = this.views.get(hive.spec.id)!;
        this.kit.paintHive(view.node, hive.spec.color, false);
        const from = view.node.position.clone();
        const to = slotPosition(slot, this.board.slotCount, new Vec3());
        const proxy = { t: 0 };
        tween(proxy).to(JUMP_DURATION, { t: 1 }, {
            easing: 'quadOut',
            onUpdate: () => {
                Vec3.lerp(this.tmp, from, to, proxy.t);
                this.tmp.y += Math.sin(proxy.t * Math.PI) * JUMP_HEIGHT;
                view.node.setPosition(this.tmp);
                const squash = 1 + 0.25 * Math.sin(proxy.t * Math.PI);
                view.node.setScale(1 / squash, squash, 1);
            },
        }).call(() => view.node.setScale(1, 1, 1)).start();
        this.layoutLine(hive.spec.line, true);
    }

    onTapRejected(line: number): void {
        const front = this.board.line(line)[0];
        const view = front && this.views.get(front.spec.id);
        if (!view) return;
        // Shake around the resting spot (not the current, possibly mid-shake, position).
        Tween.stopAllByTarget(view.node);
        const base = queuePosition(line, this.board.lineCount, 0, new Vec3());
        tween(view.node)
            .to(0.05, { position: new Vec3(base.x - 0.12, base.y, base.z) })
            .to(0.05, { position: new Vec3(base.x + 0.12, base.y, base.z) })
            .to(0.05, { position: base })
            .start();
    }

    onBeeLaunched(hive: HiveState): void {
        const view = this.views.get(hive.spec.id);
        if (view) view.punch = 1;
    }

    onHiveDepleted(hive: HiveState): void {
        const view = this.views.get(hive.spec.id);
        if (!view) return;
        this.views.delete(hive.spec.id);
        view.label.node.destroy();
        tween(view.node)
            .to(0.25, { scale: new Vec3(1.25, 1.25, 1.25) }, { easing: 'quadOut' })
            .to(0.2, { scale: Vec3.ZERO }, { easing: 'backIn' })
            .call(() => view.node.destroy())
            .start();
    }

    /** World position bees launch from for a slot. */
    launchPosition(slot: number, out: Vec3): Vec3 {
        slotPosition(slot, this.board.slotCount, out);
        Vec3.add(out, out, LAUNCH_OFFSET);
        return Vec3.transformMat4(out, out, this.node.worldMatrix);
    }

    lateUpdate(dt: number): void {
        this.views.forEach((view) => {
            if (view.punch > 0) {
                view.punch = Math.max(0, view.punch - dt * 8);
                const s = 1 + 0.12 * view.punch;
                view.node.setScale(s, s, s);
            }
            const visible = view.node.scale.x > 0.05;
            view.label.node.active = visible;
            if (visible) this.faceCamera(view.node);
            if (!visible) return;
            if (view.shownAmmo !== view.hive.ammo) {
                view.shownAmmo = view.hive.ammo;
                view.label.string = `${view.hive.ammo}`;
            }
            Vec3.add(this.tmp, view.node.worldPosition, LAUNCH_OFFSET);
            this.camera.convertToUINode(this.tmp, view.label.node.parent!, this.tmpUi);
            view.label.node.setPosition(this.tmpUi);
        });
    }

    /** Points the hive's front (+Z) at the camera, then applies the from-below tilt. */
    private faceCamera(node: Node): void {
        const pos = node.worldPosition;
        Vec3.subtract(this.tmp, pos, this.camera.node.worldPosition);
        Vec3.add(this.tmp, pos, this.tmp); // lookAt aims -Z, so aim at the point behind the hive
        node.lookAt(this.tmp);
        node.rotate(FACE_TILT);
    }

    private layoutLine(line: number, animate: boolean): void {
        this.board.line(line).forEach((hive, index) => {
            const view = this.views.get(hive.spec.id)!;
            const pos = queuePosition(line, this.board.lineCount, index, new Vec3());
            const scale = index < BOARD_LAYOUT.visibleQueue ? 1 : 0;
            this.kit.paintHive(view.node, hive.spec.color, index > 0);
            if (animate) {
                tween(view.node).to(ADVANCE_DURATION, { position: pos, scale: new Vec3(scale, scale, scale) }, { easing: 'quadOut' }).start();
            } else {
                view.node.setPosition(pos);
                view.node.setScale(scale, scale, scale);
            }
        });
    }

    private createLabel(parent: Node, font: TTFFont | null): Label {
        const node = new Node('HiveAmmo');
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform);
        node.setParent(parent);
        const label = node.addComponent(Label);
        if (font) {
            label.useSystemFont = false;
            label.font = font;
        }
        label.fontSize = LABEL_FONT_SIZE;
        label.lineHeight = LABEL_FONT_SIZE;
        label.color = Color.WHITE;
        label.enableOutline = true;
        label.outlineColor = Color.BLACK;
        label.outlineWidth = 5;
        return label;
    }
}
