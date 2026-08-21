/**
 * AMS ID Card Canvas Generator (Computer Community Official Template)
 * Generates high-resolution ID card badges (957 x 1506 px) matching 54mm x 85mm physical dimensions
 */

export interface IdCardRenderOptions {
  name: string;
  qrToken: string;
  templateSrc?: string;
}

const TEMPLATE_URL = '/templates/idcard-template.png';
const CANVAS_WIDTH = 957;
const CANVAS_HEIGHT = 1506;

// Exact solid white box coordinates in idcard-template.png (388 x 388 px)
export const BOX_X = 288;
export const BOX_Y = 399;
export const BOX_SIZE = 388;

// Symmetrical centered QR placement inside the 388x388 white box (tight slim ~7px padding)
export const QR_SIZE = 374;
export const QR_X = BOX_X + (BOX_SIZE - QR_SIZE) / 2; // 295
export const QR_Y = BOX_Y + (BOX_SIZE - QR_SIZE) / 2; // 406

// Name placement coordinates (Oxanium ExtraBold)
export const NAME_CENTER_X = CANVAS_WIDTH / 2; // 478.5
export const NAME_CENTER_Y = 915;
export const MAX_NAME_WIDTH = 760;
export const BASE_FONT_SIZE = 60; // Equivalent to 20px on display
export const MIN_FONT_SIZE = 51;  // Equivalent to 17px on display

let cachedTemplateImg: HTMLImageElement | null = null;

/**
 * Preload template image and cache in memory
 */
export async function preloadTemplateImage(src: string = TEMPLATE_URL): Promise<HTMLImageElement> {
  if (cachedTemplateImg && cachedTemplateImg.src.includes(src) && cachedTemplateImg.complete) {
    return cachedTemplateImg;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedTemplateImg = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Gagal memuat template ID Card dari: ${src}`));
    img.src = src;
  });
}

/**
 * Preload Oxanium Google font before canvas drawing
 */
export async function ensureOxaniumFontLoaded(): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.load('800 60px Oxanium');
    } catch {
      // Fallback
    }
  }
}

/**
 * Calculate dynamic font size to ensure name fits within max bounds (min 17px equivalent / 51px canvas)
 */
export function calculateNameFontSize(
  ctx: CanvasRenderingContext2D,
  name: string,
  baseSize: number = BASE_FONT_SIZE,
  minSize: number = MIN_FONT_SIZE,
  maxWidth: number = MAX_NAME_WIDTH
): number {
  let size = baseSize;
  ctx.font = `800 ${size}px 'Oxanium', 'Outfit', sans-serif`;
  let width = ctx.measureText(name).width;

  if (width > maxWidth) {
    size = Math.max(minSize, Math.floor((maxWidth / width) * baseSize));
  }
  return size;
}

/**
 * Render ID Card to an HTML5 Canvas
 */
export async function renderIdCardToCanvas(
  canvas: HTMLCanvasElement,
  options: IdCardRenderOptions,
  qrImageElement?: HTMLImageElement | HTMLCanvasElement
): Promise<void> {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  // 1. Ensure Font and Template are loaded
  await ensureOxaniumFontLoaded();
  const templateImg = await preloadTemplateImage(options.templateSrc || TEMPLATE_URL);

  // 2. Draw Background Template
  ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 3. Draw QR Code in designated white box with perfect symmetry
  if (qrImageElement) {
    ctx.drawImage(qrImageElement, QR_X, QR_Y, QR_SIZE, QR_SIZE);
  }

  // 4. Draw Member Name with Oxanium ExtraBold (800)
  const fontSize = calculateNameFontSize(ctx, options.name);
  ctx.font = `800 ${fontSize}px 'Oxanium', 'Outfit', sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Subtle text shadow for high contrast definition
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  ctx.fillText(options.name, NAME_CENTER_X, NAME_CENTER_Y);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Generate high-res PNG Data URL of the ID Card
 */
export async function generateIdCardDataUrl(
  options: IdCardRenderOptions,
  qrCanvasOrImage?: HTMLImageElement | HTMLCanvasElement
): Promise<string> {
  const offscreen = document.createElement('canvas');
  await renderIdCardToCanvas(offscreen, options, qrCanvasOrImage);
  return offscreen.toDataURL('image/png', 1.0);
}

/**
 * Trigger browser file download of the generated ID card PNG
 */
export function downloadIdCardImage(name: string, dataUrl: string): void {
  const sanitizedName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'idcard';
  const link = document.createElement('a');
  link.download = `ID_Card_${sanitizedName}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
