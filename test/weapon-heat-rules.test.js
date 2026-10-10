import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAPON_HEAT_PROFILES,
  applyShot,
  advanceCooling,
  canFire,
  createWeaponHeatState,
  getWeaponHeatViewModel,
  resetWeaponHeatState,
} from '../public/weapon-heat-rules.mjs';

test('creates a finite ready state for every weapon profile', () => {
  for (const weapon of ['scout', 'cannon', 'inferno']) {
    const state = createWeaponHeatState(weapon);

    assert.deepEqual(state, {
      weapon,
      heat: 0,
      overheated: false,
      cooling: false,
    });
    assert.equal(canFire(state), true);
    assert.equal(getWeaponHeatViewModel(state).status, 'READY');
  }
});

test('accumulates sustained rapid fire independently of shot cooldown', () => {
  let state = createWeaponHeatState('scout');
  let fired = 0;

  for (let index = 0; index < 8; index += 1) {
    const result = applyShot(state);
    state = result.state;
    fired += Number(result.fired);
  }

  assert.equal(fired, 8);
  assert.equal(state.heat, 96);
  assert.equal(state.overheated, false);
  assert.equal(canFire(state), true);

  const locked = applyShot(state);
  assert.equal(locked.fired, true);
  assert.equal(locked.state.heat, 100);
  assert.equal(locked.state.overheated, true);
  assert.equal(canFire(locked.state), false);
  assert.equal(applyShot(locked.state).fired, false);
});

test('release cooling reduces heat and reports COOLING', () => {
  const heated = applyShot(createWeaponHeatState('cannon')).state;
  const cooled = advanceCooling(heated, 0.5);

  assert.equal(heated.heat, WEAPON_HEAT_PROFILES.cannon.heatPerShot);
  assert.equal(cooled.heat, 43);
  assert.equal(cooled.cooling, true);
  assert.equal(getWeaponHeatViewModel(cooled).status, 'COOLING');

  const ready = advanceCooling(cooled, 10);
  assert.equal(ready.heat, 0);
  assert.equal(ready.cooling, true);
  assert.equal(getWeaponHeatViewModel(ready).status, 'READY');
});

test('overheat lock uses hysteresis and does not reopen at the lock threshold', () => {
  let state = createWeaponHeatState('cannon');
  for (let index = 0; index < 5; index += 1) state = applyShot(state).state;

  assert.equal(state.overheated, true);
  assert.equal(state.heat, 100);
  assert.equal(canFire(advanceCooling(state, 1)), false);
  assert.equal(canFire(advanceCooling(state, 2.5)), false);

  const reset = advanceCooling(state, 3);
  assert.equal(reset.heat, WEAPON_HEAT_PROFILES.cannon.resetThreshold);
  assert.equal(reset.overheated, false);
  assert.equal(canFire(reset), true);
});

test('all weapons have distinct thermal behavior', () => {
  const profiles = Object.values(WEAPON_HEAT_PROFILES);
  assert.equal(new Set(profiles.map((profile) => profile.heatPerShot)).size, 3);
  assert.equal(new Set(profiles.map((profile) => profile.passiveCoolingPerSecond)).size, 3);
  assert.equal(new Set(profiles.map((profile) => profile.overheatedCoolingPerSecond)).size, 3);
  assert.equal(new Set(profiles.map((profile) => profile.resetThreshold)).size, 3);
});

test('reset returns a ready state for match and death resets', () => {
  const heated = applyShot(createWeaponHeatState('inferno')).state;
  const matchReset = resetWeaponHeatState(heated);
  const deathReset = resetWeaponHeatState(matchReset, 'cannon');

  assert.equal(matchReset.weapon, 'inferno');
  assert.equal(matchReset.heat, 0);
  assert.equal(matchReset.overheated, false);
  assert.equal(deathReset.weapon, 'cannon');
  assert.equal(deathReset.heat, 0);
  assert.equal(deathReset.overheated, false);
});

test('thermal recovery cannot be shortened by fire-rate or bad input values', () => {
  let state = createWeaponHeatState('inferno');
  for (let index = 0; index < 20; index += 1) state = applyShot(state).state;
  assert.equal(state.overheated, true);

  const hackedState = { ...state, fireRate: 999999, cooldown: 0, heat: 'not-a-number' };
  const recovered = advanceCooling(hackedState, Number.POSITIVE_INFINITY);
  assert.equal(recovered.heat, 0);
  assert.equal(recovered.overheated, false);
  assert.equal(canFire(recovered), true);

  const unchanged = advanceCooling(state, Number.NaN);
  assert.equal(unchanged.heat, state.heat);
  assert.equal(unchanged.overheated, state.overheated);
  assert.ok(Number.isFinite(unchanged.heat));
});

test('bad weapon and dt inputs remain deterministic and clamped', () => {
  const state = createWeaponHeatState('unknown');
  assert.equal(state.weapon, 'scout');
  assert.equal(advanceCooling({ ...state, heat: 500 }, -10).heat, 100);
  assert.equal(advanceCooling({ ...state, heat: -20 }, 0).heat, 0);

  const view = getWeaponHeatViewModel({ weapon: 'unknown', heat: Infinity, overheated: 'yes' });
  assert.deepEqual(view, {
    weapon: 'scout',
    heat: 0,
    heatPercent: 0,
    status: 'READY',
    canFire: true,
  });
});
