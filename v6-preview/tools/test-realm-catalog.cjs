const test = require('node:test');
const assert = require('node:assert/strict');
const Realms = require('../realm-catalog.js');
const Journey = require('../endless-journey.js');

test('all six selectable realms start from zero without visual score offsets',()=>{
  assert.equal(Realms.entries.length,6);
  assert.equal(new Set(Realms.entries.map(r=>r.id)).size,6);
  for(const realm of Realms.entries) {
    const climb=Realms.newClimb(realm.id);
    assert.equal(climb.altitude,0); assert.equal(climb.peak,0);
    assert.equal(climb.realm,realm.id);
    assert.equal(Journey.decode(climb).altitude,0);
  }
});

test('realm records cannot overlap each other or overwrite legacy Endless',()=>{
  const keys=[];
  for(const realm of Realms.entries) for(const record of ['best','journey','milestones','ghost']) {
    const key=Realms.key(realm.id,record); keys.push(key);
    assert.ok(!['sisyphus6.journey','sisyphus6.best.endless','sisyphus5.best.endless'].includes(key));
  }
  assert.equal(new Set(keys).size,24);
});

test('a saved climb can only resume in its own realm',()=>{
  for(const realm of Realms.entries) for(const other of Realms.entries) {
    assert.equal(Realms.acceptsSave(realm.id,Realms.newClimb(other.id)),realm.id===other.id);
  }
  assert.equal(Realms.acceptsSave('hills',{version:1,altitude:800}),false);
  assert.equal(Realms.acceptsSave('hills',null),false);
  assert.equal(Realms.acceptsSave('hills',{version:2,realm:'hills'}),false);
});

test('invalid selection cannot create an arbitrary storage key',()=>{
  assert.equal(Realms.find('unknown'),null);
  assert.throws(()=>Realms.key('unknown','best'));
  assert.throws(()=>Realms.key('hills','settings'));
  assert.throws(()=>Realms.newClimb('../endless'));
});
