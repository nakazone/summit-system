/**
 * Viewport helpers — phone / tablet (iPad Pro ≤1366) / desktop
 * window.CrmViewport.isPhone() | .isCompact() | .isDesktop()
 */
(function (global) {
  const PHONE = '(max-width: 767.98px)';
  const COMPACT = '(max-width: 1366px)';

  function mq(q) {
    try {
      return window.matchMedia(q).matches;
    } catch (_) {
      return false;
    }
  }

  const api = {
    PHONE_MQ: PHONE,
    COMPACT_MQ: COMPACT,
    isPhone() {
      return mq(PHONE);
    },
    isCompact() {
      return mq(COMPACT);
    },
    isTablet() {
      return mq(COMPACT) && !mq(PHONE);
    },
    isDesktop() {
      return !mq(COMPACT);
    },
    onChange(fn) {
      const lists = [window.matchMedia(PHONE), window.matchMedia(COMPACT)];
      const handler = () => fn(api);
      lists.forEach((m) => {
        if (m.addEventListener) m.addEventListener('change', handler);
        else if (m.addListener) m.addListener(handler);
      });
      return () =>
        lists.forEach((m) => {
          if (m.removeEventListener) m.removeEventListener('change', handler);
          else if (m.removeListener) m.removeListener(handler);
        });
    },
  };

  global.CrmViewport = api;
})(typeof window !== 'undefined' ? window : globalThis);
