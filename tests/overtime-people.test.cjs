const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, resolve) {
  const exports = {};
  const source = fs.readFileSync(
    path.join(__dirname, '../src/app/components/overtime', file),
    'utf8',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
  });
  vm.runInNewContext(outputText, { exports, require: resolve, Map, Intl, Date });
  return exports;
}
const people = load('overtime-people.ts');
const { OvertimeComponent } = load('overtime.component.ts', (name) => {
  if (name === './overtime-people') return people;
  if (name === '@angular/core') return { Component: () => (target) => target };
  return {};
});
function component() {
  return Object.assign(Object.create(OvertimeComponent.prototype), {
    members: [{ name: 'José Pérez' }],
    entries: [
      { id: 1, person: 'Jose Perez', hours: 2, date: '2026-10-01', projectId: 1 },
      { id: 2, person: ' JOSÉ  PÉREZ ', hours: 3.5, date: '2026-10-02', projectId: 2 },
      { id: 3, person: 'Ana Pérez', hours: 1, date: '2026-10-02', projectId: 1 },
    ],
    projectFilter: null,
    personFilter: '',
    from: '',
    to: '',
    search: '',
    pendingOnly: false,
  });
}
test('deduplicates accents, case, whitespace and decomposed Unicode, preferring the team name', () => {
  const names = people.personNames(
    ['José Pérez'],
    ['Jose Perez', ' JOSE\u0301  PE\u0301REZ ', '', '  '],
  );
  assert.equal(names.size, 1);
  assert.equal(names.get(people.personKey('jose perez')), 'José Pérez');
});
test('keeps different people and historical names absent from the team', () => {
  const names = people.personNames(['José Pérez'], ['José Soto', 'Ana Pérez']);
  assert.equal(names.size, 3);
  assert.equal(names.get(people.personKey('Jose Soto')), 'José Soto');
});
test('selector has one option per person', () => {
  assert.equal(component().people.join('|'), 'Ana Pérez|José Pérez');
});
test('person filter includes all spelling variants and preserves other filters', () => {
  const c = component();
  c.personFilter = 'jose perez';
  assert.equal(c.filtered.length, 2);
  assert.equal(c.total, 5.5);
  c.projectFilter = 1;
  assert.equal(c.filtered.length, 1);
  assert.equal(c.total, 2);
});
test('summary combines hours without deleting or mutating original entries', () => {
  const c = component();
  const summary = c.summary.find((row) => row.person === 'José Pérez');
  assert.equal(summary.hours, 5.5);
  assert.equal(c.summary.length, 2);
  assert.equal(c.filtered.length, 3);
  assert.equal(c.entries[0].person, 'Jose Perez');
  assert.equal(c.filtered[0].person, 'José Pérez');
});
test('search matches accented and unaccented names', () => {
  const c = component();
  for (const search of ['jose perez', 'JOSÉ PÉREZ']) {
    c.search = search;
    assert.equal(c.filtered.length, 2);
  }
});
test('new saves resolve known variants to the team spelling', () => {
  assert.equal(component().canonicalPerson(' jose perez '), 'José Pérez');
  assert.equal(component().canonicalPerson('Persona Nueva'), 'Persona Nueva');
});
