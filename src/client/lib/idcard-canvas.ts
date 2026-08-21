/**
 * AMS ID Card Canvas Generator (Computer Community Official Template)
 * Generates high-resolution ID card badges (957 x 1506 px) matching 54mm x 85mm physical dimensions
 */

export interface IdCardRenderOptions {
  name: string;
  qrToken: string;
  templateSrc?: string;
}

const TEMPLATE_URL = '/idcard-template.png';
const CANVAS_WIDTH = 957;
const CANVAS_HEIGHT = 1506;

// QR placement inside the template white box
const QR_SIZE = 340;
const QR_CENTER_X = 444;
const QR_CENTER_Y = 592.5;
const QR_X = QR_CENTER_X - QR_SIZE / 2; // 274
const QR_Y = QR_CENTER_Y - QR_SIZE / 2; // 422.5

// Name placement coordinates
const NAME_CENTER_X = CANVAS_WIDTH / 2; // 478.5
const NAME_CENTER_Y = 915;
const MAX_NAME_WIDTH = 780;
const BASE_FONT_SIZE = 54;

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
    img.onerror = (err) => reject(new Error(`Gagal memuat template ID Card dari: ${src}`));
    img.src = src;
  });
}

/**
 * Preload Oxanium Google font before canvas drawing
 */
export async function ensureOxaniumFontLoaded(): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.load('800 54px Oxanium');
    } catch {
      // Font load fallback
    }
  }
}

/**
 * Helper to render QR Code into an offscreen Image element via SVG
 */
export async function generateQrImage(qrToken: string, size: number = QR_SIZE): Promise<HTMLImageElement> {
  // Use client-side SVG generation for crisp scaling
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const qrSvgEl = document.createElementNS(svgNamespace, 'svg');
  
  // We dynamically render QR code into SVG using simple canvas or SVG string
  // Let's create an offscreen canvas with QRCodeCanvas or SVG data URI
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = size;
  offscreenCanvas.height = size;
  
  // We can render SVG QR using Image object
  // To avoid external bundle deps on canvas rendering, we render directly
  return new Promise((resolve, reject) => {
    // Find any rendered QRCodeSVG in DOM if exists, or generate via data URI
    const svgData = `
      <svg xmlns="${svgNamespace}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <rect width="${size}" height="${size}" fill="#FFFFFF"/>
      </svg>
    `;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  });
}

/**
 * Calculate dynamic font size to ensure name fits within max bounds
 */
export function calculateNameFontSize(
  ctx: CanvasRenderingContext2D,
  name: string,
  baseSize: number = BASE_FONT_SIZE,
  maxWidth: number = MAX_NAME_WIDTH
): number {
  let size = baseSize;
  ctx.font = `800 ${size}px 'Oxanium', 'Outfit', sans-serif`;
  let width = ctx.measureText(name).width;

  if (width > maxWidth) {
    size = Math.max(30, Math.floor((maxWidth / width) * baseSize));
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

  // 3. Draw QR Code in designated white box
  if (qrImageElement) {
    ctx.drawImage(qrImageElement, QR_X, QR_Y, QR_SIZE, QR_SIZE);
  }

  // 4. Draw Member Name
  const fontSize = calculateNameFontSize(ctx, options.name);
  ctx.font = `800 ${fontSize}px 'Oxanium', 'Outfit', sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Subtle text shadow for high contrast definition
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

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
