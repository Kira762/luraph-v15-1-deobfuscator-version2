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
  const input = 'local n = Instance.new("Frame");\nlocal fixed = (12 * 8) + (4 - 1);\nlocal live = factory(12 * 8);\nlocal config = {alpha = 1, beta = 2, gamma = 3};\nlocal value = factory({onClick = function() end});\n(function() end)()\nlocal i = 1;\nprint(n, value, i, fixed, live, config);\n';
  fs.writeFileSync(chunkPath, input, 'latin1');

  const result = appendCapturedChunks('-- primary trace\n', tracePath);
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.formattedCount, 1);
  assert.match(result.text, /Captured decrypted loadstring payload \(12_34\)/);
  assert.match(result.text, /local frame = Instance\.new\("Frame"\)/);
  assert.match(result.text, /local fixed = 99;/);
  assert.match(result.text, /local live = factory\(96\)/);
  assert.match(result.text, /local config = \{\n\s+alpha = 1,/);
  assert.match(result.text, /local value = factory/);
  assert.match(result.text, /local i = 1/);
  assert.match(result.text, /\}\);/);
  assert.doesNotMatch(result.text, /\n[ \t]*\n[ \t]*\n/);

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
