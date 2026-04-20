import sharp from 'sharp';

function isAllowedRemoteImageSource(source: string): boolean {
  const allowedHosts = (process.env.ALLOWED_IMAGE_HOSTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const url = new URL(source);
  if (url.protocol === 'https:') {
    return allowedHosts.length === 0 || allowedHosts.includes(url.hostname);
  }

  return process.env.NODE_ENV !== 'production' && url.protocol === 'http:';
}

/**
 * Load an image from a URL or base64 data URI and convert to PNG buffer.
 * Returns a PNG buffer suitable for embedding in pdf-lib.
 */
export async function loadImage(source: string): Promise<Buffer> {
  let imageBuffer: Buffer;

  if (source.startsWith('data:')) {
    // Base64 data URI: data:image/png;base64,iVBOR...
    const base64Data = source.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid base64 data URI: missing data after comma');
    }
    imageBuffer = Buffer.from(base64Data, 'base64');
  } else if (source.startsWith('http://') || source.startsWith('https://')) {
    if (!isAllowedRemoteImageSource(source)) {
      throw new Error(`Remote image source is not allowed: ${source}`);
    }

    // URL — fetch the image
    const response = await fetch(source, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from ${source}: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  } else {
    throw new Error(
      `Unsupported image source. Expected URL (http/https) or base64 data URI, got: ${source.substring(0, 50)}...`
    );
  }

  // Normalize to PNG using sharp — handles JPEG, WebP, AVIF, TIFF, SVG, etc.
  const pngBuffer = await sharp(imageBuffer)
    .png()
    .toBuffer();

  return pngBuffer;
}

/**
 * Load multiple images, returning null for any that fail (non-critical).
 */
export async function loadImages(
  sources: string[]
): Promise<(Buffer | null)[]> {
  return Promise.all(
    sources.map(async (src) => {
      try {
        return await loadImage(src);
      } catch {
        console.warn(`[image-loader] Failed to load image: ${src}`);
        return null;
      }
    })
  );
}
