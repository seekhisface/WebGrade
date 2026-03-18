'use client';

import { useState, useEffect } from 'react';

/**
 * Animates a number from 0 to `target` over `duration` ms.
 *
 * @param target   The final value to count up to.
 * @param duration Animation duration in milliseconds (default 1800).
 * @param trigger  When false the animation is deferred (useful with IntersectionObserver).
 * @returns The current animated value.
 */
export function useCountUp(target: number, duration = 1800, trigger = true): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger || target === 0) {
      setVal(target);
      return;
    }
    let v = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      v += step;
      if (v >= target) {
        setVal(target);
        clearInterval(t);
      } else {
        setVal(Math.floor(v));
      }
    }, 16);
    return () => clearInterval(t);
  }, [target, duration, trigger]);
  return val;
}
