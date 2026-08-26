# Design System — Summit Flooring CRM

Aligned with the Summit Flooring website (`summit-website`).

## Identidade visual

### Cores

| Token | Hex | Uso |
|-------|-----|-----|
| **Primary** | `#1c1c1f` | Charcoal — sidebar, headings, CTAs escuros |
| **Primary hover** | `#141416` | Hover de primary |
| **Secondary / accent** | `#d6c4a8` | Destaques, badges, CTAs bege |
| **Secondary hover** | `#e4d6c4` | Hover de accent |
| **Text dark** | `#151517` | Corpo de texto |
| **Text light** | `#4a5568` | Texto secundário |
| **Text muted** | `#718096` | Hints / captions |
| **BG light** | `#f7f8fc` | Fundo do app |
| **Border** | `#e2e8f0` | Bordas |

Semânticas: success `#22c55e`, warning `#f59e0b`, danger `#ef4444`, info `#3b82f6`.

### Tipografia

- **Font:** Inter (Google Fonts), weights 400 / 500 / 600 / 700
- Stack: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Logo

- Arquivo principal (fundo escuro): `/assets/summitLogo.jpg`
- Variante transparente: `/assets/logoSummitFlooring.png`
- Favicon: `/favicon.ico` + `/assets/favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-*.png` (gerados a partir de `summitLogo.jpg`)
- Login CRM usa `summitLogo.jpg` com moldura `--primary-color`

### Tokens CSS

Definidos em `public/design-system.css` (`--color-primary`, `--color-accent`, aliases `--primary-color` / `--secondary-color` para o legado em `styles.css`).

Builder portal: `public/css/builders-portal.css` (`--bp-navy`, `--bp-tan`).

PDFs (quotes, invoices, payroll): paleta RGB equivalente em `modules/**/*Pdf.js`.

## Layout

- Sidebar CRM: `--crm-sidebar-width: 264px`, fundo primary
- Shell responsivo: `public/crm-responsive.css` + `crm-mobile-chrome.js`
- Breakpoints padronizados:
  - **Phone** ≤767.98px — tab bar + shell (`sf-mobile-shell`)
  - **Tablet / iPad (incl. Pro 13")** 768–1366px — gaveta + hamburger, **sem** tab bar
  - **Desktop** ≥1367px — sidebar fixa
- Tokens: `--crm-bp-phone-max`, `--crm-bp-tablet-max`, `--crm-bp-desktop-min`
- Helpers JS: `CrmViewport.isPhone()` / `.isCompact()` / `.isDesktop()`

## Componentes

Botões primary (charcoal) / secondary (bege), badges de status, cards de dashboard, tabelas com scroll horizontal no mobile/tablet (`.table-container`, `.bp-table-wrap`).
