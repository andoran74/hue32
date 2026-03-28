/**
 * Hue₃₂ Color Notation System — TypeScript Definitions
 * @version 1.0.0
 * @license CC-BY-4.0
 */

/** Options for conversion functions that accept physical measurement data */
export interface ConversionOptions {
  /** Luster from physical gloss measurement (1=matte, 32=glossy, 0=not encoded) */
  luster?: number;
  /** Fluorescence from UV measurement (1=none, 32=vivid, 0=not encoded) */
  fluorescence?: number;
}

/** Constructor options for Hue32Color */
export interface Hue32ColorOptions {
  huePrimary?: 'R' | 'G' | 'B' | null;
  huePrimaryVal?: number;
  hueSecondary?: 'Y' | 'C' | 'M' | null;
  hueSecondaryVal?: number;
  shade?: number;
  tone?: number;
  luster?: number;
  fluorescence?: number;
}

/** Result of converting Hue₃₂ to RGB */
export interface RgbResult {
  r: number;
  g: number;
  b: number;
  outOfGamut: boolean;
}

/** Result of converting Hue₃₂ to hex */
export interface HexResult {
  hex: string;
  outOfGamut: boolean;
}

/** Result of converting Hue₃₂ to CMYK */
export interface CmykResult {
  c: number;
  m: number;
  y: number;
  k: number;
  outOfGamut: boolean;
}

/** Round-trip validation result */
export interface RoundTripResult {
  notation: string;
  original: [number, number, number];
  recovered: [number, number, number];
  deltaE: number;
  tolerance: number;
  pass: boolean;
}

/** Precision tier for round-trip validation */
export type PrecisionTier = 'hue32' | 'hue64' | 'hue192';

/** Named color entry */
export interface NamedColor {
  hue: string;
  shade: number;
  tone: number;
}

/**
 * A color in Hue₃₂ notation.
 *
 * All axes use a 1–32 scale. 0 means not encoded — no conversion is
 * performed for that axis. This is distinct from 16 (the explicit midpoint).
 */
export declare class Hue32Color {
  /** RGB primary hue component ('R', 'G', or 'B') */
  huePrimary: 'R' | 'G' | 'B' | null;
  /** RGB primary value (0.25–32, or 0 if not present) */
  huePrimaryVal: number;
  /** YCM secondary hue component ('Y', 'C', or 'M') */
  hueSecondary: 'Y' | 'C' | 'M' | null;
  /** YCM secondary value (0.25–32, or 0 if not present) */
  hueSecondaryVal: number;
  /** Shade: 1=black, 32=white, 0=not encoded */
  shade: number;
  /** Tone: 1=gray, 32=vivid, 0=achromatic/not encoded */
  tone: number;
  /** Luster: 1=matte, 32=glossy, 0=not encoded (requires physical measurement) */
  luster: number;
  /** Fluorescence: 1=none, 32=intense, 0=not encoded (requires physical measurement) */
  fluorescence: number;

  constructor(options?: Hue32ColorOptions);

  /**
   * Returns the hue component string.
   * @example "R23Y9" | "B32" | "none"
   */
  hueString(precision?: number): string;

  /**
   * Returns the full notation string.
   * @example "H:R23Y9 S:24 T:15 L:0 F:0"
   */
  toString(precision?: number): string;

  /** Returns true if this color has no encodable hue information */
  isAchromatic(): boolean;
}

/**
 * Converts sRGB values (0–255 each) to Hue₃₂.
 * @param r - Red (0–255)
 * @param g - Green (0–255)
 * @param b - Blue (0–255)
 * @param options - Optional luster and fluorescence from physical measurement
 */
export declare function rgbToHue32(
  r: number,
  g: number,
  b: number,
  options?: ConversionOptions
): Hue32Color;

/**
 * Converts a hex color string to Hue₃₂.
 * @param hex - e.g. "#FF8000" or "FF8000"
 * @param options - Optional luster and fluorescence from physical measurement
 */
export declare function hexToHue32(
  hex: string,
  options?: ConversionOptions
): Hue32Color;

/**
 * Converts CMYK values (0–100 each) to Hue₃₂.
 * Uses a neutral RGB profile.
 */
export declare function cmykToHue32(
  c: number,
  m: number,
  y: number,
  k: number,
  options?: ConversionOptions
): Hue32Color;

/**
 * Converts a Hue₃₂ color back to sRGB (0–255 each).
 * Colors outside the sRGB gamut are clipped.
 */
export declare function hue32ToRgb(color: Hue32Color): RgbResult;

/**
 * Converts a Hue₃₂ color to a hex string.
 */
export declare function hue32ToHex(color: Hue32Color): HexResult;

/**
 * Converts a Hue₃₂ color to CMYK (0–100 each).
 */
export declare function hue32ToCmyk(color: Hue32Color): CmykResult;

/**
 * Parses a Hue₃₂ notation string into a Hue32Color object.
 * @param notation - e.g. "H:R23Y9 S:24 T:15 L:0 F:0"
 */
export declare function parseHue32(notation: string): Hue32Color;

/**
 * Validates round-trip accuracy for an RGB color.
 * Converts RGB → Hue₃₂ → RGB and measures perceptual difference.
 */
export declare function validateRoundTrip(
  r: number,
  g: number,
  b: number,
  tier?: PrecisionTier
): RoundTripResult;

/** The nine named color anchors defined by Hue₃₂ */
export declare const NAMED_COLORS: Record<string, NamedColor>;

/** Valid hue component pairs */
export declare const VALID_PAIRS: Record<string, string[]>;

/** Round-trip conformance tolerances by precision tier */
export declare const DELTA_E: Record<PrecisionTier, number>;

/** Snap threshold — minimum meaningful value at any precision tier */
export declare const SNAP: number;

export default {
  Hue32Color,
  rgbToHue32,
  hexToHue32,
  cmykToHue32,
  hue32ToRgb,
  hue32ToHex,
  hue32ToCmyk,
  parseHue32,
  validateRoundTrip,
  NAMED_COLORS,
  VALID_PAIRS,
  DELTA_E,
};
