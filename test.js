/**
 * Hue₃₂ npm package — test suite
 * Run with: node test.js
 */

import {
  rgbToHue32,
  hexToHue32,
  cmykToHue32,
  hue32ToRgb,
  hue32ToHex,
  hue32ToCmyk,
  parseHue32,
  validateRoundTrip,
  NAMED_COLORS,
  DELTA_E,
} from './index.js';

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''}: expected ${b}, got ${a}`);
}

function assertClose(a, b, tolerance, msg) {
  if (Math.abs(a - b) > tolerance)
    throw new Error(`${msg || ''}: expected ~${b}, got ${a} (tolerance ${tolerance})`);
}

console.log('\nHue₃₂ npm package tests\n');

// ── RGB → Hue32 ──────────────────────────────────────────────
console.log('RGB → Hue₃₂:');

test('pure red', () => {
  const hc = rgbToHue32(255, 0, 0);
  assert(hc.huePrimary === 'R', `expected R primary, got ${hc.huePrimary}`);
  assertClose(hc.huePrimaryVal, 32, 2, 'primary val');
  assert(!hc.isAchromatic(), 'should not be achromatic');
});

test('orange', () => {
  const hc = rgbToHue32(255, 128, 0);
  assertEq(hc.huePrimary, 'R', 'primary');
  assertEq(hc.hueSecondary, 'Y', 'secondary');
  assert(hc.huePrimaryVal > hc.hueSecondaryVal, 'more red than yellow');
});

test('indigo', () => {
  const hc = rgbToHue32(75, 0, 130);
  assertEq(hc.huePrimary, 'B', 'primary');
  assertEq(hc.hueSecondary, 'M', 'secondary');
});

test('gray is achromatic', () => {
  const hc = rgbToHue32(128, 128, 128);
  assert(hc.isAchromatic(), 'should be achromatic');
  assertEq(hc.tone, 0, 'tone should be 0');
});

test('white', () => {
  const hc = rgbToHue32(255, 255, 255);
  assertEq(hc.shade, 32, 'shade should be 32');
});

test('black', () => {
  const hc = rgbToHue32(0, 0, 0);
  assertEq(hc.shade, 1, 'shade should be 1');
});

// ── Hex → Hue32 ──────────────────────────────────────────────
console.log('\nHex → Hue₃₂:');

test('#FF8000 orange', () => {
  const hc = hexToHue32('#FF8000');
  assertEq(hc.huePrimary, 'R', 'primary');
  assertEq(hc.hueSecondary, 'Y', 'secondary');
});

test('without # prefix', () => {
  const hc = hexToHue32('FF8000');
  assertEq(hc.huePrimary, 'R');
});

test('invalid hex throws', () => {
  try { hexToHue32('#GGGGGG'); assert(false, 'should throw'); }
  catch (e) { assert(true); }
});

// ── CMYK → Hue32 ─────────────────────────────────────────────
console.log('\nCMYK → Hue₃₂:');

test('C0 M50 Y100 K0 = orange', () => {
  const hc = cmykToHue32(0, 50, 100, 0);
  assertEq(hc.huePrimary, 'R');
  assertEq(hc.hueSecondary, 'Y');
});

test('C0 M0 Y0 K0 = white', () => {
  const hc = cmykToHue32(0, 0, 0, 0);
  assert(hc.shade > 28, 'should be near white');
});

// ── Hue32 → RGB ──────────────────────────────────────────────
console.log('\nHue₃₂ → RGB:');

test('round-trip orange', () => {
  const hc = hexToHue32('#FF8000');
  const { r, g, b } = hue32ToRgb(hc);
  assertClose(r, 255, 10, 'r');
  assertClose(g, 128, 10, 'g');
  assertClose(b, 0, 10, 'b');
});

test('achromatic produces no saturation', () => {
  const hc = rgbToHue32(128, 128, 128);
  const { r, g, b } = hue32ToRgb(hc);
  assert(Math.abs(r - g) < 5 && Math.abs(g - b) < 5, 'should be near gray');
});

// ── Hue32 → Hex ──────────────────────────────────────────────
console.log('\nHue₃₂ → Hex:');

test('orange hex round-trip', () => {
  const hc = hexToHue32('#FF8000');
  const { hex } = hue32ToHex(hc);
  assert(hex.startsWith('#'), 'should start with #');
  assert(hex.length === 7, 'should be 7 chars');
});

// ── Parse notation ────────────────────────────────────────────
console.log('\nparseHue32:');

test('parse labeled notation', () => {
  const hc = parseHue32('H:R23Y9 S:24 T:15 L:0 F:0');
  assertEq(hc.huePrimary, 'R');
  assertEq(hc.hueSecondary, 'Y');
  assertEq(hc.shade, 24);
  assertEq(hc.tone, 15);
});

test('parse pure hue', () => {
  const hc = parseHue32('H:B32 S:15 T:25 L:0 F:0');
  assertEq(hc.huePrimary, 'B');
  assertClose(hc.huePrimaryVal, 32, 1);
});

test('parse achromatic', () => {
  const hc = parseHue32('H:none S:20 T:0 L:0 F:0');
  assert(hc.isAchromatic());
  assertEq(hc.shade, 20);
});

// ── toString ──────────────────────────────────────────────────
console.log('\ntoString:');

test('notation format', () => {
  const hc = hexToHue32('#FF8000');
  const str = hc.toString();
  assert(str.startsWith('H:'), 'starts with H:');
  assert(str.includes('S:'), 'includes S:');
  assert(str.includes('T:'), 'includes T:');
  assert(str.includes('L:'), 'includes L:');
  assert(str.includes('F:'), 'includes F:');
});

// ── Round-trip validation ─────────────────────────────────────
console.log('\nRound-trip validation:');

const roundTripColors = [
  [255, 0, 0, 'red'],
  [255, 128, 0, 'orange'],
  [0, 255, 0, 'green'],
  [0, 0, 255, 'blue'],
  [128, 128, 128, 'gray'],
  [255, 255, 255, 'white'],
  [0, 0, 0, 'black'],
  [75, 0, 130, 'indigo'],
  [255, 182, 193, 'pink'],
];

roundTripColors.forEach(([r, g, b, name]) => {
  test(name, () => {
    const result = validateRoundTrip(r, g, b);
    assert(result.pass, `dE=${result.deltaE} exceeds tolerance ${result.tolerance}`);
  });
});

// ── Named colors ──────────────────────────────────────────────
console.log('\nNamed colors:');

test('nine named colors defined', () => {
  const names = Object.keys(NAMED_COLORS);
  assertEq(names.length, 9, 'should have 9 named colors');
  ['red','yellow','green','cyan','blue','magenta','white','black','gray']
    .forEach(n => assert(NAMED_COLORS[n], `${n} should be defined`));
});

// ── Summary ───────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
