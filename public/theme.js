// Run before CSS so the saved/system theme is applied before the first paint.
(() => {
  const key = 'omgim-theme';
  const valid = value => ['system', 'light', 'dark'].includes(value) ? value : 'system';
  const read = () => { try { return valid(JSON.parse(localStorage.getItem(key))); } catch { return 'system'; } };
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = read();
  const apply = () => {
    const dark = mode === 'dark' || (mode === 'system' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.themeMode = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#121a27' : '#f5f7fb';
    const select = document.getElementById('theme-mode');
    if (select) select.value = mode;
  };
  apply();
  media.addEventListener('change', () => { if (mode === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { mode = read(); apply(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-mode').addEventListener('change', event => {
      mode = valid(event.target.value);
      try { localStorage.setItem(key, JSON.stringify(mode)); } catch {}
      apply();
    });
  });
})();
