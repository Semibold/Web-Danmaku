import { BaseEntity } from "./base-entity";
import { IDanmakuItem } from "../sharre/parser";
import { Utils } from "../sharre/utils";
import { BaseRenderer } from "../renderer/base-renderer";
import { DanmakuMode, DEF_OUTLINE_COLOR } from "../sharre/constant";

export class CssEntity extends BaseEntity {
    private readonly keyframeName: string;

    constructor(
        renderer: BaseRenderer<CssEntity>,
        item: IDanmakuItem,
        sharedCanvas: HTMLCanvasElement,
        readonly sharedStyle: HTMLStyleElement,
        readonly node: HTMLSpanElement = document.createElement("span"),
    ) {
        super(renderer, item, sharedCanvas);
        this.keyframeName = `${this.config.prefix}_keyframe-${this.item.uuid}`;
    }

    genTextNodeDetail(): void {
        if (this.composited) {
            this.recalculateStyleReducer(true);
            this.insertKeyframes();
            this.node.style.left = "";
            this.node.style.top = "";
            this.node.style.right = "";
            this.node.style.bottom = "";
            this.node.style.outline = "";

            switch (this.item.mode) {
                case DanmakuMode.TopToBottom:
                    this.node.style.top = `${this.initialY}px`;
                    this.node.style.left = "50%";
                    this.node.style.transform = "translateX(-50%)";
                    break;
                case DanmakuMode.BottomToTop:
                    this.node.style.bottom = `${this.initialY}px`;
                    this.node.style.left = "50%";
                    this.node.style.transform = "translateX(-50%)";
                    break;
                case DanmakuMode.LeftToRight:
                    this.node.style.top = `${this.initialY}px`;
                    this.node.style.right = `calc(100% + ${this.offsetX}px)`;
                    this.node.style.transform = "translateX(0px)";
                    break;
                case DanmakuMode.RightToLeft:
                default:
                    this.node.style.top = `${this.initialY}px`;
                    this.node.style.left = `calc(100% + ${this.offsetX}px)`;
                    this.node.style.transform = "translateX(0px)";
                    break;
            }

            if (this.item.highlight) {
                this.node.style.outline = `1px solid ${Utils.getHexColor(DEF_OUTLINE_COLOR)}`;
            }

            this.node.style.fontFamily = this.config.fontFamily;
            this.node.style.fontWeight = this.config.fontWeight;
            this.node.textContent = this.item.content;
            this.node.style.position = "absolute";
            this.node.style.fontSize = `${this.fontSize}px`;
            this.node.style.color = Utils.getHexColor(this.item.color);
            this.node.style.userSelect = "none";
            this.node.style.textShadow = `1px 0px 1px ${this.strokeColor}, 
                                          0px 1px 1px ${this.strokeColor},
                                          0px -1px 1px ${this.strokeColor}, 
                                          -1px 0px 1px ${this.strokeColor}`;
            this.node.style.zIndex = this.zIndex.toString();
            this.node.setAttribute("data-uuid", this.item.uuid);
            this.node.setAttribute("data-mode", this.item.mode.toString());
            this.node.style.animation = `${this.keyframeName} ${this.duration}s linear 0s 1 normal forwards`;
            this.node.style.animationPlayState = "paused";
            this.node.style.display = "inline-block";
        }
    }

    private insertKeyframes() {
        if (this.sharedStyle.sheet) {
            const sheet = <CSSStyleSheet>this.sharedStyle.sheet;
            const index = sheet.cssRules.length;

            switch (this.item.mode) {
                case DanmakuMode.TopToBottom:
                case DanmakuMode.BottomToTop:
                    break;
                case DanmakuMode.LeftToRight:
                    sheet.insertRule(
                        `
                        @keyframes ${this.keyframeName} {
                            from {
                                transform: translateX(0px);
                            }
                            to {
                                transform: translateX(${this.totalMotionDistance}px);
                            }
                        }
                    `,
                        index,
                    );
                    break;
                case DanmakuMode.RightToLeft:
                default:
                    sheet.insertRule(
                        `
                        @keyframes ${this.keyframeName} {
                            from {
                                transform: translateX(0px);
                            }
                            to {
                                transform: translateX(-${this.totalMotionDistance}px);
                            }
                        }
                    `,
                        index,
                    );
                    break;
            }
        }
    }

    private deleteKeyframes(endOffset: number = 0) {
        if (this.sharedStyle.sheet) {
            const sheet = <CSSStyleSheet>this.sharedStyle.sheet;
            const length = Math.min(sheet.cssRules.length + endOffset, sheet.cssRules.length);

            for (let i = 0; i < length; i++) {
                const rule = <CSSKeyframesRule>sheet.cssRules[i];
                if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === this.keyframeName) {
                    sheet.deleteRule(i);
                    break;
                }
            }
        }
    }

    private recalculateStyleReducer(val: boolean) {
        switch (this.item.mode) {
            case DanmakuMode.TopToBottom:
            case DanmakuMode.BottomToTop:
                break;
            case DanmakuMode.LeftToRight:
            case DanmakuMode.RightToLeft:
            default:
                this.node.style.willChange = val ? "transform" : "";
                break;
        }
    }

    private refreshVisibilityStyle(visible: boolean): void {
        this.state.visible = visible;
        this.node.style.visibility = this.state.visible ? "" : "hidden";
    }

    show(): void {
        this.refreshVisibilityStyle(true);
    }

    hide(): void {
        this.refreshVisibilityStyle(false);
    }

    play(): void {
        super.play();
        this.node.style.animationPlayState = "running";
    }

    pause(): void {
        super.pause();
        this.node.style.animationPlayState = "paused";
    }

    resize(): void {
        this.insertKeyframes();
        this.deleteKeyframes(-1);
        this.node.style.animationDuration = `${this.duration}s`;
    }

    repaintFrame(): void {
        this.node.style.animationDelay = `-${this.elapsedTime}s`;
    }

    dispose(needRemove?: boolean) {
        if (needRemove) {
            if (this.node.parentElement) {
                this.node.parentElement.removeChild(this.node);
            }
        } else {
            this.node.style.display = "none";
            this.recalculateStyleReducer(false);
        }
        this.deleteKeyframes();
    }
}
