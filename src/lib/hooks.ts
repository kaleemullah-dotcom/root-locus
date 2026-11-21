import { useEffect, useState } from 'react';
import type React from 'react';

export function useMediaQuery(q: string, fallback = true): boolean {
  const get = (): boolean => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : fallback);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = (): void => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

type IdleWin = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };

/** Becomes true once the browser is idle after `key` changes (progressive rendering). */
export function useIdleReady(key: unknown, timeout = 600): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const w = window as IdleWin;
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(() => setReady(true), { timeout });
      return () => w.cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(() => setReady(true), 50);
    return () => window.clearTimeout(t);
  }, [key, timeout]);
  return ready;
}

/** True once the element has come within `margin` of the viewport (stays true), or when printing. */
export function useNearViewport(ref: React.RefObject<Element | null>, key: unknown, margin = '100px'): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    const onPrint = (): void => setNear(true);
    window.addEventListener('beforeprint', onPrint);
    return () => {
      io.disconnect();
      window.removeEventListener('beforeprint', onPrint);
    };
  }, [ref, key, margin]);
  return near;
}
