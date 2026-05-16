// splotch.js — irregular ink blob.
//
// Used for: ensō interior ink puddles, Morse dots, and the wet "splat" base
// under each appendage. The shape is a noisy ellipse — 12–18 points sampled
// around a perturbed radius — smoothed with quadratic Bézier handles so the
// boundary reads as "organic" rather than "geometric".

/**
 * @param {Object} opts
 * @param {number} opts.cx
 * @param {number} opts.cy
 * @param {number} opts.size            base radius
 * @param {number} [opts.irregularity]  0..1 — how lumpy. 0 = round; 0.5 = clearly noisy.
 * @param {number} [opts.elongation]    0..1 — stretch factor (slight oval bias).
 * @param {number} [opts.rotationRad]   orientation for elongation
 * @param {Object} opts.rng             seeded RNG
 * @returns {string} SVG path `d` (closed)
 */
export function irregularBlob({
  cx,
  cy,
  size,
  irregularity = 0.3,
  elongation = 0.15,
  rotationRad,
  rng,
}) {
  const n = 12 + rng.int(0, 7); // 12..18 points
  const theta0 = rotationRad ?? rng.range(0, Math.PI * 2);
  const cosR = Math.cos(theta0);
  const sinR = Math.sin(theta0);

  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Radial noise: base 1 ± irregularity
    const noise = 1 + rng.gauss(0, irregularity * 0.4);
    const r = size * Math.max(0.35, noise);
    // Apply ellipse elongation in a rotated frame.
    let lx = Math.cos(a) * r * (1 + elongation);
    let ly = Math.sin(a) * r * (1 - elongation);
    // Rotate.
    const rx = lx * cosR - ly * sinR;
    const ry = lx * sinR + ly * cosR;
    pts.push({ x: cx + rx, y: cy + ry });
  }

  // Smooth via quadratic Béziers: each segment uses the *current* point as the
  // control and the midpoint between current and next as the on-curve anchor.
  // This produces visibly rounded corners without over-smoothing the noise.
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(pts[pts.length - 1], pts[0]);
  let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const nxt = pts[(i + 1) % n];
    const m = mid(cur, nxt);
    d += ` Q ${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`;
  }
  d += ' Z';
  return d;
}
