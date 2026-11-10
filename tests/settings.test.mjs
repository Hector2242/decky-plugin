// Settings and preset regression tests: node --test tests/ (compiles settings.ts with the project's tsc).
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), 'ac-settings-'));
execFileSync(join(root, 'node_modules/.bin/tsc'), [join(root, 'src/settings.ts'), '--outDir', out, '--module', 'es2020', '--target', 'es2020', '--strict', '--skipLibCheck']);
writeFileSync(join(out, 'package.json'), '{"type": "module"}');
const S = await import(join(out, 'settings.js'));

test('sanitizing twice changes nothing, whatever is stored', () => {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const junk = [undefined, null, 'x', -1e9, 1e9, NaN, Infinity, true, {}, [], 24, 5000];
  for (let i = 0; i < 5000; i++) {
    const layout = {custom: pick([true, false, 1]), height: pick(junk)};
    for (const part of S.LAYOUT_PARTS) layout[part] = {x: pick(junk), y: pick(junk), size: pick(junk), show: pick([true, 1])};
    const once = S.sanitizeSettings({
      ...pick(Object.values(S.PRESETS)),
      primaryColor: pick([undefined, '#ABC', 'red', '#123456']),
      preset: pick(['xbox', 'custom', 'user-1', 7]),
      borderRadius: pick(junk),
      layout,
      userPresets: pick([undefined, 'x', [{id: 'user-1', name: 5}, {id: 'bad'}]]),
    });
    assert.deepEqual(S.sanitizeSettings(JSON.parse(JSON.stringify(once))), once);
  }
});

test('built-in presets never change; edits become Custom or save into the user preset', () => {
  const builtIns = JSON.stringify(S.PRESETS);
  let s = S.changeSettings(S.DEFAULT_SETTINGS, {preset: 'pixel-hoth'});
  assert.equal(s.preset, 'pixel-hoth');
  s = S.changeSettings(s, {primaryColor: '#000000'});
  assert.equal(s.preset, 'custom');
  assert.equal(JSON.stringify(S.PRESETS), builtIns);
  s = S.addUserPreset(s, 'Mine');
  const id = s.preset;
  s = S.changeSettings(s, {glowEnabled: false});
  assert.equal(s.preset, id);
  assert.equal(s.userPresets[0].glowEnabled, false);
  const back = S.changeSettings(s, {preset: 'pixel-hoth'});
  assert.equal(back.preset, 'pixel-hoth');
  assert.equal(back.layout.custom, false);
  const deleted = S.deleteUserPreset(s, id);
  assert.equal(deleted.preset, 'custom');
  assert.equal(deleted.userPresets.length, 0);
});

test('a stored built-in preset with a missing color stays that preset', () => {
  const {primaryColor, ...rest} = S.PRESETS.xbox;
  assert.equal(S.sanitizeSettings({...rest, preset: 'xbox'}).preset, 'xbox');
  assert.equal(primaryColor.toLowerCase(), S.sanitizeSettings({}).primaryColor);
});

test('the old Pill radius becomes a real capsule and presets stay capped', () => {
  assert.equal(S.sanitizeSettings({borderRadius: 24}).borderRadius, 999);
  let s = S.DEFAULT_SETTINGS;
  for (let i = 0; i < 25; i++) s = S.addUserPreset(s, `p${i}`);
  assert.equal(s.userPresets.length, S.MAX_USER_PRESETS);
});

test('trophy images per tier and file names on buttons', () => {
  const s = S.sanitizeSettings({trophyImages: {gold: 'trophy-1-My cup.png', silver: '../x.png', bronze: 5}});
  assert.deepEqual(s.trophyImages, {bronze: '', silver: '', gold: 'trophy-1-My cup.png', platinum: ''});
  assert.equal(S.assetLabel(s.trophyImages.gold), 'My cup.png');
  assert.equal(S.assetLabel('sound-12.mp3'), 'sound-12.mp3');
});
