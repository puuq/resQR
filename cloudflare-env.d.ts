/// <reference types="@cloudflare/workers-types" />
interface CloudflareEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  BOOTSTRAP_TOKEN?: string;
  APP_ENV?: string;
  QR_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  MENU_IMPORT_MODEL?: string;
}
