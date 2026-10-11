import { ApiError, handler, json, rateLimit, requireUser } from '@/lib/api';
import { environment } from '@/lib/db';
import { menuFileError, MENU_TOTAL_BYTES } from '@/lib/menu-import';
import { extractMenu, menuMime } from '@/lib/menu-extraction';
export const dynamic = 'force-dynamic';

async function admin() {
  const user = await requireUser();
  if (user.role !== 'platform')
    throw new ApiError(403, 'Only the platform administrator can import a new restaurant menu.');
  return user;
}
export const GET = handler(async () => {
  await admin();
  return json({ enabled: Boolean((await environment()).GEMINI_API_KEY) });
});
export const POST = handler(async (request) => {
  const user = await admin();
  const env = await environment();
  if (!env.GEMINI_API_KEY)
    throw new ApiError(
      503,
      'Menu reading needs a Gemini API key. Add GEMINI_API_KEY as a Cloudflare Worker secret first.',
    );
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
    throw new ApiError(400, 'Upload menu files using the file picker.');
  const limit = MENU_TOTAL_BYTES + 65536; // Allow multipart headers, but bound actual streamed bytes too.
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw new ApiError(413, 'Keep the combined file size under 10 MB.');
  await rateLimit(`menu-import-hour:${user.id}`, 6, 3600000);
  await rateLimit(`menu-import-day:${user.id}`, 20, 86400000);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Choose menu files.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ApiError(413, 'Keep the combined file size under 10 MB.');
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { 'Content-Type': request.headers.get('content-type')! },
    }).formData();
  } catch {
    throw new ApiError(400, 'The menu upload is invalid. Select the files again.');
  }
  const values = form.getAll('files');
  if (values.some((value) => !(value instanceof File)))
    throw new ApiError(400, 'Choose menu files.');
  const files = values as File[];
  const error = menuFileError(files);
  if (error) throw new ApiError(400, error);
  const attachments = [];
  for (const file of files) {
    const content = new Uint8Array(await file.arrayBuffer());
    const mimeType = menuMime(content);
    if (!mimeType || mimeType !== file.type)
      throw new ApiError(
        400,
        'A file does not match its PDF or image format. Use a valid PDF, JPG, PNG or WebP.',
      );
    attachments.push({ mimeType, bytes: content });
  }
  // No original documents, provider responses or draft dishes are stored in D1/R2.
  return json(await extractMenu(attachments, env.GEMINI_API_KEY, env.MENU_IMPORT_MODEL));
});
