import { z } from 'zod';
const image = z
  .string()
  .max(250)
  .refine(
    (s) => s === '' || /^\/api\/media\/[a-f0-9-]+\.(png|jpg|webp|gif)$/.test(s),
    'Upload an image using the image picker.',
  );
const externalUrl = z
  .string()
  .max(1000)
  .refine((s) => {
    if (!s) return true;
    try {
      return new URL(s).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Use a full https:// link.');
export const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12, 'Use at least 12 characters for the password.').max(128),
});
const googleReviewUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((s) => {
    if (!s) return true;
    try {
      const url = new URL(s);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
      if (['g.page', 'maps.app.goo.gl'].includes(url.hostname)) return url.pathname !== '/';
      if (url.hostname === 'search.google.com') return url.pathname === '/local/writereview';
      if (url.hostname === 'maps.google.com') return true;
      return (
        ['google.com', 'www.google.com'].includes(url.hostname) &&
        (url.pathname === '/maps' || url.pathname.startsWith('/maps/'))
      );
    } catch {
      return false;
    }
  }, 'Use the full HTTPS review link from Google Business Profile or Google Maps.');
export const restaurantInput = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens for the URL.'),
  tagline: z.string().trim().max(160).default(''),
  address: z.string().trim().max(200).default(''),
  color: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default('#285847'),
  theme: z.enum(['light', 'dark']).default('light'),
  logo: image.default(''),
  wifi_ssid: z.string().max(32).default(''),
  wifi_password: z.string().max(63).default(''),
  ad_title: z.string().trim().max(120).default(''),
  ad_image: image.default(''),
  ad_url: externalUrl.default(''),
  google_review_url: googleReviewUrl.default(''),
  table_count: z.number().int().min(1).max(100).default(6),
  sample_menu: z.boolean().default(false),
});
export const menuInput = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().max(400).default(''),
  price: z
    .number()
    .min(0)
    .max(100000)
    .transform((n) => Math.round(n * 100)),
  available: z.boolean().default(true),
  vegetarian: z.boolean().default(false),
  image: image.default(''),
  sort_order: z.number().int().min(0).max(10000).default(0),
});
