import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Simple scroll restoration: saves window scrollY per location.pathname+search
// and restores when navigating back to that location. Uses sessionStorage.
export default function ScrollRestoration() {
  const loc = useLocation();
  const prevKeyRef = useRef(null);

  useEffect(() => {
    const key = `${loc.pathname}${loc.search}`;
    console.log('[ScrollRestoration] restoring for', key);
    // restore saved position (if any)
    try {
      const raw = sessionStorage.getItem(`vibna:scroll:${key}`);
      if (raw) {
        const y = parseInt(raw, 10);
        console.log('[ScrollRestoration] found saved y=', y);
        if (!isNaN(y)) {
          // only restore if it's different from current position
          if ((window.scrollY || window.pageYOffset || 0) !== y) {
            console.log('[ScrollRestoration] restoring window.scrollTo', y);
            window.scrollTo(0, y);
          } else {
            console.log('[ScrollRestoration] current position equals saved, skipping');
          }
        }
      } else {
        console.log('[ScrollRestoration] no saved position for', key);
      }
    } catch (e) { console.error('[ScrollRestoration] error reading sessionStorage', e); }

    // when unmounting or before next location change, save current position
    const savePrev = () => {
      if (prevKeyRef.current) {
        try {
          const val = String(window.scrollY || window.pageYOffset || 0);
          console.log('[ScrollRestoration] saving prev', prevKeyRef.current, val);
          sessionStorage.setItem(`vibna:scroll:${prevKeyRef.current}`, val);
        } catch (e) { console.error('[ScrollRestoration] failed to save prev', e); }
      }
    };

    // Save previous key now (for next change)
    savePrev();
    prevKeyRef.current = key;

    // Also save on pagehide (bfcache / back)
    const onPageHide = () => {
      try {
        const val = String(window.scrollY || window.pageYOffset || 0);
        console.log('[ScrollRestoration] pagehide save', key, val);
        sessionStorage.setItem(`vibna:scroll:${key}`, val);
      } catch (e) { console.error('[ScrollRestoration] pagehide save failed', e); }
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      // save current position when leaving
      try {
        const val = String(window.scrollY || window.pageYOffset || 0);
        console.log('[ScrollRestoration] cleanup save', key, val);
        sessionStorage.setItem(`vibna:scroll:${key}`, val);
      } catch (e) { console.error('[ScrollRestoration] cleanup save failed', e); }
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [loc.pathname, loc.search]);

  return null;
}
