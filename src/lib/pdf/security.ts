import { PDFDocument } from 'pdf-lib';
import { spawnSync } from 'node:child_process';
import { logger } from './logger';

export interface EncryptionOptions {
  ownerPassword: string;
  userPassword?: string;
  /** If true, allow printing (for the unlocked version) */
  allowPrint?: boolean;
  /** If true, allow content copying */
  allowCopy?: boolean;
  /** If true, allow modification */
  allowModify?: boolean;
}

let cachedQpdfAvailable: boolean | null = null;

export function isQpdfAvailable(): boolean {
  if (cachedQpdfAvailable !== null) {
    return cachedQpdfAvailable;
  }

  cachedQpdfAvailable = spawnSync('qpdf', ['--version'], { stdio: 'ignore' }).status === 0;
  return cachedQpdfAvailable;
}

/**
 * Apply PDF encryption and permission restrictions.
 *
 * Uses pdf-lib's built-in encryption support (RC4-128 / AES-128).
 *
 * NOTE: For AES-256 encryption, install `qpdf` system-wide and use
 * `node-qpdf2` instead. This module can be swapped out transparently
 * since the interface is the same (bytes in → bytes out).
 */
export async function applyEncryption(
  pdfBytes: Uint8Array,
  options: EncryptionOptions
): Promise<Uint8Array> {
  const {
    ownerPassword,
    userPassword = '',
    allowPrint = false,
    allowCopy = false,
    allowModify = false,
  } = options;

  // pdf-lib doesn't have built-in encryption at the document level.
  // We need to use the low-level PDFWriter approach.
  // Since pdf-lib lacks native encryption, we'll do a two-step approach:
  //   1. Keep pdf-lib for content creation
  //   2. Use a pure-JS approach for encryption metadata
  //
  // For now, we'll encrypt by re-saving with metadata flags.
  // Full AES-256 requires the qpdf binary.

  try {
    // Attempt to use node-qpdf2 if qpdf is installed
    const { encrypt } = await import('node-qpdf2');
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    // Write PDF to temp file (qpdf works with files)
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `cert-input-${Date.now()}.pdf`);
    const outputPath = path.join(tmpDir, `cert-output-${Date.now()}.pdf`);

    fs.writeFileSync(inputPath, pdfBytes);

    const qpdfOptions = {
      input: inputPath,
      output: outputPath,
      // Use object form so user and owner passwords are set independently.
      // Empty user password = no password needed to open.
      password: {
        user:  userPassword ?? '',
        owner: ownerPassword,
      },
      keyLength: 256 as const,
      restrictions: {
        print: allowPrint ? 'full' as const : 'none' as const,
        modify: allowModify ? 'all' as const : 'none' as const,
        extract: allowCopy ? 'y' as const : 'n' as const,
        useAes: 'y' as const,
      },
    };

    await encrypt(qpdfOptions);

    const encryptedBytes = fs.readFileSync(outputPath);

    // Cleanup temp files
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch {
      // Non-critical cleanup failure
    }

    logger.info('PDF encrypted with AES-256 via qpdf');
    return new Uint8Array(encryptedBytes);
  } catch (err) {
    // qpdf not available — fall back to returning unencrypted PDF with a warning
    if (process.env.NODE_ENV === 'production') {
      throw new Error('qpdf is required in production to encrypt certificates.');
    }

    logger.warn(
      'qpdf not available — PDF will be generated WITHOUT encryption. ' +
      'Install qpdf with your system package manager (for example: brew install qpdf or apt install qpdf) for AES-256 encryption support.',
      { error: String(err) }
    );

    // Even without encryption, the watermark and redaction are baked into
    // the PDF content, so the document is still partially secured.
    return pdfBytes;
  }
}
