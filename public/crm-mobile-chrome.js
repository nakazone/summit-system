/**
 * Shared mobile/tablet chrome: header + overlay + drawer for sidebar pages.
 * Idempotent — safe with dashboard.js / payroll / portal wiring.
 */
(function () {
  if (window.__crmMobileChromeInit) return;
  window.__crmMobileChromeInit = true;

  const COMPACT_MQ = '(max-width: 1366px)';
  const PHONE_MQ = '(max-width: 767.98px)';

  function isCompact() {
    return window.CrmViewport ? window.CrmViewport.isCompact() : window.matchMedia(COMPACT_MQ).matches;
  }

  function isPhone() {
    return window.CrmViewport && typeof window.CrmViewport.isPhone === 'function'
      ? window.CrmViewport.isPhone()
      : window.matchMedia(PHONE_MQ).matches;
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
      document.getElementById('onsiteQuoteSidebar') ||
      document.getElementById('buildersSidebar') ||
      document.getElementById('productsSidebar') ||
      document.getElementById('catalogSidebar') ||
      document.getElementById('suppliersSidebar') ||
      document.getElementById('estimateSidebar') ||
      document.getElementById('estimateAnalyticsSidebar') ||
      document.getElementById('leadDetailSidebar') ||
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

  function shouldSkipPhoneDock() {
    const b = document.body;
    return (
      b.classList.contains('dashboard-app-body') ||
      b.classList.contains('sf-mobile-shell') ||
      b.classList.contains('os-wizard-page') ||
      b.classList.contains('qb-dashboard-inner') ||
      b.classList.contains('qb-sidebar-page') ||
      b.classList.contains('crm-standalone-page') ||
      !!document.getElementById('mobileTabBar')
    );
  }

  function ensurePhoneDock() {
    if (shouldSkipPhoneDock()) {
      const existing = document.getElementById('crmPhoneDock');
      if (existing) existing.remove();
      document.body.classList.remove('has-crm-phone-dock');
      return null;
    }
    if (!isPhone()) {
      const existing = document.getElementById('crmPhoneDock');
      if (existing) existing.remove();
      document.body.classList.remove('has-crm-phone-dock');
      return null;
    }
    let dock = document.getElementById('crmPhoneDock');
    if (dock) {
      document.body.classList.add('has-crm-phone-dock');
      return dock;
    }
    dock = document.createElement('nav');
    dock.className = 'crm-phone-dock';
    dock.id = 'crmPhoneDock';
    dock.setAttribute('aria-label', 'Navegação rápida');
    dock.innerHTML =
      '<a class="crm-phone-dock__item" href="dashboard.html"><span class="crm-phone-dock__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 10v10h14V10"/></svg></span>Home</a>' +
      '<a class="crm-phone-dock__item" href="dashboard.html?page=quotes"><span class="crm-phone-dock__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></span>Quotes</a>' +
      '<a class="crm-phone-dock__item crm-phone-dock__item--accent" href="onsite-quote.html" aria-label="Field quote"><span class="crm-phone-dock__fab" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path d="M12 5v14"/><path d="M5 12h14"/></svg></span></a>' +
      '<a class="crm-phone-dock__item" href="dashboard.html?page=customers"><span class="crm-phone-dock__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></span>Clients</a>' +
      '<a class="crm-phone-dock__item" href="dashboard.html?page=leads"><span class="crm-phone-dock__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg></span>Mais</a>';
    document.body.appendChild(dock);
    document.body.classList.add('has-crm-phone-dock');
    return dock;
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
      ensurePhoneDock();
    };
    window.addEventListener('resize', onResize);
  }

  function init() {
    if (document.body.classList.contains('crm-standalone-page')) return;
    const sidebar = findSidebar();
    if (sidebar) wire(sidebar);
    ensurePhoneDock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CrmMobileChrome = {
    init,
    ensurePhoneDock,
    setOpen: (open) => {
      const sidebar = findSidebar();
      const overlay = document.getElementById('mobileOverlay');
      const toggle = document.getElementById('mobileMenuToggle') || document.getElementById('bpMenuToggle');
      setOpen(sidebar, overlay, toggle, !!open);
    },
  };
})();
