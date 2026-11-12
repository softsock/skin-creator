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

// the button of a tool in the tools panel, pressed while that tool is active
const toolButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

// the dock tab with exactly the given title
const tab = (page: Page, title: string) => page.locator('.dv-tab', { hasText: new RegExp(`^${title}$`) });

// the dock group that contains the given content
const group = (page: Page, content: Locator) => page.locator('.dv-groupview', { has: content });

// the dock node whose tab strip has a tab with the given title, view contents render outside of it
const nodeOf = (page: Page, title: string) => group(page, tab(page, title));

// opens a new view tab through the plus button of the node that has a tab with the given title
async function newTab(page: Page, title: string, kind: string): Promise<void> {
  await nodeOf(page, title).getByRole('button', { name: 'New tab' }).click();
  await page.getByRole('menuitem', { name: kind, exact: true }).click();
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
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId('dirty-indicator')).toBeVisible();

  const painted = await exportSkin(page);
  const changed = diff(baseline, painted);
  expect(changed).toHaveLength(1);
  const face = getSkinFaces('classic')[getFaceMap('classic')[changed[0]!]!]!;
  expect([face.part, face.layer, face.face]).toEqual(['body', 'base', 'front']);
  expect([...painted.slice(changed[0]! * 4, changed[0]! * 4 + 4)]).toEqual(PENCIL);

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
  await expect(toolButton(page, 'Fill')).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.getByTestId('toast')).toContainText('Legacy 64×32');
  expect(await exportSkin(page)).toEqual(slim);

  await page.getByRole('radio', { name: 'Classic' }).click();
  await expect(page.getByRole('radio', { name: 'Classic' })).toBeChecked();
  expect(await exportSkin(page)).toEqual(slim);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('radio', { name: 'Slim' })).toBeChecked();
});

test('the 2d parts and atlas views edit the same document', async ({ page }) => {
  await open(page);
  const baseline = await exportSkin(page);
  const paintAt = async (texture: Locator, fx: number, fy: number) => {
    const spot = await pointIn(texture, fx, fy);
    await page.mouse.click(spot.x, spot.y);
    const changed = diff(baseline, await exportSkin(page));
    expect(changed).toHaveLength(1);
    return getSkinFaces('classic')[getFaceMap('classic')[changed[0]!]!]!;
  };

  const parts = page.getByTestId('view-2').getByTestId('texture-view');
  await expect(parts).toBeVisible();
  const first = await paintAt(parts, 0.3, 0.3);
  expect([first.part, first.layer]).toEqual(['head', 'base']);

  await page.getByTestId('view-1').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  await page.keyboard.press('2');
  await expect(viewport(page)).toHaveCount(0);
  await expect(tab(page, '2D')).toHaveCount(1);
  await paintAt(page.getByTestId('view-1').getByTestId('texture-view'), 0.5, 0.36);

  await page.keyboard.press('1');
  await expect(viewport(page)).toBeVisible();
  await expect(parts).toBeVisible();
});

test('f9 switches to the studio render and exports opaque and transparent renders', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('texture-view')).toBeVisible();
  const edit = await capture(viewport(page));
  await page.keyboard.press('F9');
  await expect(page.getByRole('radiogroup', { name: 'Lighting preset' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Render', exact: true })).toBeChecked();
  await expect(tab(page, '3D Render')).toBeVisible();
  await expect(tab(page, '3D Preview')).toHaveCount(0);
  await page.waitForTimeout(900);
  const studio = await capture(viewport(page));
  expect(studio.at(0.5, 0.5)).not.toEqual(edit.at(0.5, 0.5));
  expect(studio.at(0.02, 0.02)).not.toEqual(edit.at(0.02, 0.02));

  const box = (await viewport(page).boundingBox())!;
  await expect(page.getByTestId('export-size')).toHaveText(
    `${Math.round(box.width) * 2} × ${Math.round(box.height) * 2} px PNG`,
  );
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
  await expect(page.getByRole('radio', { name: 'Editor' })).toBeChecked();
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
  await expect(toolButton(page, 'Darken')).toHaveAttribute('aria-pressed', 'true');
  const center = await pointIn(viewport(page));
  await page.mouse.click(center.x, center.y);
  const darkened = await exportSkin(page);
  const changed = diff(baseline, darkened);
  expect(changed).toHaveLength(1);
  expect(darkened[changed[0]! * 4 + 1]!).toBeLessThan(baseline[changed[0]! * 4 + 1]!);

  await page.getByRole('switch', { name: 'Shading tools' }).click();
  await expect(page.getByRole('button', { name: 'Lighten' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Shading' })).toHaveCount(0);
  await expect(toolButton(page, 'Pencil')).toHaveAttribute('aria-pressed', 'true');
});

test('a browser tab explains that it is desktop-only on the web', async ({ page }) => {
  await open(page);
  await nodeOf(page, '3D Preview').getByRole('button', { name: 'New tab' }).click();
  await expect(page.getByRole('menuitem')).toHaveText([
    '2D',
    '2D Parts',
    '3D Preview',
    '3D Render',
    'Browser',
  ]);
  await page.getByRole('menuitem', { name: 'Browser' }).click();
  await expect(page.getByText('Integrated browser is a desktop feature')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open a new browser tab' })).toHaveAttribute(
    'href',
    'https://duckduckgo.com/',
  );
  await expect(viewport(page)).toBeHidden();
  await tab(page, '3D Preview').click();
  await expect(viewport(page)).toBeVisible();
});

test('rendering from an editing view switches it to the studio look first', async ({ page }) => {
  await open(page);
  const box = (await viewport(page).boundingBox())!;
  const render = decode(await download(page, () => page.keyboard.press('Control+e')));
  expect([render.width, render.height]).toEqual([Math.round(box.width) * 2, Math.round(box.height) * 2]);
  await expect(tab(page, '3D Render')).toBeVisible();
  await page.waitForTimeout(900);
  const live = await capture(viewport(page));
  const offset =
    (Math.floor(render.height * 0.03) * render.width + Math.floor(render.width * 0.03)) * render.channels;
  const corner = [...render.data.slice(offset, offset + 3)];
  const liveCorner = live.at(0.03, 0.03);
  for (const channel of [0, 1, 2]) expect(Math.abs(corner[channel]! - liveCorner[channel]!)).toBeLessThan(6);
});

test('panels float, close, reopen and move, and the layout persists until it is reset', async ({ page }) => {
  await open(page);
  const hex = page.getByLabel('Hex color');
  const viewMenuItem = async (name: string) => {
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole(name === 'Reset layout' ? 'menuitem' : 'menuitemcheckbox', { name }).click();
  };

  await group(page, hex).getByRole('button', { name: 'Float this panel' }).click();
  await expect(page.locator('.dv-resize-container', { has: hex })).toBeVisible();

  await viewMenuItem('Color');
  await expect(hex).toHaveCount(0);
  await viewMenuItem('Color');
  await expect(page.locator('.dv-resize-container', { has: hex })).toBeVisible();

  const swatch = page.getByRole('button', { name: 'Use color #1a1c2c' });
  await page
    .getByText('Palette', { exact: true })
    .dragTo(group(page, toolButton(page, 'Pencil')).locator('.dv-content-container'));
  await expect(group(page, swatch).getByText('Tools', { exact: true })).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.dv-resize-container', { has: hex })).toBeVisible();
  await expect(group(page, swatch).getByText('Tools', { exact: true })).toHaveCount(1);

  await viewMenuItem('Reset layout');
  await expect(page.locator('.dv-resize-container')).toHaveCount(0);
  await expect(group(page, swatch).getByText('Tools', { exact: true })).toHaveCount(0);
});

test('a node holds several view tabs opened from its plus button and remembers them', async ({ page }) => {
  await open(page);
  const baseline = await exportSkin(page);
  const node = group(page, viewport(page));
  await expect(page.getByRole('radiogroup', { name: 'View content' })).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);

  await newTab(page, viewport(page), '2D');
  await expect(node.locator('.dv-tab')).toHaveText(['3D Preview', '2D']);
  const atlas = page.getByTestId('view-3').getByTestId('texture-view');
  await expect(atlas).toBeVisible();
  await expect(viewport(page)).toBeHidden();
  const spot = await pointIn(atlas, 0.5, 0.36);
  await page.mouse.click(spot.x, spot.y);
  expect(diff(baseline, await exportSkin(page))).toHaveLength(1);

  await newTab(page, atlas, '3D Render');
  await expect(node.locator('.dv-tab')).toHaveText(['3D Preview', '2D', '3D Render']);
  await expect(page.getByRole('radio', { name: 'Render', exact: true })).toBeChecked();

  await tab(page, '3D Preview').dragTo(
    group(page, page.getByTestId('view-2')).locator('.dv-content-container'),
  );
  await expect(group(page, page.getByTestId('view-2')).locator('.dv-tab')).toHaveText([
    '2D Parts',
    '3D Preview',
  ]);
  await expect(node.locator('.dv-tab')).toHaveText(['2D', '3D Render']);

  await page.reload();
  await expect(node.locator('.dv-tab')).toHaveText(['2D', '3D Render']);
  await expect(group(page, page.getByTestId('view-2')).locator('.dv-tab')).toHaveText([
    '2D Parts',
    '3D Preview',
  ]);
  await expect(page.getByTestId('view-1').getByTestId('viewport-3d')).toBeVisible();

  await tab(page, '3D Render').locator('.dv-default-tab-action').click();
  await expect(tab(page, '3D Render')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Editor' })).toBeChecked();

  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reset layout' }).click();
  await expect(page.locator('.dv-tab', { hasText: /^(3D Preview|2D Parts|2D|3D Render)$/ })).toHaveText([
    '3D Preview',
    '2D Parts',
  ]);
});
