import {
  PDFDocument,
  PDFImage,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { loadImage, loadImages } from './image-loader';
import { logger } from './logger';
import { RTO_CONFIG } from './data/qualifications';
import * as fs from 'fs';
import * as path from 'path';

// ── Brand colors ─────────────────────────────────────────────────
const MAROON     = rgb(0.35, 0.05, 0.1);
const GOLD       = rgb(0.65, 0.5, 0.15);
const GOLD_LIGHT = rgb(0.85, 0.73, 0.4);
const GOLD_DARK  = rgb(0.45, 0.35, 0.1);
const BLUE       = rgb(0.2, 0.6, 0.82);
const NAVY       = rgb(0.01, 0.04, 0.12);
const NAVY_DARK  = rgb(0.06, 0.09, 0.16);
const WHITE      = rgb(1, 1, 1);
const CREAM      = rgb(0.99, 0.985, 0.96);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const MID_GRAY   = rgb(0.45, 0.45, 0.45);
const DARK_GRAY  = rgb(0.25, 0.25, 0.25);
const BLACK      = rgb(0, 0, 0);
const CHARCOAL   = rgb(0.08, 0.08, 0.08);
const SLATE      = rgb(0.2, 0.2, 0.2);
const BORDER_GOLD = rgb(0.78, 0.63, 0.25);

// ── Layout constants (A4 portrait: 595.28 × 841.89 pts) ─────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;

// ── Print-safe margins — top unchanged, L/R/bottom reduced 10pt ──
const PM_TOP  = 36;   // top stays
const PM_SIDE = 21;   // left & right sides (-15pt total from original)
const PM_BOT  = 16;   // bottom (-20pt total from original)
const PM      = PM_TOP; // kept for any references that use top value

// ── Content area insets (matching HTML reference) ────────────────
const CL = 60;                         // content left  (clears navy stripe at x=48)
const CR = 40;                         // content right (-50%)
const CT = 58;                         // content top   (-10%)
const CB = 38;                         // content bottom (-50%)
const CW = PAGE_W - CL - CR;          // usable content width (495.28 pt)

// ─────────────────────────────────────────────────────────────────
// Data types
// ─────────────────────────────────────────────────────────────────

export interface UnitResult {
  unitCode: string;
  unitTitle: string;
  result: string;
  year?: string;
}

export interface CertificateData {
  certificateNumber: string;
  clientName: string;
  certificateTitle: string;
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
  ceoName?: string;
  ceoTitle?: string;
  units?: UnitResult[];
  verificationUrl?: string;
  printCode?: string;
}

export interface FieldPositions {
  scope:         { x: number; y: number; w: number; h: number };
  auditRef:      { x: number; y: number; w: number; h: number };
  certNo:        { x: number; y: number; w: number; h: number };
  clientName:    { x: number; y: number; w: number; h: number };
  issueDate:     { x: number; y: number; w: number; h: number };
  ceoSignature:  { x: number; y: number; w: number; h: number };
  page2CertNo:   { x: number; y: number; w: number; h: number };
  page2Date:     { x: number; y: number; w: number; h: number };
}

export interface TemplateResult {
  pdfBytes: Uint8Array;
  fieldPositions: FieldPositions;
}

// ─────────────────────────────────────────────────────────────────
// Template coordinate configuration
// ─────────────────────────────────────────────────────────────────

export interface TextFieldConfig {
  x: number;
  y: number;
  size: number;
  maxWidth?: number;
}

export interface TemplateFieldConfig {
  variant?: 'default' | 'tradexcel-2026';
  disableRedaction?: boolean;
  certPage: {
    clientName: TextFieldConfig;
    certificateTitle: TextFieldConfig;
    issueDate: TextFieldConfig;
    certNumber: TextFieldConfig;
    scope: TextFieldConfig;
    standard: TextFieldConfig;
    auditRef: TextFieldConfig;
  };
  transcriptPage?: {
    title: TextFieldConfig;
    clientName: TextFieldConfig;
    qualification?: TextFieldConfig;
    certNumber: TextFieldConfig;
    issueDate?: TextFieldConfig;
    tableStart: { x: number; y: number };
    tableColumns: {
      unitCodeX: number;
      unitTitleX: number;
      resultX: number;
    };
    rowHeight: number;
    fontSize: number;
    bottomY?: number;
    continuationNote?: TextFieldConfig;
  };
  fixedRedaction?: Partial<FieldPositions>;
}

export const DEFAULT_FIELD_CONFIG: TemplateFieldConfig = {
  variant: 'default',
  disableRedaction: false,
  certPage: {
    certificateTitle: { x: PAGE_W / 2, y: 510, size: 18 },
    clientName:       { x: PAGE_W / 2, y: 580, size: 24, maxWidth: 450 },
    standard:         { x: PAGE_W / 2, y: 460, size: 10 },
    scope:            { x: PAGE_W / 2, y: 480, size: 14 },
    auditRef:         { x: PAGE_W / 2, y: 440, size: 10 },
    certNumber:       { x: PAGE_W / 2, y: 420, size: 10 },
    issueDate:        { x: PAGE_W / 2, y: 440, size: 10 },
  },
  transcriptPage: {
    title:      { x: 55, y: PAGE_H - 55, size: 22 },
    clientName: { x: 55, y: PAGE_H - 120, size: 11 },
    certNumber: { x: 55, y: PAGE_H - 138, size: 10 },
    tableStart: { x: 55, y: PAGE_H - 175 },
    tableColumns: {
      unitCodeX: 120,
      unitTitleX: 210,
      resultX: 510,
    },
    rowHeight: 20,
    fontSize: 9,
  },
};

export const TRADEXCEL_TEMPLATE_FILENAME = 'Tradexcel Certificate 2026v1.0_low(F)-1.pdf';

const TRADEXCEL_TEMPLATE_ASSET_PATH = path.join(process.cwd(), TRADEXCEL_TEMPLATE_FILENAME);

export const TRADEXCEL_FIELD_CONFIG: TemplateFieldConfig = {
  variant: 'tradexcel-2026',
  disableRedaction: true,
  certPage: {
    clientName:       { x: PAGE_W / 2, y: 450, size: 20, maxWidth: 455 },
    certificateTitle: { x: PAGE_W / 2, y: 344, size: 17, maxWidth: 470 },
    issueDate:        { x: 118, y: 252, size: 9.5, maxWidth: 120 },
    certNumber:       { x: 486, y: 252, size: 9.5, maxWidth: 120 },
    scope:            { x: 0, y: 0, size: 0 },
    standard:         { x: 0, y: 0, size: 0 },
    auditRef:         { x: 0, y: 0, size: 0 },
  },
  transcriptPage: {
    title:         { x: PAGE_W / 2, y: 677, size: 22 },
    clientName:    { x: 176, y: 648, size: 10, maxWidth: 330 },
    qualification: { x: 176, y: 623, size: 8.5, maxWidth: 300 },
    certNumber:    { x: 176, y: 598, size: 10, maxWidth: 150 },
    issueDate:     { x: 404, y: 598, size: 10, maxWidth: 110 },
    tableStart:    { x: 90, y: 552 },
    tableColumns: {
      unitCodeX: 90,
      unitTitleX: 182,
      resultX: 498,
    },
    rowHeight: 17,
    fontSize: 8.5,
    bottomY: 160,
    continuationNote: { x: PAGE_W / 2, y: 653, size: 9 },
  },
};

export function resolveDefaultBaseTemplatePath(): string | undefined {
  const configuredPath = process.env.CERTIFICATE_TEMPLATE_PATH?.trim();
  const candidates = [configuredPath, TRADEXCEL_TEMPLATE_ASSET_PATH].filter((value): value is string => !!value);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

export function resolveDefaultFieldConfig(baseTemplatePath?: string): TemplateFieldConfig {
  if (baseTemplatePath && path.basename(baseTemplatePath) === TRADEXCEL_TEMPLATE_FILENAME) {
    return TRADEXCEL_FIELD_CONFIG;
  }

  return DEFAULT_FIELD_CONFIG;
}

// ─────────────────────────────────────────────────────────────────
// Font loading helper
// ─────────────────────────────────────────────────────────────────

function assetPath(relativePath: string): string {
  return path.join(process.cwd(), 'src/lib/pdf', relativePath);
}

interface EmbeddedFonts {
  raleway: PDFFont;
  ralewayBold: PDFFont;
  ralewayExtraBold: PDFFont;
  montserrat: PDFFont;
  montserratBold: PDFFont;
  helveticaBold: PDFFont;
  helvetica: PDFFont;
  timesBold: PDFFont;
  timesRoman: PDFFont;
  dancingScript: PDFFont;
}

async function embedCustomFonts(pdfDoc: PDFDocument): Promise<EmbeddedFonts> {
  pdfDoc.registerFontkit(fontkit);

  const ralewayBytes = fs.readFileSync(assetPath(RTO_CONFIG.fonts.raleway));
  const montserratBytes = fs.readFileSync(assetPath(RTO_CONFIG.fonts.montserrat));

  // Regular fonts (variable, defaults to light weight - used for body text)
  const raleway = await pdfDoc.embedFont(ralewayBytes);
  const montserrat = await pdfDoc.embedFont(montserratBytes);
  // Static bold instances generated from variable font (fonttools instantiateVariableFont)
  const ralewayBoldBytes = fs.readFileSync(assetPath('assets/fonts/Raleway-Bold.ttf'));
  const ralewayBold = await pdfDoc.embedFont(ralewayBoldBytes);
  const ralewayExtraBoldBytes = fs.readFileSync(assetPath('assets/fonts/Raleway-ExtraBold.ttf'));
  const ralewayExtraBold = await pdfDoc.embedFont(ralewayExtraBoldBytes);
  const montserratBoldBytes = fs.readFileSync(assetPath('assets/fonts/Montserrat-Bold.ttf'));
  const montserratBold = await pdfDoc.embedFont(montserratBoldBytes);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const dancingScriptBytes = fs.readFileSync(assetPath('assets/fonts/DancingScript.ttf'));
  const dancingScript = await pdfDoc.embedFont(dancingScriptBytes);

  return { raleway, ralewayBold, ralewayExtraBold, montserrat, montserratBold, helveticaBold, helvetica, timesBold, timesRoman, dancingScript };
}

function flattenTemplateFormFields(pdfDoc: PDFDocument): void {
  try {
    const form = pdfDoc.getForm();
    if (form.getFields().length > 0) {
      form.flatten();
    }
  } catch (error) {
    logger.warn('Failed to flatten template form fields', { error: String(error) });
  }
}

function getFittedImageSize(
  image: PDFImage,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maxHeight / image.height, maxWidth / image.width);
  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

async function embedProjectPng(
  pdfDoc: PDFDocument,
  relativePath: string,
  label: string,
): Promise<PDFImage | null> {
  try {
    const imageBytes = fs.readFileSync(assetPath(relativePath));
    return await pdfDoc.embedPng(imageBytes);
  } catch (error) {
    logger.warn(`Failed to embed ${label}`, {
      error: String(error),
      path: relativePath,
    });
    return null;
  }
}

async function embedRuntimePng(
  pdfDoc: PDFDocument,
  source: string,
  label: string,
): Promise<PDFImage | null> {
  try {
    const pngBuffer = await loadImage(source);
    return await pdfDoc.embedPng(pngBuffer);
  } catch (error) {
    logger.warn(`Failed to load ${label}`, {
      error: String(error),
    });
    return null;
  }
}

async function resolveBrandLogo(
  pdfDoc: PDFDocument,
  customSource?: string,
): Promise<PDFImage | null> {
  if (customSource) {
    const customLogo = await embedRuntimePng(pdfDoc, customSource, 'custom brand logo');
    if (customLogo) {
      return customLogo;
    }
  }

  return embedProjectPng(pdfDoc, RTO_CONFIG.logoPath, 'brand logo');
}

async function resolveGoverningLogos(
  pdfDoc: PDFDocument,
  customSources?: string[],
): Promise<PDFImage[]> {
  const images: PDFImage[] = [];

  if (customSources && customSources.length > 0) {
    const customBuffers = await loadImages(customSources);
    for (const buffer of customBuffers) {
      if (!buffer) {
        continue;
      }

      try {
        images.push(await pdfDoc.embedPng(buffer));
      } catch (error) {
        logger.warn('Failed to embed governing logo', {
          error: String(error),
        });
      }
    }
  }

  for (const source of [RTO_CONFIG.aqfLogoPath, RTO_CONFIG.nrtLogoPath]) {
    if (images.length >= 2) {
      break;
    }

    const defaultLogo = await embedProjectPng(pdfDoc, source, 'governing logo');
    if (defaultLogo) {
      images.push(defaultLogo);
    }
  }

  return images.slice(0, 2);
}

async function resolveSignatureImage(
  pdfDoc: PDFDocument,
  customSource?: string,
): Promise<PDFImage | null> {
  if (customSource) {
    const customSignature = await embedRuntimePng(pdfDoc, customSource, 'custom signature image');
    if (customSignature) {
      return customSignature;
    }
  }

  const defaultSignaturePath = assetPath(RTO_CONFIG.signaturePath);
  if (!fs.existsSync(defaultSignaturePath)) {
    return null;
  }

  return embedProjectPng(pdfDoc, RTO_CONFIG.signaturePath, 'signature image');
}

// ─────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────

export async function buildTemplate(
  data: CertificateData,
  options: {
    baseTemplatePath?: string;
    fieldConfig?: TemplateFieldConfig;
  } = {}
): Promise<TemplateResult> {
  const { baseTemplatePath, fieldConfig = DEFAULT_FIELD_CONFIG } = options;

  if (baseTemplatePath) {
    return buildFromBaseTemplate(data, baseTemplatePath, fieldConfig);
  }

  return buildProgrammatic(data, fieldConfig);
}

// ─────────────────────────────────────────────────────────────────
// Option C: Load pre-designed PDF + overlay dynamic fields
// ─────────────────────────────────────────────────────────────────

async function buildFromBaseTemplate(
  data: CertificateData,
  templatePath: string,
  config: TemplateFieldConfig
): Promise<TemplateResult> {
  if (config.variant === 'tradexcel-2026') {
    return buildTradexcelFromTemplate(data, templatePath, config);
  }

  logger.info('Loading base PDF template', { path: templatePath });

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  flattenTemplateFormFields(pdfDoc);
  const fonts = await embedCustomFonts(pdfDoc);
  const pages = pdfDoc.getPages();

  if (pages.length < 1) {
    throw new Error('Base template PDF must have at least 1 page');
  }

  const certPage = pages[0];
  const c = config.certPage;

  drawCenteredText(certPage, data.certificateTitle, c.certificateTitle, fonts.raleway, MAROON);
  drawCenteredText(certPage, data.clientName, c.clientName, fonts.raleway, NAVY);

  drawText(certPage, data.keyDetails.standard, c.standard, fonts.montserrat, NAVY);
  drawText(certPage, data.keyDetails.scope, c.scope, fonts.montserrat, NAVY);
  drawText(certPage, data.keyDetails.auditRef, c.auditRef, fonts.montserrat, NAVY);
  drawText(certPage, data.certificateNumber, c.certNumber, fonts.montserrat, NAVY);
  drawText(certPage, data.issueDate, c.issueDate, fonts.montserrat, NAVY);

  const fieldPositions = buildFieldPositions(config, fonts.montserrat, data);

  if (data.units && data.units.length > 0 && config.transcriptPage) {
    let transcriptPage: PDFPage;
    if (pages.length >= 2) {
      transcriptPage = pages[1];
    } else {
      transcriptPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    }
    renderTranscript(transcriptPage, data, config.transcriptPage, fonts, pdfDoc);
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, fieldPositions };
}

type FieldRect = FieldPositions[keyof FieldPositions];

function zeroRect(): FieldRect {
  return { x: 0, y: 0, w: 0, h: 0 };
}

function emptyFieldPositions(): FieldPositions {
  return {
    scope: zeroRect(),
    auditRef: zeroRect(),
    certNo: zeroRect(),
    clientName: zeroRect(),
    issueDate: zeroRect(),
    ceoSignature: zeroRect(),
    page2CertNo: zeroRect(),
    page2Date: zeroRect(),
  };
}

function rectFromTextBounds(
  bounds: { x: number; y: number; w: number; h: number },
  padX: number = 2,
  padY: number = 3,
): FieldRect {
  return {
    x: bounds.x - padX,
    y: bounds.y - padY,
    w: bounds.w + padX * 2,
    h: bounds.h + padY * 2,
  };
}

function buildQualificationLabel(data: CertificateData): string {
  return data.qualificationCode
    ? `${data.qualificationCode} - ${data.certificateTitle}`
    : data.certificateTitle;
}

async function populateTradexcelCertificateFields(
  templateDoc: PDFDocument,
  data: CertificateData,
): Promise<void> {
  const form = templateDoc.getForm();
  const font = await templateDoc.embedFont(StandardFonts.Helvetica);

  form.getTextField('Name').setText(data.clientName.trim().toUpperCase());
  form.getTextField('Qualification').setText(buildQualificationLabel(data).trim());
  form.getTextField('Cerno').setText(data.certificateNumber);
  form.getTextField('Issuedate_af_date').setText(formatDate(data.issueDate));
  form.updateFieldAppearances(font);
  form.flatten();
}

async function buildTradexcelFromTemplate(
  data: CertificateData,
  templatePath: string,
  config: TemplateFieldConfig,
): Promise<TemplateResult> {
  if (!config.transcriptPage) {
    throw new Error('Tradexcel template requires transcript page configuration');
  }

  logger.info('Loading Tradexcel certificate template', { path: templatePath });

  const templateBytes = fs.readFileSync(templatePath);
  const certificateTemplateDoc = await PDFDocument.load(templateBytes);
  await populateTradexcelCertificateFields(certificateTemplateDoc, data);

  const templateDoc = await PDFDocument.load(templateBytes);
  flattenTemplateFormFields(templateDoc);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedCustomFonts(pdfDoc);
  const fieldPositions = emptyFieldPositions();

  const [certTemplatePage] = await pdfDoc.copyPages(certificateTemplateDoc, [0]);
  pdfDoc.addPage(certTemplatePage);

  if (data.units && data.units.length > 0) {
    const transcriptPositions = await renderTradexcelTranscriptPages(
      pdfDoc,
      templateDoc,
      data,
      config.transcriptPage,
      fonts,
    );
    fieldPositions.page2CertNo = transcriptPositions.certNo;
    fieldPositions.page2Date = transcriptPositions.date;
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, fieldPositions };
}

async function renderTradexcelTranscriptPages(
  pdfDoc: PDFDocument,
  templateDoc: PDFDocument,
  data: CertificateData,
  config: NonNullable<TemplateFieldConfig['transcriptPage']>,
  fonts: EmbeddedFonts,
): Promise<{ certNo: FieldRect; date: FieldRect }> {
  const units = data.units ?? [];
  if (units.length === 0) {
    return { certNo: zeroRect(), date: zeroRect() };
  }

  const qualificationLabel = buildQualificationLabel(data);
  const bottomY = config.bottomY ?? 160;
  let cursor = 0;
  let pageIndex = 0;
  let lastCertBounds = zeroRect();
  let lastDateBounds = zeroRect();

  while (cursor < units.length) {
    const [templatePage] = await pdfDoc.copyPages(templateDoc, [1]);
    const page = pdfDoc.addPage(templatePage);
    const isContinuation = pageIndex > 0;

    renderTradexcelTranscriptHeader(page, data, qualificationLabel, config, fonts, isContinuation);

    let rowY = config.tableStart.y;
    while (cursor < units.length && rowY - config.rowHeight >= bottomY) {
      drawTradexcelTranscriptRow(page, units[cursor], cursor, rowY, config, fonts);
      rowY -= config.rowHeight;
      cursor += 1;
    }

    if (cursor >= units.length) {
      const certBounds = drawFittedText(
        page,
        data.certificateNumber,
        config.certNumber.x,
        config.certNumber.y,
        fonts.helveticaBold,
        config.certNumber.size,
        config.certNumber.maxWidth ?? 150,
        CHARCOAL,
      );
      lastCertBounds = rectFromTextBounds(certBounds);

      if (config.issueDate) {
        const dateBounds = drawFittedText(
          page,
          formatDate(data.issueDate),
          config.issueDate.x,
          config.issueDate.y,
          fonts.helveticaBold,
          config.issueDate.size,
          config.issueDate.maxWidth ?? 110,
          CHARCOAL,
        );
        lastDateBounds = rectFromTextBounds(dateBounds);
      }
    }

    pageIndex += 1;
  }

  return { certNo: lastCertBounds, date: lastDateBounds };
}

function renderTradexcelTranscriptHeader(
  page: PDFPage,
  data: CertificateData,
  qualificationLabel: string,
  config: NonNullable<TemplateFieldConfig['transcriptPage']>,
  fonts: EmbeddedFonts,
  isContinuation: boolean,
): void {
  drawFittedText(
    page,
    data.clientName.trim(),
    config.clientName.x,
    config.clientName.y,
    fonts.helveticaBold,
    config.clientName.size,
    config.clientName.maxWidth ?? 330,
    CHARCOAL,
  );

  if (config.qualification) {
    drawFittedText(
      page,
      qualificationLabel,
      config.qualification.x,
      config.qualification.y,
      fonts.helveticaBold,
      config.qualification.size,
      config.qualification.maxWidth ?? 330,
      CHARCOAL,
    );
  }

  if (isContinuation && config.continuationNote) {
    drawCenteredFittedText(
      page,
      '(continued)',
      config.continuationNote.x,
      config.continuationNote.y,
      fonts.helveticaBold,
      config.continuationNote.size,
      config.continuationNote.maxWidth ?? 120,
      MID_GRAY,
    );
  }
}

function drawTradexcelTranscriptRow(
  page: PDFPage,
  unit: UnitResult,
  rowIndex: number,
  y: number,
  config: NonNullable<TemplateFieldConfig['transcriptPage']>,
  fonts: EmbeddedFonts,
): void {
  const rowY = y;
  const tableLeft = config.tableColumns.unitCodeX - 6;
  const tableWidth = PAGE_W - tableLeft - 48;

  if (rowIndex % 2 === 0) {
    page.drawRectangle({
      x: tableLeft,
      y: rowY - 3,
      width: tableWidth,
      height: config.rowHeight - 1,
      color: LIGHT_GRAY,
      opacity: 0.35,
    });
  }

  page.drawText(unit.unitCode, {
    x: config.tableColumns.unitCodeX,
    y: rowY,
    size: config.fontSize,
    font: fonts.helveticaBold,
    color: CHARCOAL,
  });

  let title = unit.unitTitle;
  const maxTitleWidth = config.tableColumns.resultX - config.tableColumns.unitTitleX - 14;
  while (fonts.helvetica.widthOfTextAtSize(title, config.fontSize) > maxTitleWidth && title.length > 10) {
    title = `${title.slice(0, -4)}...`;
  }

  page.drawText(title, {
    x: config.tableColumns.unitTitleX,
    y: rowY,
    size: config.fontSize,
    font: fonts.helvetica,
    color: CHARCOAL,
  });

  page.drawText(abbreviateResult(unit.result), {
    x: config.tableColumns.resultX,
    y: rowY,
    size: config.fontSize,
    font: fonts.helveticaBold,
    color: CHARCOAL,
  });
}

// ─────────────────────────────────────────────────────────────────
// Decorative helpers
// ─────────────────────────────────────────────────────────────────

function drawPageFrame(page: PDFPage): void {
  // ── Cream background ───────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });

  // ── Diagonal security hatching (anti-copy pattern) ─────────────
  const hatchColor = rgb(0.93, 0.89, 0.83);
  for (let k = -PAGE_H; k < PAGE_W; k += 40) {
    page.drawLine({
      start: { x: k, y: 0 },
      end: { x: k + PAGE_H, y: PAGE_H },
      thickness: 0.15,
      color: hatchColor,
      opacity: 0.4,
    });
  }

  // ── Central focal glow (layered) ────────────────────────────────
  const glowColor = rgb(0.98, 0.94, 0.88);
  page.drawCircle({
    x: PAGE_W / 2, y: PAGE_H * 0.38,
    size: 180,
    color: glowColor,
    opacity: 0.3,
  });

  // ── Navy side accent stripe (left edge) ───────────────────────
  page.drawRectangle({
    x: PM_SIDE, y: PM_BOT,
    width: 11, height: PAGE_H - PM_BOT - PM_TOP,
    color: NAVY,
  });
  // Gold trim on right edge of navy stripe
  page.drawRectangle({
    x: PM_SIDE + 11, y: PM_BOT,
    width: 1.5, height: PAGE_H - PM_BOT - PM_TOP,
    color: GOLD,
  });

  // ── Outer gold border ────────────────────────────────────────
  const outerML = PM_SIDE + 13;
  const outerMT = PM_TOP  + 13;
  const outerMB = PM_BOT  + 13;
  const outerMR = PM_SIDE + 13;
  page.drawRectangle({
    x: outerML, y: outerMB,
    width: PAGE_W - outerML - outerMR, height: PAGE_H - outerMB - outerMT,
    borderColor: BORDER_GOLD, borderWidth: 2.5, opacity: 0,
  });

  // ── Inner gold border ────────────────────────────────────────
  const innerM  = PM_TOP  + 20; // used for top/corner reference
  const innerML = PM_SIDE + 20;
  const innerMT = PM_TOP  + 20;
  const innerMB = PM_BOT  + 20;
  const innerMR = PM_SIDE + 20;
  page.drawRectangle({
    x: innerML, y: innerMB,
    width: PAGE_W - innerML - innerMR, height: PAGE_H - innerMB - innerMT,
    borderColor: rgb(0.82, 0.68, 0.32), borderWidth: 0.8, opacity: 0,
  });

  // ── Corner ornaments (gold L-shapes with inner diamond) ─────────
  const cornerLen = 48;
  const cornerThickness = 3.5;
  const cornerColor = BORDER_GOLD;
  const cm = Math.min(innerML, innerMT) - 2;  // corner anchor from directional insets

  // Helper to draw one L-corner + diamond
  const drawCorner = (cx: number, cy: number, flipX: boolean, flipY: boolean) => {
    const dx = flipX ? -1 : 1;
    const dy = flipY ? -1 : 1;
    // Horizontal arm
    page.drawRectangle({ x: cx, y: cy, width: cornerLen * dx, height: cornerThickness * dy, color: cornerColor });
    // Vertical arm
    page.drawRectangle({ x: cx, y: cy, width: cornerThickness * dx, height: cornerLen * dy, color: cornerColor });
    // Diamond decoration at corner junction
    const diaX = cx + 12 * dx;
    const diaY = cy + 12 * dy;
    page.drawCircle({
      x: diaX, y: diaY, size: 2.5,
      color: GOLD,
    });
    // Second smaller dot further in
    const dia2X = cx + 20 * dx;
    const dia2Y = cy + 20 * dy;
    page.drawCircle({
      x: dia2X, y: dia2Y, size: 1.5,
      color: GOLD_LIGHT,
    });
  };

  // Top-left
  drawCorner(cm, PAGE_H - innerMT + 2 - cornerThickness, false, false);
  // Top-right
  drawCorner(PAGE_W - cm, PAGE_H - innerMT + 2 - cornerThickness, true, false);
  // Bottom-left
  drawCorner(cm, innerMB - 2 + cornerThickness, false, false);
  // Bottom-right
  drawCorner(PAGE_W - cm, innerMB - 2 + cornerThickness, true, false);

  // ── Decorative dots along top/bottom inside border ──────────────
  const dotColor = rgb(0.82, 0.72, 0.42);
  const dotY_top = PAGE_H - innerMT - 7;
  const dotY_bot = innerMB + 7;
  for (let dx = innerML + 50; dx < PAGE_W - innerMR - 40; dx += 30) {
    page.drawCircle({ x: dx, y: dotY_top, size: 1, color: dotColor, opacity: 0.35 });
    page.drawCircle({ x: dx, y: dotY_bot, size: 1, color: dotColor, opacity: 0.35 });
  }
}

function drawGoldFooterBar(
  page: PDFPage,
  fonts: EmbeddedFonts,
  data: CertificateData,
): void {
  const barH = 30;
  const barY = PM;
  const centerX = PAGE_W / 2;

  // Gold-dark bar
  page.drawRectangle({
    x: PM, y: barY,
    width: PAGE_W - 2 * PM, height: barH,
    color: GOLD_DARK,
  });

  // Line 1: RTO name, ABN, RTO code (custom bold font)
  const line1 = `${RTO_CONFIG.rtoName} \u2022 ABN ${RTO_CONFIG.abn} \u2022 RTO ${RTO_CONFIG.rtoCode}`;
  const line1Size = 7;
  const line1W = fonts.ralewayBold.widthOfTextAtSize(line1, line1Size);
  page.drawText(line1, {
    x: centerX - line1W / 2,
    y: barY + barH - 11,
    size: line1Size,
    font: fonts.ralewayBold,
    color: WHITE,
  });

  // Line 2: Address + email (custom regular font, tighter gap)
  const line2 = `${RTO_CONFIG.address} \u2022 ${RTO_CONFIG.email}`;
  const line2Size = 6;
  const line2W = fonts.montserratBold.widthOfTextAtSize(line2, line2Size);
  page.drawText(line2, {
    x: centerX - line2W / 2,
    y: barY + 7,
    size: line2Size,
    font: fonts.montserratBold,
    color: WHITE,
  });
}

function drawGoldAccentLine(page: PDFPage, y: number, width: number): void {
  const centerX = PAGE_W / 2;
  // Main line
  page.drawRectangle({
    x: centerX - width / 2, y,
    width, height: 1.5,
    color: GOLD,
  });
  // Center diamond (drawn as overlapping circles for star effect)
  page.drawCircle({ x: centerX, y: y + 0.75, size: 3.5, color: GOLD });
  page.drawCircle({ x: centerX, y: y + 0.75, size: 2, color: rgb(0.98, 0.95, 0.88) });
  // Endpoint dots
  page.drawCircle({ x: centerX - width / 2, y: y + 0.75, size: 2, color: GOLD });
  page.drawCircle({ x: centerX + width / 2, y: y + 0.75, size: 2, color: GOLD });
  // Secondary thin line below
  page.drawRectangle({
    x: centerX - (width * 0.5) / 2, y: y - 6,
    width: width * 0.5, height: 0.4,
    color: GOLD_LIGHT,
  });
}

// ─────────────────────────────────────────────────────────────────
// Option A: Fully programmatic EBC-branded layout (PREMIUM)
// Reference: ANT/SBTC/Sphere style certificates
// ─────────────────────────────────────────────────────────────────

async function buildProgrammatic(
  data: CertificateData,
  config: TemplateFieldConfig
): Promise<TemplateResult> {
  logger.info('Building programmatic PDF template (portrait)');

  const pdfDoc = await PDFDocument.create();
  const fonts = await embedCustomFonts(pdfDoc);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const centerX = PAGE_W / 2;
  const brandLogo = await resolveBrandLogo(pdfDoc, data.logoUrl);
  const governingLogos = await resolveGoverningLogos(pdfDoc, data.governingLogos);
  const signatureImage = await resolveSignatureImage(pdfDoc, data.ceoSignatureUrl);

  // ── Background + borders + corner ornaments ────────────────────
  drawPageFrame(page);

  // ── Navy header band at very top (above logo) ──────────────────
  const hdrBandH = 12;
  const hdrBandY = PAGE_H - PM - hdrBandH;
  page.drawRectangle({
    x: PM, y: hdrBandY,
    width: PAGE_W - 2 * PM, height: hdrBandH,
    color: NAVY,
  });
  // Gold trim line below header band
  page.drawRectangle({
    x: PM, y: hdrBandY - 2,
    width: PAGE_W - 2 * PM, height: 2,
    color: GOLD,
  });

  // ── QR Code top-right (below navy band) ────────────────────────
  if (data.verificationUrl) {
    try {
      const qrPngBuffer = await QRCode.toBuffer(data.verificationUrl, {
        type: 'png', width: 200, margin: 1,
        color: { dark: '#1A1E33', light: '#00000000' },  // transparent background
        errorCorrectionLevel: 'H',
      });
      const qrImage = await pdfDoc.embedPng(qrPngBuffer);
      const qrSize = 55;
      const qrInnerM = PM + 20;  // matches innerM border constant = 56pt
      page.drawImage(qrImage, {
        x: PAGE_W - qrInnerM - qrSize - 24,  // 20pt further left
        y: PAGE_H - qrInnerM - qrSize - 19,  // 15pt lower
        width: qrSize,
        height: qrSize,
      });
    } catch (e) {
      logger.warn('Failed to generate QR code', { error: String(e) });
    }
  }

  // ── Content vertical centering ─────────────────────────────────
  // HTML: .cert-content { top:64pt; bottom:76pt; justify-content:center }
  // Content area height = PAGE_H - CT - CB ≈ 702pt
  // Estimated content block ≈ 610pt → offset ≈ 95pt to center in available space
  const contentAreaTop = PAGE_H - CT;               // 777.89
  const contentVOffset = 20;
  let cy = contentAreaTop - contentVOffset;          // ≈ 757.89 — logo sits near top

  // ── EBC Logo centered ─────────────────────────────────────────
  // HTML: .logo { max-height:95pt; max-width:140pt } — first child
  if (brandLogo) {
    const { width: logoW, height: logoH } = getFittedImageSize(brandLogo, 140, 95);
    page.drawImage(brandLogo, {
      x: centerX - logoW / 2,
      y: cy - logoH,
      width: logoW,
      height: logoH,
    });
    cy -= logoH;
  } else {
    cy -= 80;
  }

  // ── "This is to certify that" ──────────────────────────────────
  // HTML: .cert-preamble { margin-top:40pt; font-size:12pt }
  cy -= 40;
  const preText = 'This is to certify that';
  const preSize = 12;
  const preW = fonts.montserrat.widthOfTextAtSize(preText, preSize);
  page.drawText(preText, {
    x: centerX - preW / 2, y: cy,
    size: preSize, font: fonts.montserratBold, color: CHARCOAL,
  });

  // ── Gold accent line 1 ─────────────────────────────────────────
  // HTML: .gold-accent { margin-top:10pt; width:80pt }
  cy -= (preSize + 8);  // clears preamble text height
  drawGoldAccentLine(page, cy, 80);

  // ── Client name ────────────────────────────────────────────────
  // HTML: .client-name { font-size:28pt; font-weight:700; text-transform not needed - already uppercase in design }
  cy -= 36;  // name top = accent_y - 6, no overlap
  const clientNameUpper = data.clientName.toUpperCase();
  const nameSize = clampFontSize(fonts.ralewayBold, clientNameUpper, 28, CW);
  const nameW = fonts.ralewayBold.widthOfTextAtSize(clientNameUpper, nameSize);
  const nameX = centerX - nameW / 2;
  const nameY = cy;
  page.drawText(clientNameUpper, {
    x: nameX, y: nameY,
    size: nameSize, font: fonts.ralewayBold, color: NAVY,
  });

  // ── Gold accent line 2 ─────────────────────────────────────────
  // HTML: .gold-accent { margin-top:10pt; width:120pt }
  cy -= 8;
  drawGoldAccentLine(page, cy, 120);

  // ── "Has fulfilled the requirements for" ───────────────────────
  // HTML: .cert-midtext { font-weight:600; font-size:12pt }
  cy -= 30;
  const midText = 'Has fulfilled the requirements for';
  const midSize = 11;
  const midW = fonts.montserrat.widthOfTextAtSize(midText, midSize);
  page.drawText(midText, {
    x: centerX - midW / 2, y: cy,
    size: midSize, font: fonts.montserratBold, color: CHARCOAL,
  });

  // HTML: .cert-title -- split code onto its own line so long titles don't clip border
  const qualCode = data.qualificationCode || data.keyDetails.scope || '';
  cy -= 36;
  if (qualCode) {
    const codeSize = clampFontSize(fonts.ralewayBold, qualCode, 14, CW);
    const codeW = fonts.ralewayBold.widthOfTextAtSize(qualCode, codeSize);
    page.drawText(qualCode, {
      x: centerX - codeW / 2, y: cy,
      size: codeSize, font: fonts.ralewayBold, color: MAROON,
    });
    cy -= codeSize + 4;
  }
  const titleOnly = data.certificateTitle.toUpperCase();
  const qualSize = clampFontSize(fonts.ralewayExtraBold, titleOnly, 18, CW);
  const qualW = fonts.ralewayExtraBold.widthOfTextAtSize(titleOnly, qualSize);
  page.drawText(titleOnly, {
    x: centerX - qualW / 2, y: cy,
    size: qualSize, font: fonts.ralewayExtraBold, color: MAROON,
  });

  cy -= qualSize + 18;
  const standardLine = drawCenteredFittedText(
    page,
    `Standard: ${data.keyDetails.standard}`,
    centerX,
    cy,
    fonts.montserratBold,
    9.5,
    CW,
    NAVY,
  );

  cy -= standardLine.h + 10;
  drawCenteredFittedText(
    page,
    `Scope: ${data.keyDetails.scope}`,
    centerX,
    cy,
    fonts.montserrat,
    10,
    CW,
    CHARCOAL,
  );

  cy -= 18;
  drawCenteredFittedText(
    page,
    `Audit Reference: ${data.keyDetails.auditRef}`,
    centerX,
    cy,
    fonts.montserratBold,
    9,
    CW,
    SLATE,
  );

  // ── Certificate Number ─────────────────────────────────────────
  // HTML: div margin-top:20pt; .cert-meta { font-size:9pt }
  cy -= 22;
  const fieldPositions: FieldPositions = {
    scope:        { x: 0, y: 0, w: 0, h: 0 },  // not applicable in programmatic mode
    auditRef:     { x: 0, y: 0, w: 0, h: 0 },  // not applicable in programmatic mode
    certNo:       { x: 0, y: 0, w: 0, h: 0 },
    clientName:   { x: 0, y: 0, w: 0, h: 0 },  // student name IS shown in public version
    issueDate:    { x: 0, y: 0, w: 0, h: 0 },
    ceoSignature: { x: 0, y: 0, w: 0, h: 0 },  // updated below after sig block is drawn
    page2CertNo:  { x: 0, y: 0, w: 0, h: 0 },  // updated after page 2 is rendered
    page2Date:    { x: 0, y: 0, w: 0, h: 0 },  // updated after page 2 is rendered
  };

  const certNoLine = drawCenteredFittedText(
    page,
    `Certificate Number: ${data.certificateNumber}`,
    centerX,
    cy,
    fonts.montserratBold,
    9.5,
    CW,
    NAVY,
  );
  fieldPositions.certNo = {
    x: certNoLine.x - 2,
    y: certNoLine.y - 3,
    w: certNoLine.w + 4,
    h: certNoLine.h + 4,
  };

  // ── Date of Issue ──────────────────────────────────────────────
  // HTML: .cert-meta margin-top:5pt
  cy -= certNoLine.h + 8;
  const issueDateLine = drawCenteredFittedText(
    page,
    `Date of Issue: ${formatDate(data.issueDate)}`,
    centerX,
    cy,
    fonts.montserratBold,
    9.5,
    CW,
    NAVY,
  );
  fieldPositions.issueDate = {
    x: issueDateLine.x - 2,
    y: issueDateLine.y - 3,
    w: issueDateLine.w + 4,
    h: issueDateLine.h + 4,
  };

  // ── AQF Recognition Statement ─────────────────────────────────
  // HTML: .aqf-statement { margin-top:20pt; font-size:7pt }
  cy -= issueDateLine.h + 22;
  const aqfStatement = 'THE QUALIFICATION IS RECOGNISED WITHIN THE AUSTRALIAN QUALIFICATIONS FRAMEWORK';
  const aqfSize = clampFontSize(fonts.montserrat, aqfStatement, 7, CW);
  const aqfW = fonts.montserrat.widthOfTextAtSize(aqfStatement, aqfSize);
  page.drawText(aqfStatement, {
    x: centerX - aqfW / 2, y: cy,
    size: aqfSize, font: fonts.montserratBold, color: DARK_GRAY,
  });

  // ── Signature area ─────────────────────────────────────────────
  // Sig block sits 60pt below AQF statement
  cy -= 60;
  const sigCenterY = cy;
  // The full sig block spans from sigCenterY-20 (CEO title) to sigCenterY+45 (top of sig image)
  // Width: sigLineW = 160pt, centered
  const SIG_BLOCK_W = 170;
  const ceoName = data.ceoName || RTO_CONFIG.ceoName || '';
  const ceoTitle = data.ceoTitle || RTO_CONFIG.ceoTitle;
  fieldPositions.ceoSignature = {
    x: centerX - SIG_BLOCK_W / 2,
    y: sigCenterY - 22,
    w: SIG_BLOCK_W,
    h: 67,  // covers title + name + line + image
  };

  const signatureText = ceoName || 'Authorised Signatory';
  if (signatureImage) {
    const { width: signatureW, height: signatureH } = getFittedImageSize(signatureImage, 150, 42);
    page.drawImage(signatureImage, {
      x: centerX - signatureW / 2,
      y: sigCenterY + 6,
      width: signatureW,
      height: signatureH,
    });
  } else {
    const sigFontSize = clampFontSize(fonts.dancingScript, signatureText, 28, 180);
    const sigTW = fonts.dancingScript.widthOfTextAtSize(signatureText, sigFontSize);
    page.drawText(signatureText, {
      x: centerX - sigTW / 2,
      y: sigCenterY + 10,
      size: sigFontSize,
      font: fonts.dancingScript,
      color: NAVY,
    });
  }

  // Signature line — HTML: .sig-line { width:160pt; height:0.8pt; margin-bottom:6pt }
  const sigLineW = 160;
  page.drawRectangle({
    x: centerX - sigLineW / 2, y: sigCenterY + 2,
    width: sigLineW, height: 0.8, color: NAVY,
  });

  if (ceoName) {
    // HTML: .sig-name { font-size:9pt; font-weight:700 }
    const ceoNameW = fonts.raleway.widthOfTextAtSize(ceoName, 9);
    page.drawText(ceoName, {
      x: centerX - ceoNameW / 2, y: sigCenterY - 8,
      size: 9, font: fonts.ralewayBold, color: NAVY,
    });
    // HTML: .sig-title-text { font-size:8pt }
    const ceoTitleW = fonts.montserrat.widthOfTextAtSize(ceoTitle, 8);
    page.drawText(ceoTitle, {
      x: centerX - ceoTitleW / 2, y: sigCenterY - 20,
      size: 8, font: fonts.montserratBold, color: SLATE,
    });
  } else {
    const sigLabel = 'Authorised Signatory';
    const sigLabelW = fonts.montserrat.widthOfTextAtSize(sigLabel, 8);
    page.drawText(sigLabel, {
      x: centerX - sigLabelW / 2, y: sigCenterY - 8,
      size: 8, font: fonts.montserratBold, color: MID_GRAY,
    });
  }

  // ── Government logos & Seal ────────────────────────────────────
  // HTML: .gov-logos-area { margin-top:20pt; justify-content:space-between }
  // HTML: .gov-logo { max-height:50pt; max-width:110pt }
  // Anchored near bottom of content area (CB + 65 ≈ 141pt from page bottom)
  // matching HTML's `justify-content:center` which centers the whole block including logos
  const govLogoY = CB + 150;  // raised higher to fill space between sig and logos
  const govMaxH = 75;        // 1.5x (was 50)
  const govMaxW = 165;       // 1.5x (was 110)

  const [aqfImg, nrtImg] = governingLogos;
  const aqfDims = aqfImg ? getFittedImageSize(aqfImg, govMaxW, govMaxH) : { width: 0, height: 0 };
  const nrtDims = nrtImg ? getFittedImageSize(nrtImg, govMaxW, govMaxH) : { width: 0, height: 0 };

  // AQF on left (HTML: first .gov-logo at content left edge)
  if (aqfImg) {
    page.drawImage(aqfImg, {
      x: CL,
      y: govLogoY,
      width: aqfDims.width,
      height: aqfDims.height,
    });
  }

  // NRT on right — inset 15pt extra from CR border to avoid gold border clip
  if (nrtImg) {
    page.drawImage(nrtImg, {
      x: PAGE_W - CR - nrtDims.width - 15,
      y: govLogoY,
      width: nrtDims.width,
      height: nrtDims.height,
    });
  }

  // ── Gold Seal (center, between logos) ──────────────────────────
  // HTML: .seal-container { width:90pt; height:90pt }
  const sealCenterX = centerX;
  const sealCenterY = govLogoY + govMaxH / 2 - 20;  // seal shifted 20pt lower than logo midpoint
  const sealR = 38;
  // Outer ring spiky dots
  for (let angle = 0; angle < 360; angle += 10) {
    const rad = (angle * Math.PI) / 180;
    const tipR = sealR + 3;
    const x1 = sealCenterX + Math.cos(rad) * tipR;
    const y1 = sealCenterY + Math.sin(rad) * tipR;
    page.drawCircle({
      x: x1, y: y1, size: 1.8,
      color: GOLD,
    });
  }
  // Outer circle
  page.drawCircle({
    x: sealCenterX, y: sealCenterY, size: sealR,
    borderColor: GOLD, borderWidth: 2, opacity: 0,
  });
  // Inner circle
  page.drawCircle({
    x: sealCenterX, y: sealCenterY, size: sealR - 6,
    borderColor: GOLD_LIGHT, borderWidth: 1, opacity: 0,
  });
  // Inner fill
  page.drawCircle({
    x: sealCenterX, y: sealCenterY, size: sealR - 8,
    color: rgb(0.98, 0.95, 0.88),
  });
  // Seal text
  const sealText1 = 'REGISTERED';
  const sealText2 = 'TRAINING';
  const sealText3 = 'ORGANISATION';
  const st1W = fonts.montserrat.widthOfTextAtSize(sealText1, 5.5);
  const st2W = fonts.montserrat.widthOfTextAtSize(sealText2, 5.5);
  const st3W = fonts.montserrat.widthOfTextAtSize(sealText3, 5.5);
  page.drawText(sealText1, { x: sealCenterX - st1W / 2, y: sealCenterY + 8, size: 5.5, font: fonts.montserrat, color: GOLD_DARK });
  page.drawText(sealText2, { x: sealCenterX - st2W / 2, y: sealCenterY, size: 5.5, font: fonts.montserrat, color: GOLD_DARK });
  page.drawText(sealText3, { x: sealCenterX - st3W / 2, y: sealCenterY - 8, size: 5.5, font: fonts.montserrat, color: GOLD_DARK });

  // Navy band sits directly on top of gold footer bar (barH=30), no gap
  page.drawRectangle({
    x: PM, y: PM + 30,
    width: PAGE_W - 2 * PM, height: 10,
    color: NAVY,
  });

  // ── Gold footer bar ────────────────────────────────────────────
  drawGoldFooterBar(page, fonts, data);

  // ── Print Code (tiny, above the navy band) ─────────────────────
  if (data.printCode) {
    const pcText = `Print Code: ${data.printCode}`;
    const pcW = fonts.montserrat.widthOfTextAtSize(pcText, 4);
    page.drawText(pcText, {
      x: centerX - pcW / 2, y: CB + 3,
      size: 4, font: fonts.montserrat, color: rgb(0.7, 0.7, 0.7),
    });
  }

  // ── Transcript page ────────────────────────────────────────────
  if (data.units && data.units.length > 0) {
    const tp = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const p2Pos = await renderTranscriptPortrait(tp, data, fonts, pdfDoc, brandLogo);
    fieldPositions.page2CertNo = p2Pos.certNo;
    fieldPositions.page2Date   = p2Pos.date;
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, fieldPositions };
}

// ─────────────────────────────────────────────────────────────────
// Render transcript page (portrait layout, premium design)
// ─────────────────────────────────────────────────────────────────

interface TranscriptTableLayout {
  leftM: number;
  rightM: number;
  colYear: number;
  colCode: number;
  colTitle: number;
  colResult: number;
  rowH: number;
  fontSize: number;
}

function getTranscriptLayout(): TranscriptTableLayout {
  return {
    leftM: CL,
    rightM: CR,
    colYear: CL,
    colCode: CL + 50,
    colTitle: CL + 160,
    colResult: PAGE_W - CR - 68,
    rowH: 18,
    fontSize: 8.5,
  };
}

function drawTranscriptPageHeader(
  page: PDFPage,
  data: CertificateData,
  fonts: EmbeddedFonts,
  brandLogo: PDFImage | null,
  continued: boolean,
): number {
  drawPageFrame(page);

  const leftM = CL;
  const rightM = CR;
  const titleText = continued ? 'Record of Results (continued)' : 'Record of Results';
  const titleSize = continued ? 20 : 22;
  let cy = PAGE_H - 70;
  let logoBottomY = cy;

  if (brandLogo) {
    const { width: logoW, height: logoH } = getFittedImageSize(brandLogo, 60, 45);
    const logoY = cy - logoH - 5;
    page.drawImage(brandLogo, {
      x: PAGE_W - CL - logoW - 50,
      y: logoY,
      width: logoW,
      height: logoH,
    });

    const titleH = fonts.raleway.heightAtSize(titleSize);
    const logoCenterY = logoY + logoH / 2;
    page.drawText(titleText, {
      x: leftM,
      y: logoCenterY - titleH / 2 + 4,
      size: titleSize,
      font: fonts.ralewayBold,
      color: NAVY,
    });

    logoBottomY = logoY;
  } else {
    page.drawText(titleText, {
      x: leftM,
      y: cy,
      size: titleSize,
      font: fonts.ralewayBold,
      color: NAVY,
    });
    logoBottomY = cy - 5;
  }

  cy = logoBottomY - 10;
  page.drawRectangle({
    x: leftM,
    y: cy,
    width: PAGE_W - leftM - rightM,
    height: 1.5,
    color: GOLD,
  });

  cy -= 30;
  page.drawText('NAME OF STUDENT:', {
    x: leftM,
    y: cy,
    size: 9,
    font: fonts.montserratBold,
    color: MID_GRAY,
  });
  page.drawText(data.clientName, {
    x: leftM + 130,
    y: cy,
    size: 10,
    font: fonts.montserratBold,
    color: NAVY,
  });

  cy -= 20;
  const qualCode = data.qualificationCode || data.keyDetails.scope || '';
  const qualFullText = qualCode
    ? `${qualCode} - ${data.certificateTitle}`
    : data.certificateTitle;
  page.drawText('NAME OF QUALIFICATION:', {
    x: leftM,
    y: cy,
    size: 9,
    font: fonts.montserratBold,
    color: MID_GRAY,
  });

  const qualLabelSize = clampFontSize(
    fonts.montserratBold,
    qualFullText,
    10,
    PAGE_W - leftM - rightM - 130,
  );
  page.drawText(qualFullText, {
    x: leftM + 130,
    y: cy,
    size: qualLabelSize,
    font: fonts.montserratBold,
    color: NAVY,
  });

  if (continued) {
    cy -= 20;
    page.drawText('CERTIFICATE NO:', {
      x: leftM,
      y: cy,
      size: 9,
      font: fonts.montserratBold,
      color: MID_GRAY,
    });
    page.drawText(data.certificateNumber, {
      x: leftM + 130,
      y: cy,
      size: 10,
      font: fonts.montserratBold,
      color: NAVY,
    });
  }

  return cy - 30;
}

function drawTranscriptTableHeader(
  page: PDFPage,
  fonts: EmbeddedFonts,
  y: number,
  layout: TranscriptTableLayout,
): number {
  const tableWidth = PAGE_W - 2 * layout.leftM + 10;
  const headerBg = rgb(0.12, 0.18, 0.38);

  page.drawRectangle({
    x: layout.leftM - 5,
    y: y - 4,
    width: tableWidth,
    height: layout.rowH + 2,
    color: headerBg,
  });

  page.drawText('YEAR', {
    x: layout.colYear,
    y,
    size: 9,
    font: fonts.ralewayBold,
    color: WHITE,
  });
  page.drawText('CODE', {
    x: layout.colCode,
    y,
    size: 9,
    font: fonts.ralewayBold,
    color: WHITE,
  });
  page.drawText('COMPETENCY', {
    x: layout.colTitle,
    y,
    size: 9,
    font: fonts.ralewayBold,
    color: WHITE,
  });
  page.drawText('RESULT', {
    x: layout.colResult,
    y,
    size: 9,
    font: fonts.ralewayBold,
    color: WHITE,
  });

  const nextY = y - 8;
  page.drawRectangle({
    x: layout.leftM - 5,
    y: nextY,
    width: tableWidth,
    height: 1,
    color: GOLD,
  });

  return nextY;
}

function drawTranscriptRow(
  page: PDFPage,
  fonts: EmbeddedFonts,
  unit: UnitResult,
  rowIndex: number,
  y: number,
  layout: TranscriptTableLayout,
  defaultYear: string,
): number {
  const rowY = y - layout.rowH;

  if (rowIndex % 2 === 0) {
    page.drawRectangle({
      x: layout.leftM - 5,
      y: rowY - 3,
      width: PAGE_W - 2 * layout.leftM + 10,
      height: layout.rowH,
      color: rgb(0.96, 0.96, 0.94),
    });
  }

  page.drawText(unit.year || defaultYear, {
    x: layout.colYear,
    y: rowY,
    size: layout.fontSize,
    font: fonts.montserratBold,
    color: NAVY,
  });
  page.drawText(unit.unitCode, {
    x: layout.colCode,
    y: rowY,
    size: layout.fontSize,
    font: fonts.montserratBold,
    color: NAVY,
  });

  let title = unit.unitTitle;
  const maxTitleW = layout.colResult - layout.colTitle - 15;
  while (fonts.montserrat.widthOfTextAtSize(title, layout.fontSize) > maxTitleW && title.length > 10) {
    title = title.slice(0, -4) + '...';
  }

  page.drawText(title, {
    x: layout.colTitle,
    y: rowY,
    size: layout.fontSize,
    font: fonts.montserratBold,
    color: CHARCOAL,
  });

  page.drawText(abbreviateResult(unit.result), {
    x: layout.colResult,
    y: rowY,
    size: layout.fontSize,
    font: fonts.helveticaBold,
    color: NAVY,
  });

  return rowY;
}

async function renderTranscriptPortrait(
  page: PDFPage,
  data: CertificateData,
  fonts: EmbeddedFonts,
  pdfDoc: PDFDocument,
  brandLogo: PDFImage | null,
): Promise<{ certNo: { x:number; y:number; w:number; h:number }; date: { x:number; y:number; w:number; h:number } }> {
  if (!data.units || data.units.length === 0) {
    return { certNo: { x: 0, y: 0, w: 0, h: 0 }, date: { x: 0, y: 0, w: 0, h: 0 } };
  }

  const centerX = PAGE_W / 2;
  const layout = getTranscriptLayout();
  const defaultYear = data.issueDate.split('-')[0] || new Date().getFullYear().toString();
  let currentPage = page;
  let cy = drawTranscriptPageHeader(currentPage, data, fonts, brandLogo, false);
  cy = drawTranscriptTableHeader(currentPage, fonts, cy, layout);

  for (let index = 0; index < data.units.length; index++) {
    const minY = index === data.units.length - 1 ? 220 : 130;
    if (cy - layout.rowH < minY) {
      drawGoldFooterBar(currentPage, fonts, data);
      currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      cy = drawTranscriptPageHeader(currentPage, data, fonts, brandLogo, true);
      cy = drawTranscriptTableHeader(currentPage, fonts, cy, layout);
    }

    cy = drawTranscriptRow(currentPage, fonts, data.units[index], index, cy, layout, defaultYear);
  }

  cy -= 8;
  currentPage.drawRectangle({
    x: layout.leftM - 5,
    y: cy,
    width: PAGE_W - 2 * layout.leftM + 10,
    height: 1,
    color: GOLD,
  });

  cy -= 20;
  currentPage.drawText('RESULT KEY: C = Competent  |  NYC = Not Yet Competent  |  CT = Credit Transfer', {
    x: layout.leftM,
    y: cy,
    size: 8,
    font: fonts.helveticaBold,
    color: CHARCOAL,
  });
  cy -= 16;
  currentPage.drawText('THESE UNITS HAVE BEEN DELIVERED AND ASSESSED IN ENGLISH BY A REGISTERED PROVIDER', {
    x: layout.leftM,
    y: cy - 15,
    size: 7.5,
    font: fonts.montserratBold,
    color: CHARCOAL,
  });

  const bottomY = Math.min(cy - 20, 170);
  let by = bottomY;

  const certNoText = `Certificate No: ${data.certificateNumber}`;
  const certNoW = fonts.montserratBold.widthOfTextAtSize(certNoText, 9);
  currentPage.drawText(certNoText, {
    x: centerX - certNoW / 2,
    y: by,
    size: 9,
    font: fonts.montserratBold,
    color: NAVY,
  });

  by -= 15;
  const dateText = `Date of Issue: ${formatDate(data.issueDate)}`;
  const dateW = fonts.montserratBold.widthOfTextAtSize(dateText, 9);
  currentPage.drawText(dateText, {
    x: centerX - dateW / 2,
    y: by,
    size: 9,
    font: fonts.montserratBold,
    color: NAVY,
  });

  drawGoldFooterBar(currentPage, fonts, data);

  return {
    certNo: { x: centerX - certNoW / 2 - 2, y: bottomY - 3, w: certNoW + 4, h: 14 },
    date:   { x: centerX - dateW / 2 - 2,   y: by - 3,      w: dateW + 4,   h: 14 },
  };
}

// ─────────────────────────────────────────────────────────────────
// Shared: render transcript (legacy — used by buildFromBaseTemplate)
// ─────────────────────────────────────────────────────────────────

function renderTranscript(
  page: PDFPage,
  data: CertificateData,
  config: NonNullable<TemplateFieldConfig['transcriptPage']>,
  fonts: EmbeddedFonts,
  pdfDoc: PDFDocument,
): void {
  const { tableStart, tableColumns, rowHeight, fontSize } = config;
  const tableWidth = tableColumns.resultX - tableColumns.unitCodeX + 120;

  const drawHeader = (targetPage: PDFPage, continued: boolean): number => {
    if (continued) {
      targetPage.drawText('Record of Results (continued)', {
        x: tableColumns.unitCodeX,
        y: PAGE_H - 55,
        size: 14,
        font: fonts.ralewayBold,
        color: NAVY,
      });
      targetPage.drawText(data.clientName, {
        x: tableColumns.unitCodeX,
        y: PAGE_H - 75,
        size: 10,
        font: fonts.montserratBold,
        color: NAVY,
      });
      targetPage.drawText(`Certificate: ${data.certificateNumber}`, {
        x: tableColumns.unitCodeX,
        y: PAGE_H - 90,
        size: 9,
        font: fonts.montserrat,
        color: MID_GRAY,
      });
    } else {
      drawCenteredText(targetPage, data.clientName, config.clientName, fonts.raleway, NAVY);
      drawCenteredText(targetPage, `Certificate: ${data.certificateNumber}`, config.certNumber, fonts.montserrat, MID_GRAY);
    }

    const headerYPos = continued ? PAGE_H - 125 : tableStart.y;
    const headerTextY = headerYPos + 2;
    targetPage.drawRectangle({
      x: tableColumns.unitCodeX - 5,
      y: headerYPos - 4,
      width: tableWidth,
      height: rowHeight,
      color: MAROON,
    });
    targetPage.drawText('Unit Code', { x: tableColumns.unitCodeX, y: headerTextY, size: fontSize, font: fonts.raleway, color: GOLD });
    targetPage.drawText('Unit Title', { x: tableColumns.unitTitleX, y: headerTextY, size: fontSize, font: fonts.raleway, color: GOLD });
    targetPage.drawText('Result', { x: tableColumns.resultX, y: headerTextY, size: fontSize, font: fonts.raleway, color: GOLD });

    return headerYPos - rowHeight;
  };

  let currentPage = page;
  let y = drawHeader(currentPage, false);

  if (!data.units) return;

  for (let i = 0; i < data.units.length; i++) {
    const unit = data.units[i];

    if (y < 50) {
      currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = drawHeader(currentPage, true);
    }

    if (i % 2 === 0) {
      currentPage.drawRectangle({
        x: tableColumns.unitCodeX - 5, y: y - 4,
        width: tableWidth, height: rowHeight,
        color: LIGHT_GRAY,
      });
    }

    currentPage.drawText(unit.unitCode, { x: tableColumns.unitCodeX, y: y + 2, size: fontSize, font: fonts.montserrat, color: NAVY });

    let title = unit.unitTitle;
    const maxTitleW = tableColumns.resultX - tableColumns.unitTitleX - 20;
    while (fonts.montserrat.widthOfTextAtSize(title, fontSize) > maxTitleW && title.length > 10) {
      title = title.slice(0, -4) + '...';
    }
    currentPage.drawText(title, { x: tableColumns.unitTitleX, y: y + 2, size: fontSize, font: fonts.montserrat, color: NAVY });

    const resultColor = unit.result.toLowerCase().includes('competent') && !unit.result.toLowerCase().includes('not')
      ? rgb(0.1, 0.5, 0.2)
      : rgb(0.7, 0.15, 0.1);
    currentPage.drawText(unit.result, { x: tableColumns.resultX, y: y + 2, size: fontSize, font: fonts.raleway, color: resultColor });

    y -= rowHeight;
  }

  currentPage.drawRectangle({
    x: tableColumns.unitCodeX - 5, y: y - 2,
    width: tableWidth, height: 1.5, color: GOLD,
  });
}

// ─────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────

function clampFontSize(font: PDFFont, text: string, maxSize: number, maxWidth: number): number {
  let size = maxSize;
  while (font.widthOfTextAtSize(text, size) > maxWidth && size > 8) {
    size -= 0.5;
  }
  return size;
}

function formatDate(isoDate: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${parseInt(d, 10)} ${months[monthIdx]} ${y}`;
}

function abbreviateResult(result: string): string {
  const lower = result.toLowerCase().trim();
  if (lower === 'competent' || lower === 'c') return 'C';
  if (lower.includes('not yet') || lower === 'nyc') return 'NYC';
  if (lower.includes('credit') || lower === 'ct') return 'CT';
  if (lower.includes('competent') && !lower.includes('not')) return 'C';
  return result;
}

function drawText(
  page: PDFPage,
  text: string,
  pos: { x: number; y: number; size: number },
  font: PDFFont,
  color: ReturnType<typeof rgb>,
): void {
  page.drawText(text, { x: pos.x, y: pos.y, size: pos.size, font, color });
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  pos: { x: number; y: number; size: number; maxWidth?: number },
  font: PDFFont,
  color: ReturnType<typeof rgb>,
): void {
  let fontSize = pos.size;
  if (pos.maxWidth) {
    while (font.widthOfTextAtSize(text, fontSize) > pos.maxWidth && fontSize > 8) {
      fontSize -= 1;
    }
  }
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, {
    x: pos.x - textWidth / 2,
    y: pos.y,
    size: fontSize,
    font,
    color,
  });
}

function drawFittedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  maxSize: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>,
): { x: number; y: number; w: number; h: number; size: number } {
  const size = clampFontSize(font, text, maxSize, maxWidth);
  const width = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });

  return {
    x,
    y,
    w: width,
    h: size,
    size,
  };
}

function drawCenteredFittedText(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  font: PDFFont,
  maxSize: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>,
): { x: number; y: number; w: number; h: number; size: number } {
  const size = clampFontSize(font, text, maxSize, maxWidth);
  const width = font.widthOfTextAtSize(text, size);
  const x = centerX - width / 2;

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });

  return {
    x,
    y,
    w: width,
    h: size,
    size,
  };
}

function buildFieldPositions(
  config: TemplateFieldConfig,
  font: PDFFont,
  data: CertificateData,
): FieldPositions {
  const c = config.certPage;
  return {
    scope: {
      x: c.scope.x - 2,
      y: c.scope.y - 3,
      w: Math.max(font.widthOfTextAtSize(data.keyDetails.scope, c.scope.size) + 4, 200),
      h: c.scope.size + 4,
    },
    auditRef: {
      x: c.auditRef.x - 2,
      y: c.auditRef.y - 3,
      w: Math.max(font.widthOfTextAtSize(data.keyDetails.auditRef, c.auditRef.size) + 4, 200),
      h: c.auditRef.size + 4,
    },
    certNo: {
      x: c.certNumber.x - 2,
      y: c.certNumber.y - 3,
      w: Math.max(font.widthOfTextAtSize(data.certificateNumber, c.certNumber.size) + 4, 200),
      h: c.certNumber.size + 4,
    },
    clientName: {
      x: c.clientName.x - 2,
      y: c.clientName.y - 3,
      w: Math.max(font.widthOfTextAtSize(data.clientName, c.clientName.size) + 4, 200),
      h: c.clientName.size + 4,
    },
    issueDate: {
      x: c.issueDate.x - 2,
      y: c.issueDate.y - 3,
      w: Math.max(font.widthOfTextAtSize(data.issueDate, c.issueDate.size) + 4, 150),
      h: c.issueDate.size + 4,
    },
    ceoSignature: { x: 0, y: 0, w: 0, h: 0 },  // not used in base-template mode
    page2CertNo:  { x: 0, y: 0, w: 0, h: 0 },  // not used in base-template mode
    page2Date:    { x: 0, y: 0, w: 0, h: 0 },  // not used in base-template mode
  };
}
