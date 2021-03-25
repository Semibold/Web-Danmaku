import { IDanmakuItem, IParsedDanmakuDetail, Parser } from "./sharre/parser";
import { DanmakuMode, RendererType } from "./sharre/constant";
import { CssRenderer } from "./renderer/css-renderer";
import { BaseRenderer } from "./renderer/base-renderer";
import { CssEntity } from "./entity/css-entity";

interface IDanmakuConfigRequired {
    canvasW: number;
    canvasH: number;
    readonly container: HTMLElement;
}

interface IDanmakuConfigOptional {
    duration: number;
    openLayers: number;
    prefix: string;
    fontFamily: string;
    fontWeight: string;
    fontScaling: number;
    reproducible: boolean;
    scalableDuration: boolean;
    detail: IParsedDanmakuDetail;
    rendererType: RendererType;
    recycledBufferSize: number;
    /**
     * @desc This function should be simple and efficient.
     * @desc You can use HTMLMediaElement clock or custom clock.
     * @desc NOTICE: you MUST invoke `Danmaku.pause()` method
     *               if clock stopped(e.g: meida paused, suspend or seeking...),
     *               otherwise the animation will be deranged.
     * @example `clock: function() { return HTMLMediaElement.currentTime; }`
     */
    readonly clock: (
        this: null,
        previousTime: DOMHighResTimeStamp,
        elapsed: DOMHighResTimeStamp,
    ) => DOMHighResTimeStamp;
    readonly filter: (this: null, entry: IDanmakuItem) => boolean;
}

export type IDanmakuConfig = IDanmakuConfigRequired & IDanmakuConfigOptional;

export class Danmaku {
    static get DEF_CONFIG(): IDanmakuConfigOptional {
        return {
            duration: 5,
            openLayers: 0,
            prefix: "danmaku",
            fontFamily: "SimHei, sans-serif",
            fontWeight: "700",
            fontScaling: 1,
            reproducible: true,
            scalableDuration: true,
            detail: { maxLimit: 100000 },
            rendererType: RendererType.CSS,
            recycledBufferSize: 500,
            clock: (previousTime, elapsed) => previousTime + elapsed,
            filter: entry => true,
        };
    }

    static get Parser() {
        return Parser;
    }

    readonly config: IDanmakuConfig;
    readonly sharedRenderer: BaseRenderer<CssEntity>;

    get paused() {
        return this.sharedRenderer.paused;
    }

    get domElement() {
        return this.sharedRenderer.domElement;
    }

    constructor(readonly input: IDanmakuConfigRequired & Partial<IDanmakuConfigOptional>) {
        this.config = Object.assign(Danmaku.DEF_CONFIG, this.input);
        this.config.rendererType = RendererType.CSS;
        this.sharedRenderer = new CssRenderer(this.config);

        if (this.config.detail.items) {
            this.sharedRenderer.addAll(this.config.detail.items.filter(item => item.mode !== DanmakuMode.Unknown));
        }
    }

    play() {
        this.sharedRenderer.play();
    }

    pause() {
        this.sharedRenderer.pause();
    }

    resize(w: number, h: number) {
        this.sharedRenderer.resize(w, h);
    }
}
