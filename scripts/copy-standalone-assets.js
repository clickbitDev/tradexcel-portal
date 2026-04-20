const fs = require('fs');
const path = require('path');

const root = process.cwd();

// Source and destination paths
const publicSrc = path.join(root, 'public');
const publicDest = path.join(root, '.next', 'standalone', 'public');
const staticSrc = path.join(root, '.next', 'static');
const staticDest = path.join(root, '.next', 'standalone', '.next', 'static');

// Function to copy directory recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    if (!fs.existsSync(path.dirname(dest))) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// Check if standalone directory exists
const standaloneDir = path.join(root, '.next', 'standalone');
if (!fs.existsSync(standaloneDir)) {
  console.error('Error: .next/standalone directory does not exist. Make sure you have run "next build" with output: "standalone" in next.config.ts');
  process.exit(1);
}

// Copy public directory if it exists
if (fs.existsSync(publicSrc)) {
  console.log('Copying public directory to standalone...');
  copyRecursiveSync(publicSrc, publicDest);
  console.log('✓ Copied public directory');
} else {
  console.log('⚠ public directory does not exist, skipping...');
}

// Copy static directory if it exists
if (fs.existsSync(staticSrc)) {
  console.log('Copying .next/static directory to standalone...');
  copyRecursiveSync(staticSrc, staticDest);
  console.log('✓ Copied .next/static directory');
  
  // Verify chunks were copied
  const chunksSrc = path.join(staticSrc, 'chunks');
  const chunksDest = path.join(staticDest, 'chunks');
  if (fs.existsSync(chunksSrc)) {
    const chunkFiles = fs.readdirSync(chunksSrc).filter(f => f.endsWith('.js') || f.endsWith('.css'));
    console.log(`Found ${chunkFiles.length} chunk files in source`);
    if (fs.existsSync(chunksDest)) {
      const copiedChunks = fs.readdirSync(chunksDest).filter(f => f.endsWith('.js') || f.endsWith('.css'));
      console.log(`Copied ${copiedChunks.length} chunk files to standalone`);
      if (copiedChunks.length !== chunkFiles.length) {
        console.warn(`⚠ Warning: Chunk count mismatch. Source: ${chunkFiles.length}, Copied: ${copiedChunks.length}`);
      }
    } else {
      console.error('ERROR: Chunks directory not found in destination after copy');
      process.exit(1);
    }
  }
  
  // Verify CSS files were copied
  const cssSrc = path.join(staticSrc, 'css');
  const cssDest = path.join(staticDest, 'css');
  if (fs.existsSync(cssSrc)) {
    const cssFiles = fs.readdirSync(cssSrc).filter(f => f.endsWith('.css'));
    console.log(`Found ${cssFiles.length} CSS files in source`);
    if (fs.existsSync(cssDest)) {
      const copiedCss = fs.readdirSync(cssDest).filter(f => f.endsWith('.css'));
      console.log(`Copied ${copiedCss.length} CSS files to standalone`);
    }
  }
} else {
  console.error('Error: .next/static directory does not exist. This is required for static assets.');
  process.exit(1);
}

console.log('✓ Successfully copied all static assets to standalone directory');
