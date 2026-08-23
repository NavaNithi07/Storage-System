import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollDebug() {
  const loc = useLocation();

  useEffect(() => {
    console.log('[ScrollDebug] mounted');
    return () => console.log('[ScrollDebug] unmounted');
  }, []);

  useEffect(() => {
    console.log('[ScrollDebug] route change ->', loc.pathname + loc.search);
    console.log('[ScrollDebug] window.scrollY before restore', window.scrollY);
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    const onScroll = () => {
      // Throttle minimally to avoid spamming
      // eslint-disable-next-line no-console
      console.log('[ScrollDebug] window scroll', Math.round(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return null;
}
