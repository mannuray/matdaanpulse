// Set the theme before first paint (no dark-to-light flash). Keep in sync with src/viewmodels/theme/useTheme.ts.
// A file, not an inline <script>, so the Content-Security-Policy can keep script-src 'self' (public/_headers).
try {
  var t = localStorage.getItem('studio_theme') === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
} catch (e) { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark'; }
