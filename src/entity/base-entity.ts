import { IDanmakuConfig } from "../danmaku";
import { IDanmakuItem } from "../sharre/parser";
import { Utils } from "../sharre/utils";
import { DanmakuMode, DEF_LINE_HEIGHT } from "../sharre/constant";
import { BaseRenderer } from "../renderer/base-renderer";
import { CssEntity } from "./css-entity";

export abstract class BaseEntity {
    readonly width: number;
    readonly height: number;
    readonly config: IDanmakuConfig;
    readonly strokeColor: string;

    protected readonly state = {
        zIndex: 0,
        offsetX: 1,
        offsetY: 0,
        paused: true,
        visible: true,
        composited: false,
    };

    /**
     * @desc NOTICE: This state MUST be in sync with renderer's paused state,
     *       otherwise the animation will be deranged.
     */
    get paused() {
        return this.state.paused;
    }

    get composited() {
        return this.state.composited;
    }

    get visible() {
        return this.state.visible;
    }

    get zIndex(): number {
        return this.state.zIndex;
    }

    get fontSize(): number {
        return Math.floor(this.item.size * this.config.fontScaling);
    }

    get elapsedTime(): number {
        const elapsedTime = this.renderer.currentTime - this.item.start;
        return Math.min(Math.max(0, elapsedTime), this.duration);
    }

    get restTime(): number {
        const restTime = this.duration - this.elapsedTime;
        return Math.min(Math.max(0, restTime), this.duration);
    }

    get duration(): number {
        return this.config.duration;
    }

    get totalMotionDistance(): number {
        return this.config.canvasW + this.width + this.state.offsetX;
    }

    get elapsedMotionDistance(): number {
        return (this.elapsedTime / this.duration) * this.totalMotionDistance;
    }

    get restMotionDistance(): number {
        return (this.restTime / this.duration) * this.totalMotionDistance;
    }

    get averageLinearSpeed(): number {
        return this.totalMotionDistance / this.duration;
    }

    get x(): number {
        switch (this.item.mode) {
            case DanmakuMode.TopToBottom:
            case DanmakuMode.BottomToTop:
                return (this.config.canvasW - this.width) / 2;
            case DanmakuMode.LeftToRight:
            case DanmakuMode.RightToLeft:
            default:
                return this.restMotionDistance - this.width;
        }
    }

    get y(): number {
        return this.state.offsetY;
    }

    get offsetX(): number {
        return this.state.offsetX;
    }

    get offsetY(): number {
        return this.state.offsetY;
    }

    get initialX(): number {
        switch (this.item.mode) {
            case DanmakuMode.TopToBottom:
            case DanmakuMode.BottomToTop:
                return (this.config.canvasW - this.width) / 2;
            case DanmakuMode.LeftToRight:
            case DanmakuMode.RightToLeft:
            default:
                return this.config.canvasW + this.state.offsetX;
        }
    }

    get initialY(): number {
        return this.state.offsetY;
    }

    protected constructor(
        readonly renderer: BaseRenderer<CssEntity>,
        readonly item: IDanmakuItem,
        readonly sharedCanvas: HTMLCanvasElement,
    ) {
        this.config = this.renderer.config;
        this.strokeColor = Utils.getHexColor(Utils.getOutlineColor(this.item.color));
        this.width = Utils.getMeasuredTextWidth(
            this.sharedCanvas,
            item.content,
            `${this.config.fontWeight} ${this.fontSize}px/${DEF_LINE_HEIGHT} ${this.config.fontFamily}`,
        );
        this.height =
            Utils.getMeasuredTextWidth(
                this.sharedCanvas,
                "中",
                `${this.config.fontWeight} ${this.fontSize}px/${DEF_LINE_HEIGHT} ${this.config.fontFamily}`,
            ) * DEF_LINE_HEIGHT;
    }

    abstract hide(): void;
    abstract show(): void;
    abstract resize(): void;
    abstract repaintFrame(): void;
    abstract dispose(): void;
    abstract genTextNodeDetail(): void;

    play() {
        this.state.paused = false;
    }

    pause() {
        this.state.paused = true;
    }

    setLayout(offsetY: number, zIndex: number): boolean {
        if (this.state.composited) {
            return false;
        } else {
            this.state.offsetY = offsetY;
            this.state.zIndex = zIndex;
            this.state.composited = true;
            this.genTextNodeDetail();
            return true;
        }
    }
}
