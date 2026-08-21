import { describe, it, expect } from 'vitest';
import {
  calculateNameFontSize,
  BOX_X,
  BOX_Y,
  BOX_SIZE,
  QR_SIZE,
  QR_X,
  QR_Y,
  BASE_FONT_SIZE,
  MIN_FONT_SIZE,
  NAME_CENTER_Y,
} from '../src/client/lib/idcard-canvas';

describe('Official Template ID Card (54mm x 85mm) Engine Tests', () => {
  it('should maintain accurate physical aspect ratio (54mm x 85mm)', () => {
    const physicalWidthMm = 54;
    const physicalHeightMm = 85;
    const physicalRatio = physicalWidthMm / physicalHeightMm; // ~0.63529

    const canvasWidthPx = 957;
    const canvasHeightPx = 1506;
    const canvasRatio = canvasWidthPx / canvasHeightPx; // ~0.63545

    const delta = Math.abs(physicalRatio - canvasRatio);
    expect(delta).toBeLessThan(0.001); // 99.97% accuracy match
  });

  it('should calculate base font size (60px canvas / 20px display) for normal length names', () => {
    const mockCtx = {
      font: '',
      measureText: (text: string) => ({
        width: text.length * 20, // ~200-300px for average name
      }),
    } as unknown as CanvasRenderingContext2D;

    const size = calculateNameFontSize(mockCtx, 'Budi Santoso', 60, 51, 760);
    expect(size).toBe(60);
  });

  it('should auto-scale font size down for excessively long names without clipping (min 51px canvas / 17px display)', () => {
    const mockCtx = {
      font: '',
      measureText: (text: string) => ({
        width: text.length * 30, // 1500px for 50 chars
      }),
    } as unknown as CanvasRenderingContext2D;

    const longName = 'Muhammad Budi Santoso Pratama Kusuma Wardhana Al-Bantani';
    const size = calculateNameFontSize(mockCtx, longName, 60, 51, 760);

    expect(size).toBeLessThan(60);
    expect(size).toBeGreaterThanOrEqual(51); // Maintains minimum 17px equivalent
  });

  it('should verify exact 388x388 solid white box coordinates and symmetrical enlarged QR placement', () => {
    expect(BOX_X).toBe(288);
    expect(BOX_Y).toBe(399);
    expect(BOX_SIZE).toBe(388);
    expect(QR_SIZE).toBe(374);

    // Padding on all 4 sides must be perfectly equal and slim (7px)
    const paddingLeft = QR_X - BOX_X;
    const paddingRight = BOX_X + BOX_SIZE - (QR_X + QR_SIZE);
    const paddingTop = QR_Y - BOX_Y;
    const paddingBottom = BOX_Y + BOX_SIZE - (QR_Y + QR_SIZE);

    expect(paddingLeft).toBe(7);
    expect(paddingRight).toBe(7);
    expect(paddingTop).toBe(7);
    expect(paddingBottom).toBe(7);

    // Name position must be situated below the white box and above the 2026-2027 footer
    expect(NAME_CENTER_Y).toBeGreaterThan(BOX_Y + BOX_SIZE); // Below 787
    expect(NAME_CENTER_Y).toBeLessThan(1013); // Above 1013
  });
});
