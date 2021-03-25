import { DEF_LINE_HEIGHT } from "./constant";
import { IDanmakuItem } from "./parser";

interface IRectangleRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class Utils {
    static danmakuCompareFn(prev: IDanmakuItem, next: IDanmakuItem): number {
        return prev.start - next.start;
    }

    static getMeasuredTextWidth(
        canvas: HTMLCanvasElement,
        text: string,
        font: string = `normal normal normal normal 1rem/${DEF_LINE_HEIGHT} sans-serif`,
    ) {
        const context = canvas.getContext("2d");
        if (context) {
            context.font = font;
            return context.measureText(text).width;
        } else {
            return 0;
        }
    }

    static getHexColor(value: number, withSign: boolean = true): string {
        const hexColor = ("000000" + value.toString(16)).slice(-6);

        if (withSign) {
            return "#" + hexColor;
        } else {
            return hexColor;
        }
    }

    static getOutlineColor(value: number): number {
        return value ? 0 : 0xffffff;
    }

    static isOrthogonalRectangle(a: IRectangleRect, b: IRectangleRect): boolean {
        const targetGeometricX = a.x + a.width / 2;
        const targetGeometricY = a.y + a.height / 2;
        const existGeometricX = b.x + b.width / 2;
        const existGeometricY = b.y + b.height / 2;

        return (
            Math.abs(targetGeometricX - existGeometricX) <= (a.width + b.width) / 2 &&
            Math.abs(targetGeometricY - existGeometricY) <= (a.height + b.height) / 2
        );
    }
}
