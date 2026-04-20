import { PDFDocument, rgb } from 'pdf-lib';
import type { FieldPositions } from './template-builder';

type Rect = { x: number; y: number; w: number; h: number };

function redactRect(page: ReturnType<typeof PDFDocument.prototype.getPages>[0], pos: Rect) {
  if (pos.w === 0 || pos.h === 0) return;
  const BLACK = rgb(0, 0, 0);
  const LABEL_COLOR = rgb(0.12, 0.12, 0.12);
  page.drawRectangle({ x: pos.x, y: pos.y, width: pos.w, height: pos.h, color: BLACK });
  page.drawText('REDACTED', { x: pos.x + 4, y: pos.y + 2, size: 8, color: LABEL_COLOR });
}

/**
 * Apply black-bar redaction over sensitive field positions on page 1 and the
 * final transcript page.
 */
export async function applyRedaction(
  pdfBytes: Uint8Array,
  fieldPositions: FieldPositions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // ── Page 1: cert number, date of issue, CEO signature ───────────
  const p1 = pages[0];
  if (!p1) throw new Error('PDF has no pages — cannot apply redaction');

  for (const key of ['scope', 'auditRef', 'certNo', 'issueDate', 'ceoSignature'] as const) {
    redactRect(p1, fieldPositions[key]);
  }

  // ── Final transcript page: cert number and date at bottom ───────
  const lastPage = pages[pages.length - 1];
  if (lastPage && pages.length > 1) {
    redactRect(lastPage, fieldPositions.page2CertNo);
    redactRect(lastPage, fieldPositions.page2Date);
  }

  return pdfDoc.save();
}
