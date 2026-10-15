import {Color, Component, Label, Node, Sprite, Tween, tween, UITransform, Vec3, view, Widget} from 'cc';

/** Pop-in of the title and hero when loading starts (seconds). */
const POP_TIME = 0.45;
const HERO_DELAY = 0.12;
/** Idle bob of the hero image: height (design px) and half period (seconds). */
const BOB_HEIGHT = 14;
const BOB_TIME = 0.9;
/** "Loading..." caption under the bar: offset below it, size and dot speed (dots per second). */
const CAPTION_GAP = 78;
const CAPTION_SIZE = 44;
const DOTS_PER_SECOND = 3;
const CAPTION_OUTLINE = new Color(122, 59, 0, 255);
/** Dark see-through track drawn behind the fill, inside the bar's white frame. */
const TRACK_COLOR = new Color(60, 25, 0, 170);

export interface LoadingDecorParts {
    readonly root: Node;
    /** Full-screen background; the root is sized to cover the whole canvas with it. */
    readonly background: Sprite | null;
    readonly fill: Sprite | null;
    readonly percent: Label | null;
    readonly hero: Node | null;
    readonly title: Node | null;
}

/**
 * Reference-style dressing for the loading screen, built on the prefab's own parts: title and hero
 * pop in, the hero bobs, the bar gets a dark track behind its fill and an animated "Loading..."
 * caption sits under it.
 */
export class LoadingDecor {
    private caption: Label | null = null;
    private time = 0;

    constructor(private readonly parts: LoadingDecorParts) {
        this.addTrack();
        this.addCaption();
        this.raisePercent();
    }

    play(): void {
        const {title, hero} = this.parts;
        this.time = 0;
        this.coverCanvas();
        if (title) popIn(title, 0);
        if (hero) {
            popIn(hero, HERO_DELAY);
            const up = new Vec3(0, BOB_HEIGHT, 0), down = new Vec3(0, -BOB_HEIGHT, 0);
            tween(hero).delay(HERO_DELAY + POP_TIME)
                .then(tween(hero).by(BOB_TIME, {position: up}, {easing: 'sineInOut'}).by(BOB_TIME, {position: down}, {easing: 'sineInOut'}).union().repeatForever())
                .start();
        }
    }

    update(dt: number): void {
        this.time += dt;
        if (this.caption) this.caption.string = 'Loading' + '.'.repeat(1 + Math.floor(this.time * DOTS_PER_SECOND) % 3);
    }

    stop(): void {
        for (const node of [this.parts.title, this.parts.hero]) if (node) Tween.stopAllByTarget(node);
    }

    private addTrack(): void {
        const fill = this.parts.fill;
        if (!fill) return;
        const track = new Node('Track');
        track.layer = fill.node.layer;
        track.setParent(fill.node.parent);
        track.setSiblingIndex(fill.node.getSiblingIndex());
        track.setPosition(fill.node.position);
        const size = fill.node.getComponent(UITransform)!.contentSize;
        track.addComponent(UITransform).setContentSize(size);
        const sprite = track.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = fill.spriteFrame;
        sprite.color = TRACK_COLOR;
    }

    /**
     * Sizes the root (and its background) to cover the whole canvas, keeping the background's aspect.
     * The canvas is letterboxed (ShowAll): on tall or wide screens it extends past the 1080x1920
     * design area, where the root's full-stretch Widget left the game showing above and below.
     */
    private coverCanvas(): void {
        const {root, background} = this.parts;
        const frame = view.getFrameSize();
        const width = frame.width / view.getScaleX(), height = frame.height / view.getScaleY();
        const rect = background?.spriteFrame?.originalSize;
        const aspect = rect && rect.height > 0 ? rect.width / rect.height : width / height;
        const widget = root.getComponent(Widget);
        if (widget) widget.enabled = false;
        // UIScreenResolution would resize (and stretch) the root again on every size change.
        const resizer = root.getComponent('UIScreenResolution') as Component | null;
        if (resizer) resizer.enabled = false;
        root.getComponent(UITransform)!.setContentSize(Math.max(width, height * aspect), Math.max(height, width / aspect));
        root.setPosition(0, 0, 0);
    }

    /** The percent sits inside the bar: white with the caption's outline, drawn after the bar node. */
    private raisePercent(): void {
        const {percent, fill} = this.parts;
        if (!percent) return;
        percent.color = Color.WHITE;
        percent.enableOutline = true;
        percent.outlineColor = CAPTION_OUTLINE;
        percent.outlineWidth = 3;
        percent.enableShadow = false;
        const bar = fill?.node.parent;
        if (bar && bar.parent === percent.node.parent) percent.node.setSiblingIndex(bar.getSiblingIndex());
    }

    private addCaption(): void {
        const {root, percent, fill} = this.parts;
        if (!percent) return;
        const node = new Node('LoadingCaption');
        node.layer = root.layer;
        node.setParent(root);
        const barY = fill ? fill.node.parent!.position.y : percent.node.position.y;
        node.setPosition(0, barY - CAPTION_GAP, 0);
        node.addComponent(UITransform);
        const label = node.addComponent(Label);
        label.font = percent.font;
        label.useSystemFont = percent.useSystemFont;
        label.fontSize = CAPTION_SIZE;
        label.lineHeight = CAPTION_SIZE + 6;
        label.enableOutline = true;
        label.outlineColor = CAPTION_OUTLINE;
        label.outlineWidth = 4;
        label.string = 'Loading.';
        this.caption = label;
    }
}

function popIn(node: Node, delay: number): void {
    const scale = node.scale.clone();
    node.setScale(0.01, 0.01, 1);
    tween(node).delay(delay).to(POP_TIME, {scale}, {easing: 'backOut'}).start();
}
