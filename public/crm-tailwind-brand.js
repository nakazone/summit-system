/**
 * Shared Tailwind CDN theme mapped to Summit design-system.css tokens.
 * Include after design-system.css and before/alongside the Tailwind CDN script.
 *
 * Usage in HTML:
 *   <script src="crm-tailwind-brand.js"></script>
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script>tailwind.config = window.SUMMIT_TAILWIND_CONFIG;</script>
 */
(function (global) {
  global.SUMMIT_TAILWIND_CONFIG = {
    corePlugins: { preflight: false },
    theme: {
      extend: {
        colors: {
          primary: {
            DEFAULT: 'var(--color-primary)',
            hover: 'var(--color-primary-hover)',
            light: 'var(--primary-light)',
            dark: 'var(--primary-dark)',
          },
          accent: {
            DEFAULT: 'var(--color-accent)',
            hover: 'var(--color-accent-hover)',
            dark: 'var(--secondary-dark)',
          },
          surface: {
            DEFAULT: 'var(--color-surface)',
            secondary: 'var(--color-surface-secondary)',
            tertiary: 'var(--color-surface-tertiary)',
          },
          ink: {
            DEFAULT: 'var(--color-text-primary)',
            secondary: 'var(--color-text-secondary)',
            muted: 'var(--color-text-muted)',
          },
          line: 'var(--color-border)',
        },
        fontFamily: {
          sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        },
        borderRadius: {
          sm: 'var(--radius-sm)',
          md: 'var(--radius-md)',
          lg: 'var(--radius-lg)',
        },
      },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
