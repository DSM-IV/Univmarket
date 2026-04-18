/**
 * 폴링 간격에 ±20% jitter 추가.
 * 모든 클라이언트가 같은 초에 동시에 서버를 때리는 thundering-herd 현상 완화.
 */
export function jitterMs(baseMs: number, spread = 0.2): number {
  const delta = baseMs * spread * (Math.random() * 2 - 1);
  return Math.max(1000, Math.round(baseMs + delta));
}

/**
 * fetch 함수를 jittered 간격으로 재귀 호출하는 헬퍼.
 * 반환된 stop 함수를 호출하면 루프 중단.
 */
export function pollWithJitter(fetcher: () => void | Promise<void>, baseMs: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const loop = async () => {
    if (cancelled) return;
    try {
      await fetcher();
    } catch {
      // 호출부에서 처리
    }
    if (!cancelled) {
      timer = setTimeout(loop, jitterMs(baseMs));
    }
  };

  timer = setTimeout(loop, jitterMs(baseMs));
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
