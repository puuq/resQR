import { ApiError, handler, json, rateLimit, requireUser } from '@/lib/api';
import { environment, id } from '@/lib/db';
export const POST = handler(async (request) => {
  const user = await requireUser();
  if (!['platform', 'owner'].includes(user.role))
    throw new ApiError(403, 'Only an owner or administrator can upload images.');
  await rateLimit(`upload:${user.id}`, 30, 60000);
  if (Number(request.headers.get('content-length') || 0) > 3_200_000)
    throw new ApiError(413, 'Choose an image smaller than 3 MB.');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 3_000_000 || file.size < 12)
    throw new ApiError(400, 'Choose a PNG, JPEG, WebP or GIF smaller than 3 MB.');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const start = String.fromCharCode(...bytes.slice(0, 12));
  let ext = '';
  let type = '';
  if (bytes[0] === 137 && start.slice(1, 4) === 'PNG') {
    ext = 'png';
    type = 'image/png';
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    ext = 'jpg';
    type = 'image/jpeg';
  } else if (start.startsWith('GIF87a') || start.startsWith('GIF89a')) {
    ext = 'gif';
    type = 'image/gif';
  } else if (start.startsWith('RIFF') && start.slice(8, 12) === 'WEBP') {
    ext = 'webp';
    type = 'image/webp';
  } else throw new ApiError(400, 'That file is not a supported image.');
  const key = `${id()}.${ext}`;
  await (
    await environment()
  ).MEDIA.put(key, buffer, {
    httpMetadata: { contentType: type },
    customMetadata: { owner: user.id },
  });
  return json({ url: `/api/media/${key}` }, 201);
});
