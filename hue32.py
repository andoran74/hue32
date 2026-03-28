"""
Hue₃₂ Color Notation System  —  v1.2
======================================
A human-readable, device-independent color notation built on OKLCh.

Reference space: OKLCh (Oklab cylindrical), chosen for perceptual uniformity
across the full color gamut including the blue region where CIE L*C*H* is
known to be non-uniform.

Four axes, all on a 1–32 scale:
  H  Hue:    Two adjacent RYGCBM components summing to 32
             RGB primary always first, YCM secondary always second.
             Valid pairs: R/Y, R/M, G/Y, G/C, B/C, B/M
  S  Shade:  1 = black, 32 = white  (maps to OKLCh L, range 0–1)
  T  Tone:   1 = gray,  32 = vivid  (maps to OKLCh C, range 0–0.4)
  L  Luster:     1 = matte,  32 = glossy
             0 = not encoded (distinct from 16 = explicit midpoint)
             Derivable from physical gloss measurement; not from digital formats.
  F  Fluorescence: 1 = none, 32 = intensely fluorescent
             0 = not encoded
             Activated by UV; relevant for paint, textiles, makeup, nail polish.

Value semantics:
  0          = not encoded — no conversion performed, treated as absent
  0.25–32    = valid range (Hue₁₉₂ minimum to maximum)
  16         = explicit midpoint, converts normally

Snap rule:
  Any computed component value below 0.25 is set to 0 (not encoded).
  This is the Hue₁₉₂ minimum step — values below it are not meaningful
  at any defined precision tier.

Precision tiers:
  Hue₃₂   integer steps    delta-E < 0.0323  (one L step in OKLab)
  Hue₆₄   0.5 steps        delta-E < 0.0161
  Hue₁₉₂  0.25 steps       delta-E < 0.0081

Nine named colors:
  R (red), Y (yellow), G (green), C (cyan), B (blue), M (magenta),
  white (S:32 T:0), black (S:1 T:0), gray (S:16 T:0)
  All other color names are outside the scope of this specification.

Conversion path:
  RGB / HEX --|
  CMYK       --+-> CIE XYZ -> OKLab -> OKLCh -> Hue32
  OKLab      --|

  Hue32 -> OKLCh -> OKLab -> CIE XYZ -> RGB / CMYK

Dependencies:
  colour-science  (pip install colour-science)

License:
  CC BY-NC 4.0 — non-commercial use only.
  Commercial licensing: angel@angeldoran.com
"""

import colour
import numpy as np
from dataclasses import dataclass
from typing import Optional


# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------

# RGB primaries always occupy first (primary) position.
# YCM secondaries always occupy second position.
RGB_PRIMARIES   = ['R', 'G', 'B']
YCM_SECONDARIES = ['Y', 'C', 'M']

# Fixed valid pairs: primary -> [secondary, secondary]
VALID_PAIRS = {
    'R': ['Y', 'M'],
    'G': ['Y', 'C'],
    'B': ['C', 'M'],
}

# All six hue names in wheel order
HUE_NAMES = ['R', 'Y', 'G', 'C', 'B', 'M']

# OKLCh hue angles for each named color, derived from sRGB primaries/secondaries
# converted through XYZ -> OKLab -> OKLCh. Using exact values ensures pure hues
# land precisely on segment boundaries.
HUE_ANGLES = {
    'R':  29.2232,
    'Y': 109.7828,
    'G': 142.5112,
    'C': 194.8069,
    'B': 264.0729,
    'M': 328.3520,
}

# OKLCh axis calibration ranges
L_MIN, L_MAX = 0.0, 1.0    # OKLCh L: 0 (black) to 1 (white)
C_MIN, C_MAX = 0.0, 0.4    # OKLCh C: 0 (gray) to 0.4 (above sRGB ceiling)

HSTF_MIN = 1
HSTF_MAX = 32

# Snap threshold: the Hue192 minimum step.
# Any computed value below this becomes 0 (not encoded).
SNAP_THRESHOLD = 0.25

# Achromatic threshold: colors with chroma below 0.25 of one Tone step
# are treated as having no encodable hue.
_TONE_STEP = (C_MAX - C_MIN) / (HSTF_MAX - HSTF_MIN)
ACHROMATIC_THRESHOLD = SNAP_THRESHOLD * _TONE_STEP  # ~0.003226 in OKLCh C

# Round-trip conformance tolerances (OKLab Euclidean distance).
# Equal to one step size per tier.
DELTA_E_HUE32  = (L_MAX - L_MIN) / (HSTF_MAX - HSTF_MIN)  # ~0.0323
DELTA_E_HUE64  = DELTA_E_HUE32 / 2                          # ~0.0161
DELTA_E_HUE192 = DELTA_E_HUE32 / 4                          # ~0.0081

# Precision tier step sizes
PRECISION_HUE32  = 1
PRECISION_HUE64  = 0.5
PRECISION_HUE192 = 0.25


# -----------------------------------------------------------------------------
# Data structure
# -----------------------------------------------------------------------------

@dataclass
class Hue32Color:
    """
    A color in Hue32 notation.

    All axes use the 1-32 scale. 0 means not encoded -- no conversion is
    performed for that axis. This is distinct from 16, which is the explicit
    midpoint and converts normally.

    Luster is populated from physical gloss measurement data. When converting
    from digital-only sources (RGB, CMYK, hex), luster must be set to 0.

    Fluorescence is activated by UV light. It is not derivable from digital
    color formats. For paint, textiles, and makeup, it should be measured
    and populated directly.
    """
    hue_primary:     Optional[str] = None
    hue_primary_v:   float = 0
    hue_secondary:   Optional[str] = None
    hue_secondary_v: float = 0
    shade:  float = 0
    tone:   float = 0
    luster:       float = 0   # 1=matte,  32=glossy,             0=not encoded
    fluorescence: float = 0   # 1=none,   32=intensely fluorescent, 0=not encoded

    def hue_string(self, precision: float = PRECISION_HUE32) -> str:
        """
        Returns the human-readable hue string at the specified precision tier.
        Components with value 0 (not encoded) are omitted.
        Primary always appears before secondary.
        """
        def fmt(v: float) -> str:
            rounded = round(v / precision) * precision
            return str(int(rounded)) if rounded == int(rounded) else str(rounded)

        parts = []
        if self.hue_primary and self.hue_primary_v >= SNAP_THRESHOLD:
            parts.append(f"{self.hue_primary}{fmt(self.hue_primary_v)}")
        if self.hue_secondary and self.hue_secondary_v >= SNAP_THRESHOLD:
            parts.append(f"{self.hue_secondary}{fmt(self.hue_secondary_v)}")
        return ''.join(parts)

    def notation(self, precision: float = PRECISION_HUE32) -> str:
        """Returns a full Hue32 notation string at the specified precision."""
        def fmt(v):
            if v == 0:
                return '0'
            rounded = round(v / precision) * precision
            return str(int(rounded)) if rounded == int(rounded) else str(rounded)

        h = self.hue_string(precision) or 'none'
        return f"H:{h} S:{fmt(self.shade)} T:{fmt(self.tone)} L:{fmt(self.luster)} F:{fmt(self.fluorescence)}"

    def __str__(self) -> str:
        return self.notation()

    def is_achromatic(self) -> bool:
        """True if this color has no encodable hue information."""
        return self.tone == 0 or self.tone < SNAP_THRESHOLD


# -----------------------------------------------------------------------------
# Scale helpers
# -----------------------------------------------------------------------------

def _to_hue32(value: float, v_min: float, v_max: float) -> float:
    """Scales from [v_min, v_max] to [1, 32]."""
    normalized = (value - v_min) / (v_max - v_min)
    return 1.0 + normalized * (HSTF_MAX - HSTF_MIN)


def _from_hue32(hue32_value: float, v_min: float, v_max: float) -> float:
    """
    Scales from [1, 32] back to [v_min, v_max].
    A value of 0 (not encoded) returns v_min as a conservative default.
    """
    if hue32_value == 0:
        return v_min
    normalized = (hue32_value - HSTF_MIN) / (HSTF_MAX - HSTF_MIN)
    return v_min + normalized * (v_max - v_min)


def _snap(value: float) -> float:
    """
    Applies the snap rule:
    - Values below SNAP_THRESHOLD (0.25) become 0 (not encoded).
    - Values within SNAP_THRESHOLD of HSTF_MAX snap up to HSTF_MAX.
    """
    if value < SNAP_THRESHOLD:
        return 0.0
    if value > HSTF_MAX - SNAP_THRESHOLD:
        return float(HSTF_MAX)
    return value


# -----------------------------------------------------------------------------
# Hue angle <-> Hue32 components
# -----------------------------------------------------------------------------

# Six segments connecting one RGB primary to one adjacent YCM secondary.
# Tuple: (rgb_primary, ycm_secondary, start_angle, end_angle, rgb_at_start)
# rgb_at_start=True:  t=0 -> all RGB,  t=1 -> all YCM
# rgb_at_start=False: t=0 -> all YCM,  t=1 -> all RGB
_SEGMENTS = [
    ('R', 'Y', HUE_ANGLES['R'], HUE_ANGLES['Y'],         True),
    ('G', 'Y', HUE_ANGLES['Y'], HUE_ANGLES['G'],         False),
    ('G', 'C', HUE_ANGLES['G'], HUE_ANGLES['C'],         True),
    ('B', 'C', HUE_ANGLES['C'], HUE_ANGLES['B'],         False),
    ('B', 'M', HUE_ANGLES['B'], HUE_ANGLES['M'],         True),
    ('R', 'M', HUE_ANGLES['M'], HUE_ANGLES['R'] + 360.0, False),  # wraparound
]


def _angle_to_components(hue_degrees: float) -> tuple:
    """
    Converts an OKLCh hue angle (0-360) to Hue32 hue components.
    RGB primary is always first; YCM secondary is always second.
    Returns: (rgb_name, rgb_value, ycm_name, ycm_value)
    """
    hue_degrees = hue_degrees % 360.0

    for rgb, ycm, a_start, a_end, rgb_at_start in _SEGMENTS:
        test = hue_degrees if hue_degrees >= a_start else hue_degrees + 360.0
        if a_start <= test <= a_end:
            span = a_end - a_start
            t = (test - a_start) / span if span > 0 else 0.0
            t = max(0.0, min(1.0, t))

            if rgb_at_start:
                rgb_val = (1.0 - t) * HSTF_MAX
                ycm_val = t * HSTF_MAX
            else:
                rgb_val = t * HSTF_MAX
                ycm_val = (1.0 - t) * HSTF_MAX

            rgb_val = _snap(rgb_val)
            ycm_val = _snap(ycm_val)

            rgb_name = rgb if rgb_val > 0 else None
            ycm_name = ycm if ycm_val > 0 else None
            return rgb_name, rgb_val, ycm_name, ycm_val

    return 'R', float(HSTF_MAX), None, 0.0  # fallback


def _components_to_angle(
    primary: Optional[str], primary_v: float,
    secondary: Optional[str], secondary_v: float
) -> float:
    """
    Converts Hue32 hue components back to an OKLCh hue angle (0-360).
    Each pair has a known angular direction. R/M is the only wraparound.
    """
    if not primary and not secondary:
        return 0.0
    if not secondary or secondary_v == 0:
        return HUE_ANGLES[primary]
    if not primary or primary_v == 0:
        return HUE_ANGLES[secondary]

    total = primary_v + secondary_v
    t = secondary_v / total

    p_angle = HUE_ANGLES[primary]
    s_angle = HUE_ANGLES[secondary]

    if primary == 'G' and secondary == 'Y':
        angle = s_angle + t * (p_angle - s_angle)
    elif primary == 'B' and secondary == 'C':
        angle = s_angle + t * (p_angle - s_angle)
    elif primary == 'R' and secondary == 'M':
        # Wraparound through 0: extend R past 360 for clean interpolation
        r_extended = p_angle + 360.0
        angle = s_angle + t * (r_extended - s_angle)
    else:
        # R/Y, G/C, B/M: monotonically increasing
        angle = p_angle + t * (s_angle - p_angle)

    return angle % 360.0


# -----------------------------------------------------------------------------
# OKLCh <-> Hue32
# -----------------------------------------------------------------------------

def oklch_to_hue32(L: float, C: float, H: float,
                   luster: float = 0,
                   fluorescence: float = 0) -> Hue32Color:
    """
    Converts OKLCh values to Hue32 notation.

    L: lightness  0-1
    C: chroma     0-0.4 (values above sRGB gamut valid for physical colors)
    H: hue angle  0-360
    luster: 0 = not encoded (default for digital sources)
    fluorescence: 0 = not encoded (default for digital sources)
    """
    shade = _snap(_to_hue32(L, L_MIN, L_MAX))

    # Achromatic: chroma below snap threshold of one Tone step
    if C < ACHROMATIC_THRESHOLD:
        return Hue32Color(shade=round(shade, 4), tone=0,
                         luster=luster, fluorescence=fluorescence)

    tone = _snap(_to_hue32(C, C_MIN, C_MAX))
    p_name, p_val, s_name, s_val = _angle_to_components(H)

    return Hue32Color(
        hue_primary=p_name,
        hue_primary_v=round(p_val, 4),
        hue_secondary=s_name,
        hue_secondary_v=round(s_val, 4),
        shade=round(shade, 4),
        tone=round(tone, 4),
        luster=luster,
        fluorescence=fluorescence,
    )


def hue32_to_oklch(color: Hue32Color) -> tuple:
    """
    Converts a Hue32 color back to OKLCh.
    0 (not encoded) returns conservative defaults, not midpoint.
    Returns: (L, C, H)
    """
    L = _from_hue32(color.shade, L_MIN, L_MAX)
    C = _from_hue32(color.tone,  C_MIN, C_MAX) if color.tone > 0 else 0.0
    H = _components_to_angle(
        color.hue_primary,   color.hue_primary_v,
        color.hue_secondary, color.hue_secondary_v,
    )
    if color.tone == 0:
        C = 0.0
    return L, C, H


# -----------------------------------------------------------------------------
# RGB <-> Hue32
# -----------------------------------------------------------------------------

def rgb_to_hue32(r: int, g: int, b: int,
                 luster: float = 0,
                 fluorescence: float = 0) -> Hue32Color:
    """
    Converts sRGB (0-255 each) to Hue32.
    Path: sRGB -> XYZ -> OKLab -> OKLCh -> Hue32
    luster and fluorescence default to 0 (not encoded) for all digital sources.
    """
    rgb_norm = np.array([r / 255.0, g / 255.0, b / 255.0])
    xyz   = colour.sRGB_to_XYZ(rgb_norm)
    oklab = colour.XYZ_to_Oklab(xyz)
    oklch = colour.Oklab_to_Oklch(oklab)
    return oklch_to_hue32(float(oklch[0]), float(oklch[1]),
                          float(oklch[2]), luster, fluorescence)


def hue32_to_rgb(color: Hue32Color) -> tuple:
    """
    Converts Hue32 back to sRGB (0-255 each).
    Path: Hue32 -> OKLCh -> OKLab -> XYZ -> sRGB
    Out-of-gamut colors are clipped; the flag is reported to the caller.
    Returns: (r, g, b, out_of_gamut)
    """
    L, C, H = hue32_to_oklch(color)
    oklch = np.array([L, C, H])
    oklab = colour.Oklch_to_Oklab(oklch)
    xyz   = colour.Oklab_to_XYZ(oklab)
    rgb   = colour.XYZ_to_sRGB(xyz)
    rgb_clipped = np.clip(rgb, 0, 1)
    out_of_gamut = not np.allclose(rgb, rgb_clipped, atol=0.005)
    r2, g2, b2 = (round(float(v) * 255) for v in rgb_clipped)
    return r2, g2, b2, out_of_gamut


def hex_to_hue32(hex_color: str,
                 luster: float = 0,
                 fluorescence: float = 0) -> Hue32Color:
    """Converts a hex color string (e.g. '#FF8000') to Hue32."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return rgb_to_hue32(r, g, b, luster, fluorescence)


def hue32_to_hex(color: Hue32Color) -> tuple:
    """Returns (hex_string, out_of_gamut_flag)."""
    r, g, b, oog = hue32_to_rgb(color)
    return f"#{r:02X}{g:02X}{b:02X}", oog


# -----------------------------------------------------------------------------
# CMYK <-> Hue32
# -----------------------------------------------------------------------------

def cmyk_to_hue32(c: float, m: float, y: float, k: float,
                  luster: float = 0,
                  fluorescence: float = 0) -> Hue32Color:
    """
    Converts CMYK (0.0-1.0 each) to Hue32 via neutral RGB profile.
    For ICC-profiled print, convert to RGB using your profile first.
    luster and fluorescence default to 0 (not encoded) for digital CMYK sources.
    """
    r = (1 - c) * (1 - k)
    g = (1 - m) * (1 - k)
    b = (1 - y) * (1 - k)
    return rgb_to_hue32(round(r * 255), round(g * 255),
                        round(b * 255), luster, fluorescence)


def hue32_to_cmyk(color: Hue32Color) -> tuple:
    """Returns (C, M, Y, K, out_of_gamut_flag)."""
    r, g, b, oog = hue32_to_rgb(color)
    r_n, g_n, b_n = r / 255.0, g / 255.0, b / 255.0
    k = 1 - max(r_n, g_n, b_n)
    if k == 1.0:
        return 0.0, 0.0, 0.0, 1.0, oog
    c = (1 - r_n - k) / (1 - k)
    m = (1 - g_n - k) / (1 - k)
    y = (1 - b_n - k) / (1 - k)
    return round(c, 4), round(m, 4), round(y, 4), round(k, 4), oog


# -----------------------------------------------------------------------------
# Round-trip validation
# -----------------------------------------------------------------------------

def delta_e_oklab(rgb1: tuple, rgb2: tuple) -> float:
    """
    Perceptual color difference between two sRGB colors using Euclidean
    distance in OKLab space. OKLab is designed so this distance is
    perceptually uniform -- equal distances mean equal perceived differences.

    Conformance thresholds:
      < 0.0081  imperceptible  (Hue192)
      < 0.0161  barely visible to experts  (Hue64)
      < 0.0323  just perceptible  (Hue32)
    """
    def to_oklab(r, g, b):
        return colour.XYZ_to_Oklab(
            colour.sRGB_to_XYZ(np.array([r / 255.0, g / 255.0, b / 255.0]))
        )
    return float(np.sqrt(np.sum((to_oklab(*rgb1) - to_oklab(*rgb2)) ** 2)))


def validate_round_trip(r: int, g: int, b: int,
                        precision: float = PRECISION_HUE32) -> dict:
    """
    Converts an RGB color to Hue32 and back, reporting accuracy.
    Returns dict with notation, recovered RGB, delta_e, and pass/fail.
    """
    hc = rgb_to_hue32(r, g, b)
    r2, g2, b2, oog = hue32_to_rgb(hc)
    de = delta_e_oklab((r, g, b), (r2, g2, b2))

    tolerance = {
        PRECISION_HUE32:  DELTA_E_HUE32,
        PRECISION_HUE64:  DELTA_E_HUE64,
        PRECISION_HUE192: DELTA_E_HUE192,
    }.get(precision, DELTA_E_HUE32)

    return {
        'notation':     hc.notation(precision),
        'original':     (r, g, b),
        'recovered':    (r2, g2, b2),
        'delta_e':      round(de, 6),
        'tolerance':    round(tolerance, 4),
        'pass':         de < tolerance,
        'out_of_gamut': oog,
    }


# -----------------------------------------------------------------------------
# Demo
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print("Hue32  v1.2  --  OKLCh reference space")
    print("=" * 76)

    test_colors = [
        ("Pure Red",     (255,   0,   0)),
        ("Orange",       (255, 128,   0)),
        ("Pure Yellow",  (255, 255,   0)),
        ("Pure Green",   (  0, 255,   0)),
        ("Pure Cyan",    (  0, 255, 255)),
        ("Pure Blue",    (  0,   0, 255)),
        ("Pure Magenta", (255,   0, 255)),
        ("White",        (255, 255, 255)),
        ("Black",        (  0,   0,   0)),
        ("Mid Gray",     (128, 128, 128)),
        ("Dark Orange",  (128,  64,   0)),
        ("Pastel Pink",  (255, 182, 193)),
        ("Navy",         ( 10,  20, 100)),
        ("Olive",        (128, 128,   0)),
    ]

    print(f"\n{'Color':<16} {'RGB':<10} {'Hue32 Notation':<32} {'Recovered':<10} {'dE':<8} {'Pass?'}")
    print("-" * 82)

    all_pass = True
    for name, (r, g, b) in test_colors:
        rt = validate_round_trip(r, g, b)
        r2, g2, b2 = rt['recovered']
        oog = " OOG" if rt['out_of_gamut'] else "    "
        status = "OK" if rt['pass'] else "FAIL"
        if not rt['pass']:
            all_pass = False
        print(f"{name:<16} #{r:02X}{g:02X}{b:02X}   {rt['notation']:<32} "
              f"#{r2:02X}{g2:02X}{b2:02X}{oog}  {rt['delta_e']:.5f}  {status}")

    print()
    print(f"Conformance (Hue32, dE < {DELTA_E_HUE32:.4f}): "
          f"{'ALL PASS' if all_pass else 'FAILURES DETECTED'}")

    print(f"\n{'─'*76}")
    print("Precision tiers -- Orange (255,128,0):")
    hc = rgb_to_hue32(255, 128, 0)
    for label, p in [("Hue32", 1), ("Hue64", 0.5), ("Hue192", 0.25)]:
        print(f"  {label:<8}  {hc.notation(p)}")

    print(f"\n{'─'*76}")
    print("CMYK round-trip -- C:0.0 M:0.5 Y:1.0 K:0.0:")
    hc = cmyk_to_hue32(0.0, 0.5, 1.0, 0.0)
    c, m, y, k, oog = hue32_to_cmyk(hc)
    print(f"  Hue32:  {hc.notation()}")
    print(f"  Back:   C:{c} M:{m} Y:{y} K:{k}  {'OOG' if oog else 'OK'}")

    print(f"\n{'─'*76}")
    print("Nine named color anchors:")
    named = [
        ("red",     rgb_to_hue32(255,   0,   0)),
        ("yellow",  rgb_to_hue32(255, 255,   0)),
        ("green",   rgb_to_hue32(  0, 255,   0)),
        ("cyan",    rgb_to_hue32(  0, 255, 255)),
        ("blue",    rgb_to_hue32(  0,   0, 255)),
        ("magenta", rgb_to_hue32(255,   0, 255)),
        ("white",   rgb_to_hue32(255, 255, 255)),
        ("black",   rgb_to_hue32(  0,   0,   0)),
        ("gray",    rgb_to_hue32(128, 128, 128)),
    ]
    for name, hc in named:
        print(f"  {name:<10}  {hc.notation()}")

    print(f"\n{'─'*76}")
    print("Conformance tolerances (OKLab Euclidean distance = one step):")
    print(f"  Hue32   dE < {DELTA_E_HUE32:.4f}")
    print(f"  Hue64   dE < {DELTA_E_HUE64:.4f}")
    print(f"  Hue192  dE < {DELTA_E_HUE192:.4f}")
