// prongDigitArc.js — V2: 4 prongs sprout from points along a digit-lobe arc.
//
// Same lobe geometry as morseDigitArc.js, but instead of dots/dashes riding
// along the lobe we emit 4 brush-stroke prongs at sample points along the
// lobe. OUT bits point radially outward from the ensō center (away from the
// ensō); IN bits point radially inward (toward and through the ensō).
//
// Encoding (4-bit binary, MSB first) matches V1 prongDigit.js exactly. The
// reading order along the lobe is leading-edge (near lobe start, the
// clockwise-forward direction along the ensō) → trailing-edge (near lobe
// end): MSB first, LSB last.

import { brushStroke, kenshinTaper } from './brush.js';
import { buildLobeControlPoints } from './morseDigitArc.js';

const DEG = Math.PI / 180;

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

function bits(digit) {
  return [(digit >> 3) & 1, (digit >> 2) & 1, (digit >> 1) & 1, digit & 1];
}

/**
 * @param {Object} opts
 * @param {number} opts.digit
 * @param {{x:number,y:number}} opts.lobeStartPoint
 * @param {{x:number,y:number}} opts.lobeEndPoint
 * @param {{x:number,y:number}} opts.ensoCenter
 * @param {number} opts.ensoRadius
 * @param {number} opts.scale     — overall length scale (≈ ensōRadius * 0.85)
 * @param {Object} opts.rng
 * @param {number} [opts.bulge=0.4]
 * @returns {string} SVG group fragment
 */
export function prongDigitArcAppendage({
  digit,
  lobeStartPoint,
  lobeEndPoint,
  ensoCenter,
  ensoRadius,
  scale,
  rng,
  bulge,
  inward = false,
}) {
  const pattern = bits(digit);
  const effectiveBulge = (bulge ?? 0.4) * (1 + rng.gauss(0, 0.06));

  const ctrl = buildLobeControlPoints({
    lobeStartPoint,
    lobeEndPoint,
    ensoCenter,
    ensoRadius,
    bulge: effectiveBulge,
    inward,
  });

  // 4 sample positions along the lobe — evenly spaced, avoiding the very
  // ends (which sit on the ensō itself).
  const sampleU = [0.18, 0.40, 0.60, 0.82];

  let body = '';

  pattern.forEach((bit, i) => {
    const u = sampleU[i] + rng.gauss(0, 0.02);
    const uClamped = Math.max(0.05, Math.min(0.95, u));
    const pos = cubicBezier(ctrl[0], ctrl[1], ctrl[2], ctrl[3], uClamped);

    // "Outward" = the direction the lobe bulges (away from the ensō body).
    // For outward lobes that's radially away from the center; for inward
    // lobes it's radially toward the center, so we flip the sign.
    const radialSign = inward ? -1 : 1;
    const ox = (pos.x - ensoCenter.x) * radialSign;
    const oy = (pos.y - ensoCenter.y) * radialSign;
    const oLen = Math.hypot(ox, oy) || 1;
    const outX = ox / oLen;
    const outY = oy / oLen;

    // Direction: OUT → outward; IN → inward (negate).
    // Light per-prong angle jitter (±15°).
    const jitterRad = rng.gauss(0, 7 * DEG);
    const baseDir = bit === 1 ? 1 : -1;
    const cosJ = Math.cos(jitterRad);
    const sinJ = Math.sin(jitterRad);
    const dirX = (outX * baseDir) * cosJ - (outY * baseDir) * sinJ;
    const dirY = (outX * baseDir) * sinJ + (outY * baseDir) * cosJ;

    // Length: OUT longer than IN (IN has to cross the ensō line but not spear
    // wildly across). Slightly shorter than V1 to keep V2's silhouette tight.
    const baseLen = scale * (bit === 1 ? 0.55 : 0.40);
    const lenJ = 1 + rng.gauss(0, 0.18);
    const prongLen = baseLen * Math.max(0.5, lenJ);

    // Origin: slightly off the lobe in the prong's direction so it visibly
    // sprouts FROM the lobe rather than starting buried inside it.
    const offsetFromLobe = ensoRadius * 0.02;
    const ox0 = pos.x + dirX * offsetFromLobe;
    const oy0 = pos.y + dirY * offsetFromLobe;

    // Subtle curl at the tip (mantid-tendril vibe).
    const perpX = -dirY;
    const perpY = dirX;
    const curlSign = rng.next() < 0.5 ? 1 : -1;
    const curl = prongLen * 0.18 * curlSign;

    const controlPoints = [
      { x: ox0, y: oy0 },
      { x: ox0 + dirX * prongLen * 0.5, y: oy0 + dirY * prongLen * 0.5 },
      {
        x: ox0 + dirX * prongLen * 0.85 + perpX * curl * 0.6,
        y: oy0 + dirY * prongLen * 0.85 + perpY * curl * 0.6,
      },
      {
        x: ox0 + dirX * prongLen + perpX * curl,
        y: oy0 + dirY * prongLen + perpY * curl,
      },
    ];

    const maxW = Math.max(1.5, scale * 0.04);
    const d = brushStroke({
      controlPoints,
      widthProfile: kenshinTaper,
      maxWidth: maxW,
      jitter: { edge: maxW * 0.22, spine: 0 },
      rng,
      samples: 28,
    });

    body += `<path class="prong ${bit ? 'out' : 'in'}" d="${d}" />`;
  });

  const sideClass = inward ? 'inward' : 'outward';
  return `<g class="appendage prong-arc ${sideClass} digit-${digit}">${body}</g>`;
}
