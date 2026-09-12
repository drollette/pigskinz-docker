import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const ICON_SIZES = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'icon-48x48.png' },
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

async function generateIcons() {
  const publicDir = join(process.cwd(), 'public');
  const iconsDir = join(publicDir, 'icons');
  const imagePath = join(publicDir, 'pigskinz-mascot.png');

  // Create icons directory if it doesn't exist
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating PWA icons from pigskinz-mascot.png...\n');

  // Generate each icon size
  for (const { size, name } of ICON_SIZES) {
    const outputPath = join(iconsDir, name);

    await sharp(imagePath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  // Also copy the main icon to root for favicon
  await sharp(imagePath)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(join(publicDir, 'favicon.png'));

  console.log('\n✓ Generated favicon.png');

  // Generate ICO file (using 32x32 PNG)
  // Note: Sharp doesn't support ICO directly, so we'll use the PNG favicon
  console.log('\nAll icons generated successfully!');
  console.log(`Icons saved to: ${iconsDir}`);
}

generateIcons().catch(console.error);
