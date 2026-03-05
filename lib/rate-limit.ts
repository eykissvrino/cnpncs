const requests = new Map<string, number[]>();

// 5분마다 오래된 엔트리 정리
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requests.entries()) {
    const filtered = timestamps.filter((t) => now - t < 300_000);
    if (filtered.length === 0) {
      requests.delete(key);
    } else {
      requests.set(key, filtered);
    }
  }
}, 300_000);

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = (requests.get(key) || []).filter(
    (t) => now - t < windowMs
  );

  if (timestamps.length >= limit) {
    requests.set(key, timestamps);
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  requests.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length };
}
