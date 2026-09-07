const test = require('node:test');
const assert = require('node:assert/strict');
const Journey = require('../endless-journey.js');

test('pressure is continuous, bounded, and rises with altitude', () => {
  let previous = Journey.profile(0);
  for (let height = 1; height <= 10000; height++) {
    const next = Journey.profile(height);
    assert.ok(next.intensity >= previous.intensity);
    assert.ok(next.intensity - previous.intensity < 0.001);
    assert.ok(next.grace >= 0.45 && next.grace <= 0.8);
    assert.ok(next.decay >= 1.28 && next.decay <= 1.7);
    assert.ok(next.hazard >= 0 && next.hazard <= 1);
    previous = next;
  }
  assert.equal(Journey.profile(100).intensity, 0);
  assert.equal(Journey.profile(200).hazard, 0);
});

test('rollback remains gradual and does not stop at an artificial distance floor', () => {
  assert.equal(Journey.fallFloor,undefined);
  assert.equal(Journey.profile(0).fallSpeed,8);
  assert.equal(Journey.profile(10000).fallSpeed,48);
  let speed=0, height=300;
  for(let frame=0;frame<600;frame++) {
    speed=Journey.approach(speed,-Journey.profile(height).fallSpeed,7,1/60);
    height+=speed/60;
  }
  assert.ok(height<220 && height>190);
  assert.ok(speed<-7);
});

test('velocity response is refresh-rate independent', () => {
  function response(hz) {
    let value = 0;
    for (let i = 0; i < hz; i++) value = Journey.approach(value, 20, 14, 1 / hz);
    return value;
  }
  assert.ok(Math.abs(response(60) - response(120)) < 1e-10);
  assert.ok(Math.abs(response(30) - response(144)) < 1e-10);
});

test('invalid saves cannot poison the simulation', () => {
  for (const raw of ['', '{', null, [], {version:2,altitude:30}, {version:1,altitude:NaN}, {version:1,altitude:-10}]) {
    assert.equal(Journey.decode(raw), null);
  }
  const saved = Journey.decode(JSON.stringify({version:1,altitude:813,peak:1000,energy:8,resolve:-3,roll:22,gait:30,elapsed:88}));
  assert.equal(saved.altitude,813);
  assert.equal(saved.peak,1000);
  assert.equal(saved.energy,1);
  assert.equal(saved.resolve,0);
  assert.equal(saved.roll,22);
  assert.equal(saved.elapsed,88);
  assert.equal(Journey.decode({version:1,altitude:42}).peak,42);
});
