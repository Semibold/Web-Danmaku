import { IDanmakuConfig } from "../danmaku";
import { IDanmakuItem } from "../sharre/parser";
import { Utils } from "../sharre/utils";
import { BaseEntity } from "../entity/base-entity";
import { DanmakuMode, DEF_LINE_HEIGHT } from "../sharre/constant";
import { BinaryTree } from "../sharre/binary-tree";

interface ILayoutMode<U> {
    [DanmakuMode.RightToLeft]: BinaryTree<U>[];
    [DanmakuMode.LeftToRight]: BinaryTree<U>[];
    [DanmakuMode.TopToBottom]: BinaryTree<U>[];
    [DanmakuMode.BottomToTop]: BinaryTree<U>[];
}

export abstract class BaseRenderer<T extends BaseEntity> {
    readonly domElement = document.createElement("div");

    private timelineRaf = 0;
    private maxStackDepth = 0;
    private prevFrameTimeStamp: DOMHighResTimeStamp = 0;
    protected readonly fpsSamples: number[] = [];
    protected readonly fpsMaxSamples = 5;
    protected readonly stackDepthRestrict = 2 * 1024;
    protected readonly compositeFrameInterval = 40; // Unit: ms
    protected readonly compositeFrameMinPeriod = 5; // Unit: ms
    protected readonly viewportTree = new BinaryTree<T>((prev, next) => prev.item.start - next.item.start);
    protected readonly timelineTree = new BinaryTree<IDanmakuItem>(Utils.danmakuCompareFn);
    protected readonly sharedCanvas = document.createElement("canvas");
    protected readonly state = {
        paused: true,
        currentTime: 0,
    };
    protected readonly zIndexLayout: ILayoutMode<T> = {
        [DanmakuMode.RightToLeft]: [],
        [DanmakuMode.LeftToRight]: [],
        [DanmakuMode.TopToBottom]: [],
        [DanmakuMode.BottomToTop]: [],
    };

    get fps() {
        if (this.fpsSamples.length) {
            const samples = this.fpsSamples.slice(-this.fpsMaxSamples);
            const total = samples.reduce((prev, cur) => prev + cur, 0);

            if (samples.length > 2) {
                return (samples.length - 2) / (total - Math.max(...samples) - Math.min(...samples));
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    get paused() {
        return this.state.paused;
    }

    get currentTime() {
        return this.state.currentTime;
    }

    protected constructor(readonly config: IDanmakuConfig) {
        this.genMaxStackDepth();
        this.genStageDetail();
    }

    protected abstract render(prevTime: number, currentTime: number): void;
    protected abstract cleanOutdatedEntities(removedEntities: T[]): void;

    protected getItemsByTimeRange(prevTime: number, currentTime: number): IDanmakuItem[] {
        return this.timelineTree
            .getItemsByPartialRange({ start: prevTime }, { start: currentTime })
            .filter(item => this.config.filter.call(null, item));
    }

    protected compositeAll(entities: T[], compositeFramePeriodRestrict: number = Infinity): T[] {
        const compositedEntities: T[] = [];

        if (!entities.length) return compositedEntities;

        const groups: (T[] | void)[] = []; // Sparse Array
        const step = this.compositeFrameInterval / 1000;
        const bStart = Math.min(...entities.map(entity => entity.item.start));

        entities.forEach(entity => {
            const j = Math.floor((entity.item.start - bStart) / step);
            const g = groups[j];
            if (Array.isArray(g)) {
                g.push(entity);
            } else {
                groups[j] = [entity];
            }
        });

        groups.forEach(group => {
            if (group && group.length) {
                compositedEntities.push(...this.composite(group, compositeFramePeriodRestrict));
            }
        });

        return compositedEntities;
    }

    protected composite(entities: T[], compositeFramePeriodRestrict: number = Infinity): T[] {
        const maxPeriod = Math.max(this.compositeFrameMinPeriod, compositeFramePeriodRestrict) || Infinity;
        const compositedEntities: T[] = [];
        const prevLayoutDetailCache: { [P in keyof ILayoutMode<T>]?: [number, number] } = {}; // [offsetY, zIndex]

        const startTime = performance.now();
        for (const entity of entities) {
            let j = 0;
            let args: void | [T, number, number] = [entity, 0, 0];

            if (prevLayoutDetailCache[entity.item.mode]) {
                const [offsetYCache, zIndexCache] = prevLayoutDetailCache[entity.item.mode];
                args = [entity, offsetYCache, zIndexCache];
            }

            while (args && j++ < this.maxStackDepth) {
                args = this.getNextCompositeArguments(...args);
            }

            if (entity.composited) {
                compositedEntities.push(entity);
                prevLayoutDetailCache[entity.item.mode] = [entity.offsetY, entity.zIndex];
            }

            if (performance.now() - startTime > maxPeriod) break;
        }
        const etime = performance.now();

        this.viewportTree.bInsertAll(compositedEntities);

        if (DEBUG) {
            if (compositedEntities.length !== entities.length) {
                console.warn(`${entities.length - compositedEntities.length} entities have been discarded`);
            }
            if (etime - startTime > 5) {
                console.warn(`Composition time is ${etime - startTime}ms which greater than 5ms`);
            }
        }

        return compositedEntities;
    }

    private getNextCompositeArguments(entity: T, offsetY: number, zIndex: number): void | [T, number, number] {
        /** The highlight danmaku has an extra layer. */
        const calculatedOpenLayers = this.config.openLayers + (entity.item.highlight ? 1 : 0);

        if (entity.composited) return;
        if (zIndex && zIndex > calculatedOpenLayers) return;
        if (entity.y + entity.height > this.config.canvasH) return;

        if (offsetY + entity.y < 0 || offsetY + entity.y + entity.height > this.config.canvasH) {
            return [entity, 0, zIndex + 1];
        }

        const list: BinaryTree<T>[] = this.zIndexLayout[entity.item.mode];

        if (!Array.isArray(list)) return;

        while (list.length <= zIndex) {
            list.push(new BinaryTree<T>((prev, next) => prev.y - next.y));
        }

        const layoutTree: BinaryTree<T> = list[zIndex];
        const tunedOffsetY = this.getTunedOffsetY(entity, offsetY, zIndex);

        if (tunedOffsetY) {
            return [entity, tunedOffsetY, zIndex];
        } else {
            entity.setLayout(offsetY, zIndex);
            layoutTree.bInsert(entity);
        }
    }

    private getTunedOffsetY(entity: T, offsetY: number, zIndex: number): number {
        const list: BinaryTree<T>[] = this.zIndexLayout[entity.item.mode];
        const layoutTree: BinaryTree<T> = list[zIndex];
        const [sIndex] = layoutTree.findInsertionIndex(<T>{ y: entity.y + offsetY });
        const start = sIndex < 0 ? 0 : sIndex;

        for (let i = start; i < layoutTree.entries.length; i++) {
            const exist = layoutTree.entries[i];

            if (
                this.isIntersectionRectangle(entity, exist, offsetY) ||
                this.isExceedingLinearSpeed(entity, exist, offsetY)
            ) {
                return exist.y + exist.height + 1;
            }
        }

        // for (const exist of layoutTree.entries) {
        //     if (
        //         this.isIntersectionRectangle(entity, exist, offsetY) ||
        //         this.isExceedingLinearSpeed(entity, exist, offsetY)
        //     ) {
        //         return exist.y + exist.height + 1;
        //     }
        // }

        return 0;
    }

    private isIntersectionRectangle(target: T, exist: T, offsetY: number): boolean {
        return Utils.isOrthogonalRectangle(
            {
                x: target.x,
                y: offsetY + target.y,
                width: target.width,
                height: target.height,
            },
            {
                x: exist.x,
                y: exist.y,
                width: exist.width,
                height: exist.height,
            },
        );
    }

    private isExceedingLinearSpeed(target: T, exist: T, offsetY: number): boolean {
        const isRowOrthogonal = Utils.isOrthogonalRectangle(
            {
                x: 0,
                y: offsetY + target.y,
                width: 64,
                height: target.height,
            },
            {
                x: 0,
                y: exist.y,
                width: 64,
                height: exist.height,
            },
        );

        if (!isRowOrthogonal) return false;

        const diffSpeed = target.averageLinearSpeed - exist.averageLinearSpeed;
        const diffDistance = Math.min(target.restTime, exist.restTime) * Math.abs(diffSpeed);

        if (diffSpeed > 0) {
            if (exist.x + exist.width < target.x) {
                return diffDistance > target.x - (exist.x + exist.width);
            } else {
                return !(target.x + target.width < exist.x);
            }
        }

        if (diffSpeed < 0) {
            if (target.x + target.width < exist.x) {
                return diffDistance > exist.x - (target.x + target.width);
            } else {
                return !(exist.x + exist.width < target.x);
            }
        }

        return false;
    }

    private genMaxStackDepth() {
        /** Two extra layers: default and highlight. */
        const coBoundary = Math.ceil(this.config.canvasH / 12) * (Math.max(0, this.config.openLayers) + 2);
        this.maxStackDepth = Math.min(coBoundary, this.stackDepthRestrict) || this.stackDepthRestrict;
    }

    private genStageDetail() {
        this.domElement.style.display = "block";
        this.domElement.style.position = "absolute";
        this.domElement.style.top = "0%";
        this.domElement.style.left = "50%";
        this.domElement.style.right = "0%";
        this.domElement.style.bottom = "0%";
        this.domElement.style.overflow = "hidden";
        this.domElement.style.transform = "translateX(-50%)";
        this.domElement.style.whiteSpace = "pre";
        this.domElement.style.pointerEvents = "none";
        this.domElement.style.width = `${this.config.canvasW}px`;
        this.domElement.style.height = `${this.config.canvasH}px`;
        this.domElement.style.lineHeight = DEF_LINE_HEIGHT.toString();

        if (this.config.container && !this.domElement.parentElement) {
            this.config.container.appendChild(this.domElement);
        }
    }

    /**
     * @desc Internal clock
     */
    private nextTick(): number {
        const currentFrameTimeStamp = performance.now();
        const elapsed = (currentFrameTimeStamp - this.prevFrameTimeStamp) / 1000;
        const prevTime = this.state.currentTime;

        this.state.currentTime = this.clockSynchronization(prevTime, elapsed);
        this.prevFrameTimeStamp = currentFrameTimeStamp;
        this.fpsSamples.push(elapsed);

        while (this.fpsSamples.length > this.fpsMaxSamples) {
            this.fpsSamples.shift();
        }

        return elapsed;
    }

    private clockSynchronization(previousTime: DOMHighResTimeStamp, elapsed: DOMHighResTimeStamp): DOMHighResTimeStamp {
        const time = +this.config.clock.call(null, previousTime, elapsed) || 0;

        if (time >= 0 && time < Infinity) {
            return time;
        } else {
            return previousTime;
        }
    }

    private nextAnimationFrame(timeStamp: DOMHighResTimeStamp) {
        if (DEBUG) {
            console.count("requestAnimationFrame");
        }
        const previousTime = this.state.currentTime;

        this.nextTick();
        this.refreshRendererDetail();
        this.render(previousTime, this.state.currentTime);
        this.timelineRaf = requestAnimationFrame(this.nextAnimationFrame.bind(this));
    }

    private refreshRendererDetail() {
        const delta = 0.05; // Unit: s
        const outdated: T[] = [];

        for (const entity of this.viewportTree.entries) {
            if (entity.item.start + entity.duration + delta < this.state.currentTime) {
                outdated.push(entity);
            } else {
                break;
            }
        }

        this.removeOutdatedEntitiesFromTrees(outdated);
    }

    private removeOutdatedEntitiesFromTrees(outdated: T[]) {
        if (outdated.length) {
            outdated.forEach(entity => {
                const list: BinaryTree<T>[] = this.zIndexLayout[entity.item.mode];
                if (list && list[entity.zIndex]) {
                    list[entity.zIndex].removeAllEquivalent([entity], true);
                }
            });

            const removedEntities = this.viewportTree.removeAllEquivalent(outdated, true);

            this.cleanOutdatedEntities(removedEntities);

            if (!this.config.reproducible) {
                const items = outdated.map(entity => entity.item);
                this.timelineTree.removeAllEquivalent(items, true);
            }
        }
    }

    private requestDanmakuAnimation() {
        if (!this.timelineRaf) {
            this.prevFrameTimeStamp = this.prevFrameTimeStamp || performance.now();
            this.timelineRaf = requestAnimationFrame(this.nextAnimationFrame.bind(this));
            this.state.paused = false;
        }
    }

    private cancelDanmakuAnimation() {
        if (this.timelineRaf) {
            cancelAnimationFrame(this.timelineRaf);
            this.nextTick();
            this.prevFrameTimeStamp = 0;
            this.timelineRaf = 0;
            this.state.paused = true;
        }
    }

    private refreshViewportTree(currentTime: number) {
        const [sIndex] = this.timelineTree.findInsertionIndex(<IDanmakuItem>{ start: currentTime });

        if (sIndex > 0) {
            let prevTime = null;

            for (let i = sIndex - 1; i >= 0; i--) {
                const item = this.timelineTree.entries[i];
                if (item.start < currentTime && item.start + this.config.duration >= currentTime) {
                    prevTime = item.start;
                } else {
                    break;
                }
            }

            if (prevTime != null) {
                this.render(prevTime, currentTime);
                this.viewportTree.entries.forEach(entity => entity.repaintFrame());
            }
        }
    }

    play() {
        if (!this.timelineRaf) {
            this.requestDanmakuAnimation();
        }
    }

    pause() {
        if (this.timelineRaf) {
            this.cancelDanmakuAnimation();
        }
    }

    /**
     * @desc MUST not be use this method if you are using external clock.
     */
    seek(to: number, refreshViewport?: boolean) {
        const time = Number(to);
        const prevPaused = this.paused;

        if (time !== this.currentTime && time >= 0 && time < Infinity && !isNaN(time)) {
            this.pause();
            this.removeOutdatedEntitiesFromTrees(this.viewportTree.entries.slice(0));
            this.state.currentTime = time;
            if (refreshViewport) {
                this.refreshViewportTree(time);
            }
            prevPaused ? this.pause() : this.play();
        }
    }

    addAll(items: IDanmakuItem[]) {
        this.timelineTree.bInsertAll(items);
    }

    resize(w: number, h: number) {
        if (w > 0 || h > 0) {
            const oldCanvasW = this.config.canvasW;

            if (w) {
                this.config.canvasW = w;
                if (this.config.scalableDuration) {
                    this.config.duration = (w / oldCanvasW) * this.config.duration;
                }
            }
            if (h) {
                this.config.canvasH = h;
            }
            this.genMaxStackDepth();
            this.genStageDetail();
            this.viewportTree.entries.forEach(entity => entity.resize());
        }
    }

    search(offsetX: number, offsetY: number): T[] {
        return this.viewportTree.entries.filter(entity => {
            return Utils.isOrthogonalRectangle(
                {
                    x: offsetX,
                    y: offsetY,
                    width: 0,
                    height: 0,
                },
                {
                    x: entity.x,
                    y: entity.y,
                    width: entity.width,
                    height: entity.height,
                },
            );
        });
    }

    dispose() {
        this.cancelDanmakuAnimation();

        if (this.domElement.parentElement) {
            this.domElement.parentElement.removeChild(this.domElement);
        }
    }
}
