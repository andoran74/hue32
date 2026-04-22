# Hue₃₂

**A human-readable color notation system. Every code tells you what color it is.**

[![Live Demo](https://img.shields.io/badge/demo-hue32.studio-1F3864?style=flat-square)](https://hue32.studio)
[![npm](https://img.shields.io/npm/v/hue32?style=flat-square&color=CC3534)](https://www.npmjs.com/package/hue32)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-C8A84B?style=flat-square)](LICENSE)
[![Specification](https://img.shields.io/badge/spec-v1.4-34C759?style=flat-square)](hue32_specification.pdf)

---

## The Problem

Color codes are opaque. `#4B0082` tells you nothing. `C42 M100 Y0 K49` tells you nothing. Even experienced designers have to paste hex codes into a color picker to see what they're looking at.

Color names are the opposite problem — they're ambiguous. "Indigo" means something slightly different to everyone who uses it. Newton inserted it into the rainbow in the 17th century to match the seven notes of the musical scale, and we've been arguing about what color it actually is ever since.

Hue₃₂ solves both problems. It gives colors **coordinates instead of names** — precise enough to be unambiguous, readable enough to decode without tools.

---

## The Notation

A Hue₃₂ code has five axes, all on a 1–32 scale:

```
H:B13M19  S:12  T:15  L:0  F:0
```

| Axis | Name | Scale | Meaning |
|------|------|-------|---------|
| **H** | Hue | RYGCBM wheel | Two adjacent color components summing to 32 |
| **S** | Shade | 1–32 | 1 = black, 16 = medium, 32 = white |
| **T** | Tone | 1–32 | 1 = gray, 16 = moderate, 32 = vivid |
| **L** | Luster | 1–32 | 1 = matte, 32 = glossy |
| **F** | Fluorescence | 1–32 | 1 = none, 32 = intensely fluorescent |

**0 = not encoded** on any axis — distinct from 16 (the explicit midpoint).

The first three axes — Hue, Shade, Tone — are **Color Axes**, derivable from any digital color source. The last two — Luster and Fluorescence — are **Material Axes**, requiring physical measurement. Digital sources produce L:0 F:0, which is honest about what they can't know.

### Reading a code

```
H:B13M19  S:12  T:15  L:0  F:0
```

- **B13M19** — 13 parts blue, 19 parts magenta. More magenta than blue, leaning purple.
- **S:12** — dark
- **T:15** — moderately vivid
- **L:0** — luster not encoded (digital source)
- **F:0** — fluorescence not encoded

That's indigo. You knew that before looking it up.

### More examples

| Color | RGB | Hue₃₂ | What it tells you |
|-------|-----|--------|-------------------|
| Orange | #FF8000 | H:R23Y9 S:24 T:15 | mostly red, some yellow · medium-light · moderate |
| Indigo | #4B0082 | H:B13M19 S:12 T:15 | mostly magenta, some blue · dark · moderate |
| Pastel pink | #FFB6C1 | H:R21M11 S:27 T:8 | mostly red, some magenta · light · soft |
| Mid gray | #808080 | H:none S:20 T:0 | achromatic · medium |
| Pure red | #FF0000 | H:R32 S:20 T:21 | pure red · medium · vivid |

---

## Installation

```bash
npm install hue32
```

No dependencies. Works in Node.js 16+ and all modern browsers via ESM.

---

## Why This Matters

The same color, described in Hue₃₂, means the same thing to:

- A **paint manufacturer** measuring a physical chip with a spectrophotometer
- A **textile buyer** matching fabric across suppliers
- A **screen designer** working in sRGB
- A **makeup artist** coordinating a collection across product lines
- A **print shop** converting between CMYK workflows

No lookup tables. No license fees. No proprietary system. Just coordinates.

---

## Case Study: Dress to Handbag

A blue-and-white floral print dress. Ten candidate handbags. Four lighting conditions (studio white, warm indoor, outdoor daylight, mixed ambient). The dominant blue of the dress samples to `#12326C` — which, in Hue₃₂, is `H:B21M11 S:11 T:10`: about 65% blue, 35% magenta, dark, softly saturated.

Color names failed: every candidate was called "navy" or "blue" somewhere. Hex codes failed: the same bag photographed under two lighting conditions produced visibly different values. But Hue₃₂ found the match:

| Item | Hue₃₂ | Why |
|------|--------|-----|
| Dress (reference) | H:B21M11 S:11 T:10 | — |
| KS wristlet (white bg) | H:B19M13 S:14 T:10 | **Best match** — identical tone, nearest hue ratio |
| KS teal messenger | H:B31C1 S:16 T:6 | Eliminated — cyan secondary, wrong family |
| KS tassel crossbody | H:B16M16 S:11 T:16 | Eliminated — equal B/M = violet |
| KS hobo (two-tone) | H:B19M13 S:16 T:4 | Right hue, but T:4 is near-gray |

Three properties made this work. (1) The Hue axis eliminates fast — a wrong secondary letter is immediately visible. (2) Hue is stable across lighting conditions where shade and tone shift, so practitioners can compare hue family membership across photos taken in different conditions. (3) Axis-level comparison wins close calls — the hobo bag matched hue exactly but was eliminated on tone alone.

See the full case study at [hue32.studio](https://hue32.studio#case-study).

---

## Reference Space

Hue₃₂ is anchored to **OKLCh** (the cylindrical form of OKLab), chosen for perceptual uniformity across the full gamut — including the blue region where CIE L\*C\*H\* is known to be non-uniform. OKLCh is already used in CSS Color Level 4.

Axis calibration:
- **L** (lightness): 0.0–1.0 → S:1–32
- **C** (chroma): 0.0–0.4 → T:1–32 (ceiling above sRGB gamut for physical pigments)
- **H** (hue angle): six-segment RYGCBM wheel

---

## Precision Tiers

The base system uses integer steps. Higher tiers subdivide without changing the format:

| Tier | Step | Positions | Round-trip tolerance |
|------|------|-----------|---------------------|
| Hue₃₂ | 1 | 32 per axis | ΔE < 0.0323 |
| Hue₆₄ | 0.5 | 64 per axis | ΔE < 0.0161 |
| Hue₁₉₂ | 0.25 | 192 per axis | ΔE < 0.0081 |

Hue₃₂ ⊂ Hue₆₄ ⊂ Hue₁₉₂ — every integer value is valid at any tier.

---

## Reference Implementation

`hue32.py` is the Python reference implementation. A JavaScript package is also available on npm.

### JavaScript (npm)

```bash
npm install hue32
```

```javascript
import { hexToHue32, hue32ToHex, rgbToHue32 } from 'hue32';

hexToHue32('#FF8000').toString()
// "H:R23Y9 S:24 T:15 L:0 F:0"

hexToHue32('#4B0082').toString()
// "H:B13M19 S:12 T:15 L:0 F:0"
```

### CSS Polyfill

Download `hue32-polyfill.js` and add one script tag:

```html
<script src="hue32-polyfill.js"></script>
```

Then use `hue32()` anywhere in your CSS:

```css
color:      hue32(R23Y9, 24, 15);
background: hue32(none, 31, 0);
--brand:    hue32(B32, 12, 20);
```

### Python

`hue32.py` is the Python reference implementation. It requires `colour-science`:

```bash
pip install colour-science
```

### Convert from RGB

```python
from hue32 import rgb_to_hue32

hc = rgb_to_hue32(75, 0, 130)
print(hc.notation())
# H:B13M19 S:12 T:15 L:0 F:0
```

### Convert from hex

```python
from hue32 import hex_to_hue32

hc = hex_to_hue32('#FF8000')
print(hc.notation())
# H:R23Y9 S:24 T:15 L:0 F:0
```

### Convert from CMYK

```python
from hue32 import cmyk_to_hue32

hc = cmyk_to_hue32(0.0, 0.5, 1.0, 0.0)
print(hc.notation())
# H:R23Y9 S:24 T:15 L:0 F:0
```

### Convert back to RGB

```python
from hue32 import hue32_to_rgb

r, g, b, out_of_gamut = hue32_to_rgb(hc)
print(r, g, b)
# 255 128 0
```

### Validate round-trip accuracy

```python
from hue32 import validate_round_trip

result = validate_round_trip(75, 0, 130)
print(result['notation'])   # H:B13M19 S:12 T:15 L:0 F:0
print(result['delta_e'])    # 0.0
print(result['pass'])       # True
```

---

## Named Colors

Hue₃₂ defines exactly nine named color anchors. All other color names are outside the scope of the specification — they are positions on the scale, not names defined by this system.

| Name | Hue₃₂ |
|------|--------|
| red | H:R32 |
| yellow | H:Y32 |
| green | H:G32 |
| cyan | H:C32 |
| blue | H:B32 |
| magenta | H:M32 |
| white | S:32 T:0 |
| black | S:1 T:0 |
| gray | S:16 T:0 |

Your personal definitions sit naturally within the system. For example, different people place "indigo" in different places on the wheel:

```
B24M8     blue-leaning indigo (closer to Newton's original)
B13M19    magenta-leaning indigo (what #4B0082 actually computes to)
B16M16    exact midpoint — sometimes called violet
B8M24     purple — magenta-leaning, past the midpoint
```

The point of Hue₃₂ isn't to settle which one is "right." It's to let everyone state precisely which one they mean.

---

## Repository Contents

| File | Description |
|------|-------------|
| `hue32.py` | Python reference implementation |
| `npm/index.js` | JavaScript package (also on npm as `hue32`) |
| `npm/index.d.ts` | TypeScript type definitions |
| `npm/test.js` | Test suite (28 tests) |
| `hue32-polyfill.js` | CSS polyfill — use `hue32()` in stylesheets today |
| `hue32-polyfill-demo.html` | Polyfill demo page |
| `hue32_specification.pdf` | Full specification (v1.4) |
| `demo/index.html` | Interactive web demo (also at hue32.studio) |
| `LICENSE` | CC BY-NC 4.0 |

---

## Live Demo

**[hue32.studio](https://hue32.studio)** — paste any hex code, enter RGB or CMYK, or click the wheel to explore the color space interactively.

---

## Specification

The full specification (v1.4) covers the mathematical reference space, axis definitions, hue wheel geometry, precision tiers, conformance requirements, conversion pseudocode, and the scaling system. Available as a PDF in this repository and at [hue32.studio](https://hue32.studio).

---

## License

This work is licensed under [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](LICENSE).

You are free to use, share, and adapt Hue₃₂ for **non-commercial purposes** as long as you give appropriate credit. Commercial use requires a separate license — see below.

**Suggested attribution:**  
*Hue₃₂ Color Notation System by Angel Doran, licensed under CC BY-NC 4.0. https://hue32.studio*

**Commercial licensing:**  
To use Hue₃₂ in a commercial product or service, contact angel@angeldoran.com.

---

## Contributing

Found a bug in the reference implementation? Open an issue with the input color, the result you got, and what you expected. The [Report a Problem](https://hue32.studio) button on the demo site pre-fills this information automatically.

Pull requests for additional language implementations (JavaScript, Swift, Kotlin, etc.) are welcome.