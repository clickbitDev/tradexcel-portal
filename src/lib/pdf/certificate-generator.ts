import {
  buildTemplate,
  resolveDefaultBaseTemplatePath,
  resolveDefaultFieldConfig,
  type CertificateData,
  type TemplateFieldConfig,
  type UnitResult,
} from './template-builder';
import { applyWatermark } from './watermark';
import { applyRedaction } from './redaction';
import { applyEncryption } from './security';
import { generateCertNumber } from './cert-number';
import { logger } from './logger';

export interface GenerateRequest {
  certificateNumber?: string;
  clientName: string;
  certificateTitle: string;
  /** Qualification code, e.g. "BSB50120" */
  qualificationCode?: string;
  issueDate: string;
  keyDetails: {
    scope: string;
    standard: string;
    auditRef: string;
    [key: string]: string;
  };
  logoUrl?: string;
  governingLogos?: string[];
  ceoSignatureUrl?: string;
  /** CEO name (defaults to RTO_CONFIG.ceoName) */
  ceoName?: string;
  /** CEO title (defaults to RTO_CONFIG.ceoTitle) */
  ceoTitle?: string;
  /** Unit results for the transcript page */
  units?: UnitResult[];
  /** Verification URL (used for QR code) */
  verificationUrl?: string;
  /** One-time print code */
  printCode?: string;
  /** If provided, generates the clean/unlocked version */
  ownerPassword?: string;
}

export interface GenerateResult {
  certificateNumber: string;
  pdf: string; // base64-encoded PDF
}

/**
 * Orchestrates the full certificate generation pipeline:
 * 1. Generate unique cert number
 * 2. Build PDF layout (from base template or programmatic)
 * 3. Conditionally apply watermark + redaction (user version only)
 * 4. Apply encryption
 * 5. Return cert number + base64 PDF
 */
export async function generateCertificate(
  request: GenerateRequest,
  options: {
    certPrefix?: string;
    systemOwnerPassword?: string;
    systemUserPassword?: string;
    isUnique?: (certNumber: string) => Promise<boolean>;
    baseTemplatePath?: string;
    fieldConfig?: TemplateFieldConfig;
  } = {}
): Promise<GenerateResult> {
  const {
    certPrefix = process.env.CERT_PREFIX || 'CERT',
    systemOwnerPassword = process.env.OWNER_PASSWORD || '',
    systemUserPassword = process.env.USER_PASSWORD || '',
    isUnique,
    baseTemplatePath,
    fieldConfig,
  } = options;

  const resolvedBaseTemplatePath = baseTemplatePath ?? resolveDefaultBaseTemplatePath();
  const resolvedFieldConfig = fieldConfig ?? resolveDefaultFieldConfig(resolvedBaseTemplatePath);

  if (!systemOwnerPassword) {
    throw new Error('OWNER_PASSWORD is required to generate secured certificates.');
  }

  const isUnlockedVersion = !!request.ownerPassword;

  // ── Step 1: Generate certificate number ────────────────────────
  logger.info('Generating certificate number...');
  const certificateNumber = request.certificateNumber?.trim()
    ? request.certificateNumber.trim()
    : await generateCertNumber({
      prefix: certPrefix,
      isUnique,
    });
  logger.info(`Certificate number: ${certificateNumber}`);

  // ── Step 2: Build PDF template ─────────────────────────────────
  logger.info('Building PDF template...');
  const templateData: CertificateData = {
    ...request,
    certificateNumber,
  };
  const { pdfBytes, fieldPositions } = await buildTemplate(templateData, {
    baseTemplatePath: resolvedBaseTemplatePath,
    fieldConfig: resolvedFieldConfig,
  });
  let currentPdf = pdfBytes;

  if (isUnlockedVersion) {
    // ── UNLOCKED VERSION: Verify owner password, skip watermark/redaction ──
    if (request.ownerPassword !== systemOwnerPassword) {
      throw new OwnerPasswordError('Invalid owner password');
    }
    logger.info('Generating UNLOCKED version (no watermark, no redaction)');

    // Apply encryption with full permissions
    currentPdf = await applyEncryption(currentPdf, {
      ownerPassword: systemOwnerPassword,
      userPassword: systemUserPassword || undefined,
      allowPrint: true,
      allowCopy: true,
      allowModify: false,
    });
  } else {
    // ── USER VERSION: Apply watermark + redaction + restrictive encryption ──
    logger.info('Generating USER version (watermark + redaction + restricted)');

    // Step 3: Apply watermark
    logger.info('Applying watermark...');
    currentPdf = await applyWatermark(currentPdf);

    if (resolvedFieldConfig.disableRedaction !== true) {
      // Step 4: Apply redaction
      logger.info('Applying redaction...');
      currentPdf = await applyRedaction(currentPdf, fieldPositions);
    } else {
      logger.info('Skipping redaction for this template variant');
    }

    // Step 5: Apply encryption with restricted permissions
    currentPdf = await applyEncryption(currentPdf, {
      ownerPassword: systemOwnerPassword,
      userPassword: systemUserPassword || undefined,
      allowPrint: false,
      allowCopy: false,
      allowModify: false,
    });
  }

  // ── Step 6: Convert to base64 ──────────────────────────────────
  const pdfBase64 = Buffer.from(currentPdf).toString('base64');
  logger.info('Certificate generation complete', {
    certificateNumber,
    version: isUnlockedVersion ? 'unlocked' : 'user',
    sizeKB: Math.round(currentPdf.length / 1024),
    hasTranscript: !!(request.units && request.units.length > 0),
  });

  return {
    certificateNumber,
    pdf: pdfBase64,
  };
}

/**
 * Custom error for invalid owner password attempts.
 */
export class OwnerPasswordError extends Error {
  public statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'OwnerPasswordError';
  }
}
