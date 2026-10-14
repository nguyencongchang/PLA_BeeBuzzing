import { _decorator, Component, Graphics, Node, UITransform, Vec3, Layers, director, Sprite, tween } from 'cc';
const { ccclass, property } = _decorator;

interface HighlightRectOptions {
    widthOffset?: number;
    heightOffset?: number;
    radius?: number;
}

interface HighlightCircleOptions {
    radiusOffset?: number;
}

@ccclass('HighlightOverlay')
export class HighlightOverlay extends Component {
    @property(Graphics)
    maskGraphics: Graphics = null;

    @property(Sprite)
    handTutorial: Sprite = null;

    @property
    handOffsetX: number = 50;

    @property
    handOffsetY: number = 50;

    private static _instance: HighlightOverlay;
    public static get instance(): HighlightOverlay {
        if (!this._instance) {
            const node = new Node("HighlightOverlay");
            node.layer = Layers.Enum.UI_2D;
            const comp = node.addComponent(HighlightOverlay);
            director.getScene()?.addChild(node);
            this._instance = comp;
        }
        return this._instance;
    }

    onLoad() {
        HighlightOverlay._instance = this;
    }

    public clearHighlights() {
        this.maskGraphics?.clear();
        if (this.handTutorial) {
            tween(this.handTutorial.node).stop();
            this.maskGraphics.node.active = false;
            this.handTutorial.node.active = false;
        }
    }

    public highlightRectTargets(targets: Node | Node[], options: HighlightRectOptions = {}) {
        if (!this.maskGraphics) return;
        this.maskGraphics.node.active = true
        const uiTransform = this.getComponent(UITransform);
        if (!uiTransform) return;

        const { widthOffset = 100, heightOffset = 100, radius = 35 } = options;
        const targetArray = Array.isArray(targets) ? targets : [targets];

        for (const node of targetArray) {
            const targetUI = node.getComponent(UITransform);
            if (!targetUI) continue;

            const worldPos = targetUI.convertToWorldSpaceAR(new Vec3());
            const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
            const size = targetUI.contentSize;

            this.maskGraphics.roundRect(
                localPos.x - size.width / 2 - widthOffset / 2,
                localPos.y - size.height / 2 - heightOffset / 2,
                size.width + widthOffset,
                size.height + heightOffset,
                radius
            );
            this.maskGraphics.fill();
        }

        this.showHandTutorial(targetArray[0], uiTransform);
    }

    public highlightCircleTargets(targets: Node | Node[], options: HighlightCircleOptions = {}) {
        if (!this.maskGraphics) return;
        this.maskGraphics.node.active = true
        const uiTransform = this.getComponent(UITransform);
        if (!uiTransform) return;

        const { radiusOffset = 100 } = options;
        const targetArray = Array.isArray(targets) ? targets : [targets];

        for (const node of targetArray) {
            const targetUI = node.getComponent(UITransform);
            if (!targetUI) continue;

            const worldPos = targetUI.convertToWorldSpaceAR(new Vec3());
            const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
            const size = targetUI.contentSize;

            const r = Math.max(size.width, size.height) / 2 + radiusOffset / 2;
            this.maskGraphics.circle(localPos.x, localPos.y, r);
            this.maskGraphics.fill();
        }

        this.showHandTutorial(targetArray[0], uiTransform);
    }

    private showHandTutorial(target: Node, parentUI: UITransform) {
        if (!this.handTutorial || !target) return;

        const targetUI = target.getComponent(UITransform);
        if (!targetUI) return;

        // Tính vị trí world → local
        const worldPos = targetUI.convertToWorldSpaceAR(new Vec3());
        const localPos = parentUI.convertToNodeSpaceAR(worldPos);

        const handNode = this.handTutorial.node;
        handNode.active = true;
        handNode.setPosition(localPos.add(new Vec3(0, - this.handOffsetY, 0)));

        tween(handNode).stop();

        tween(handNode)
            .to(0.6, { position: new Vec3(localPos.x, localPos.y, 0) })
            .to(0.6, { position: new Vec3(localPos.x + this.handOffsetX, localPos.y - this.handOffsetY, 0) })
            .union()
            .repeatForever()
            .start();
    }
}