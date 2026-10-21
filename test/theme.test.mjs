import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/theme.js', import.meta.url), 'utf8');
function screen({ saved = null, systemDark = false, storageBlocked = false } = {}) {
  const documentEvents = {}, windowEvents = {}, controlEvents = {};
  let mediaChange, writes = 0;
  const selector = { value: '', addEventListener: (name, fn) => { controlEvents[name] = fn; } };
  const meta = { content: '' }, root = { dataset: {} };
  const media = { matches: systemDark, addEventListener: (_, fn) => { mediaChange = fn; } };
  const context = {
    document: { documentElement: root, querySelector: () => meta,
      getElementById: () => selector, addEventListener: (name, fn) => { documentEvents[name] = fn; } },
    localStorage: { getItem: () => { if (storageBlocked) throw Error('blocked'); return saved; },
      setItem: (_, value) => { if (storageBlocked) throw Error('blocked'); saved = value; writes++; } },
    window: { matchMedia: () => media, addEventListener: (name, fn) => { windowEvents[name] = fn; } },
  };
  runInNewContext(source, context);
  return {
    root, meta, selector, saved: () => saved, writes: () => writes,
    mount: () => documentEvents.DOMContentLoaded(),
    select: value => { selector.value = value; controlEvents.change({ target: selector }); },
    system: value => { media.matches = value; mediaChange(); },
    fromOtherTab: value => { saved = value; windowEvents.storage({ key: 'omgim-theme' }); },
  };
}

test('default follows OS before CSS/controls load, then follows live system changes', () => {
  const s = screen({ systemDark: true });
  assert.equal(s.root.dataset.theme, 'dark');
  assert.equal(s.root.dataset.themeMode, 'system');
  assert.equal(s.writes(), 0);
  s.mount(); assert.equal(s.selector.value, 'system');
  s.system(false); assert.equal(s.root.dataset.theme, 'light');
});

test('explicit choices persist and override the system until system is selected again', () => {
  const s = screen(); s.mount(); s.select('dark'); s.system(false);
  assert.equal(s.root.dataset.theme, 'dark');
  assert.equal(s.saved(), '"dark"');
  const next = screen({ saved: s.saved() });
  assert.equal(next.root.dataset.theme, 'dark');
  s.select('light'); s.system(true); assert.equal(s.root.dataset.theme, 'light');
  s.select('system'); assert.equal(s.root.dataset.theme, 'dark');
  s.system(false); assert.equal(s.root.dataset.theme, 'light');
});

test('blocked/corrupt storage and changes from another tab are handled safely', () => {
  for (const saved of ['broken', '"invalid"', 'null']) {
    const s = screen({ saved, systemDark: true }); assert.equal(s.root.dataset.theme, 'dark');
  }
  const blocked = screen({ storageBlocked: true }); blocked.mount(); blocked.select('dark');
  assert.equal(blocked.root.dataset.theme, 'dark');
  const s = screen(); s.mount(); s.fromOtherTab('"dark"');
  assert.equal(s.root.dataset.theme, 'dark'); assert.equal(s.selector.value, 'dark');
});
