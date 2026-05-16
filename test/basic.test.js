// Structural smoke tests for the V2 flowing-arc renderer that powers heptacipher.
//
// Run via:  npm test    (vitest --environment happy-dom — set in package.json)

import { describe, it, expect } from 'vitest';
import { renderHeptapodNumeralV2 } from '../src/index.js';

describe('renderHeptapodNumeralV2', () => {
  it('returns an SVG with the V2 flowing-arc structure', () => {
    const svg = renderHeptapodNumeralV2({
      number: 3729,
      encoding: 'morse',
      size: 400,
      seed: 1,
    });

    expect(svg).toBeTruthy();
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 400');
    expect(svg.dataset.number).toBe('3729');
    expect(svg.dataset.encoding).toBe('morse');
    expect(svg.dataset.variant).toBe('v2');

    // Animation metadata is baked into dataset so the quiz can reconstruct
    // the brush gesture (clockwise sweep + per-quadrant lobe sync).
    expect(svg.dataset.cx).toBeTruthy();
    expect(svg.dataset.cy).toBeTruthy();
    expect(svg.dataset.gapStartDeg).toBeTruthy();
    expect(svg.dataset.bodySweepDeg).toBeTruthy();
    expect(svg.dataset.tailSweepDeg).toBeTruthy();
    expect(svg.dataset.wetDropX).toBeTruthy();
    expect(svg.dataset.wetDropY).toBeTruthy();

    // Three layers: far halo, near halo, crisp. We scope structural checks
    // to the crisp layer (the halos are blurred copies of the same content).
    const crisp = svg.querySelector('g.ink-crisp');
    expect(crisp).toBeTruthy();
    expect(crisp.querySelector('g.enso')).toBeTruthy();
    expect(crisp.querySelector('g.wet-drop')).toBeTruthy();
    expect(crisp.querySelector('g.wet-drop path')).toBeTruthy();

    // Four lobe-appendage groups, classed for V2 morse.
    const appendages = crisp.querySelectorAll('g.appendage');
    expect(appendages.length).toBe(4);
    appendages.forEach((g) => {
      expect(g.getAttribute('class')).toMatch(/morse-arc/);
      // 5 morse marks per digit (data-halo layers can be skipped by samplers).
      expect(g.querySelectorAll('path').length).toBe(5);
    });

    const halo = svg.querySelector('g.ink-halo');
    expect(halo).toBeTruthy();
    expect(halo.getAttribute('data-halo')).toBe('true');
  });

  it('emits 4 prongs per appendage in prong mode', () => {
    const svg = renderHeptapodNumeralV2({ number: 1234, encoding: 'prong', size: 300, seed: 7 });
    const crisp = svg.querySelector('g.ink-crisp');
    const appendages = crisp.querySelectorAll('g.appendage');
    expect(appendages.length).toBe(4);
    appendages.forEach((g) => {
      expect(g.getAttribute('class')).toMatch(/prong-arc/);
      expect(g.querySelectorAll('path').length).toBe(4);
    });
  });

  it('produces a stable render for a pinned seed', () => {
    const a = renderHeptapodNumeralV2({ number: 42, encoding: 'morse', size: 300, seed: 12345 });
    const b = renderHeptapodNumeralV2({ number: 42, encoding: 'morse', size: 300, seed: 12345 });
    expect(a.innerHTML).toBe(b.innerHTML);
  });

  it('rejects invalid inputs', () => {
    expect(() => renderHeptapodNumeralV2({ number: -1, encoding: 'morse', size: 200 })).toThrow(TypeError);
    expect(() => renderHeptapodNumeralV2({ number: 10000, encoding: 'morse', size: 200 })).toThrow(TypeError);
    expect(() => renderHeptapodNumeralV2({ number: 1.5, encoding: 'morse', size: 200 })).toThrow(TypeError);
    expect(() => renderHeptapodNumeralV2({ number: 1, encoding: 'binary', size: 200 })).toThrow(TypeError);
    expect(() => renderHeptapodNumeralV2({ number: 1, encoding: 'morse', size: -5 })).toThrow(TypeError);
  });
});
