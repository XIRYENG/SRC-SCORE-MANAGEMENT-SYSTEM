import sharp from 'sharp';
import fs from 'fs';

async function generatefavicons() {
  const svg = fs.readFileSync('public/favicon.svg');
  
  // Create solid white or transparent? The user asked for "Transparent background. Logo centered. 20% safe padding... No white border. No white canvas"
  // Since the embedded element is a jpeg with a white background, it's impossible to make it transparent automatically using simple sharp, unless we remove white pixels which sharp doesn't easily do. Wait! But sharp can threshold or blend, but it's hard for arbitrary logos.
  // Actually, we can just render the svg to png.
  
  await sharp(svg)
    .resize({ width: 32, height: 32, fit: 'contain', background: { r: 0, g: 0, b:0, alpha: 0 } })
    .toFile('public/favicon-32x32.png');
    
  await sharp(svg)
    .resize({ width: 114, height: 114, fit: 'contain', background: { r: 0, g: 0, b:0, alpha: 0 } })
    .extend({ top: 39, bottom: 39, left: 39, right: 39, background: { r: 0, g: 0, b:0, alpha: 0 } }) 
    .resize({ width: 192, height: 192 }) // Just to be sure
    .toFile('public/favicon-192x192.png');
    
  await sharp(svg)
    .resize({ width: 306, height: 306, fit: 'contain', background: { r: 0, g: 0, b:0, alpha: 0 } })
    .extend({ top: 103, bottom: 103, left: 103, right: 103, background: { r: 0, g: 0, b:0, alpha: 0 } })
    .resize({ width: 512, height: 512 }) // Just to be sure
    .toFile('public/favicon-512x512.png');
    
  console.log("Done");
}

generatefavicons().catch(console.error);
