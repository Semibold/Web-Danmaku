import { IDanmakuConfig } from "../danmaku";
import { BaseRenderer } from "./base-renderer";
import { CssEntity } from "../entity/css-entity";

export class CssRenderer extends BaseRenderer<CssEntity> {
    readonly fragment = document.createDocumentFragment();
    readonly sharedStyle = document.createElement("style");
    readonly recycledNodes: HTMLSpanElement[] = [];

    constructor(config: IDanmakuConfig) {
        super(config);
        this.appendSharedStyle();
    }

    private appendSharedStyle() {
        this.sharedStyle.setAttribute("data-sign", `${this.config.prefix}-keyframes`);
        this.sharedStyle.title = "This is a shared style for danmaku keyframes";
        if (this.domElement.ownerDocument && this.domElement.ownerDocument.head && !this.sharedStyle.parentElement) {
            this.domElement.ownerDocument.head.appendChild(this.sharedStyle);
        }
    }

    protected render(prevTime: number, currentTime: number) {
        const items = this.getItemsByTimeRange(prevTime, currentTime);
        const entities = items.map(items => {
            return new CssEntity(this, items, this.sharedCanvas, this.sharedStyle, this.recycledNodes.shift());
        });
        const compositedEntities = this.compositeAll(entities);

        if (compositedEntities.length) {
            compositedEntities.forEach(compositedEntity => {
                if (!compositedEntity.node.parentElement) {
                    this.fragment.appendChild(compositedEntity.node);
                }
            });

            if (this.fragment.childNodes.length) {
                this.domElement.appendChild(this.fragment);
            }

            this.refreshConnectedEntityAnimation(compositedEntities);
        }
    }

    protected cleanOutdatedEntities(removedEntities: CssEntity[]) {
        for (const entity of removedEntities) {
            if (this.recycledNodes.length < this.config.recycledBufferSize) {
                this.recycledNodes.push(entity.node);
                entity.dispose();
            } else {
                entity.dispose(true);
            }
        }
    }

    private refreshConnectedEntityAnimation(entities?: CssEntity[]) {
        const curPaused = this.paused;
        const targetEntities = entities || this.viewportTree.entries;
        targetEntities.forEach(entity => (curPaused ? entity.pause() : entity.play()));
    }

    play() {
        if (this.paused) {
            super.play();
            this.refreshConnectedEntityAnimation();
        }
    }

    pause() {
        if (!this.paused) {
            super.pause();
            this.refreshConnectedEntityAnimation();
        }
    }

    dispose() {
        super.dispose();
        this.recycledNodes.length = 0;
        if (this.sharedStyle.parentElement) {
            this.sharedStyle.parentElement.removeChild(this.sharedStyle);
        }
    }
}
