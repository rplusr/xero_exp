// Central app state: owns the config, the generated composition, and
// orchestrates regenerate (new random walk) vs. rebuild (re-render the
// existing walk with new visual parameters — cheap, safe to run on every
// slider tick).

import { buildComposition } from './build.js';
import { CUSTOM_PALETTE_ID, DEFAULT_PALETTE_ID, PALETTES, findPalette } from './palettes.js';
import { GeneratedLine, generateComposition } from './pathgen.js';
import { hashSeed, mulberry32, randomSeedString } from './rng.js';
import { RenderHandles, renderComposition } from './svg.js';
import { DriftHandleRef, createDrift, runDrawIn } from './animate.js';
import { lerp } from './geometry.js';
import { prefersReducedMotion } from './util.js';

export interface Config {
  seed: string;
  lineCount: number;
  thickness: number;
  cornerRadius: number;
  gridDensity: number;
  spacing: number;
  paletteId: string;
  customColors: string[];
  background: 'light' | 'dark';
  stations: boolean;
  animation: boolean;
}

export function defaultConfig(): Config {
  return {
    seed: randomSeedString(),
    lineCount: 7,
    thickness: 7,
    cornerRadius: 16,
    gridDensity: 5,
    spacing: 11,
    paletteId: DEFAULT_PALETTE_ID,
    customColors: ['#D1112E', '#0E7C61', '#2A2A2A'],
    background: 'light',
    stations: true,
    animation: true,
  };
}

function densityToCellSize(density: number): number {
  const t = (density - 1) / 9;
  return lerp(72, 22, Math.max(0, Math.min(1, t)));
}

export class TravelLinesApp {
  config: Config = defaultConfig();
  private generated: GeneratedLine[] = [];
  private driftRef: DriftHandleRef = { current: null };
  private drift = createDrift(this.driftRef);
  private reducedMotion = prefersReducedMotion();

  constructor(private svg: SVGSVGElement, private wrapper: HTMLElement) {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
      this.rebuild();
    });
  }

  getReducedMotion(): boolean {
    return this.reducedMotion;
  }

  getLastHandles(): RenderHandles | null {
    return this.driftRef.current;
  }

  regenerate(seed?: string): void {
    this.config.seed = seed ?? randomSeedString();
    const rng = mulberry32(hashSeed(this.config.seed));
    this.generated = generateComposition(rng, { lineCount: this.config.lineCount, bundleChance: 0.55 });
    this.rebuild(true);
  }

  private resolveColors(): string[] {
    if (this.config.paletteId === CUSTOM_PALETTE_ID) {
      const custom = this.config.customColors.filter(Boolean);
      return custom.length >= 2 ? custom : PALETTES[0].colors;
    }
    return findPalette(this.config.paletteId)?.colors ?? PALETTES[0].colors;
  }

  rebuild(animateIn = false): void {
    if (!this.generated.length) {
      this.regenerate(this.config.seed);
      return;
    }
    const rect = this.wrapper.getBoundingClientRect();
    const width = Math.max(240, Math.round(rect.width));
    const height = Math.max(240, Math.round(rect.height));
    const cellSize = densityToCellSize(this.config.gridDensity);
    const colors = this.resolveColors();

    const comp = buildComposition(this.generated, {
      cellSize,
      spacing: this.config.spacing,
      cornerRadius: this.config.cornerRadius,
      colors,
      stations: this.config.stations,
    });

    const handles = renderComposition(this.svg, comp, {
      width,
      height,
      padding: Math.min(width, height) * 0.1,
      thickness: this.config.thickness,
      stationsEnabled: this.config.stations,
      stationRadius: Math.max(5, this.config.thickness * 0.95),
    });

    this.driftRef.current = handles;
    runDrawIn(handles, animateIn && this.config.animation, this.reducedMotion);

    if (this.config.animation && !this.reducedMotion) {
      this.drift.start();
    } else {
      this.drift.stop();
    }

    document.documentElement.dataset.theme = this.config.background;
  }
}
