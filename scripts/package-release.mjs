import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Packaging Front Wars release for Web Game Portals...');

const root = process.cwd();
const distDir = path.join(root, 'dist');
const zipOutput = path.join(root, 'frontwars-release.zip');

// Step 1: Run build
console.log('📦 Step 1: Running production build...');
execSync('npm run build', { stdio: 'inherit' });

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('❌ Error: dist/index.html does not exist after build!');
  process.exit(1);
}

// Step 2: Remove old zip if present
if (fs.existsSync(zipOutput)) {
  fs.unlinkSync(zipOutput);
}

// Step 3: Compress dist contents to zip (ensuring index.html is at root of archive)
console.log('🗜️ Step 2: Creating frontwars-release.zip archive...');
const isWindows = process.platform === 'win32';

if (isWindows) {
  // Use PowerShell Compress-Archive
  const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipOutput}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });
} else {
  // Use zip utility on Linux / macOS
  execSync(`cd "${distDir}" && zip -r "${zipOutput}" .`, { stdio: 'inherit' });
}

if (!fs.existsSync(zipOutput)) {
  console.error('❌ Error: frontwars-release.zip was not created!');
  process.exit(1);
}

const stats = fs.statSync(zipOutput);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`\n✅ Release archive ready!`);
console.log(`📁 File: frontwars-release.zip (${sizeMB} MB)`);
console.log(`📍 Path: ${zipOutput}`);
console.log(`\nPlatform Compatibility:`);
console.log(`  ✓ CrazyGames (CrazyGames SDK v3 ready)`);
console.log(`  ✓ Poki (Poki SDK v2 ready)`);
console.log(`  ✓ Itch.io (HTML5 browser playable)`);
console.log(`  ✓ GameDistribution / Lagged / GameJolt`);

