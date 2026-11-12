import { expect, test, type Locator, type Page } from '@playwright/test';
import { decode, encode } from 'fast-png';
import { readFile } from 'node:fs/promises';
import { createDefaultSkin } from '../src/core/default-skin';
import { getFaceMap, getSkinFaces, SKIN_SIZE } from '../src/core/skin-layout';

// default pencil color of a fresh session
const PENCIL = [233, 84, 84, 255];

// the webgl canvas of the 3d viewport
const viewport = (page: Page) => page.locator('[data-testid=viewport-3d] canvas');

// opens the app and waits until the 3d viewport has been created
async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(viewport(page)).toBeVisible();
  await page.waitForTimeout(400);
}

// triggers an action that downloads a file and returns its bytes
async function download(page: Page, trigger: () => Promise<void>): Promise<Uint8Array> {
  const [file] = await Promise.all([page.waitForEvent('download'), trigger()]);
  return new Uint8Array(await readFile(await file.path()));
}

// exports the skin through the ui and returns its decoded rgba pixels
async function exportSkin(page: Page): Promise<Uint8Array> {
  const bytes = await download(page, () => page.keyboard.press('Control+Shift+S'));
  const png = decode(bytes);
  expect([png.width, png.height, png.channels, png.depth]).toEqual([64, 64, 4, 8]);
  return new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength);
}

// imports a png through the file menu
async function importSkin(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await page.getByRole('button', { name: 'File' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: /Open PNG/ }).click(),
  ]);
  await chooser.setFiles({ name, mimeType: 'image/png', buffer: Buffer.from(bytes) });
}

// lists the pixel indices that differ between two skins
function diff(a: Uint8Array, b: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    if ([0, 1, 2, 3].some((c) => a[i * 4 + c] !== b[i * 4 + c])) out.push(i);
  }
  return out;
}

// screen position at a fraction of an element's box
async function pointIn(locator: Locator, fx = 0.5, fy = 0.5): Promise<{ x: number; y: number }> {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

// decodes a screenshot of an element for pixel assertions
async function capture(locator: Locator) {
  const png = decode(await locator.screenshot());
  const at = (fx: number, fy: number) => {
    const offset = (Math.floor(png.height * fy) * png.width + Math.floor(png.width * fx)) * png.channels;
    return [...png.data.slice(offset, offset + 3)];
  };
  return { png, at };
}

test('renders the character and paints single pixels on the 3d model with undo and redo', async ({
  page,
}) => {
  await open(page);
  const shot = await capture(viewport(page));
  expect(shot.at(0.5, 0.5)).not.toEqual(shot.at(0.02, 0.02));

  const baseline = await exportSkin(page);
  expect(baseline).toEqual(createDefaultSkin('classic'));

  const center = await pointIn(viewport(page));
  await page.mouse.move(center.x, center.y);
  await expect(page.getByTestId('status-pixel')).toContainText('Body · Base · front');
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId('dirty-indicator')).toBeVisible();

  const painted = await exportSkin(page);
  const changed = diff(baseline, painted);
  expect(changed).toHaveLength(1);
  const face = getSkinFaces('classic')[getFaceMap('classic')[changed[0]!]!]!;
  expect([face.part, face.layer, face.face]).toEqual(['body', 'base', 'front']);
  expect([...painted.slice(changed[0]! * 4, changed[0]! * 4 + 4)]).toEqual(PENCIL);
  const status = await page.getByTestId('status-pixel').textContent();
  expect(status).toContain(`${changed[0]! % SKIN_SIZE}, ${Math.floor(changed[0]! / SKIN_SIZE)}`);

  await page.keyboard.press('Control+z');
  expect(await exportSkin(page)).toEqual(baseline);
  await page.keyboard.press('Control+Shift+z');
  expect(await exportSkin(page)).toEqual(painted);
  await page.getByRole('button', { name: /^Undo/ }).click();
  expect(await exportSkin(page)).toEqual(baseline);
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeDisabled();
});

test('a drag is one undo step, dragging empty space orbits instead of painting', async ({ page }) => {
  await open(page);
  const baseline = await exportSkin(page);
  const start = await pointIn(viewport(page), 0.48, 0.47);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 12, { steps: 4 });
  await page.mouse.move(start.x + 45, start.y + 25, { steps: 4 });
  await page.mouse.up();
  const painted = await exportSkin(page);
  expect(diff(baseline, painted).length).toBeGreaterThan(2);

  const before = await capture(viewport(page));
  const empty = await pointIn(viewport(page), 0.1, 0.5);
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await page.mouse.move(empty.x + 200, empty.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await capture(viewport(page));
  expect(Buffer.compare(Buffer.from(before.png.data), Buffer.from(after.png.data))).not.toBe(0);
  expect(await exportSkin(page)).toEqual(painted);

  await page.keyboard.press('Control+z');
  expect(await exportSkin(page)).toEqual(baseline);
});

test('fill, eraser, eyedropper and the outer layer target work from the 3d view', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'New blank skin' }).click();
  const baseline = await exportSkin(page);
  expect(baseline.every((value) => value === 0)).toBe(true);
  const center = await pointIn(viewport(page));

  await page.keyboard.press('g');
  await expect(page.getByTestId('status-tool')).toHaveText('Fill');
  await page.mouse.click(center.x, center.y);
  const filled = await exportSkin(page);
  const region = diff(baseline, filled);
  expect(region).toHaveLength(96);
  for (const index of region) expect([...filled.slice(index * 4, index * 4 + 4)]).toEqual(PENCIL);

  await page.keyboard.press('e');
  await page.mouse.click(center.x, center.y);
  const erased = await exportSkin(page);
  const hole = diff(filled, erased);
  expect(hole).toHaveLength(1);
  expect([...erased.slice(hole[0]! * 4, hole[0]! * 4 + 4)]).toEqual([0, 0, 0, 0]);

  await page.getByLabel('Hex color').fill('#00ff00');
  await page.getByLabel('Hex color').press('Enter');
  await page.keyboard.press('i');
  await page.mouse.click(center.x + 12, center.y);
  await expect(page.getByLabel('Hex color')).toHaveValue('#e95454');

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('b');
  await page.getByRole('radio', { name: 'Outer' }).click();
  await page.mouse.click(center.x, center.y);
  const outer = diff(baseline, await exportSkin(page));
  expect(outer).toHaveLength(1);
  const face = getSkinFaces('classic')[getFaceMap('classic')[outer[0]!]!]!;
  expect([face.part, face.layer]).toEqual(['body', 'outer']);
});

test('import and export round-trip pixels exactly for classic and slim skins', async ({ page }) => {
  await open(page);
  const noisy = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  let state = 7;
  for (let i = 0; i < noisy.length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    noisy[i] = state >>> 24;
  }
  await importSkin(
    page,
    'noisy-classic.png',
    encode({ width: 64, height: 64, data: noisy, channels: 4, depth: 8 }),
  );
  await expect(page.getByLabel('Project name')).toHaveValue('noisy-classic');
  await expect(page.getByRole('radio', { name: 'Classic' })).toBeChecked();
  expect(await exportSkin(page)).toEqual(noisy);

  const slim = createDefaultSkin('slim');
  await importSkin(page, 'slim.png', encode({ width: 64, height: 64, data: slim, channels: 4, depth: 8 }));
  await expect(page.getByRole('radio', { name: 'Slim' })).toBeChecked();
  expect(await exportSkin(page)).toEqual(slim);

  const legacy = encode({ width: 64, height: 32, data: new Uint8Array(64 * 32 * 4), channels: 4, depth: 8 });
  await importSkin(page, 'legacy.png', legacy);
  await expect(page.getByRole('status')).toContainText('Legacy 64×32');
  expect(await exportSkin(page)).toEqual(slim);

  await page.getByRole('radio', { name: 'Classic' }).click();
  await expect(page.getByRole('radio', { name: 'Classic' })).toBeChecked();
  expect(await exportSkin(page)).toEqual(slim);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('radio', { name: 'Slim' })).toBeChecked();
});

test('the 2d texture view edits the same document', async ({ page }) => {
  await open(page);
  const baseline = await exportSkin(page);
  await page.keyboard.press('3');
  const texture = page.getByTestId('texture-view');
  await expect(texture).toBeVisible();
  const spot = await pointIn(texture, 0.5, 0.36);
  await page.mouse.move(spot.x, spot.y);
  await expect(page.getByTestId('status-pixel')).toContainText('·');
  const status = (await page.getByTestId('status-pixel').textContent())!;
  const [x, y] = status.split(' · ')[0]!.split(', ').map(Number) as [number, number];
  await page.mouse.click(spot.x, spot.y);
  expect(diff(baseline, await exportSkin(page))).toEqual([y * SKIN_SIZE + x]);

  await page.keyboard.press('2');
  await expect(viewport(page)).toBeVisible();
  await expect(texture).toBeVisible();
});

test('f9 switches to studio mode and exports opaque and transparent renders', async ({ page }) => {
  await open(page);
  const edit = await capture(viewport(page));
  await page.keyboard.press('F9');
  await expect(page.getByRole('radiogroup', { name: 'Lighting preset' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pencil' })).toBeDisabled();
  await page.waitForTimeout(900);
  const studio = await capture(viewport(page));
  expect(studio.at(0.5, 0.5)).not.toEqual(edit.at(0.5, 0.5));
  expect(studio.at(0.02, 0.02)).not.toEqual(edit.at(0.02, 0.02));

  const box = (await viewport(page).boundingBox())!;
  const opaque = decode(
    await download(page, () => page.getByRole('button', { name: /Export render/ }).click()),
  );
  expect([opaque.width, opaque.height]).toEqual([Math.round(box.width) * 2, Math.round(box.height) * 2]);
  const pixel = (png: typeof opaque, fx: number, fy: number) => {
    const offset = (Math.floor(png.height * fy) * png.width + Math.floor(png.width * fx)) * png.channels;
    return [...png.data.slice(offset, offset + png.channels)];
  };
  expect(pixel(opaque, 0.02, 0.02)[3] ?? 255).toBe(255);
  expect(pixel(opaque, 0.5, 0.5).slice(0, 3)).not.toEqual(pixel(opaque, 0.02, 0.02).slice(0, 3));

  await page.getByRole('switch', { name: 'Transparent background' }).click();
  await page.getByRole('radio', { name: '1×' }).click();
  const clear = decode(await download(page, () => page.keyboard.press('Control+e')));
  expect([clear.width, clear.height, clear.channels]).toEqual([
    Math.round(box.width),
    Math.round(box.height),
    4,
  ]);
  expect(pixel(clear, 0.02, 0.02)[3]).toBe(0);
  expect(pixel(clear, 0.5, 0.5)[3]).toBe(255);

  await page.getByRole('radio', { name: /Dramatic/ }).click();
  await page.waitForTimeout(900);
  const dramatic = await capture(viewport(page));
  expect(dramatic.at(0.5, 0.5)).not.toEqual(studio.at(0.5, 0.5));

  await page.keyboard.press('F9');
  await expect(page.getByRole('button', { name: 'Pencil' })).toBeEnabled();
  await page.waitForTimeout(900);
  const back = await capture(viewport(page));
  expect(back.at(0.5, 0.5)).toEqual(edit.at(0.5, 0.5));
  expect(back.at(0.02, 0.02)).toEqual(edit.at(0.02, 0.02));
});

test('the example extension contributes tools and a panel and can be disabled', async ({ page }) => {
  await open(page);
  const baseline = await exportSkin(page);
  await expect(page.getByRole('button', { name: 'Lighten' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shading' })).toBeVisible();

  await page.keyboard.press('d');
  await expect(page.getByTestId('status-tool')).toHaveText('Darken');
  const center = await pointIn(viewport(page));
  await page.mouse.click(center.x, center.y);
  const darkened = await exportSkin(page);
  const changed = diff(baseline, darkened);
  expect(changed).toHaveLength(1);
  expect(darkened[changed[0]! * 4 + 1]!).toBeLessThan(baseline[changed[0]! * 4 + 1]!);

  await page.getByRole('switch', { name: 'Shading tools' }).click();
  await expect(page.getByRole('button', { name: 'Lighten' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Shading' })).toHaveCount(0);
  await expect(page.getByTestId('status-tool')).toHaveText('Pencil');
});

test('the browser workspace explains that it is desktop-only', async ({ page }) => {
  await open(page);
  await page.getByRole('radio', { name: 'Browser' }).click();
  await expect(page.getByText('Integrated browser is a desktop feature')).toBeVisible();
  await expect(viewport(page)).toBeHidden();
  await page.getByRole('radio', { name: 'Edit' }).click();
  await expect(viewport(page)).toBeVisible();
});
