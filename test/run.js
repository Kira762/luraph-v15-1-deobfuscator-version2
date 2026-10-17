'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  appendCapturedChunks,
  clearCapturedChunks,
} = require('../src/captured_chunks');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'deob-captured-test-'));
try {
  const tracePath = path.join(temp, 'result.deobf.luau');
  const key = '12_34';
  const chunkPath = path.join(temp, `result.chunk_${key}.luau`);
  const input = 'local value = factory({onClick = function() end});\n(function() end)()\n';
  fs.writeFileSync(chunkPath, input, 'latin1');

  const result = appendCapturedChunks('-- primary trace\n', tracePath);
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.formattedCount, 1);
  assert.match(result.text, /Captured decrypted loadstring payload \(12_34\)/);
  assert.match(result.text, /local value = factory/);
  assert.match(result.text, /\}\);/);

  const combinedPath = path.join(temp, 'combined.luau');
  fs.writeFileSync(combinedPath, result.text, 'utf8');
  const luauAst = path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'luau-ast.exe' : 'luau-ast');
  execFileSync(luauAst, [combinedPath], { stdio: 'ignore' });

  clearCapturedChunks(tracePath);
  assert.strictEqual(fs.existsSync(chunkPath), false);
  process.stdout.write('captured chunk integration tests passed\n');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
