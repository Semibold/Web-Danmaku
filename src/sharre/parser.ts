export interface IDanmakuItem {
    start: number;
    mode: number;
    size: number;
    color: number;
    pubDate: number;
    pool: number;
    uHash: string;
    uuid: string;
    content: string;
    highlight?: boolean;
}

export interface IParsedDanmakuDetail {
    chatId?: string;
    source?: string;
    mission?: string;
    chatServer?: string;
    ds?: string;
    de?: string;
    maxLimit?: number;
    maxCount?: number;
    items?: IDanmakuItem[];
}

export class Parser {
    private readonly doc: Document;
    private readonly domParser = new DOMParser();
    private readonly disinfectedText: string;

    constructor(private text: string) {
        this.disinfectedText = this.text.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, "");
        this.doc = this.domParser.parseFromString(this.disinfectedText, "text/xml");
    }

    private getSingleNodeStringContent(tagName: string) {
        const node = this.doc.querySelector(tagName);

        if (node && node.textContent != null) {
            return node.textContent;
        }
    }

    private getSingleNodeNumberContent(tagName: string) {
        const node = this.doc.querySelector(tagName);

        if (node && node.textContent) {
            return Number(node.textContent);
        }
    }

    private getVarietyDanmakuItems(tagName: string): IDanmakuItem[] {
        const items: IDanmakuItem[] = [];
        const nodes = this.doc.getElementsByTagName(tagName);
        if (!nodes) return items;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const textContent = node.textContent;
            if (!textContent) continue;
            const pVal = node.getAttribute("p");
            if (!pVal) continue;
            const pValSegments = pVal.split(",");
            if (pValSegments.length < 8) continue;
            const item: IDanmakuItem = {
                start: Number(pValSegments.shift()),
                mode: Number(pValSegments.shift()),
                size: Number(pValSegments.shift()),
                color: Number(pValSegments.shift()),
                pubDate: Number(pValSegments.shift()),
                pool: Number(pValSegments.shift()),
                uHash: String(pValSegments.shift()),
                uuid: String(pValSegments.shift()),
                content: textContent,
            };
            items.push(item);
        }
        return items;
    }

    parse() {
        const detail: IParsedDanmakuDetail = {};
        detail.chatServer = this.getSingleNodeStringContent("chatserver");
        detail.chatId = this.getSingleNodeStringContent("chatid");
        detail.mission = this.getSingleNodeStringContent("mission");
        detail.maxLimit = this.getSingleNodeNumberContent("maxlimit");
        detail.source = this.getSingleNodeStringContent("source");
        detail.ds = this.getSingleNodeStringContent("ds");
        detail.de = this.getSingleNodeStringContent("de");
        detail.maxCount = this.getSingleNodeNumberContent("max_count");
        detail.items = this.getVarietyDanmakuItems("d");
        return detail;
    }
}
