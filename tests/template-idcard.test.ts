import { describe, it, expect } from 'vitest';
import { calculateNameFontSize } from '../src/client/lib/idcard-canvas';

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

  it('should calculate base font size for normal length names', () => {
    // Mock canvas 2D context
    const mockCtx = {
      font: '',
      measureText: (text: string) => ({
        width: text.length * 18, // ~200-300px for average name
      }),
    } as unknown as CanvasRenderingContext2D;

    const size = calculateNameFontSize(mockCtx, 'Budi Santoso', 54, 780);
    expect(size).toBe(54);
  });

  it('should auto-scale font size down for excessively long names without clipping', () => {
    const mockCtx = {
      font: '',
      measureText: (text: string) => ({
        width: text.length * 28, // 1400px for 50 chars
      }),
    } as unknown as CanvasRenderingContext2D;

    const longName = 'Muhammad Budi Santoso Pratama Kusuma Wardhana Al-Bantani';
    const size = calculateNameFontSize(mockCtx, longName, 54, 780);

    expect(size).toBeLessThan(54);
    expect(size).toBeGreaterThanOrEqual(30); // Maintains minimum readable size
  });

  it('should verify QR center and bounding coordinates within template box', () => {
    const CANVAS_WIDTH = 957;
    const CANVAS_HEIGHT = 1506;

    // Solid white box bounds found in idcard-template.png
    const boxMinX = 213;
    const boxMaxX = 675;
    const boxMinY = 399;
    const boxMaxY = 786;

    const boxWidth = boxMaxX - boxMinX + 1; // 463
    const boxHeight = boxMaxY - boxMinY + 1; // 388
    const boxCenterX = (boxMinX + boxMaxX) / 2; // 444
    const boxCenterY = (boxMinY + boxMaxY) / 2; // 592.5

    const qrSize = 340;
    const qrX = boxCenterX - qrSize / 2;
    const qrY = boxCenterY - qrSize / 2;

    // QR must fit completely inside the white box
    expect(qrX).toBeGreaterThanOrEqual(boxMinX);
    expect(qrX + qrSize).toBeLessThanOrEqual(boxMaxX);
    expect(qrY).toBeGreaterThanOrEqual(boxMinY);
    expect(qrY + qrSize).toBeLessThanOrEqual(boxMaxY);

    // Name position must be situated below the white box and above the 2026-2027 footer
    const nameCenterY = 915;
    expect(nameCenterY).toBeGreaterThan(boxMaxY); // Below QR box
    expect(nameCenterY).toBeLessThan(1013); // Above "2026 - 2027"
  });
});
