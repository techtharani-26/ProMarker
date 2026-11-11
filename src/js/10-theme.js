/* --------------------------------------------------------------------------
   5. THEME ENGINE (System Preference Default)
   -------------------------------------------------------------------------- */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

// Initialize Theme
applyTheme(AppState.data.settings.theme || 'system');

// Listen to OS theme changes if on system
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (AppState.data.settings.theme === 'system') {
    applyTheme('system');
  }
});
