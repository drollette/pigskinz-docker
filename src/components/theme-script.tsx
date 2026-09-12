export function ThemeScript({ defaultTheme = "system" }: { defaultTheme?: string }) {
  // This script runs before React hydration to prevent theme flash
  const script = `
    (function() {
      const THEME_STORAGE_KEY = 'pigskinz-theme';
      const LIGHT_THEME = 'pigskinz';
      const DARK_THEME = 'pigskinz-dark';

      function getStoredTheme() {
        try {
          return localStorage.getItem(THEME_STORAGE_KEY);
        } catch {
          return null;
        }
      }

      function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      const stored = getStoredTheme();
      const preference = stored || '${defaultTheme}';
      const resolved = preference === 'system' ? getSystemTheme() : preference;
      const daisyTheme = resolved === 'dark' ? DARK_THEME : LIGHT_THEME;

      document.documentElement.setAttribute('data-theme', daisyTheme);
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
