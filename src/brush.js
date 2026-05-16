// brush.js — every visible mark in the engine passes through here.
//
// `brushStroke({controlPoints, widthProfile, jitter, rng})` produces a *filled*
// SVG path that traces both edges of a virtual brush moving along a Catmull-Rom-ish
// spine through the control points. Width along the stroke is controlled by
// `widthProfile(t)` where t ∈ [0,1] (default = kenshin/harai taper: full at the
// start, ramping to ~zero at the end). Edge jitter perpendicular to the local
// normal gives the stroke a ragged, ink-like silhouette.

const SAMPLES = 40; // number of spine samples; more = smoother but heavier

// Default width profile: full width at the start, ease-out taper to zero at end.
// Real sumi-e strokes load ink at the beginning (kenshin) and trail off (harai).
// We approximate with a cubic ease — flat then a steady taper.
export function kenshinTaper(t) {
  // Held near 1 for the first ~30%, then smooth fall to zero.
  if (t < 0.3) return 1.0;
  const u = (t - 0.3) / 0.7; // 0..1 across the taper region
  return Math.max(0, (1 - u) * (1 - u)); // quadratic ease-out to zero
}

// Symmetric profile useful for prongs / dashes where both ends taper.
export function lensProfile(t) {
  return Math.sin(Math.PI * t); // 0 at both ends, 1 in middle
}

// Sample a centripetal-ish Catmull-Rom spline through `pts`. Returns {x,y} at param u.
// For internal use only; we deliberately keep the math simple to avoid an external dep.
function catmullRom(pts, u) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { ...pts[0] };
  if (n === 2) {
    return {
      x: pts[0].x + (pts[1].x - pts[0].x) * u,
      y: pts[0].y + (pts[1].y - pts[0].y) * u,
    };
  }
  const total = n - 1;
  const seg = Math.min(Math.floor(u * total), total - 1);
  const localT = u * total - seg;
  const p0 = pts[Math.max(0, seg - 1)];
  const p1 = pts[seg];
  const p2 = pts[seg + 1];
  const p3 = pts[Math.min(n - 1, seg + 2)];
  const t = localT;
  const t2 = t * t;
  const t3 = t2 * t;
  // Standard Catmull-Rom basis (tension = 0.5).
  const x = 0.5 * (
    (2 * p1.x) +
    (-p0.x + p2.x) * t +
    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
  );
  const y = 0.5 * (
    (2 * p1.y) +
    (-p0.y + p2.y) * t +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
  );
  return { x, y };
}

// Numerical tangent: small forward difference along the spline.
function tangentAt(pts, u) {
  const eps = 1e-3;
  const a = catmullRom(pts, Math.max(0, u - eps));
  const b = catmullRom(pts, Math.min(1, u + eps));
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Build a filled SVG path that traces both edges of a brush stroke.
 *
 * @param {Object} opts
 * @param {Array<{x:number,y:number}>} opts.controlPoints - spine control points
 * @param {(t:number)=>number} [opts.widthProfile] - returns half-width factor 0..1
 * @param {number} [opts.maxWidth] - max half-width in user units
 * @param {{edge:number, spine:number}} [opts.jitter] - pixel jitter amounts
 * @param {{next:Function, gauss:Function, range:Function}} opts.rng
 * @param {number} [opts.samples] - spine sample count
 * @returns {string} SVG `d` attribute for a closed filled shape
 */
export function brushStroke({
  controlPoints,
  widthProfile = kenshinTaper,
  maxWidth = 6,
  jitter = { edge: 0.6, spine: 0.0 },
  rng,
  samples = SAMPLES,
}) {
  if (!controlPoints || controlPoints.length < 2) return '';

  const left = [];
  const right = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const spine = catmullRom(controlPoints, t);

    // Optional spine wobble (rarely used; ragged feel mostly comes from edges).
    const spineWobble = jitter.spine || 0;
    if (spineWobble) {
      spine.x += rng.gauss(0, spineWobble);
      spine.y += rng.gauss(0, spineWobble);
    }

    const tan = tangentAt(controlPoints, t);
    // Normal is the 90° CCW rotation of the tangent (screen coords, Y-down).
    const nx = -tan.y;
    const ny = tan.x;

    const halfW = Math.max(0, widthProfile(t)) * maxWidth;
    const edgeJ = jitter.edge || 0;
    const jL = edgeJ ? rng.gauss(0, edgeJ) : 0;
    const jR = edgeJ ? rng.gauss(0, edgeJ) : 0;

    left.push({
      x: spine.x + nx * (halfW + jL),
      y: spine.y + ny * (halfW + jL),
    });
    right.push({
      x: spine.x - nx * (halfW + jR),
      y: spine.y - ny * (halfW + jR),
    });
  }

  // Build path: left edge forward, then right edge in reverse, closed.
  // Use simple L commands — the jitter already provides organic variation.
  let d = `M ${left[0].x.toFixed(2)} ${left[0].y.toFixed(2)}`;
  for (let i = 1; i < left.length; i++) {
    d += ` L ${left[i].x.toFixed(2)} ${left[i].y.toFixed(2)}`;
  }
  // Round end-cap at the tail: small arc connecting left tip → right tip.
  const tailLeft = left[left.length - 1];
  const tailRight = right[right.length - 1];
  const tailRadius = Math.max(0.1, Math.hypot(tailLeft.x - tailRight.x, tailLeft.y - tailRight.y) / 2);
  d += ` A ${tailRadius.toFixed(2)} ${tailRadius.toFixed(2)} 0 0 1 ${tailRight.x.toFixed(2)} ${tailRight.y.toFixed(2)}`;
  for (let i = right.length - 2; i >= 0; i--) {
    d += ` L ${right[i].x.toFixed(2)} ${right[i].y.toFixed(2)}`;
  }
  // Round end-cap at the head.
  const headRight = right[0];
  const headLeft = left[0];
  const headRadius = Math.max(0.1, Math.hypot(headLeft.x - headRight.x, headLeft.y - headRight.y) / 2);
  d += ` A ${headRadius.toFixed(2)} ${headRadius.toFixed(2)} 0 0 1 ${headLeft.x.toFixed(2)} ${headLeft.y.toFixed(2)}`;
  d += ' Z';

  return d;
}

// Helper exposed for the enso module: sample the spine at a fixed param.
export function sampleSpine(controlPoints, u) {
  return catmullRom(controlPoints, u);
}
