import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/**
 * Apply a diagonal repeating "CONTROLLED COPY" watermark across all pages.
 */
export async function applyWatermark(
  pdfBytes: Uint8Array,
  text: string = 'CONTROLLED COPY'
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = 42;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    // Create a grid of diagonal watermarks across the page
    const spacingX = textWidth + 80;
    const spacingY = 120;

    for (let y = -spacingY; y < height + spacingY; y += spacingY) {
      for (let x = -textWidth; x < width + textWidth; x += spacingX) {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.85, 0.85, 0.85),
          rotate: degrees(35),
          opacity: 0.15,
        });
      }
    }
  }

  return pdfDoc.save();
}
