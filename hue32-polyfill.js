/**
 * Hue₃₂ CSS Polyfill v1.0
 * ========================
 * Enables the hue32() color function in CSS before native browser support.
 *
 * Usage:
 *   <script src="hue32-polyfill.js"></script>
 *
 * Then use hue32() anywhere in your CSS:
 *   color:            hue32(R23Y9, 24, 15);
 *   background-color: hue32(B32, 9, 20);
 *   border:           1px solid hue32(none, 20, 0);
 *   --brand-color:    hue32(R23Y9, 24, 15);
 *
 * Syntax:
 *   hue32(hue, shade, tone)
 *   hue32(hue, shade, tone, luster)
 *   hue32(hue, shade, tone, luster, fluorescence)
 *
 * Where:
 *   hue   — RYGCBM components summing to 32, e.g. R23Y9, B32, none
 *   shade — 1–32 (1=black, 32=white)
 *   tone  — 1–32 (1=gray, 32=vivid) or 0 for achromatic
 *   luster, fluorescence — 1–32 or 0 (not encoded, ignored for display)
 *
 * License: CC BY 4.0 — Angel Doran — https://hue32.studio
 */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // Hue₃₂ Core Math (OKLCh reference space)
  // ─────────────────────────────────────────────────────────────

  const L_MIN = 0, L_MAX = 1;
  const C_MIN = 0, C_MAX = 0.4;
  const HSTF_MIN = 1, HSTF_MAX = 32;
  const SNAP = 0.25;
  const ACHROMATIC_THRESH = SNAP * (C_MAX - C_MIN) / (HSTF_MAX - HSTF_MIN);

  const HUE_ANGLES = { R: 0, Y: 60, G: 120, C: 180, B: 240, M: 300 };
  const HUE_ANCHORS = ['R', 'Y', 'G', 'C', 'B', 'M'];

  const HUE_ARCS = [
    { primary: 'R', secondary: 'Y', reverse: false },
    { primary: 'G', secondary: 'Y', reverse: true  },
    { primary: 'G', secondary: 'C', reverse: false },
    { primary: 'B', secondary: 'C', reverse: true  },
    { primary: 'B', secondary: 'M', reverse: false },
    { primary: 'R', secondary: 'M', reverse: true  },
  ];

  function snap(v) {
    if (v < SNAP) return 0;
    if (v > HSTF_MAX - SNAP) return HSTF_MAX;
    return Math.round(v * 4) / 4;
  }

  function fromHue32Scale(val, vmin, vmax) {
    if (val === 0) return vmin;
    return vmin + (val - HSTF_MIN) / (HSTF_MAX - HSTF_MIN) * (vmax - vmin);
  }

  function normalizeDeg(d) {
    return ((d % 360) + 360) % 360;
  }

  function componentsToAngle(p, pv, s, sv) {
    if (!p && !s) return 0;
    if (!s || sv < SNAP) return HUE_ANGLES[p];
    if (!p || pv < SNAP) return HUE_ANGLES[s];
    const total = pv + sv;
    const t = pv / total;
    let pa = HUE_ANGLES[p], sa = HUE_ANGLES[s];
    if ((p === 'G' && s === 'Y') || (p === 'B' && s === 'C') || (p === 'R' && s === 'M')) {
      if (p === 'R' && s === 'M' && sa > pa) sa -= 360;
      return normalizeDeg(sa + t * (pa - sa));
    }
    return normalizeDeg(pa + t * (sa - pa));
  }

  function srgbLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearSrgb(c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function oklchToRgb(L, C, H) {
    const a = C * Math.cos(H * Math.PI / 180);
    const b = C * Math.sin(H * Math.PI / 180);
    let lc = L + 0.3963377774 * a + 0.2158037573 * b;
    let mc = L - 0.1055613458 * a - 0.0638541728 * b;
    let sc = L - 0.0894841775 * a - 1.2914855480 * b;
    let l = lc * lc * lc, m = mc * mc * mc, s = sc * sc * sc;
    const rl =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    return [
      Math.round(Math.max(0, Math.min(1, linearSrgb(rl))) * 255),
      Math.round(Math.max(0, Math.min(1, linearSrgb(gl))) * 255),
      Math.round(Math.max(0, Math.min(1, linearSrgb(bl))) * 255),
    ];
  }

  function hue32ToHex(hueStr, shade, tone) {
    shade = parseFloat(shade) || 0;
    tone  = parseFloat(tone)  || 0;

    const L = fromHue32Scale(shade, L_MIN, L_MAX);
    let C = 0, H = 0;

    if (tone > 0 && hueStr.toLowerCase() !== 'none') {
      C = fromHue32Scale(tone, C_MIN, C_MAX);

      // Parse hue string — e.g. "R23Y9", "B32", "G16C16"
      const matches = [...hueStr.matchAll(/([RYGCBM])(\d+(?:\.\d+)?)/gi)];
      let p = null, pv = 0, s = null, sv = 0;

      if (matches.length >= 1) {
        p  = matches[0][1].toUpperCase();
        pv = parseFloat(matches[0][2]);
      }
      if (matches.length >= 2) {
        s  = matches[1][1].toUpperCase();
        sv = parseFloat(matches[1][2]);
      }

      // Validate primary is RGB, secondary is YCM
      const RGB = ['R', 'G', 'B'];
      const YCM = ['Y', 'C', 'M'];
      if (p && !RGB.includes(p) && YCM.includes(p)) {
        // Swap if user put secondary first
        [p, s] = [s, p];
        [pv, sv] = [sv, pv];
      }

      H = componentsToAngle(p, pv, s, sv);
    }

    const [r, g, b] = oklchToRgb(L, C, H);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
  }

  // ─────────────────────────────────────────────────────────────
  // CSS Parser — finds and replaces hue32() calls
  // ─────────────────────────────────────────────────────────────

  // Matches: hue32(R23Y9, 24, 15) or hue32(none, 20, 0) or hue32(B32, 9, 20, 16, 0)
  const HUE32_REGEX = /hue32\(\s*([A-Za-z0-9]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?(?:\s*,\s*[\d.]+)?\s*\)/gi;

  function processCSS(css) {
    return css.replace(HUE32_REGEX, (match, hue, shade, tone) => {
      try {
        return hue32ToHex(hue, shade, tone);
      } catch (e) {
        console.warn('[hue32-polyfill] Could not parse:', match, e);
        return match;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Stylesheet Processing
  // ─────────────────────────────────────────────────────────────

  function processStyleElement(el) {
    if (el._hue32processed) return;
    const original = el.textContent;
    if (!original.includes('hue32(')) return;
    el.textContent = processCSS(original);
    el._hue32processed = true;
  }

  function processAllStyles() {
    document.querySelectorAll('style').forEach(processStyleElement);
  }

  // Also process inline style attributes on elements
  function processInlineStyles() {
    document.querySelectorAll('[style*="hue32("]').forEach(el => {
      if (el._hue32inlineprocessed) return;
      el.setAttribute('style', processCSS(el.getAttribute('style')));
      el._hue32inlineprocessed = true;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Public API — set CSS custom properties from Hue₃₂
  // ─────────────────────────────────────────────────────────────

  /**
   * Set a CSS custom property using Hue₃₂ values.
   *
   * window.Hue32.set('--brand-color', 'R23Y9', 24, 15);
   * window.Hue32.set('--bg', 'none', 31, 0);
   */
  function set(property, hue, shade, tone, element) {
    const hex = hue32ToHex(hue, shade, tone);
    (element || document.documentElement).style.setProperty(property, hex);
    return hex;
  }

  /**
   * Convert a Hue₃₂ notation to a hex string.
   *
   * window.Hue32.toHex('R23Y9', 24, 15) // '#FF8000'
   */
  function toHex(hue, shade, tone) {
    return hue32ToHex(hue, shade, tone);
  }

  /**
   * Apply a Hue₃₂ color map to CSS custom properties.
   *
   * window.Hue32.apply({
   *   '--brand':      ['R23Y9', 24, 15],
   *   '--background': ['none',  31,  0],
   *   '--text':       ['none',   2,  0],
   * });
   */
  function apply(colorMap, element) {
    const root = element || document.documentElement;
    Object.entries(colorMap).forEach(([prop, [hue, shade, tone]]) => {
      root.style.setProperty(prop, hue32ToHex(hue, shade, tone));
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────

  function init() {
    processAllStyles();
    processInlineStyles();

    // Watch for dynamically added style elements
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'STYLE') processStyleElement(node);
          if (node.nodeType === 1) {
            node.querySelectorAll('style').forEach(processStyleElement);
            if (node.getAttribute && node.getAttribute('style') &&
                node.getAttribute('style').includes('hue32(')) {
              node.setAttribute('style', processCSS(node.getAttribute('style')));
            }
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Run as early as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.Hue32 = { set, toHex, apply, version: '1.0' };

  console.log('[hue32-polyfill] v1.0 loaded — hue32() is now available in CSS');

})();

