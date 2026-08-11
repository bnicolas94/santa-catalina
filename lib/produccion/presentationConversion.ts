export interface JqPresentationSplit {
    basePackages: number
    outputX48: number
    outputX24: number
    outputPackages: number
}

export function calculateJqPresentationSplit(x48BasePackages: number, x24BasePackages: number): JqPresentationSplit {
    const x48 = Number.isInteger(x48BasePackages) && x48BasePackages > 0 ? x48BasePackages : 0
    const x24 = Number.isInteger(x24BasePackages) && x24BasePackages > 0 ? x24BasePackages : 0

    return {
        basePackages: x48 + x24,
        outputX48: x48,
        outputX24: x24 * 2,
        outputPackages: x48 + (x24 * 2),
    }
}
