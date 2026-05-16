// morseDigitArc.js — V2: Morse marks ride along a digit-lobe arc.
//
// Each digit gets a calligraphic "petal" attached to the ensō body: a Bézier
// lobe whose endpoints sit on the ensō line (or very near it) and whose belly
// bulges outward. The 5 Morse marks for the digit are placed along the inside
// of the lobe, from `lobeStartPoint` (near the ensō) outward through the lobe
// belly and back to `lobeEndPoint` (which nearly touches the ensō again,
// leaving a small gap as the digit boundary).
//
// Encoding tables match V1 morseDigit.js exactly — V2 only changes layout,
// never the encoding.

import { brushStroke, lensProfile } from './brush.js';
import { irregularBlob } from './splotch.js';

const PATTERNS = [
  ['-', '-', '-', '-', '-'], // 0
  ['.', '-', '-', '-', '-'], // 1
  ['.', '.', '-', '-', '-'], // 2
  ['.', '.', '.', '-', '-'], // 3
  ['.', '.', '.', '.', '-'], // 4
  ['.', '.', '.', '.', '.'], // 5
  ['-', '.', '.', '.', '.'], // 6
  ['-', '-', '.', '.', '.'], // 7
  ['-', '-', '-', '.', '.'], // 8
  ['-', '-', '-', '-', '.'], // 9
];

// Cubic Bézier evaluation: B(u) for u ∈ [0,1].
function cubicBezier(p0, p1, p2, p3, u) {
  const mu = 1 - u;
  const mu2 = mu * mu;
  const mu3 = mu2 * mu;
  const u2 = u * u;
  const u3 = u2 * u;
  return {
    x: mu3 * p0.x + 3 * mu2 * u * p1.x + 3 * mu * u2 * p2.x + u3 * p3.x,
    y: mu3 * p0.y + 3 * mu2 * u * p1.y + 3 * mu * u2 * p2.y + u3 * p3.y,
  };
}

// Cubic Bézier derivative (unnormalized tangent).
function cubicBezierTangent(p0, p1, p2, p3, u) {
  const mu = 1 - u;
  const mu2 = mu * mu;
  const u2 = u * u;
  const dx = 3 * mu2 * (p1.x - p0.x) + 6 * mu * u * (p2.x - p1.x) + 3 * u2 * (p3.x - p2.x);
  const dy = 3 * mu2 * (p1.y - p0.y) + 6 * mu * u * (p2.y - p1.y) + 3 * u2 * (p3.y - p2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Build the 4 cubic-Bézier control points for an asymmetric "teardrop" digit
 * lobe that:
 *   - starts at `lobeStartPoint` (on the ensō)
 *   - ends at `lobeEndPoint`   (back on the ensō, leaving a small gap before
 *     the next digit's lobe)
 *   - climbs gradually from the start, peaks past the midpoint, then whips
 *     back sharply to the end (comma / teardrop silhouette)
 *
 * `bulge` is the additional radial distance, expressed as a fraction of
 * `ensoRadius`, by which the belly of the lobe extends past the ensō ring.
 * For example bulge=0.8 means the lobe's outer apex sits at ≈ 1.8 × ensoRadius
 * from the center (with the asymmetric handle distribution below, the apex
 * actually reaches about 0.75–0.9 × radius outward — tune via the
 * `RADIAL_*` constants below).
 *
 * Construction (asymmetric):
 *   - P0 = lobe start (on/near ensō).
 *   - P3 = lobe end   (on/near ensō).
 *   - C1 (P1) sits modestly outward and forward along the ring — gentle climb.
 *   - C2 (P2) sits much further outward AND is pulled close to P3 along the
 *     ring tangent — the curve is forced to snap back hard near the end.
 *
 * Returns [p0, p1, p2, p3].
 */

// --- Lobe shape constants (asymmetric teardrop). -------------------------
// Tangent components: how far each control point travels *along* the ring,
// as a fraction of ensoRadius.
// A smaller value pinches the curve toward the ring at that end.
const TANGENT_MAG_START = 0.34; // C1: longer along-ring travel = gradual ascent
const TANGENT_MAG_END   = 0.10; // C2: very short along-ring travel = sharp whip back

// Radial components: how far each control point pushes *outward* from the ring,
// as a fraction of ensoRadius * bulge. The Bézier belly only reaches a
// fraction of the way to its control points, so the multipliers below are
// calibrated empirically (via .tmp-verify/lobe-shape.mjs) so that with
// bulge=0.50 the apex lands at ~80% of radius above the ring, biased to
// u≈0.55 (just past the midpoint).
const RADIAL_MAG_START = 2.10; // C1: moderate outward push
const RADIAL_MAG_END   = 2.80; // C2: stronger outward push -> apex biased past midpoint

export function buildLobeControlPoints({ lobeStartPoint, lobeEndPoint, ensoCenter, ensoRadius, bulge = 0.8, inward = false }) {
  const p0 = { x: lobeStartPoint.x, y: lobeStartPoint.y };
  const p3 = { x: lobeEndPoint.x, y: lobeEndPoint.y };

  // Radial unit vectors at each endpoint, pointing in the lobe's bulge
  // direction. For an outward lobe (default) that's away from the ensō center;
  // for an inward lobe we flip the sign so the bulge dives toward center.
  const sign = inward ? -1 : 1;
  const oStart = unit((p0.x - ensoCenter.x) * sign, (p0.y - ensoCenter.y) * sign);
  const oEnd = unit((p3.x - ensoCenter.x) * sign, (p3.y - ensoCenter.y) * sign);

  // Tangent along the ring at each endpoint, pointing in the direction of
  // travel from p0 → p3. Choose the perpendicular that has positive dot
  // product with (p3 - p0) so we always advance along the ring.
  const chordDx = p3.x - p0.x;
  const chordDy = p3.y - p0.y;

  const tStartA = { x: -oStart.y, y: oStart.x };
  const tStart = (tStartA.x * chordDx + tStartA.y * chordDy) >= 0
    ? tStartA
    : { x: -tStartA.x, y: -tStartA.y };

  const tEndA = { x: -oEnd.y, y: oEnd.x };
  // At the endpoint we want the handle to point *back* along the lobe
  // (toward the start), so flip the sign of the natural forward tangent.
  const tEnd = (tEndA.x * chordDx + tEndA.y * chordDy) >= 0
    ? { x: -tEndA.x, y: -tEndA.y }
    : tEndA;

  const tangentMagStart = ensoRadius * TANGENT_MAG_START;
  const tangentMagEnd   = ensoRadius * TANGENT_MAG_END;
  const radialMagStart  = ensoRadius * bulge * RADIAL_MAG_START;
  const radialMagEnd    = ensoRadius * bulge * RADIAL_MAG_END;

  const p1 = {
    x: p0.x + tStart.x * tangentMagStart + oStart.x * radialMagStart,
    y: p0.y + tStart.y * tangentMagStart + oStart.y * radialMagStart,
  };
  const p2 = {
    x: p3.x + tEnd.x * tangentMagEnd + oEnd.x * radialMagEnd,
    y: p3.y + tEnd.y * tangentMagEnd + oEnd.y * radialMagEnd,
  };
  return [p0, p1, p2, p3];
}

function unit(dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Sample a point along the lobe at parameter `u ∈ [0,1]`. Returns position +
 * unit tangent direction (along the lobe) at that point.
 */
function lobeSample(controlPts, u) {
  const [p0, p1, p2, p3] = controlPts;
  const pos = cubicBezier(p0, p1, p2, p3, u);
  const tan = cubicBezierTangent(p0, p1, p2, p3, u);
  return { x: pos.x, y: pos.y, tx: tan.x, ty: tan.y };
}

/**
 * @param {Object} opts
 * @param {number} opts.digit
 * @param {{x:number,y:number}} opts.lobeStartPoint
 * @param {{x:number,y:number}} opts.lobeEndPoint
 * @param {{x:number,y:number}} opts.ensoCenter
 * @param {number} opts.ensoRadius
 * @param {number} opts.scale     — overall length scale, used for mark sizing
 *                                  (typically ≈ ensōRadius * 0.85)
 * @param {Object} opts.rng
 * @param {number} [opts.bulge=0.4] — lobe height, as fraction of ensōRadius
 * @returns {string} SVG group fragment
 */
export function morseDigitArcAppendage({
  digit,
  lobeStartPoint,
  lobeEndPoint,
  ensoCenter,
  ensoRadius,
  scale,
  rng,
  bulge,
  inward = false,
  markSpread = 1,
}) {
  const pattern = PATTERNS[digit];
  // Light seeded variation per lobe — different digits look slightly different
  // even if they encode the same value.
  const effectiveBulge = (bulge ?? 0.4) * (1 + rng.gauss(0, 0.06));

  const ctrl = buildLobeControlPoints({
    lobeStartPoint,
    lobeEndPoint,
    ensoCenter,
    ensoRadius,
    bulge: effectiveBulge,
    inward,
  });

  // Place 5 marks along the lobe at parameter positions u_i, equally spaced.
  // `markSpread` controls how far across the lobe the marks fan out:
  //   markSpread=0 → u ∈ [0.40, 0.60] — marks clustered at the lobe apex
  //   markSpread=1 → u ∈ [0.05, 0.95] — marks spread to lobe endpoints
  const N = pattern.length; // 5
  const s = Math.max(0, Math.min(1, markSpread));
  const u0 = 0.40 - s * 0.35;
  const u1 = 0.60 + s * 0.35;
  const baseU = (i) => u0 + (u1 - u0) * (i / (N - 1));

  // Per-mark scale — dots / dash thickness anchored on the lobe span.
  const chordLen = Math.hypot(lobeEndPoint.x - lobeStartPoint.x, lobeEndPoint.y - lobeStartPoint.y);
  // Treat the *lobe arc length* as ~chord * (1 + bulge) (rough approx for our
  // bulge range). With the taller asymmetric lobe the arc is noticeably longer
  // than chord; bump the factor up so dot/dash sizing keeps pace.
  const approxArc = chordLen * (1 + effectiveBulge * 1.1);
  const stride = approxArc / N;

  let body = '';

  pattern.forEach((mark, i) => {
    // ±5% jitter on u, smaller than V1's because the lobe layout is tighter.
    const uJ = rng.gauss(0, 0.015);
    const u = Math.max(0.05, Math.min(0.95, baseU(i) + uJ));
    const samp = lobeSample(ctrl, u);

    // Per-mark scale jitter.
    const scaleJ = 1 + rng.gauss(0, 0.12);

    if (mark === '.') {
      // Dots: solid round beads, sized so adjacent marks stay visibly
      // separated. Smaller than the previous pass (0.30) — the user wants
      // clear gaps between marks within a digit, e.g. ". - . - ." not
      // ".-.-." merged into a blob.
      const dotSize = stride * 0.20 * Math.max(0.6, scaleJ);
      const dotRot = Math.atan2(samp.ty, samp.tx) + rng.range(-0.3, 0.3);
      const dotBlob = irregularBlob({
        cx: samp.x,
        cy: samp.y,
        size: dotSize,
        irregularity: 0.4,
        elongation: 0.18,
        rotationRad: dotRot,
        rng,
      });
      body += `<path d="${dotBlob}" />`;
    } else {
      // Dash: a short brushStroke whose spine runs *along the lobe tangent*
      // at this sample. Length kept under ~50% of stride so two adjacent
      // dashes leave a clear gap between them.
      const dashLen = stride * 0.48 * Math.max(0.55, scaleJ);
      // Tiny wobble — calligraphic, not mechanical.
      const wobble = rng.gauss(0, 5 * Math.PI / 180);
      const cw = Math.cos(wobble);
      const sw = Math.sin(wobble);
      // Rotate tangent by wobble.
      const dx = samp.tx * cw - samp.ty * sw;
      const dy = samp.tx * sw + samp.ty * cw;
      const half = dashLen / 2;
      const controlPoints = [
        { x: samp.x - dx * half, y: samp.y - dy * half },
        { x: samp.x + dx * half * 0.2, y: samp.y + dy * half * 0.2 },
        { x: samp.x + dx * half, y: samp.y + dy * half },
      ];
      // Slimmer dashes — gives the line marks their own identity vs. the
      // (now-thicker) dot marks.
      const dashMaxW = Math.max(0.6, stride * 0.04);
      const d = brushStroke({
        controlPoints,
        widthProfile: lensProfile,
        maxWidth: dashMaxW,
        jitter: { edge: dashMaxW * 0.25, spine: 0 },
        rng,
        samples: 20,
      });
      body += `<path d="${d}" />`;
    }
  });

  const sideClass = inward ? 'inward' : 'outward';
  return `<g class="appendage morse-arc ${sideClass} digit-${digit}">${body}</g>`;
}
