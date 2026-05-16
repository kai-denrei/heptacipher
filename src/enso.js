// enso.js — open circle with a gap + trailing tail (kenshin/harai brush).
//
// Builds a circular spine with seeded radial wobble, trims out a gap, and
// extends one end into a tapering tail. The whole thing is fed to `brushStroke`
// with a width profile that ramps up at the head, holds, then tapers to zero
// through the tail — the classic ensō ink-load → ink-out signature.

import { brushStroke } from './brush.js';

const DEG = Math.PI / 180;

/**
 * Geometry-only helper used by V2 (compositeFlow). Computes the ensō *body*
 * spine — the portion of the stroke that sweeps from the head (wet-drop
 * landing) to just before the tail starts. The tail itself is NOT part of the
 * returned spine; V2 lobes attach along the body, then the tail wisps off.
 *
 * Returns:
 *   - `bodyPoint(t)` : (t ∈ [0,1]) → {x,y,nx,ny} on the body spine.
 *                      `(nx,ny)` is the OUTWARD unit normal at that point
 *                      (pointing away from the ensō center).
 *   - `startAngleRad`, `endAngleRad` : angular bounds of the body, useful
 *                      if a caller wants to extrapolate slightly past either
 *                      end.
 *   - `center`, `radius` : echoed back for convenience.
 *
 * NOTE: this helper deliberately recomputes the geometry from the same inputs
 * `enso()` consumes (minus `rng`), so V2 lobes register with the *intended*
 * body arc. The actual rendered ensō has radial wobble from the rng, so the
 * lobe-endpoint <-> ensō-line registration is approximate (a few pixels of
 * play), which is fine for the calligraphic look.
 */
export function ensoBodyGeometry({
  cx,
  cy,
  radius,
  gapAngleDeg = 135,
  gapWidthDeg = 35,
}) {
  const halfGap = gapWidthDeg / 2;
  const startAngleDeg = gapAngleDeg + halfGap;
  const sweepArcDeg = 360 - gapWidthDeg;

  const startAngleRad = startAngleDeg * DEG;
  const endAngleRad = (startAngleDeg + sweepArcDeg) * DEG;

  function bodyPoint(t) {
    const angle = startAngleRad + (endAngleRad - startAngleRad) * t;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
      x: cx + cosA * radius,
      y: cy + sinA * radius,
      nx: cosA,
      ny: sinA,
      angleRad: angle,
    };
  }

  return {
    bodyPoint,
    startAngleRad,
    endAngleRad,
    center: { x: cx, y: cy },
    radius,
  };
}

/**
 * @param {Object} opts
 * @param {number} opts.cx
 * @param {number} opts.cy
 * @param {number} opts.radius
 * @param {number} [opts.gapAngleDeg=135]   center of the gap, in SVG-degrees (0° = +X, 90° = +Y down).
 * @param {number} [opts.gapWidthDeg=35]    angular width of the gap.
 * @param {number} [opts.tailLengthDeg=25]  extra arc past the gap that tapers off.
 * @param {number} [opts.maxWidth]          peak brush half-width
 * @param {Object} opts.rng                 seeded RNG
 * @returns {string} SVG path `d`
 */
export function enso({
  cx,
  cy,
  radius,
  gapAngleDeg = 135,
  gapWidthDeg = 35,
  tailLengthDeg = 25,
  maxWidth,
  rng,
}) {
  // The spine sweeps clockwise (increasing angle) from `startAngle` to `endAngle`,
  // skipping the gap. We pick the start so the gap sits where the caller asked
  // and the tail trails off into the gap region (i.e., the head is just past
  // the gap going one way, and the tail ends just before the gap going the other).
  const halfGap = gapWidthDeg / 2;
  // Start the stroke just *after* the trailing edge of the gap, sweep all the
  // way around, and stop just before the leading edge of the gap. Then add the
  // tail past the stop, overlapping into the gap territory for the kenshin look.
  const startAngle = gapAngleDeg + halfGap; // degrees
  const sweepArc = 360 - gapWidthDeg;       // main body sweep
  const totalSweep = sweepArc + tailLengthDeg; // body + trailing tail

  // Sample control points along the spine. Density is moderate; brush.js
  // will further interpolate with Catmull-Rom + 40 sub-samples.
  const N = 36;
  const controlPoints = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const angle = (startAngle + totalSweep * u) * DEG;
    // Seeded radial wobble (±5%) — gives the circle that hand-drawn quaver.
    const wobble = 1 + rng.gauss(0, 0.025);
    const r = radius * Math.max(0.85, Math.min(1.15, wobble));
    controlPoints.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }

  // Width profile: ramp up quickly (ink load), hold across the body, then
  // taper hard through the tail region. The tail occupies the last
  // `tailLengthDeg / totalSweep` fraction of t.
  const bodyFrac = sweepArc / totalSweep;
  function ensoWidth(t) {
    if (t < 0.06) {
      // Initial ink-load ramp.
      return t / 0.06;
    }
    if (t < bodyFrac) {
      // Body: hold near full, with gentle variation handled by edge jitter.
      return 1.0;
    }
    // Tail: taper from 1 → 0 with an ease-out.
    const u = (t - bodyFrac) / (1 - bodyFrac);
    return Math.max(0, (1 - u) * (1 - u));
  }

  const peakWidth = maxWidth ?? Math.max(3, radius * 0.06);

  const outlineD = brushStroke({
    controlPoints,
    widthProfile: ensoWidth,
    maxWidth: peakWidth,
    jitter: { edge: peakWidth * 0.18, spine: peakWidth * 0.05 },
    rng,
    samples: 80, // ensō is the longest stroke — use more samples
  });

  // Spine polyline (joining the wobbled control points). Used by the quiz
  // reveal animation as a stroked path inside an SVG mask — animating its
  // stroke-dashoffset reveals the brush outline progressively, matching the
  // brush's gesture along its own (wobbly) spine rather than a sector
  // from the ring's geometric center.
  const spineD = 'M ' + controlPoints
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' L ');

  return { outlineD, spineD };
}
