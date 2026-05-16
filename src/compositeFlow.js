// compositeFlow.js — V2 public entry: a flowing-arc layout.
//
// Where V1 (composite.js) places 4 radial appendages at fixed NW/NE/SE/SW
// quadrants, V2 makes the *whole number* flow along the ensō body as one
// calligraphic gesture:
//
//   • The ensō's head (wet-drop landing) is the start of digit 1 (thousands).
//     A LARGE ink-splotch sits there to evoke the brush touching down.
//   • The body is divided into 4 segments; each segment hosts one digit lobe
//     (an asymmetric Bézier teardrop bulging OUTWARD from the ensō and
//     whipping back to nearly touch it). Reading order: clockwise along the
//     body.
//   • Each lobe carries 5 Morse marks (V2 morse) or 4 prongs (V2 prong)
//     placed along its arc.
//   • Visible whitespace gaps separate the 4 lobes along the bare ensō —
//     each digit is its own gesture.
//   • Digit 4 (ones) ends just before the tail; the tail wisps off into nothing.
//
// Every visible stroke is also stacked with a halo (blurred copy) behind it
// to evoke wet sumi ink bleeding into paper fibers.
//
// All encodings, RNG, primitives, and validation are unchanged from V1.

import { createRng } from './rng.js';
import { enso, ensoBodyGeometry } from './enso.js';
import { irregularBlob } from './splotch.js';
import { morseDigitArcAppendage } from './morseDigitArc.js';
import { prongDigitArcAppendage } from './prongDigitArc.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULT_GAP_DEG = 90;

// ============================================================================
// V2 TUNING CONSTANTS — edit these to reshape the glyph without hunting
// through the code. All are dimensionless unless noted.
// ============================================================================

// --- Digit spacing along the ensō body --------------------------------------
// Each digit lobe spans [start, end] in body-parameter space (t ∈ [0,1] along
// the body arc, where 0 = wet-drop, 1 = just before tail starts). The exposed
// stretches of bare ensō between consecutive lobes are the "whitespace" that
// makes each digit read as its own gesture.
//
// The spans are computed from `digitGap` (the fraction of body-arc reserved
// between consecutive lobes), with fixed leading/trailing margins so the
// wet-drop and tail still get their breathing room.
const LEAD_GAP = 0.04; // body fraction reserved before digit 1 (after wet-drop)
const TAIL_GAP = 0.03; // body fraction reserved after digit 4 (before tail)
const DEFAULT_DIGIT_GAP = 0.08; // body fraction between consecutive lobes

function computeLobeSpans(digitGap) {
  const interGapTotal = 3 * digitGap;
  const lobeBudget = 1 - LEAD_GAP - TAIL_GAP - interGapTotal;
  const lobeSpan = Math.max(0.02, lobeBudget / 4);
  const spans = [];
  for (let i = 0; i < 4; i++) {
    const start = LEAD_GAP + i * (lobeSpan + digitGap);
    spans.push([start, start + lobeSpan]);
  }
  return spans;
}

// --- Lobe side (outside vs inside the ensō) --------------------------------
// Thousands and tens bulge OUTSIDE the ring; hundreds and units bulge INSIDE.
// Indexed [d1, d2, d3, d4] = [thousands, hundreds, tens, units].
const DIGIT_LOBE_INWARD = [false, true, false, true];

// --- Lobe shape -------------------------------------------------------------
// Bulge = apex radial reach as a fraction of ensōRadius. With the asymmetric
// control-point distribution in morseDigitArc.js, bulge=0.50 puts the apex at
// ~75–80% of radius from the ring. Inward lobes use a smaller bulge so the
// two inside apexes don't crowd the center.
const LOBE_BULGE_OUTWARD = 0.50;
const LOBE_BULGE_INWARD  = 0.32;
const LOBE_BULGE_JITTER  = 0.03;  // ± gaussian stddev applied per lobe

// --- Endpoint nudging -------------------------------------------------------
// Lobe endpoints are nudged a few px outward from the ensō body so marks at
// the endpoints don't get buried inside the ensō stroke.
const ENDPOINT_OUTWARD_NUDGE_FRAC = 0.012; // × size

// --- Wet-drop ---------------------------------------------------------------
const WET_DROP_SIZE_FRAC = 0.13;  // × radius

// --- Ink bleed / soak-through halo -----------------------------------------
// We emit two halo layers behind each crisp stroke, evoking wet sumi ink
// soaking into paper fibres:
//   • Far-soak halo: heavier blur, lower opacity — outer "bloom".
//   • Near-soak halo: lighter blur, higher opacity — softens the crisp edge.
// Both are filter-applied copies of the visible content (data-halo="true").
// All deviations are tuned at size=480 and scale linearly with size.
const INK_BLEED_FAR_STD_DEV  = 8.0;  // outer halo Gaussian stdDeviation @ size=480
const INK_BLEED_FAR_OPACITY  = 0.42; // outer halo opacity
const INK_BLEED_NEAR_STD_DEV = 2.4;  // inner halo Gaussian stdDeviation @ size=480
const INK_BLEED_NEAR_OPACITY = 0.62; // inner halo opacity
const INK_CRISP_OPACITY      = 0.92; // crisp layer opacity (just under 1 keeps it from
                                     // looking digitally hard against the halo)

// ============================================================================

function validate({ number, encoding, size }) {
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0 || number > 9999) {
    throw new TypeError(
      `renderHeptapodNumeralV2: 'number' must be an integer in [0, 9999]; got ${number}`
    );
  }
  if (encoding !== 'morse' && encoding !== 'prong') {
    throw new TypeError(
      `renderHeptapodNumeralV2: 'encoding' must be 'morse' or 'prong'; got ${JSON.stringify(encoding)}`
    );
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new TypeError(
      `renderHeptapodNumeralV2: 'size' must be a positive finite number; got ${size}`
    );
  }
}

/**
 * @param {Object} opts
 * @param {number} opts.number          0..9999 integer
 * @param {'morse'|'prong'} opts.encoding
 * @param {number} opts.size            viewBox dimension (square)
 * @param {number} [opts.seed]
 * @param {number} [opts.bulgeScale=1]  multiplier on lobe apex height — 0.3..1.6
 *                                      (0.5 = squashed lobes, 1.5 = tall lobes)
 * @param {number} [opts.digitGap=0.08] body-arc fraction between consecutive
 *                                      digit lobes — 0.02..0.18
 * @param {number} [opts.markSpread=1]  how spread out the morse marks sit
 *                                      along their lobe — 0 = clustered at
 *                                      midpoint, 1 = spread to lobe endpoints
 * @param {number} [opts.bleedScale=1]  multiplier on both halo blur std devs
 *                                      (0 = dry/sharp, 2.5 = very wet/blurry)
 * @param {number} [opts.haloOpacity=1] multiplier on both halo opacities
 *                                      (0 = no halo, 1.5 = dark wet halo)
 * @param {number} [opts.crispOpacity=INK_CRISP_OPACITY]
 *                                      opacity of the crisp ink layer — 0..1
 * @param {number} [opts.liquidWobble=0]
 *                                      feDisplacementMap scale (pixels) applied
 *                                      to the halo via fractal-noise turbulence.
 *                                      0 = no liquid distortion; 8 = sumi-on-rice-paper
 *                                      bloom; 20 = wet watercolor pool.
 * @param {number} [opts.liquidDetail=0.04]
 *                                      feTurbulence baseFrequency. Low (~0.01)
 *                                      = large slow swirls; high (~0.2) = fine
 *                                      grainy capillary texture.
 * @returns {SVGSVGElement}
 */
export function renderHeptapodNumeralV2({
  number,
  encoding,
  size,
  seed,
  bulgeScale = 1,
  digitGap = DEFAULT_DIGIT_GAP,
  markSpread = 1,
  bleedScale = 1,
  haloOpacity = 1,
  crispOpacity = INK_CRISP_OPACITY,
  liquidWobble = 0,
  liquidDetail = 0.04,
} = {}) {
  validate({ number, encoding, size });

  const rng = createRng(seed);

  const digits = [
    Math.floor(number / 1000) % 10,
    Math.floor(number / 100) % 10,
    Math.floor(number / 10) % 10,
    number % 10,
  ];

  const cx = size / 2;
  const cy = size / 2;
  // Smaller than V1 so the much-larger asymmetric teardrop lobes
  // (apex at ~75% of radius outward) stay inside the viewBox.
  const radius = size * 0.24;

  // ENSO -----------------------------------------------------------------
  const gapAngleDeg = DEFAULT_GAP_DEG + rng.gauss(0, 6);
  const gapWidthDeg = 32 + rng.range(-4, 6);
  const tailLengthDeg = 22 + rng.range(-3, 5);

  // We compute the body geometry first so that lobe positions are derived
  // from the *intended* body arc. (The rendered ensō has small radial wobble
  // from the rng — a few pixels — which is visually fine.)
  const bodyGeo = ensoBodyGeometry({
    cx,
    cy,
    radius,
    gapAngleDeg,
    gapWidthDeg,
  });

  // IMPORTANT: bodyGeo and enso() pull from the SAME rng. enso() is what
  // actually advances the rng to produce the body wobble + brush jitter.
  // bodyGeo above used 0 rng calls (it's pure geometry), so the rng state
  // is unchanged. Now we call enso() which consumes rng draws as normal.
  // Returns BOTH the filled brush outline AND the wobbly spine polyline —
  // the spine drives the quiz's draw-mask animation.
  const { outlineD: ensoPath, spineD: ensoSpineD } = enso({
    cx,
    cy,
    radius,
    gapAngleDeg,
    gapWidthDeg,
    tailLengthDeg,
    rng,
  });

  // LOBE ENDPOINTS -------------------------------------------------------
  // Each digit's lobe spans a window of body-parameter space defined in
  // DIGIT_LOBE_SPANS. The bare ensō between consecutive lobes is the
  // visible whitespace that separates the digits.
  //
  // We push each anchor a few pixels *outward* (away from the ensō center).
  // This keeps marks at the lobe endpoints from sitting buried inside the
  // ensō stroke.
  const nudgePx = Math.max(3, size * ENDPOINT_OUTWARD_NUDGE_FRAC);
  function anchorAt(tBody, inward) {
    const bp = bodyGeo.bodyPoint(tBody);
    // Nudge the anchor a few pixels off the ensō line on the side the lobe
    // bulges toward, so marks at the lobe endpoints don't sit buried in the
    // ensō stroke.
    const sign = inward ? -1 : 1;
    return {
      x: bp.x + bp.nx * nudgePx * sign,
      y: bp.y + bp.ny * nudgePx * sign,
      tAlongBody: tBody,
    };
  }

  // APPENDAGES -----------------------------------------------------------
  // Each appendage now returns {body, spine, sideClass, digit} so we can
  // wrap the body in <g mask="..."> below and emit the spine into the
  // mask's stroked path for the per-lobe draw-by-stroke-dashoffset reveal.
  const appendageScale = radius * 0.85; // shared budget; lobe size dominates
  const appendageResults = [];

  const lobeSpans = computeLobeSpans(digitGap);

  for (let i = 0; i < 4; i++) {
    const [tStart, tEnd] = lobeSpans[i];
    const inward = DIGIT_LOBE_INWARD[i];
    const lobeStart = anchorAt(tStart, inward);
    const lobeEnd = anchorAt(tEnd, inward);
    const digit = digits[i];

    // Per-lobe slight bulge jitter — varies the petal heights a bit so the
    // logogram doesn't feel mechanically perfect. `bulgeScale` is the
    // user-controlled multiplier exposed via the demo slider.
    const baseBulge = (inward ? LOBE_BULGE_INWARD : LOBE_BULGE_OUTWARD) * bulgeScale;
    const bulge = baseBulge + rng.gauss(0, LOBE_BULGE_JITTER);

    const result = encoding === 'morse'
      ? morseDigitArcAppendage({
          digit,
          lobeStartPoint: lobeStart,
          lobeEndPoint: lobeEnd,
          ensoCenter: { x: cx, y: cy },
          ensoRadius: radius,
          scale: appendageScale,
          rng,
          bulge,
          inward,
          markSpread,
        })
      : prongDigitArcAppendage({
          digit,
          lobeStartPoint: lobeStart,
          lobeEndPoint: lobeEnd,
          ensoCenter: { x: cx, y: cy },
          ensoRadius: radius,
          scale: appendageScale,
          rng,
          bulge,
          inward,
        });

    appendageResults.push(result);
  }

  // WET-DROP -------------------------------------------------------------
  // A larger ink splotch at the head of the ensō — the brush's "landing
  // point". Spec: 2.5–3× the size of V1's interior dots / appendage dots.
  // V1 interior dot size ≈ radius * 0.04 (max). We use ~radius * 0.12 here
  // (≈ 3× larger). It sits ON the body (not on the outward-nudged lobe
  // anchor), slightly elongated perpendicular to the body so the droplet's
  // long axis points outward — reads as a wet bead sitting on the line.
  const bp0 = bodyGeo.bodyPoint(0);
  const bpEps = bodyGeo.bodyPoint(0.005);
  const tanX = bpEps.x - bp0.x;
  const tanY = bpEps.y - bp0.y;
  const tanLen = Math.hypot(tanX, tanY) || 1;
  const tanAngle = Math.atan2(tanY / tanLen, tanX / tanLen);

  const wetDropSize = radius * WET_DROP_SIZE_FRAC;
  const wetDropPath = irregularBlob({
    cx: bp0.x,
    cy: bp0.y,
    size: wetDropSize,
    irregularity: 0.35,
    elongation: 0.30,
    rotationRad: tanAngle + Math.PI / 2,
    rng,
  });

  // ASSEMBLE -------------------------------------------------------------
  // Ink-bleed defs: two reusable Gaussian-blur filters that simulate wet sumi
  // ink soaking into paper. Filter `x`/`y`/`width`/`height` are widened to
  // 200% so the blur isn't clipped at the path's tight bounding box.
  // stdDeviations are tuned at size=480 and scale linearly with rendered size.
  const sizeScale = size / 480;
  const farStdDev  = INK_BLEED_FAR_STD_DEV  * sizeScale * bleedScale;
  const nearStdDev = INK_BLEED_NEAR_STD_DEV * sizeScale * bleedScale;
  const farOpacity  = INK_BLEED_FAR_OPACITY  * haloOpacity;
  const nearOpacity = INK_BLEED_NEAR_OPACITY * haloOpacity;
  // Liquid distortion: feTurbulence generates fractal noise, feDisplacementMap
  // pushes each blurred pixel along that noise gradient. At wobble=0 the
  // displacementMap is a no-op (scale="0"), so behaviour is identical to the
  // previous pure-Gaussian halo. Higher values give watercolour-edge bloom.
  // The crisp layer also gets a milder displacement (30 %) so the sharp ink
  // doesn't look glassy against a wobbly halo.
  const wobblePx = Math.max(0, liquidWobble) * sizeScale;
  const detail   = Math.max(0.005, liquidDetail);
  const idTag = (rng.seed >>> 0).toString(36);
  const filterFarId   = `ink-bleed-far-${idTag}`;
  const filterNearId  = `ink-bleed-near-${idTag}`;
  const filterCrispId = `ink-crisp-${idTag}`;
  // Per-seed turbulence offsets so reseeding visibly changes the wet-edge
  // shape (the displacement pattern is sampled at different x/y offsets in
  // the infinite turbulence field).
  const turbSeedFar   = (rng.seed >>> 0) % 9973;
  const turbSeedNear  = ((rng.seed >>> 8) >>> 0) % 9973;
  const turbSeedCrisp = ((rng.seed >>> 16) >>> 0) % 9973;
  // Filter region — generous margin so heavy bleed + displacement never gets
  // clipped at the element bbox. With bleedScale=2.5 and liquidWobble=20, the
  // halo extends ~90px past content; 200% / -50% offsets the bbox by half,
  // which left only 50% headroom — too tight. 600% / -250% gives 2.5× bbox of
  // headroom on every side. Combined with svg overflow="visible" and the
  // padded viewBox below, the wet halo never hits a rectangular clip line.
  const FILTER_BOUNDS = 'x="-250%" y="-250%" width="600%" height="600%"';

  // --- Draw-spine masks ----------------------------------------------------
  // One mask per logical element that needs to be "drawn" in time:
  //   • 1 mask for the ensō ring (its full body+tail spine)
  //   • 4 masks for the lobes (each lobe's Bezier spine)
  // Each mask contains a stroked path with pathLength=100 so CSS can animate
  // stroke-dashoffset 100→0 to reveal the path progressively. The stroke is
  // wide enough to cover the brush + most of the wet halo, and a CSS filter
  // blur on the path softens the brush tip (Smoothness slider).
  // The wet-drop is NOT masked — it splashes on its own via CSS bloomDrop.
  const ensoMaskId = `draw-enso-${idTag}`;
  const lobeMaskIds = appendageResults.map((_, i) => `draw-lobe-${i + 1}-${idTag}`);
  // Stroke width = generous fraction of size; covers brush (~size×0.06) plus
  // a margin for the halo bleed. CSS Smoothness/filter:blur on top widens
  // the effective reveal further.
  const MASK_STROKE_WIDTH = (size * 0.18).toFixed(0);
  const maskDefs = [
    `<mask id="${ensoMaskId}" maskUnits="userSpaceOnUse">
       <path class="draw-spine" data-element="enso"
             d="${ensoSpineD}" stroke="white" stroke-width="${MASK_STROKE_WIDTH}"
             stroke-linecap="round" stroke-linejoin="round" fill="none"
             pathLength="100" />
     </mask>`,
    ...appendageResults.map((r, i) => (
      `<mask id="${lobeMaskIds[i]}" maskUnits="userSpaceOnUse">
         <path class="draw-spine" data-element="lobe" data-lobe="${i + 1}"
               d="${r.spine}" stroke="white" stroke-width="${MASK_STROKE_WIDTH}"
               stroke-linecap="round" stroke-linejoin="round" fill="none"
               pathLength="100" />
       </mask>`
    )),
  ].join('');

  const defs = `
    <defs>
      <filter id="${filterFarId}" ${FILTER_BOUNDS}>
        <feGaussianBlur in="SourceGraphic" stdDeviation="${farStdDev.toFixed(2)}" result="blur" />
        <feTurbulence type="fractalNoise" baseFrequency="${detail.toFixed(4)}" numOctaves="2" seed="${turbSeedFar}" result="turb" />
        <feDisplacementMap in="blur" in2="turb" scale="${(wobblePx * 1.0).toFixed(2)}" />
      </filter>
      <filter id="${filterNearId}" ${FILTER_BOUNDS}>
        <feGaussianBlur in="SourceGraphic" stdDeviation="${nearStdDev.toFixed(2)}" result="blur" />
        <feTurbulence type="fractalNoise" baseFrequency="${(detail * 1.4).toFixed(4)}" numOctaves="2" seed="${turbSeedNear}" result="turb" />
        <feDisplacementMap in="blur" in2="turb" scale="${(wobblePx * 0.65).toFixed(2)}" />
      </filter>
      <filter id="${filterCrispId}" ${FILTER_BOUNDS}>
        <feTurbulence type="fractalNoise" baseFrequency="${(detail * 1.8).toFixed(4)}" numOctaves="2" seed="${turbSeedCrisp}" result="turb" />
        <feDisplacementMap in="SourceGraphic" in2="turb" scale="${(wobblePx * 0.30).toFixed(2)}" />
      </filter>
      ${maskDefs}
    </defs>
  `;

  // Inner contents — every visible group. We render this block THREE times:
  // a far-soak halo (heaviest blur, lowest opacity), a near-soak halo (light
  // blur, mid opacity), and the crisp layer on top. The halo layers are
  // tagged data-halo="true" so sample.js can skip them.
  // The ensō group and each appendage group apply their mask= attribute, so
  // the brush's draw animation reveals each progressively.
  const appendageWrapped = appendageResults
    .map((r, i) => (
      `<g class="appendage ${r.encoding}-arc ${r.sideClass} digit-${r.digit}" mask="url(#${lobeMaskIds[i]})">${r.body}</g>`
    ))
    .join('');
  const inkContent = [
    `<g class="enso" mask="url(#${ensoMaskId})"><path d="${ensoPath}" /></g>`,
    `<g class="wet-drop"><path d="${wetDropPath}" /></g>`,
    `<g class="appendages">${appendageWrapped}</g>`,
  ].join('');

  // Padded viewBox — give the halo room to extend past the drawing area
  // without hitting the SVG's rectangular clip. Content keeps its original
  // cx/cy in the unpadded coord space; the viewBox grows around it.
  // 30% padding (was 0.4) — the SVG's filter has overflow="visible" plus
  // 600% filter region, so the halo never clips. Smaller padding means
  // the glyph fills more of the rendered SVG box → visually bigger glyph
  // for the same stage area.
  const VB_PAD_FRAC = 0.3;
  const vbPad = size * VB_PAD_FRAC;
  const vbSize = size + 2 * vbPad;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `${-vbPad} ${-vbPad} ${vbSize} ${vbSize}`);
  svg.setAttribute('width', String(vbSize));
  svg.setAttribute('height', String(vbSize));
  svg.setAttribute('overflow', 'visible');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('stroke', 'none');
  svg.dataset.number = String(number);
  svg.dataset.encoding = encoding;
  svg.dataset.seed = String(rng.seed);
  svg.dataset.variant = 'v2';

  // Animation metadata — consumers (e.g. the quiz draw-animation) use these to
  // reconstruct the brush gesture: where the wet-drop lands, which angle the
  // ensō body starts at, how far it sweeps before the tail.
  svg.dataset.cx = String(cx);
  svg.dataset.cy = String(cy);
  svg.dataset.radius = String(radius);
  svg.dataset.wetDropX = bp0.x.toFixed(2);
  svg.dataset.wetDropY = bp0.y.toFixed(2);
  svg.dataset.gapStartDeg = (gapAngleDeg + gapWidthDeg / 2).toFixed(2);
  svg.dataset.bodySweepDeg = (360 - gapWidthDeg).toFixed(2);
  svg.dataset.tailSweepDeg = tailLengthDeg.toFixed(2);

  // The crisp layer only gets the displacement filter when wobble > 0; at
  // wobble=0 we skip the filter entirely to keep the default render byte-for-byte
  // identical to the pre-liquid pipeline.
  const crispFilterAttr = wobblePx > 0 ? ` filter="url(#${filterCrispId})"` : '';
  svg.innerHTML = [
    defs,
    `<g class="ink-halo ink-halo-far"  data-halo="true" filter="url(#${filterFarId})"  opacity="${farOpacity.toFixed(3)}">${inkContent}</g>`,
    `<g class="ink-halo ink-halo-near" data-halo="true" filter="url(#${filterNearId})" opacity="${nearOpacity.toFixed(3)}">${inkContent}</g>`,
    `<g class="ink-crisp"${crispFilterAttr} opacity="${crispOpacity.toFixed(3)}">${inkContent}</g>`,
  ].join('');

  return svg;
}
