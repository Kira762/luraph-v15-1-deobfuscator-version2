'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getPythonBin } = require('./pyenv');

const MAX_FORMAT_BUFFER = 128 * 1024 * 1024;

function captureBase(tracePath) {
  return tracePath.replace(/\.(deobf\.luau|luau)$/, '');
}

function capturedChunkFiles(tracePath) {
  const base = captureBase(tracePath);
  const dir = path.dirname(base);
  const prefix = path.basename(base) + '.chunk_';
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.luau'))
    .sort()
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).isFile());
}

function clearCapturedChunks(tracePath) {
  for (const file of capturedChunkFiles(tracePath)) {
    try { fs.unlinkSync(file); } catch (_) {}
  }
}

function formatChunk(file) {
  const formatter = path.join(__dirname, '..', 'core', 'luauast.py');
  return execFileSync(getPythonBin(), [formatter, file], {
    encoding: 'latin1',
    maxBuffer: MAX_FORMAT_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function appendCapturedChunks(content, tracePath) {
  const files = capturedChunkFiles(tracePath);
  let text = content;
  let formattedCount = 0;

  for (const file of files) {
    const baseName = path.basename(file);
    const key = baseName.match(/\.chunk_(.+)\.luau$/)?.[1] || baseName;
    let payload;
    let formatNote = '';

    try {
      payload = formatChunk(file);
      formattedCount++;
    } catch (err) {
      // Never lose decrypted plaintext just because the optional formatter fails.
      payload = fs.readFileSync(file, 'latin1');
      const reason = String(err.message || err).replace(/[\r\n]+/g, ' ').slice(0, 300);
      formatNote = `-- Formatting failed (${reason}); raw plaintext follows.\n`;
    }

    text = text.replace(/\s*$/, '');
    text += `\n\n-- ===== Captured decrypted loadstring payload (${key}) =====\n`;
    if (formatNote) text += formatNote;
    text += payload.replace(/\s*$/, '') + '\n';
  }

  return { text, count: files.length, formattedCount };
}

module.exports = { appendCapturedChunks, capturedChunkFiles, clearCapturedChunks, formatChunk };
