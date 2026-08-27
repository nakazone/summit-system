/**
 * Injects standard CRM shell CSS/JS link tags into HTML pages (idempotent-ish).
 * Usage: node scripts/inject-crm-shell-assets.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'public');
const V = '20260827-shell';

const CSS_BLOCK = [
  `<link rel="stylesheet" href="styles.css?v=20260819-menu-fix-v2" />`,
  `<link rel="stylesheet" href="design-system.css?v=20260819-menu-fix-v2" />`,
  `<link rel="stylesheet" href="crm-shared-nav.css?v=${V}" />`,
  `<link rel="stylesheet" href="crm-responsive.css?v=${V}" />`,
  `<link rel="stylesheet" href="mobile-design-system.css?v=${V}" />`,
  `<link rel="stylesheet" href="crm-page.css?v=${V}" />`,
  `<link rel="stylesheet" href="crm-toast.css" />`,
].join('\n  ');

const JS_BLOCK = [
  `<script src="crm-viewport.js?v=${V}"></script>`,
  `<script src="crm-mobile-chrome.js?v=${V}"></script>`,
  `<script src="crm-shared-nav.js?v=${V}"></script>`,
  `<script src="crm-toast.js"></script>`,
].join('\n  ');

const PAGES = [
  'projects.html',
  'financial.html',
  'payroll-module.html',
  'marketing.html',
  'builders.html',
  'builder-payments-forecast.html',
  'quote-builder.html',
  'builder-detail.html',
  'builder-gallery-admin.html',
  'builder-messages-admin.html',
  'builder-pricing-admin.html',
  'builder-estimate-requests.html',
  'project-detail.html',
  'lead-detail.html',
  'onsite-quote.html',
];

function ensureCss(html) {
  let out = html;
  // Normalize versions of known CRM assets when present
  out = out.replace(/crm-shared-nav\.css\?v=[^"']+/g, `crm-shared-nav.css?v=${V}`);
  out = out.replace(/crm-responsive\.css\?v=[^"']+/g, `crm-responsive.css?v=${V}`);
  out = out.replace(/mobile-design-system\.css\?v=[^"']+/g, `mobile-design-system.css?v=${V}`);
  out = out.replace(/crm-page\.css\?v=[^"']+/g, `crm-page.css?v=${V}`);

  const missing = [];
  if (!/crm-shared-nav\.css/.test(out)) missing.push(`crm-shared-nav.css?v=${V}`);
  if (!/crm-responsive\.css/.test(out)) missing.push(`crm-responsive.css?v=${V}`);
  if (!/mobile-design-system\.css/.test(out)) missing.push(`mobile-design-system.css?v=${V}`);
  if (!/crm-page\.css/.test(out)) missing.push(`crm-page.css?v=${V}`);
  if (!/crm-toast\.css/.test(out)) missing.push('crm-toast.css');

  if (missing.length) {
    const tags = missing.map((f) => `<link rel="stylesheet" href="${f}" />`).join('\n  ');
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `  ${tags}\n</head>`);
    }
  }
  return out;
}

function ensureJs(html) {
  let out = html;
  out = out.replace(/crm-shared-nav\.js\?v=[^"']+/g, `crm-shared-nav.js?v=${V}`);
  out = out.replace(/crm-viewport\.js\?v=[^"']+/g, `crm-viewport.js?v=${V}`);
  out = out.replace(/crm-mobile-chrome\.js\?v=[^"']+/g, `crm-mobile-chrome.js?v=${V}`);

  const need = [];
  if (!/crm-viewport\.js/.test(out)) need.push(`crm-viewport.js?v=${V}`);
  if (!/crm-mobile-chrome\.js/.test(out)) need.push(`crm-mobile-chrome.js?v=${V}`);
  if (!/crm-shared-nav\.js/.test(out)) need.push(`crm-shared-nav.js?v=${V}`);
  if (!/crm-toast\.js/.test(out)) need.push('crm-toast.js');

  if (need.length) {
    const tags = need.map((f) => `<script src="${f}"></script>`).join('\n  ');
    // Insert before first page-specific script that is not chrome, or before </body>
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `  ${tags}\n</body>`);
    }
  }
  return out;
}

function ensureMobileHeader(html, title, sidebarId) {
  if (/id="mobileAppHeader"/.test(html)) return html;
  if (!/dashboard-app-body/.test(html) && !/class="[^"]*dashboard-container/.test(html)) return html;

  const header = `
  <header class="mobile-app-header" id="mobileAppHeader" aria-label="Barra superior">
    <button type="button" class="mobile-app-header__menu" id="mobileMenuToggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="${sidebarId}">
      <span class="mobile-app-header__menu-icon" aria-hidden="true"></span>
    </button>
    <div class="mobile-app-header__brand">
      <img src="/assets/logoSummitFlooring.png" alt="" class="mobile-app-header__logo" width="28" height="28" onerror="this.style.display='none'" />
      <h1 class="mobile-app-header__title">${title}</h1>
    </div>
  </header>
`;

  // Insert after <body ...>
  return html.replace(/(<body[^>]*>)/i, `$1\n${header}`);
}

function ensureOverlay(html) {
  if (/id="mobileOverlay"/.test(html)) return html;
  return html.replace(
    /(<div class="dashboard-container"[^>]*>)/i,
    `$1\n    <div class="mobile-overlay" id="mobileOverlay"></div>`
  );
}

const TITLE_MAP = {
  'builder-detail.html': 'Builder',
  'builder-gallery-admin.html': 'Galeria',
  'builder-messages-admin.html': 'Mensagens',
  'builder-pricing-admin.html': 'Tabela',
  'builder-estimate-requests.html': 'Pedidos',
  'projects.html': 'Projetos',
  'financial.html': 'Financeiro',
  'payroll-module.html': 'Folha',
  'marketing.html': 'Marketing',
  'builders.html': 'Builders',
  'builder-payments-forecast.html': 'Previsão',
  'quote-builder.html': 'Orçamento',
  'project-detail.html': 'Projeto',
  'lead-detail.html': 'Lead',
  'onsite-quote.html': 'Field Quote',
};

const SIDEBAR_MAP = {
  'builder-detail.html': 'bpSidebar',
  'builder-gallery-admin.html': 'bpSidebar',
  'builder-messages-admin.html': 'bpSidebar',
  'builder-pricing-admin.html': 'bpSidebar',
  'builder-estimate-requests.html': 'bpSidebar',
  'projects.html': 'projectsSidebar',
  'financial.html': 'finSidebar',
  'payroll-module.html': 'payrollSidebar',
  'marketing.html': 'marketingSidebar',
  'builders.html': 'bpSidebar',
  'builder-payments-forecast.html': 'bpfSidebar',
  'quote-builder.html': 'quoteBuilderSidebar',
  'project-detail.html': 'dashboardSidebar',
  'lead-detail.html': 'dashboardSidebar',
  'onsite-quote.html': 'onsiteQuoteSidebar',
};

for (const file of PAGES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) {
    console.warn('skip missing', file);
    continue;
  }
  let html = fs.readFileSync(fp, 'utf8');
  const before = html;
  html = ensureCss(html);
  html = ensureJs(html);
  html = ensureMobileHeader(html, TITLE_MAP[file] || 'Summit', SIDEBAR_MAP[file] || 'dashboardSidebar');
  html = ensureOverlay(html);
  if (html !== before) {
    fs.writeFileSync(fp, html);
    console.log('updated', file);
  } else {
    console.log('unchanged', file);
  }
}

console.log('done');
