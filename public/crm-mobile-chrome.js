/**
 * Shared mobile/tablet chrome: header + overlay + drawer for sidebar pages.
 * Idempotent — safe with dashboard.js / payroll / portal wiring.
 */
(function () {
  if (window.__crmMobileChromeInit) return;
  window.__crmMobileChromeInit = true;

  const COMPACT_MQ = '(max-width: 1366px)';

  function isCompact() {
    return window.CrmViewport ? window.CrmViewport.isCompact() : window.matchMedia(COMPACT_MQ).matches;
  }

  function findSidebar() {
    return (
      document.getElementById('dashboardSidebar') ||
      document.getElementById('bpSidebar') ||
      document.getElementById('payrollSidebar') ||
      document.getElementById('finSidebar') ||
      document.getElementById('projectsSidebar') ||
      document.getElementById('marketingSidebar') ||
      document.getElementById('bpfSidebar') ||
      document.getElementById('quoteBuilderSidebar') ||
      document.querySelector('.dashboard-container > .dashboard-sidebar') ||
      document.querySelector('aside.dashboard-sidebar')
    );
  }

  function ensureOverlay() {
    let el = document.getElementById('mobileOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'mobile-overlay';
    el.id = 'mobileOverlay';
    el.setAttribute('aria-hidden', 'true');
    const container = document.querySelector('.dashboard-container') || document.body;
    container.insertBefore(el, container.firstChild);
    return el;
  }

  function pageTitle() {
    const h1 = document.querySelector('.bp-title, .page-title, .lead-title, main h1');
    if (h1) {
      const t = (h1.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length < 48 && !/^loading/i.test(t)) return t;
    }
    const doc = (document.title || '').split(/[-—|]/)[0].trim();
    return doc || 'Summit Flooring';
  }

  function ensureHeader(sidebar) {
    let header = document.getElementById('mobileAppHeader');
    if (header) return header;
    if (document.body.classList.contains('crm-standalone-page')) return null;
    if (!sidebar) return null;

    header = document.createElement('header');
    header.className = 'mobile-app-header';
    header.id = 'mobileAppHeader';
    header.setAttribute('aria-label', 'Barra superior');
    const sid = sidebar.id || 'dashboardSidebar';
    if (!sidebar.id) sidebar.id = sid;

    header.innerHTML =
      '<button type="button" class="mobile-app-header__menu" id="mobileMenuToggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="' +
      sid +
      '"><span class="mobile-app-header__menu-icon" aria-hidden="true"></span></button>' +
      '<div class="mobile-app-header__brand">' +
      '<img src="/assets/logoSummitFlooring.png" alt="" class="mobile-app-header__logo" width="28" height="28" onerror="this.style.display=\'none\'" />' +
      '<h1 class="mobile-app-header__title">' +
      pageTitle().replace(/</g, '&lt;') +
      '</h1></div>';

    document.body.insertBefore(header, document.body.firstChild);
    return header;
  }

  function setOpen(sidebar, overlay, toggle, open) {
    if (!sidebar) return;
    sidebar.classList.toggle('mobile-open', open);
    if (overlay) {
      overlay.classList.toggle('active', open);
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('crm-drawer-open', open);
  }

  function wire(sidebar) {
    if (!sidebar || sidebar.dataset.crmChromeWired === '1') return;
    sidebar.dataset.crmChromeWired = '1';

    const overlay = ensureOverlay();
    ensureHeader(sidebar);
    const toggle =
      document.getElementById('mobileMenuToggle') || document.getElementById('bpMenuToggle');

    if (toggle && !toggle.dataset.crmChromeClick) {
      toggle.dataset.crmChromeClick = '1';
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const open = !sidebar.classList.contains('mobile-open');
        setOpen(sidebar, overlay, toggle, open);
      });
    }

    if (overlay && !overlay.dataset.crmChromeClick) {
      overlay.dataset.crmChromeClick = '1';
      overlay.addEventListener('click', () => setOpen(sidebar, overlay, toggle, false));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(sidebar, overlay, toggle, false);
    });

    sidebar.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        if (isCompact()) setOpen(sidebar, overlay, toggle, false);
      });
    });

    const onResize = () => {
      if (!isCompact()) setOpen(sidebar, overlay, toggle, false);
    };
    window.addEventListener('resize', onResize);
  }

  function init() {
    if (document.body.classList.contains('crm-standalone-page')) return;
    const sidebar = findSidebar();
    if (!sidebar) return;
    wire(sidebar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CrmMobileChrome = { init, setOpen: (open) => {
    const sidebar = findSidebar();
    const overlay = document.getElementById('mobileOverlay');
    const toggle = document.getElementById('mobileMenuToggle') || document.getElementById('bpMenuToggle');
    setOpen(sidebar, overlay, toggle, !!open);
  } };
})();
