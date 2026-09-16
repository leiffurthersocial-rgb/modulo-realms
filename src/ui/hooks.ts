import { useEffect, useState } from 'react';

/** Cheap ticker so a panel can show a live countdown without re-rendering the whole tree every frame. */
export function useTicker(hz = 10): number {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 1), 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return 0;
}
