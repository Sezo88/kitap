const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageData.version;

const distDir = path.join(__dirname, '..', 'dist');
const exeName = `Okul_Zil_Sistemi_Setup_${version}.exe`;
const exePath = path.join(distDir, exeName);

const zipName = `Okul_Zil_Sistemi_Setup_${version}.zip`;
const zipPath = path.join(distDir, zipName);

const downloadsDir = path.join(__dirname, '..', '..', 'public', 'downloads');
const versionJsonPath = path.join(downloadsDir, 'version.json');
const latestYmlPath = path.join(distDir, 'latest.yml');
const destLatestYmlPath = path.join(downloadsDir, 'latest.yml');

if (!fs.existsSync(exePath)) {
  console.error(`HATA: EXE dosyası bulunamadı: ${exePath}`);
  process.exit(1);
}

// Create ZIP
console.log(`${exeName} dosyası sıkıştırılıyor...`);
const zip = new AdmZip();
zip.addLocalFile(exePath);
zip.writeZip(zipPath);
console.log(`ZIP oluşturuldu: ${zipName}`);

// Copy to public/downloads
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

fs.copyFileSync(zipPath, path.join(downloadsDir, zipName));
console.log(`ZIP public/downloads dizinine kopyalandı.`);

if (fs.existsSync(latestYmlPath)) {
  fs.copyFileSync(latestYmlPath, destLatestYmlPath);
  console.log(`latest.yml public/downloads dizinine kopyalandı.`);
}

// Update version.json
if (fs.existsSync(versionJsonPath)) {
  const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  versionData.version = version;
  versionData.url = `https://oyp.vercel.app/downloads/${zipName}`;
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));
  console.log(`version.json güncellendi: v${version}`);
}

console.log('--- BUILD ZIP İŞLEMİ TAMAMLANDI ---');
