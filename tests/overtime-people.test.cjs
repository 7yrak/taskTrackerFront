const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/app/components/overtime/overtime.component.ts'),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}});
const exportsForTest={};
vm.runInNewContext(outputText,{exports:exportsForTest,require:name=>name==='@angular/core'?{Component:()=>target=>target}:{},Map,Intl,Date});
function component(){return Object.assign(Object.create(exportsForTest.OvertimeComponent.prototype),{
 members:[{name:'José Pérez'}],entries:[
  {id:1,person:'Jose Perez',hours:2,date:'2026-10-01',projectId:1},
  {id:2,person:' JOSÉ  PÉREZ ',hours:3.5,date:'2026-10-02',projectId:2},
  {id:3,person:'Ana Pérez',hours:1,date:'2026-10-02',projectId:1}],
 projectFilter:null,personFilter:'',from:'',to:'',search:'',pendingOnly:false});}
test('preserves one team-preferred option for accents, case and whitespace',()=>{
 assert.equal(component().people.join('|'),'Ana Pérez|José Pérez');
});
test('keeps distinct people and historical people outside the team',()=>{
 const c=component();c.members.push({name:'José Soto'});assert.equal(c.people.length,3);
});
test('person filter combines spelling variants while respecting project filter',()=>{
 const c=component();c.personFilter='jose perez';assert.equal(c.filtered.length,2);assert.equal(c.total,5.5);
 c.projectFilter=1;assert.equal(c.filtered.length,1);assert.equal(c.total,2);
});
test('summary and visible names preserve totals without rewriting original data',()=>{
 const c=component();assert.equal(c.summary.find(row=>row.person==='José Pérez').hours,5.5);
 assert.equal(c.personName(c.entries[0].person),'José Pérez');assert.equal(c.entries[0].person,'Jose Perez');
 assert.equal(c.entries.length,3);
});
test('preserves the deployed accent-insensitive search',()=>{
 const c=component();c.entries=[c.entries[1]];
 for(const search of ['jose perez','JOSÉ PÉREZ']){c.search=search;assert.equal(c.filtered.length,1);}
});
test('new saves and decomposed Unicode use the team spelling',()=>{
 const c=component();assert.equal(c.personName(' JOSE\u0301  PE\u0301REZ '),'José Pérez');
 assert.equal(c.personName('Persona Nueva'),'Persona Nueva');
});
test('keeps the main-branch distinction between ñ and n',()=>{
 const c=component();c.members=[{name:'Niño'},{name:'Nino'}];c.entries=[];assert.equal(c.people.length,2);
});
