import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generateId = customAlphabet(alphabet, 8);

/**
 * Generate a unique certificate number in the format: PREFIX-YYYY-XXXXXXXX
 * Supports an optional async collision check callback.
 */
export async function generateCertNumber(
  options: {
    prefix?: string;
    isUnique?: (certNumber: string) => Promise<boolean>;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const { prefix = 'CERT', isUnique, maxRetries = 10 } = options;
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const certNumber = `${prefix}-${year}-${generateId()}`;

    if (!isUnique) {
      return certNumber;
    }

    const unique = await isUnique(certNumber);
    if (unique) {
      return certNumber;
    }
  }

  throw new Error(
    `Failed to generate unique certificate number after ${maxRetries} attempts`
  );
}
