declare module 'gifenc' {
  export type GifFormat = 'rgb565' | 'rgb444' | 'rgba4444'
  export type PaletteColor = number[]

  export interface QuantizeOptions {
    format?: GifFormat
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaThreshold?: number
    clearAlphaColor?: number
  }

  export interface GifFrameOptions {
    palette?: PaletteColor[] | null
    delay?: number
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    colorDepth?: number
    dispose?: number
    first?: boolean
  }

  export interface GifEncoderInstance {
    reset: () => void
    finish: () => void
    bytes: () => Uint8Array
    bytesView: () => Uint8Array
    writeFrame: (index: Uint8Array, width: number, height: number, opts?: GifFrameOptions) => void
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GifEncoderInstance

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): PaletteColor[]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: PaletteColor[],
    format?: GifFormat,
  ): Uint8Array
}
