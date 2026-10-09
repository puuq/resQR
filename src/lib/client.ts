export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      ...options,
      cache: 'no-store',
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      'The connection failed or timed out. Please check your internet and try again.',
    );
  }
  const data = await response
    .json()
    .catch(() => ({ error: 'The server could not be reached. Please try again.' }));
  if (!response.ok) throw new Error((data as { error?: string }).error || 'Something went wrong.');
  return data as T;
}
export const money = (paisa: number) =>
  `Rs. ${new Intl.NumberFormat('en-NP', { maximumFractionDigits: 2 }).format(paisa / 100)}`;
export function elapsed(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
export function brandStyle(color: string) {
  // Keep a darker usable button shade even when a restaurant selects a pale logo colour.
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  const button = luminance > 140 ? `rgb(${rgb.map((v) => Math.round(v * 0.48)).join(',')})` : color;
  return {
    '--brand': color,
    '--brand-button': button,
    '--brand-soft': `${color}16`,
  } as React.CSSProperties;
}
