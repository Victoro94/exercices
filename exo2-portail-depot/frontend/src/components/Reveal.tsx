import { useEffect, useRef, type ReactNode } from 'react';

export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.animationDelay = `${delay}ms`;
      el.classList.add('reveal');
    }
  }, [delay]);
  return <div ref={ref}>{children}</div>;
}
