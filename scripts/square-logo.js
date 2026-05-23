const sharp = require('sharp');
const path = require('path');

async function main() {
  const input = path.join(__dirname, 'public', 'logo.png');
  const output = path.join(__dirname, 'public', 'logo-square.png');
  
  const metadata = await sharp(input).metadata();
  console.log(`Original: ${metadata.width}x${metadata.height}`);
  
  const size = Math.max(metadata.width, metadata.height);
  
  await sharp(input)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(output);
  
  console.log(`Square: ${size}x${size} -> ${output}`);
}

main().catch(console.error);
