/**
 * @desc The method that name start with `b`, which has to do with algorithms.
 */
export class BinaryTree<T> {
    readonly entries: T[] = [];
    readonly compareFn: (target: T, element: T) => number;

    constructor(compareFn: (target: T, element: T) => number) {
        this.compareFn = compareFn;
    }

    bSearchTargetIndex(target: T): number {
        let low = 0;
        let mid = 0;
        let hig = this.entries.length - 1;

        while (low <= hig) {
            mid = Math.floor((low + hig) / 2);
            const index = this.compareFn(target, this.entries[mid]);
            if (index < 0) {
                hig = mid - 1;
            } else if (index > 0) {
                low = mid + 1;
            } else {
                return mid;
            }
        }

        return -1;
    }

    bSearchInsertionIndex(target: T): number {
        if (!this.entries.length) return 0;
        if (this.compareFn(target, this.entries[0]) <= 0) return 0;
        if (this.compareFn(target, this.entries[this.entries.length - 1]) >= 0) return this.entries.length;

        let low = 0;
        let mid = 0;
        let hig = this.entries.length - 1;

        while (low <= hig) {
            mid = Math.floor((low + hig + 1) / 2);
            const pIndex = this.compareFn(target, this.entries[mid - 1]);
            const cIndex = this.compareFn(target, this.entries[mid]);

            if (pIndex >= 0 && cIndex <= 0) {
                return mid;
            } else if (pIndex < 0) {
                hig = mid - 1;
            } else if (pIndex > 0) {
                low = mid + 1;
            } else {
                if (DEBUG) {
                    console.error("Cannot find insertion index in an unordered array");
                }
                break;
            }
        }

        return -1;
    }

    bInsert(target: T, offset: number = 0): number {
        let index = -1;
        let sIndex = -1,
            mIndex = -1,
            eIndex = -1;

        if (offset) {
            [sIndex, mIndex, eIndex] = this.findInsertionIndex(target);
        } else {
            sIndex = mIndex = eIndex = this.bSearchInsertionIndex(target);
        }

        switch (true) {
            case offset < 0:
                index = sIndex;
                break;
            case offset > 0:
                index = eIndex;
                break;
            default:
                index = mIndex;
                break;
        }

        if (index > -1) {
            this.entries.splice(index, 0, target);
        }

        return this.entries.length;
    }

    bRemove(target: T): T[] {
        const eliminated: T[] = [];
        const index = this.bSearchTargetIndex(target);

        if (index > -1) {
            eliminated.push(...this.entries.splice(index, 1));
        }

        return eliminated;
    }

    bInsertAll(items: T[], offset: number = 0): number {
        items.forEach((item: T) => {
            this.bInsert(item, offset);
        });

        return this.entries.length;
    }

    bRemoveAll(items: T[]): T[] {
        const eliminated: T[] = [];

        items.forEach((item: T) => {
            eliminated.push(...this.bRemove(item));
        });

        return eliminated;
    }

    findInsertionIndex(target: T): [number, number, number] {
        let mIndex = this.bSearchInsertionIndex(target);
        let sIndex = mIndex;
        let eIndex = mIndex;

        if (mIndex < 0) return [sIndex, mIndex, eIndex];

        while (eIndex + 1 < this.entries.length) {
            const pIndex = this.compareFn(target, this.entries[eIndex]);
            const cIndex = this.compareFn(target, this.entries[eIndex + 1]);

            if (pIndex >= 0 && cIndex <= 0) {
                eIndex += 1;
            } else {
                break;
            }
        }

        if (eIndex + 1 === this.entries.length && this.compareFn(target, this.entries[this.entries.length - 1]) >= 0) {
            eIndex = this.entries.length;
        }

        while (sIndex - 1 > 0 && sIndex - 1 < this.entries.length) {
            const pIndex = this.compareFn(target, this.entries[sIndex - 2]);
            const cIndex = this.compareFn(target, this.entries[sIndex - 1]);

            if (pIndex >= 0 && cIndex <= 0) {
                sIndex -= 1;
            } else {
                break;
            }
        }

        if (sIndex === 1 && this.compareFn(target, this.entries[0]) <= 0) {
            sIndex = 0;
        }

        return [sIndex, mIndex, eIndex];
    }

    findTargetIndex(target: T): [number, number, number] {
        let mIndex = this.bSearchTargetIndex(target);
        let sIndex = mIndex;
        let eIndex = mIndex;

        if (mIndex < 0) return [sIndex, mIndex, eIndex];

        while (eIndex + 1 < this.entries.length) {
            if (this.compareFn(target, this.entries[eIndex + 1])) {
                break;
            } else {
                eIndex += 1;
            }
        }

        while (sIndex - 1 >= 0 && sIndex - 1 < this.entries.length) {
            if (this.compareFn(target, this.entries[sIndex - 1])) {
                break;
            } else {
                sIndex -= 1;
            }
        }

        return [sIndex, mIndex, eIndex];
    }

    removeAllEquivalent(items: T[], interrupt: boolean = false): T[] {
        const eliminated: T[] = [];
        const indexCounter: { [index: string]: number } = {};

        for (const item of items) {
            const [sIndex, mIndex, eIndex] = this.findTargetIndex(item);

            if (mIndex < 0) continue;

            for (let i = sIndex; i < eIndex + 1; i++) {
                if (this.entries[i] === item) {
                    if (indexCounter[i] == null) {
                        indexCounter[i] = 1;
                    } else {
                        indexCounter[i]++;
                    }
                    if (interrupt) break;
                }
            }
        }

        Object.keys(indexCounter)
            .map(Number)
            .sort((a, b) => b - a)
            .forEach(val => {
                eliminated.push(...this.entries.splice(val, 1));
            });

        if (DEBUG) {
            const diff = items.length - eliminated.length;
            if (diff) {
                console.warn(`${diff} items cannot be removed, which may cause performance problems`);
            }
        }

        return eliminated;
    }

    getItemsByPartialRange(start: Partial<T>, end: Partial<T>, limit: number = Infinity): T[] {
        const [sIndex] = this.findInsertionIndex(<T>start);
        const [eIndex] = this.findInsertionIndex(<T>end);

        return this.getItemsByIndexRange(sIndex, eIndex, limit);
    }

    /**
     * @desc Include start index and exclude end index.
     * @desc Returned value is a subarray(a sorted array) of `entries`.
     */
    getItemsByIndexRange(sIndex: number, eIndex: number, limit: number = Infinity): T[] {
        const data: T[] = [];

        if (sIndex >= eIndex) return data;

        while (sIndex < eIndex) {
            if (sIndex >= 0 && sIndex < this.entries.length) {
                if (data.length >= limit) break;
                data.push(this.entries[sIndex]);
            }
            sIndex++;
        }

        return data;
    }
}
