/**
 * Global chunk loading error handler with retry logic
 * Handles 404 errors for JavaScript chunks and CSS files
 */

interface ChunkLoadError extends Error {
  type?: string;
  request?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms

// Track if we're already handling a chunk error to prevent loops
let isHandlingChunkError = false;
let reloadAttempts = 0;
const MAX_RELOAD_ATTEMPTS = 2;

/**
 * Check if an error is a chunk loading error
 * Made more strict to avoid false positives
 */
function isChunkLoadError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  
  const err = error as ChunkLoadError;
  
  // Check for common chunk loading error patterns (must be explicit)
  const message = err.message || '';
  const name = err.name || '';
  
  // Explicitly exclude React/module resolution errors
  if (message.includes('createContext is not a function') ||
      message.includes('Class extends value undefined') ||
      message.includes('is not a constructor') ||
      message.includes('Lazy element type must resolve') ||
      message.includes('Received a promise that resolves to: undefined') ||
      message.includes('Element type is invalid')) {
    // These are React/module errors, not chunk loading errors
    return false;
  }
  
  // Only treat as chunk error if message explicitly mentions chunk loading
  if (message.includes('Loading chunk') || 
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('ChunkLoadError') ||
      name === 'ChunkLoadError') {
    return true;
  }
  
  // Check for 404 errors on chunk files (must be a Next.js chunk file)
  if (err.request && typeof err.request === 'string') {
    const request = err.request;
    // Must be a Next.js static chunk or CSS file
    if ((request.includes('/_next/static/chunks/') || 
         request.includes('/_next/static/css/')) &&
        (request.endsWith('.js') || request.endsWith('.css') || request.includes('.js?') || request.includes('.css?'))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract chunk URL from error
 */
function extractChunkUrl(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  
  const err = error as ChunkLoadError;
  
  // Try to extract from message
  const messageMatch = err.message?.match(/Loading chunk (\d+)/);
  if (messageMatch) {
    // This is a simplified approach - in reality, we'd need to construct the full URL
    return null;
  }
  
  // Try to extract from request
  if (err.request && typeof err.request === 'string') {
    return err.request;
  }
  
  return null;
}

/**
 * Retry loading a chunk with exponential backoff
 */
async function retryChunkLoad(
  chunkUrl: string | null,
  retryCount: number = 0
): Promise<boolean> {
  if (retryCount >= MAX_RETRIES) {
    console.error('[ChunkErrorHandler] Max retries reached for chunk:', chunkUrl);
    isHandlingChunkError = false;
    return false;
  }
  
  // Prevent too many reload attempts
  if (reloadAttempts >= MAX_RELOAD_ATTEMPTS) {
    console.error('[ChunkErrorHandler] Max reload attempts reached, stopping to prevent loop');
    isHandlingChunkError = false;
    return false;
  }
  
  if (!chunkUrl) {
    // If we can't extract the URL, don't reload - this might not be a chunk error
    console.warn('[ChunkErrorHandler] Cannot extract chunk URL, not reloading to prevent false positives');
    isHandlingChunkError = false;
    return false;
  }
  
  const delay = RETRY_DELAYS[retryCount] || 4000;
  console.log(`[ChunkErrorHandler] Retrying chunk load (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms:`, chunkUrl);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    // Try to fetch the chunk
    const response = await fetch(chunkUrl, { cache: 'no-cache' });
    if (response.ok) {
      console.log('[ChunkErrorHandler] Chunk loaded successfully, reloading page');
      reloadAttempts++;
      // Chunk is available, reload the page
      window.location.reload();
      return true;
    } else {
      // Still 404, retry
      return retryChunkLoad(chunkUrl, retryCount + 1);
    }
  } catch (fetchError) {
    console.error('[ChunkErrorHandler] Error fetching chunk:', fetchError);
    return retryChunkLoad(chunkUrl, retryCount + 1);
  }
}

/**
 * Handle chunk loading errors
 */
export async function handleChunkLoadError(error: unknown): Promise<void> {
  if (!isChunkLoadError(error)) {
    return;
  }
  
  // Prevent handling if already handling
  if (isHandlingChunkError) {
    console.warn('[ChunkErrorHandler] Already handling a chunk error, ignoring');
    return;
  }
  
  isHandlingChunkError = true;
  console.error('[ChunkErrorHandler] Chunk loading error detected:', error);
  
  const chunkUrl = extractChunkUrl(error);
  
  // Log the error for debugging
  if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__) {
    console.error('[ChunkErrorHandler] Build ID:', (window as any).__NEXT_DATA__?.buildId);
  }
  
  // Try to retry loading the chunk
  await retryChunkLoad(chunkUrl);
  
  // Reset flag after a delay in case reload doesn't happen
  setTimeout(() => {
    isHandlingChunkError = false;
  }, 5000);
}

/**
 * Initialize global error handlers for chunk loading errors
 */
export function initializeChunkErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  
  // Disable in development mode to prevent reload loops from React errors
  if (process.env.NODE_ENV === 'development') {
    console.log('[ChunkErrorHandler] Disabled in development mode to prevent reload loops');
    return;
  }
  
  // Reset reload attempts on page load
  reloadAttempts = 0;
  
  // Handle unhandled promise rejections (common for chunk loading errors)
  window.addEventListener('unhandledrejection', (event) => {
    // Prevent handling if already handling
    if (isHandlingChunkError) return;
    
    // Only handle if it's actually a chunk error
    if (isChunkLoadError(event.reason)) {
      handleChunkLoadError(event.reason);
    }
  });
  
  // Handle general errors - be more selective
  window.addEventListener('error', (event) => {
    // Prevent handling if already handling
    if (isHandlingChunkError) return;
    
    // Ignore React/module errors
    const message = event.message || '';
    if (message.includes('createContext') ||
        message.includes('Class extends') ||
        message.includes('is not a constructor') ||
        message.includes('Lazy element') ||
        message.includes('Element type is invalid')) {
      return; // Ignore React/module errors
    }
    
    // Only process if it looks like a chunk loading error
    if (event.error) {
      if (isChunkLoadError(event.error)) {
        handleChunkLoadError(event.error);
      }
    } else if (event.message && event.filename?.includes('/_next/static/')) {
      // Only check filename-based errors if it's a Next.js static file
      // And explicitly check it's a chunk file, not a React module issue
      if (event.filename.includes('/_next/static/chunks/') || event.filename.includes('/_next/static/css/')) {
        const error = new Error(event.message);
        (error as any).request = event.filename;
        if (isChunkLoadError(error)) {
          handleChunkLoadError(error);
        }
      }
    }
  });
  
  console.log('[ChunkErrorHandler] Global chunk error handlers initialized');
}
