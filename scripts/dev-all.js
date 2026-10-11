const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 [OneAI] Launching Next.js on port 3000 and WhatsApp Engine on port 3001...');

const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const serverPath = path.join(__dirname, '..', 'whatsapp-engine', 'server.ts');

const next = spawn(process.execPath, [nextBin, 'dev'], { stdio: 'inherit' });
const wa = spawn(process.execPath, ['--import', 'tsx', serverPath], { stdio: 'inherit' });

process.on('SIGINT', () => {
  try { next.kill(); } catch {}
  try { wa.kill(); } catch {}
  process.exit(0);
});

process.on('SIGTERM', () => {
  try { next.kill(); } catch {}
  try { wa.kill(); } catch {}
  process.exit(0);
});
