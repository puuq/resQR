import { z } from 'zod';

export const MENU_FILE_LIMIT = 10;
export const MENU_FILE_BYTES = 8 * 1024 * 1024;
export const MENU_TOTAL_BYTES = 10 * 1024 * 1024;
export const MENU_ITEM_LIMIT = 200;
export const MENU_FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

export const menuExtraction = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        category: z.string().trim().min(1).max(60),
        description: z.string().trim().max(400),
        price: z.number().min(0).max(100000).nullable(),
        vegetarian: z.boolean().nullable(),
        note: z.string().trim().max(400),
      }),
    )
    .max(MENU_ITEM_LIMIT),
  warnings: z.array(z.string().max(500)).max(20),
});
export type ImportedDish = z.infer<typeof menuExtraction>['items'][number];
export type MenuExtraction = z.infer<typeof menuExtraction>;

export function menuFileError(files: File[]) {
  if (!files.length) return 'Choose at least one menu PDF or photo.';
  if (files.length > MENU_FILE_LIMIT) return 'Choose up to 10 files at a time.';
  if (files.some((file) => file.size === 0 || file.size > MENU_FILE_BYTES))
    return 'Each file must be nonempty and no larger than 8 MB.';
  if (files.reduce((sum, file) => sum + file.size, 0) > MENU_TOTAL_BYTES)
    return 'Keep the combined file size under 10 MB.';
  if (files.some((file) => !MENU_FILE_ACCEPT.split(',').includes(file.type)))
    return 'Use PDF, JPG, PNG or WebP menu files.';
  return '';
}
