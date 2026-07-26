const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const srcDir = path.join(__dirname, '..', 'src');
const patchDir = path.join(__dirname, '..', '..', 'public', 'downloads');
const zipFile = path.join(patchDir, 'renderer-patch.zip');
const manifestFile = path.join(patchDir, 'renderer-manifest.json');

// Check if src directory exists
if (!fs.existsSync(srcDir)) {
  console.error('Hata: src dizini bulunamadı!');
  process.exit(1);
}

// Create downloads directory if not exists
if (!fs.existsSync(patchDir)) {
  fs.mkdirSync(patchDir, { recursive: true });
}

// Read old manifest to increment version, or start at 1
let version = 1;
if (fs.existsSync(manifestFile)) {
  try {
    const oldManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    version = (oldManifest.renderer_version || 0) + 1;
  } catch (e) {}
}

// Zip the src directory
console.log('src dizini zikleniyor...');
const zip = new AdmZip();
zip.addLocalFolder(srcDir);
zip.writeZip(zipFile);
console.log(`Bitti: ${zipFile}`);

// Write manifest
const manifest = {
  renderer_version: version,
  url: "https://oyp.vercel.app/downloads/renderer-patch.zip",
  notes: "Otomatik arayüz (UI) güncellemesi."
};

fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
console.log(`Manifest oluşturuldu: ${manifestFile} (v${version})`);
console.log('--- OTA GÜNCELLEMESİ HAZIR ---');
