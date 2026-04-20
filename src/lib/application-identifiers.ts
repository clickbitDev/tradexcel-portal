const APP_PATTERN = /^APP-([0-9]+)$/i;
const APP_YEAR_PATTERN = /^APP-[0-9]{4}-([0-9]+)$/i;
const UID_PATTERN = /^[0-9]{8}-([0-9]+)[A-Z]+-[A-Z0-9]+$/;

function normalizeSerial(rawSerial: string): string {
  const trimmed = rawSerial.trim();
  const withoutLeadingZeros = trimmed.replace(/^0+/, '');
  return withoutLeadingZeros === '' ? '0' : withoutLeadingZeros;
}

function extractSerialFromIdentifier(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const appMatch = trimmed.match(APP_PATTERN);
  if (appMatch) return normalizeSerial(appMatch[1]);

  const appYearMatch = trimmed.match(APP_YEAR_PATTERN);
  if (appYearMatch) return normalizeSerial(appYearMatch[1]);

  const uidMatch = trimmed.toUpperCase().match(UID_PATTERN);
  if (uidMatch) return normalizeSerial(uidMatch[1]);

  return null;
}

export function resolveApplicationId(
  applicationNumber?: string | null,
  studentUid?: string | null
): string {
  const appSerial = extractSerialFromIdentifier(applicationNumber);
  if (appSerial) return `APP-${appSerial}`;

  const uidSerial = extractSerialFromIdentifier(studentUid);
  if (uidSerial) return `APP-${uidSerial}`;

  return applicationNumber?.trim() || studentUid?.trim() || '';
}
