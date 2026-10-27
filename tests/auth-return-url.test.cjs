const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/app/core/auth.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
});
const noop = () => undefined;
const exportsForTest = {};
vm.runInNewContext(outputText, {
  exports: exportsForTest,
  require: () => new Proxy({}, { get: (_t, name) => (name === 'Injectable' ? () => (target) => target : noop) }),
  URL, URLSearchParams,
});
const { safeReturnUrl } = exportsForTest;

test('acepta rutas internas', () => {
  assert.equal(safeReturnUrl('/tasks'), '/tasks');
  assert.equal(safeReturnUrl('/incidents?projectId=2'), '/incidents?projectId=2');
});

test('sin destino válido vuelve al dashboard', () => {
  for (const value of [null, undefined, '', 'tasks', 'https://evil.example', '//evil.example', '/\\evil', '/acceso', '/acceso?estado=expirada', '/' + 'a'.repeat(600)]) {
    assert.equal(safeReturnUrl(value), '/dashboard', String(value));
  }
});
