import { getCloudflareContext } from '@opennextjs/cloudflare';
export async function environment() {
  return (await getCloudflareContext({ async: true })).env as CloudflareEnv;
}
export async function database() {
  return (await environment()).DB;
}
export function id() {
  return crypto.randomUUID();
}
export function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
