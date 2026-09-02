import { useEffect } from 'react';

/* ---------------------------------------------------------------------------
 * Keeps the app sized to the space the browser is ACTUALLY giving it.
 *
 * On mobile Chrome the address bar and tab strip slide in and out, and the
 * on-screen keyboard pushes things around. None of that is reflected in `100%`
 * or `100vh`, both of which report the *largest* the viewport could be — so
 * the top of the UI ends up underneath the browser chrome.
 *
 * `visualViewport` is the only API that reports the real, currently-visible
 * region. Its height is published as a CSS variable so layout can follow it,
 * with `100dvh` as the fallback for anything that lacks the API.
 * ------------------------------------------------------------------------- */

export function useViewportFit() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      root.style.setProperty('--app-height', `${Math.round(height)}px`);
    };

    apply();

    const vv = window.visualViewport;
    // 'scroll' matters too: Chrome fires it (not resize) as the URL bar
    // collapses during a swipe.
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);

    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
}
