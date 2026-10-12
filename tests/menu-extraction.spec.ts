import { expect, test } from '@playwright/test';
import { extractMenu, menuMime } from '../src/lib/menu-extraction';
import { menuFileError } from '../src/lib/menu-import';

const draft = {
  items: [
    {
      name: 'मसला चिया',
      category: 'Tea',
      description: '',
      price: 120.5,
      vegetarian: null,
      note: '',
    },
    {
      name: 'Momo — chicken',
      category: 'Kitchen',
      description: '',
      price: null,
      vegetarian: false,
      note: 'Price blurred',
    },
  ],
  warnings: ['Second page is blurry.'],
};
const response = (value: unknown = draft, finishReason = 'STOP') =>
  new Response(
    JSON.stringify({
      candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
  );

test('reader sends multiple images/PDFs, uses bounded JSON mode and preserves uncertain prices', async () => {
  let payload: Record<string, any> = {};
  const fakeFetch: typeof fetch = async (input, options) => {
    expect(String(input)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    expect(new Headers(options?.headers).get('x-goog-api-key')).toBe('test-key');
    payload = JSON.parse(options!.body as string);
    return response();
  };
  const result = await extractMenu(
    [
      { mimeType: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.7') },
      { mimeType: 'image/jpeg', bytes: new Uint8Array([255, 216, 255]) },
    ],
    'test-key',
    undefined,
    fakeFetch,
  );
  expect(result).toEqual(draft);
  expect(payload.contents[0].parts.slice(1).map((part: any) => part.inlineData.mimeType)).toEqual([
    'application/pdf',
    'image/jpeg',
  ]);
  expect(payload.generationConfig.responseMimeType).toBe('application/json');
  expect(payload.generationConfig.thinkingConfig).toBeUndefined();
  expect(payload.generationConfig.maxOutputTokens).toBe(32768);
  const schema = payload.generationConfig.responseJsonSchema;
  expect(schema.required).toEqual(['items', 'warnings']);
  expect(schema.properties.items.maxItems).toBe(200);
  expect(schema.properties.items.items.required).toEqual([
    'name', 'category', 'description', 'price', 'vegetarian', 'note',
  ]);
  expect(schema.$schema).toBeUndefined();
  expect(payload.generationConfig.responseSchema).toBeUndefined();
  expect(payload.generationConfig.responseFormat).toBeUndefined();
});

test('reader rejects truncated, invalid, empty and out-of-range drafts without returning partial dishes', async () => {
  for (const upstream of [
    response(draft, 'MAX_TOKENS'),
    response({ ...draft, items: [] }),
    response({ ...draft, items: [{ ...draft.items[0], price: -10 }] }),
    response({ ...draft, items: [{ name: 'Missing fields', price: 120 }] }),
    new Response(
      JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{broken' }] } }],
      }),
    ),
    new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })),
  ]) {
    await expect(extractMenu([], 'test-key', undefined, async () => upstream)).rejects.toThrow();
  }
});

test('reader flags omitted variants above the draft limit and defaults only absent optional details', async () => {
  const result = await extractMenu([], 'test-key', undefined, async () => response({
    items: Array(201).fill({ name: 'Rum 60ML', category: 'Rum', price: 290 }),
  }));
  expect(result.items).toHaveLength(200);
  expect(result.items[0]).toEqual({ name: 'Rum 60ML', category: 'Rum', price: 290, description: '', vegetarian: null, note: '' });
  expect(result.warnings[0]).toContain('Only the first 200');
});

test('reader returns useful quota, key and connection errors without revealing upstream details', async () => {
  for (const [status, message] of [
    [429, 'free quota'],
    [403, 'key needs checking'],
    [500, 'could not process'],
  ] as const) {
    await expect(
      extractMenu(
        [],
        'test-key',
        undefined,
        async () => new Response('secret upstream error', { status }),
      ),
    ).rejects.toThrow(message);
  }
  await expect(
    extractMenu([], 'test-key', undefined, async () => {
      throw new Error('secret');
    }),
  ).rejects.toThrow('could not connect');
});

test('reader explains response truncation without returning a partial menu', async () => {
  await expect(
    extractMenu([], 'test-key', undefined, async () => response(draft, 'MAX_TOKENS')),
  ).rejects.toThrow('reached its response limit');
});

test('reader falls back once when the provider rejects schema settings', async () => {
  const requests: any[] = [];
  const result = await extractMenu([], 'test-key', undefined, async (_, options) => {
    requests.push(JSON.parse(options!.body as string));
    return requests.length === 1
      ? Response.json({ error: { message: 'responseJsonSchema is unsupported' } }, { status: 400 })
      : response();
  });
  expect(result).toEqual(draft);
  expect(requests).toHaveLength(2);
  expect(requests[0].generationConfig.responseJsonSchema).toBeDefined();
  expect(requests[1].generationConfig.responseJsonSchema).toBeUndefined();
});

test('reader preserves legacy settings only for 2.5 Flash overrides', async () => {
  let settings: Record<string, unknown> = {};
  await extractMenu([], 'test-key', 'gemini-2.5-flash', async (_, options) => {
    settings = JSON.parse(options!.body as string).generationConfig;
    return response();
  });
  expect(settings.thinkingConfig).toEqual({ thinkingBudget: 0 });
});

test('reader distinguishes rejected keys, model access, settings and paid credits without exposing provider text', async () => {
  for (const [status, details, expected] of [
    [
      400,
      { error: { message: 'upstream-secret', details: [{ reason: 'API_KEY_INVALID' }] } },
      'rejected the API key',
    ],
    [
      400,
      { error: { message: 'API key expired. Please renew the API key.' } },
      'rejected the API key',
    ],
    [400, { error: { message: 'Invalid response schema. upstream-secret' } }, 'HTTP 400'],
    [404, { error: { message: 'upstream-secret' } }, 'model is unavailable'],
    [402, { error: { message: 'upstream-secret' } }, 'Free Tier project'],
  ] as const) {
    try {
      await extractMenu(
        [],
        'test-key',
        undefined,
        async () => new Response(JSON.stringify(details), { status }),
      );
      throw new Error('Expected reader failure');
    } catch (error) {
      expect((error as Error).message).toContain(expected);
      expect((error as Error).message).not.toContain('upstream-secret');
      expect((error as Error).message).not.toContain('test-key');
    }
  }
  await expect(
    extractMenu([], 'test-key', undefined, async () => new Response('not JSON', { status: 400 })),
  ).rejects.toThrow('HTTP 400');
});

test('upload checks reject unsupported, oversized and excess files and verify file signatures', () => {
  const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'menu.png', {
    type: 'image/png',
  });
  expect(menuFileError([png])).toBe('');
  expect(menuFileError([])).toContain('at least one');
  expect(menuFileError(Array(11).fill(png))).toContain('up to 10');
  expect(menuFileError([new File(['text'], 'menu.svg', { type: 'image/svg+xml' })])).toContain(
    'Use PDF',
  );
  const large = { size: 9 * 1024 * 1024, type: 'application/pdf' } as File;
  expect(menuFileError([large])).toContain('8 MB');
  expect(
    menuFileError([
      { ...large, size: 6 * 1024 * 1024 },
      { ...large, size: 6 * 1024 * 1024 },
    ]),
  ).toContain('10 MB');
  expect(menuMime(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
  expect(menuMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
  expect(menuMime(new Uint8Array([255, 216, 255]))).toBe('image/jpeg');
  expect(menuMime(new TextEncoder().encode('RIFF0000WEBP'))).toBe('image/webp');
  expect(menuMime(new TextEncoder().encode('<script>'))).toBe('');
});
