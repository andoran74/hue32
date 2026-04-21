--- /mnt/project/hue32-polyfill.js	2026-04-21 05:05:23.000000000 +0000
+++ hue32-polyfill.js	2026-04-21 13:01:44.230853814 +0000
@@ -39,18 +39,15 @@
   const SNAP = 0.25;
   const ACHROMATIC_THRESH = SNAP * (C_MAX - C_MIN) / (HSTF_MAX - HSTF_MIN);
 
-  const HUE_ANGLES = { R: 0, Y: 60, G: 120, C: 180, B: 240, M: 300 };
+  // OKLCh perceptual hue angles for the six RYGCBM anchors. Must match
+  // hue32.py and index.js exactly to keep the spec, npm package, and CSS
+  // polyfill in agreement. These are NOT artist-wheel angles (0/60/120/...);
+  // they are the actual perceptual positions in OKLCh derived from the
+  // calibrated sRGB primaries and secondaries.
+  const HUE_ANGLES = { R: 29.2232, Y: 109.7828, G: 142.5112,
+                       C: 194.8069, B: 264.0729, M: 328.3520 };
   const HUE_ANCHORS = ['R', 'Y', 'G', 'C', 'B', 'M'];
 
-  const HUE_ARCS = [
-    { primary: 'R', secondary: 'Y', reverse: false },
-    { primary: 'G', secondary: 'Y', reverse: true  },
-    { primary: 'G', secondary: 'C', reverse: false },
-    { primary: 'B', secondary: 'C', reverse: true  },
-    { primary: 'B', secondary: 'M', reverse: false },
-    { primary: 'R', secondary: 'M', reverse: true  },
-  ];
-
   function snap(v) {
     if (v < SNAP) return 0;
     if (v > HSTF_MAX - SNAP) return HSTF_MAX;
@@ -66,17 +63,26 @@
     return ((d % 360) + 360) % 360;
   }
 
+  // Reconstruct the OKLCh hue angle from primary/secondary letter pair and
+  // their integer values. Mirrors the canonical implementation in index.js
+  // and hue32.py.
   function componentsToAngle(p, pv, s, sv) {
     if (!p && !s) return 0;
     if (!s || sv < SNAP) return HUE_ANGLES[p];
     if (!p || pv < SNAP) return HUE_ANGLES[s];
     const total = pv + sv;
-    const t = pv / total;
+    const t = sv / total;
     let pa = HUE_ANGLES[p], sa = HUE_ANGLES[s];
-    if ((p === 'G' && s === 'Y') || (p === 'B' && s === 'C') || (p === 'R' && s === 'M')) {
-      if (p === 'R' && s === 'M' && sa > pa) sa -= 360;
-      return normalizeDeg(sa + t * (pa - sa));
+    // Three "reverse" segments where the primary anchor sits at the END:
+    // walk from secondary anchor toward primary anchor.
+    if (p === 'G' && s === 'Y') return normalizeDeg(sa + t * (pa - sa));
+    if (p === 'B' && s === 'C') return normalizeDeg(sa + t * (pa - sa));
+    if (p === 'R' && s === 'M') {
+      // Wraparound through 0 degrees: extend R past 360 for clean interpolation.
+      const rExt = pa + 360;
+      return normalizeDeg(sa + t * (rExt - sa));
     }
+    // Forward segments (R/Y, G/C, B/M): walk from primary toward secondary.
     return normalizeDeg(pa + t * (sa - pa));
   }