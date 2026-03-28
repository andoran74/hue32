/**
 * Hue₃₂ Color Notation System
 * ============================
 * A human-readable, device-independent color notation anchored to OKLCh.
 *
 * @version 1.0.0
 * @license CC-BY-4.0
 * @author Angel Doran
 * @see https://hue32.studio
 */

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const L_MIN = 0, L_MAX = 1;
const C_MIN = 0, C_MAX = 0.4;
const HSTF_MIN = 1, HSTF_MAX = 32;
const SNAP = 0.25;
const ACHROMATIC_THRESH = SNAP * (C_MAX - C_MIN) / (HSTF_MAX - HSTF_MIN);

const HUE_ANGLES = { R: 29.2232, Y: 109.7828, G: 142.5112, C: 194.8069, B: 264.0729, M: 328.3520 };

// Segment definitions are in _SEGMENTS (defined with _angleToComponents below)

/** RGB primaries — always appear first in hue notation */
const RGB_PRIMARIES = ['R', 'G', 'B'];

/** YCM secondaries — always appear second in hue notation */
const YCM_SECONDARIES = ['Y', 'C', 'M'];

/** Valid hue pairs: primary -> [secondary, secondary] */
const VALID_PAIRS = { R: ['Y', 'M'], G: ['Y', 'C'], B: ['C', 'M'] };

/** The nine named color anchors defined by Hue₃₂ */
const NAMED_COLORS = {
  red:     { hue: 'R32',   shade: 20, tone: 21 },
  yellow:  { hue: 'Y32',   shade: 31, tone: 17 },
  green:   { hue: 'G32',   shade: 28, tone: 24 },
  cyan:    { hue: 'C32',   shade: 29, tone: 13 },
  blue:    { hue: 'B32',   shade: 15, tone: 25 },
  magenta: { hue: 'M32',   shade: 23, tone: 26 },
  white:   { hue: 'none',  shade: 32, tone:  0 },
  black:   { hue: 'none',  shade:  1, tone:  0 },
  gray:    { hue: 'none',  shade: 16, tone:  0 },
};

/** Round-trip conformance tolerances (OKLab Euclidean distance) */
const DELTA_E = {
  hue32:  0.0323,
  hue64:  0.0161,
  hue192: 0.0081,
};

// ─────────────────────────────────────────────────────────────
// Internal math
// ─────────────────────────────────────────────────────────────

function _snap(v) {
  if (v < SNAP) return 0;
  if (v > HSTF_MAX - SNAP) return HSTF_MAX;
  return Math.round(v * 4) / 4;
}

function _normDeg(d) {
  return ((d % 360) + 360) % 360;
}

function _toScale(val, vmin, vmax) {
  return HSTF_MIN + (val - vmin) / (vmax - vmin) * (HSTF_MAX - HSTF_MIN);
}

function _fromScale(val, vmin, vmax) {
  if (val === 0) return vmin;
  return vmin + (val - HSTF_MIN) / (HSTF_MAX - HSTF_MIN) * (vmax - vmin);
}

const _SEGMENTS = [
  ['R','Y', HUE_ANGLES.R, HUE_ANGLES.Y,         true],
  ['G','Y', HUE_ANGLES.Y, HUE_ANGLES.G,         false],
  ['G','C', HUE_ANGLES.G, HUE_ANGLES.C,         true],
  ['B','C', HUE_ANGLES.C, HUE_ANGLES.B,         false],
  ['B','M', HUE_ANGLES.B, HUE_ANGLES.M,         true],
  ['R','M', HUE_ANGLES.M, HUE_ANGLES.R + 360.0, false],
];

function _angleToComponents(hDeg) {
  const norm = _normDeg(hDeg);
  for (const [rgb, ycm, a0, a1, rgbAtStart] of _SEGMENTS) {
    const test = norm >= a0 ? norm : norm + 360;
    if (test >= a0 && test <= a1) {
      const span = a1 - a0;
      const t = span > 0 ? Math.max(0, Math.min(1, (test - a0) / span)) : 0;
      const rv = _snap(rgbAtStart ? (1 - t) * HSTF_MAX : t * HSTF_MAX);
      const sv = _snap(rgbAtStart ? t * HSTF_MAX : (1 - t) * HSTF_MAX);
      return [rv > 0 ? rgb : null, rv, sv > 0 ? ycm : null, sv];
    }
  }
  return ['R', HSTF_MAX, null, 0];
}

function _componentsToAngle(p, pv, s, sv) {
  if (!p && !s) return 0;
  if (!s || sv === 0) return HUE_ANGLES[p];
  if (!p || pv === 0) return HUE_ANGLES[s];
  const total = pv + sv;
  const t = sv / total;
  let pa = HUE_ANGLES[p], sa = HUE_ANGLES[s];
  if (p === 'G' && s === 'Y') return _normDeg(sa + t * (pa - sa));
  if (p === 'B' && s === 'C') return _normDeg(sa + t * (pa - sa));
  if (p === 'R' && s === 'M') {
    const rExt = pa + 360;
    return _normDeg(sa + t * (rExt - sa));
  }
  return _normDeg(pa + t * (sa - pa));
}

function _srgbLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function _linearSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function _rgbToOklch(r, g, b) {
  const rl = _srgbLinear(r / 255);
  const gl = _srgbLinear(g / 255);
  const bl = _srgbLinear(b / 255);
  const X = 0.4124 * rl + 0.3576 * gl + 0.1805 * bl;
  const Y = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  const Z = 0.0193 * rl + 0.1192 * gl + 0.9505 * bl;
  const l = Math.cbrt(0.8189330101 * X + 0.3618667424 * Y - 0.1288597137 * Z);
  const m = Math.cbrt(0.0329845436 * X + 0.9293118715 * Y + 0.0361456387 * Z);
  const s = Math.cbrt(0.0482003018 * X + 0.2643662691 * Y + 0.6338517070 * Z);
  const L =  0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a =  1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bk = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.sqrt(a * a + bk * bk), _normDeg(Math.atan2(bk, a) * 180 / Math.PI)];
}

function _oklchToRgb(L, C, H) {
  const a = C * Math.cos(H * Math.PI / 180);
  const bk = C * Math.sin(H * Math.PI / 180);
  const lc = L + 0.3963377774 * a + 0.2158037573 * bk;
  const mc = L - 0.1055613458 * a - 0.0638541728 * bk;
  const sc = L - 0.0894841775 * a - 1.2914855480 * bk;
  const l = lc ** 3, m = mc ** 3, s = sc ** 3;
  return [
    Math.round(Math.max(0, Math.min(1, _linearSrgb( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))) * 255),
    Math.round(Math.max(0, Math.min(1, _linearSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))) * 255),
    Math.round(Math.max(0, Math.min(1, _linearSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s))) * 255),
  ];
}

function _deltaE(r1, g1, b1, r2, g2, b2) {
  const [L1, a1, b1k] = _rgbToOklch(r1, g1, b1).map((v, i) => i === 2 ? 0 : v);
  const [L2, a2, b2k] = _rgbToOklch(r2, g2, b2).map((v, i) => i === 2 ? 0 : v);
  // Use OKLab Euclidean distance
  const toOklab = (r, g, b) => {
    const [L, C, H] = _rgbToOklch(r, g, b);
    return [L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180)];
  };
  const [l1, aa1, bb1] = toOklab(r1, g1, b1);
  const [l2, aa2, bb2] = toOklab(r2, g2, b2);
  return Math.sqrt((l1 - l2) ** 2 + (aa1 - aa2) ** 2 + (bb1 - bb2) ** 2);
}

// ─────────────────────────────────────────────────────────────
// Hue32Color class
// ─────────────────────────────────────────────────────────────

/**
 * Represents a color in Hue₃₂ notation.
 *
 * All axes use a 1–32 scale. 0 means not encoded — no conversion is
 * performed for that axis. This is distinct from 16 (the explicit midpoint).
 *
 * Color axes (derivable from digital sources):
 *   huePrimary / huePrimaryVal  — RGB component (R, G, or B)
 *   hueSecondary / hueSecondaryVal — YCM component (Y, C, or M)
 *   shade — 1=black, 32=white
 *   tone  — 1=gray, 32=vivid, 0=achromatic
 *
 * Material axes (require physical measurement):
 *   luster       — 1=matte, 32=glossy, 0=not encoded
 *   fluorescence — 1=none, 32=intensely fluorescent, 0=not encoded
 */
class Hue32Color {
  constructor({
    huePrimary = null,
    huePrimaryVal = 0,
    hueSecondary = null,
    hueSecondaryVal = 0,
    shade = 0,
    tone = 0,
    luster = 0,
    fluorescence = 0,
  } = {}) {
    this.huePrimary = huePrimary;
    this.huePrimaryVal = huePrimaryVal;
    this.hueSecondary = hueSecondary;
    this.hueSecondaryVal = hueSecondaryVal;
    this.shade = shade;
    this.tone = tone;
    this.luster = luster;
    this.fluorescence = fluorescence;
  }

  /** Returns the hue component string, e.g. "R23Y9", "B32", "none" */
  hueString(precision = 1) {
    const fmt = v => {
      const r = Math.round(v / precision) * precision;
      return r === Math.round(r) ? String(Math.round(r)) : String(r);
    };
    const parts = [];
    if (this.huePrimary && this.huePrimaryVal >= SNAP)
      parts.push(this.huePrimary + fmt(this.huePrimaryVal));
    if (this.hueSecondary && this.hueSecondaryVal >= SNAP)
      parts.push(this.hueSecondary + fmt(this.hueSecondaryVal));
    return parts.join('') || 'none';
  }

  /** Returns the full notation string, e.g. "H:R23Y9 S:24 T:15 L:0 F:0" */
  toString(precision = 1) {
    const fmt = v => {
      if (v === 0) return '0';
      const r = Math.round(v / precision) * precision;
      return r === Math.round(r) ? String(Math.round(r)) : String(r);
    };
    return [
      `H:${this.hueString(precision)}`,
      `S:${fmt(this.shade)}`,
      `T:${fmt(this.tone)}`,
      `L:${fmt(this.luster)}`,
      `F:${fmt(this.fluorescence)}`,
    ].join(' ');
  }

  /** Returns true if this color has no encodable hue information */
  isAchromatic() {
    return this.tone === 0 || this.tone < SNAP;
  }
}

// ─────────────────────────────────────────────────────────────
// Conversion functions
// ─────────────────────────────────────────────────────────────

/**
 * Converts sRGB values (0–255 each) to Hue₃₂.
 * @param {number} r - Red (0–255)
 * @param {number} g - Green (0–255)
 * @param {number} b - Blue (0–255)
 * @param {object} [options]
 * @param {number} [options.luster=0] - Luster from physical measurement (0=not encoded)
 * @param {number} [options.fluorescence=0] - Fluorescence from physical measurement
 * @returns {Hue32Color}
 */
function rgbToHue32(r, g, b, { luster = 0, fluorescence = 0 } = {}) {
  const [L, C, H] = _rgbToOklch(r, g, b);
  const shade = _snap(_toScale(L, L_MIN, L_MAX));

  if (C < ACHROMATIC_THRESH) {
    return new Hue32Color({ shade, tone: 0, luster, fluorescence });
  }

  const tone = _snap(_toScale(C, C_MIN, C_MAX));
  const [p, pv, s, sv] = _angleToComponents(H);

  return new Hue32Color({
    huePrimary: p,
    huePrimaryVal: Math.round(pv * 100) / 100,
    hueSecondary: s,
    hueSecondaryVal: Math.round(sv * 100) / 100,
    shade: Math.round(shade * 100) / 100,
    tone: Math.round(tone * 100) / 100,
    luster,
    fluorescence,
  });
}

/**
 * Converts a hex color string to Hue₃₂.
 * @param {string} hex - e.g. "#FF8000" or "FF8000"
 * @param {object} [options]
 * @returns {Hue32Color}
 */
function hexToHue32(hex, options = {}) {
  hex = hex.replace('#', '');
  if (hex.length !== 6) throw new Error(`Invalid hex color: #${hex}`);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) throw new Error(`Invalid hex color: #${hex}`);
  return rgbToHue32(r, g, b, options);
}

/**
 * Converts CMYK values (0–100 each) to Hue₃₂.
 * Uses a neutral RGB profile — for ICC-profiled print, convert to RGB
 * using your profile first and pass to rgbToHue32().
 * @param {number} c - Cyan (0–100)
 * @param {number} m - Magenta (0–100)
 * @param {number} y - Yellow (0–100)
 * @param {number} k - Key/Black (0–100)
 * @param {object} [options]
 * @returns {Hue32Color}
 */
function cmykToHue32(c, m, y, k, options = {}) {
  const cn = c / 100, mn = m / 100, yn = y / 100, kn = k / 100;
  const r = Math.round(255 * (1 - cn) * (1 - kn));
  const g = Math.round(255 * (1 - mn) * (1 - kn));
  const b = Math.round(255 * (1 - yn) * (1 - kn));
  return rgbToHue32(r, g, b, options);
}

/**
 * Converts a Hue₃₂ color back to sRGB (0–255 each).
 * Colors outside the sRGB gamut are clipped.
 * @param {Hue32Color} color
 * @returns {{ r: number, g: number, b: number, outOfGamut: boolean }}
 */
function hue32ToRgb(color) {
  const L = _fromScale(color.shade, L_MIN, L_MAX);
  const C = color.tone > 0 ? _fromScale(color.tone, C_MIN, C_MAX) : 0;
  const H = _componentsToAngle(
    color.huePrimary, color.huePrimaryVal,
    color.hueSecondary, color.hueSecondaryVal
  );

  // Check gamut before clipping
  const [rRaw, gRaw, bRaw] = _oklchToRgb(L, C, H);
  const outOfGamut = rRaw < 0 || rRaw > 255 || gRaw < 0 || gRaw > 255 || bRaw < 0 || bRaw > 255;

  return {
    r: Math.max(0, Math.min(255, rRaw)),
    g: Math.max(0, Math.min(255, gRaw)),
    b: Math.max(0, Math.min(255, bRaw)),
    outOfGamut,
  };
}

/**
 * Converts a Hue₃₂ color to a hex string.
 * @param {Hue32Color} color
 * @returns {{ hex: string, outOfGamut: boolean }}
 */
function hue32ToHex(color) {
  const { r, g, b, outOfGamut } = hue32ToRgb(color);
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
  return { hex, outOfGamut };
}

/**
 * Converts a Hue₃₂ color to CMYK (0–100 each).
 * @param {Hue32Color} color
 * @returns {{ c: number, m: number, y: number, k: number, outOfGamut: boolean }}
 */
function hue32ToCmyk(color) {
  const { r, g, b, outOfGamut } = hue32ToRgb(color);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 0.9999) return { c: 0, m: 0, y: 0, k: 100, outOfGamut };
  return {
    c: Math.round((1 - rn - k) / (1 - k) * 100),
    m: Math.round((1 - gn - k) / (1 - k) * 100),
    y: Math.round((1 - bn - k) / (1 - k) * 100),
    k: Math.round(k * 100),
    outOfGamut,
  };
}

/**
 * Parses a Hue₃₂ notation string into a Hue32Color object.
 * Accepts strings like "H:R23Y9 S:24 T:15 L:0 F:0" or abbreviated "R23Y9 24 15".
 * @param {string} notation
 * @returns {Hue32Color}
 */
function parseHue32(notation) {
  const axisMap = {};

  // Try labeled format: H:... S:... T:... L:... F:...
  const labeled = notation.match(/([HSTLF]):([^\s]+)/g);
  if (labeled) {
    labeled.forEach(part => {
      const [axis, val] = part.split(':');
      axisMap[axis] = val;
    });
  }

  const hueStr = axisMap.H || '';
  const shade = parseFloat(axisMap.S) || 0;
  const tone  = parseFloat(axisMap.T) || 0;
  const luster = parseFloat(axisMap.L) || 0;
  const fluorescence = parseFloat(axisMap.F) || 0;

  let huePrimary = null, huePrimaryVal = 0;
  let hueSecondary = null, hueSecondaryVal = 0;

  if (hueStr && hueStr.toLowerCase() !== 'none') {
    const parts = [...hueStr.matchAll(/([RYGCBM])(\d+(?:\.\d+)?)/gi)];
    if (parts.length >= 1) {
      const letter = parts[0][1].toUpperCase();
      const val = parseFloat(parts[0][2]);
      if (RGB_PRIMARIES.includes(letter)) {
        huePrimary = letter; huePrimaryVal = val;
      } else {
        hueSecondary = letter; hueSecondaryVal = val;
      }
    }
    if (parts.length >= 2) {
      const letter = parts[1][1].toUpperCase();
      const val = parseFloat(parts[1][2]);
      if (YCM_SECONDARIES.includes(letter)) {
        hueSecondary = letter; hueSecondaryVal = val;
      } else {
        huePrimary = letter; huePrimaryVal = val;
      }
    }
  }

  return new Hue32Color({
    huePrimary, huePrimaryVal,
    hueSecondary, hueSecondaryVal,
    shade, tone, luster, fluorescence,
  });
}

/**
 * Validates round-trip accuracy for an RGB color.
 * Converts RGB → Hue₃₂ → RGB and measures the perceptual difference.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {'hue32'|'hue64'|'hue192'} [tier='hue32']
 * @returns {{ notation: string, original: number[], recovered: number[], deltaE: number, tolerance: number, pass: boolean }}
 */
function validateRoundTrip(r, g, b, tier = 'hue32') {
  const hc = rgbToHue32(r, g, b);
  const { r: r2, g: g2, b: b2 } = hue32ToRgb(hc);
  const de = _deltaE(r, g, b, r2, g2, b2);
  const tolerance = DELTA_E[tier] ?? DELTA_E.hue32;
  return {
    notation:  hc.toString(),
    original:  [r, g, b],
    recovered: [r2, g2, b2],
    deltaE:    Math.round(de * 1e6) / 1e6,
    tolerance,
    pass:      de < tolerance,
  };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export {
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
  SNAP,
};

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
