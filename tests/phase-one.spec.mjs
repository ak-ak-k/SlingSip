import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const pointerSource = path.resolve('tests/windows-pointer.cs');
const pointerExecutable = path.resolve('.cache/native-tests/windows-pointer.exe');
let pointerBuild;

async function buildPointerHelper() {
  await mkdir(path.dirname(pointerExecutable), { recursive: true });
  const source = await stat(pointerSource);
  const executable = await stat(pointerExecutable).catch(() => null);
  if (executable && executable.mtimeMs >= source.mtimeMs) return;
  const compiler = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  await execFileAsync(compiler, ['/nologo', '/optimize+', '/target:exe', `/out:${pointerExecutable}`, pointerSource], { windowsHide: true });
}

async function pointer(action, point = { x: 0, y: 0 }, ownerPid) {
  pointerBuild ??= buildPointerHelper();
  await pointerBuild;
  const args=[action, String(Math.round(point.x)), String(Math.round(point.y))];
  if(action==='Click') { if(!ownerPid) throw new Error('Physical clicks require the isolated Electron owner.'); args.push(String(ownerPid)); }
  const { stdout } = await execFileAsync(pointerExecutable, args, { windowsHide: true });
  const actual = JSON.parse(stdout.trim());
  if (action !== 'Position' && Math.hypot(actual.x - Math.round(point.x), actual.y - Math.round(point.y)) > 1) {
    throw new Error(`Physical pointer moved during ${action}: expected (${Math.round(point.x)},${Math.round(point.y)}), observed (${actual.x},${actual.y}). Run on an unlocked desktop with the physical mouse idle.`);
  }
  return actual;
}

async function physicalPoint(application, page, localPoint) {
  return application.evaluate(({ BrowserWindow, screen }, { url, localPoint }) => {
    const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL() === url);
    const bounds = window.getContentBounds();
    return screen.dipToScreenPoint({ x: Math.round(bounds.x + localPoint.x), y: Math.round(bounds.y + localPoint.y) });
  }, { url: page.url(), localPoint });
}

async function centerOf(application, page, locator) {
  // Physical clicks need the final geometry of the finite bubble entrance.
  await locator.evaluate((element) => Promise.all((element.closest('.speech-bubble')?.getAnimations() ?? []).map(animation => animation.finished)));
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return physicalPoint(application, page, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
}

test('Native swing regression: transparent overlay, native hydration clicks, secure IPC, reuse, and recovery', async ({}, testInfo) => {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.ELECTRON_RENDERER_URL;
  const application = await electron.launch({ args: ['.', '--companion-test'], cwd: process.cwd(), env: environment, chromiumSandbox: true });
  const rendererErrors = [];
  application.on('window', (page) => page.on('pageerror', (error) => rendererErrors.push(error.message)));
  let originalCursor;

  try {
    await expect.poll(() => application.windows().filter((page) => /#\/(dashboard|companion)$/.test(page.url())).length, { timeout: 60_000 }).toBe(2);
    let dashboard = application.windows().find((page) => page.url().endsWith('#/dashboard'));
    let overlay = application.windows().find((page) => page.url().endsWith('#/companion'));
    const restartSequence = async () => {
      await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
      await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'hidden');
      await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(true));
      await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
      await overlay.locator('.speech-bubble').evaluate((bubble) => Promise.all(bubble.getAnimations().map(animation => animation.finished)));
    };
    await expect(dashboard.getByTestId('dashboard')).toBeVisible();
    await expect(overlay.getByTestId('companion')).toBeAttached();
    await overlay.evaluate(() => {
      window.__nativeMouseEvents = [];
      for (const type of ['mousemove', 'mouseleave']) document.addEventListener(type, (event) => {
        window.__nativeMouseEvents.push({ type, x: event.clientX, y: event.clientY, target: event.target?.tagName });
        window.__nativeMouseEvents = window.__nativeMouseEvents.slice(-20);
      });
    });
    await expect(dashboard.getByTestId('test-clicks')).toHaveText('0');

    await test.step('Windows use isolated, sandboxed renderers and a work-area transparent overlay', async () => {
      const windows = await application.evaluate(({ BrowserWindow, screen }) => ({
        area: screen.getPrimaryDisplay().workArea,
        windows: BrowserWindow.getAllWindows().map((window) => ({
          role: window.webContents.getURL().split('#/')[1],
          preferences: window.webContents.getLastWebPreferences(),
          visible: window.isVisible(),
          bounds: window.getBounds(),
          background: window.getBackgroundColor(),
          resizable: window.isResizable(),
          alwaysOnTop: window.isAlwaysOnTop(),
        })),
      }));
      for (const window of windows.windows) {
        expect(window.preferences.contextIsolation).toBe(true);
        expect(window.preferences.nodeIntegration).toBe(false);
        expect(window.preferences.sandbox).toBe(true);
      }
      const companion = windows.windows.find((window) => window.role === 'companion');
      expect(companion.visible).toBe(false);
      // Electron's getter reports RGB; the actual alpha surface is checked below.
      expect(companion.background).toBe('#000000');
      expect(companion.resizable).toBe(false);
      expect(companion.alwaysOnTop).toBe(true);
      expect(companion.bounds).toEqual(windows.area);
      const surfaceColors = await overlay.evaluate(() => [document.documentElement, document.body, document.querySelector('app-root'), document.querySelector('.transparent-stage')].map((element) => getComputedStyle(element).backgroundColor));
      expect(surfaceColors).toEqual(Array(4).fill('rgba(0, 0, 0, 0)'));
      expect(await dashboard.evaluate(() => typeof window.require)).toBe('undefined');
      expect(await overlay.evaluate(() => window.desktopCompanion.role)).toBe('companion');
      expect(await dashboard.evaluate(() => window.desktopCompanion.role)).toBe('dashboard');
    });

    await dashboard.screenshot({ path: testInfo.outputPath('dashboard.png') });

    await test.step('The dashboard shows the overlay without moving keyboard focus', async () => {
      const focusBefore = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id ?? null);
      await dashboard.getByTestId('toggle-overlay').click();
      await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(true);
      expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id ?? null)).toBe(focusBefore);
      const cornerAlpha = await application.evaluate(async ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion'));
        return (await window.webContents.capturePage()).toBitmap()[3];
      });
      expect(cornerAlpha).toBe(0);
      await overlay.screenshot({ path: testInfo.outputPath('overlay.png'), omitBackground: true });
    });

    await test.step('IPC rejects incorrect window roles and invalid payloads', async () => {
      const wrongRole = await dashboard.evaluate(async () => {
        try { await window.desktopCompanion.recordTestClick(); return ''; }
        catch (error) { return error.message; }
      });
      expect(wrongRole).toContain('not available to the requesting frame');
      const invalidPayload = await dashboard.evaluate(async () => {
        try { await window.desktopCompanion.setOverlayVisible('yes'); return ''; }
        catch (error) { return error.message; }
      });
      expect(invalidPayload).toContain('must be a boolean');
      const invalidRevision = await overlay.evaluate(async () => {
        try { await window.desktopCompanion.setOverlayVisible(false, -1); return ''; }
        catch (error) { return error.message; }
      });
      expect(invalidRevision).toContain('valid visibility revision');
      const wrongConditionalRole = await dashboard.evaluate(async () => {
        try { await window.desktopCompanion.setOverlayVisible(false, 0); return ''; }
        catch (error) { return error.message; }
      });
      expect(wrongConditionalRole).toContain('not available to the requesting frame');
    });

    if (process.platform === 'win32') {
      originalCursor = await pointer('Position');
      await test.step('A real Windows click on the bubble opens the existing dashboard', async () => {
        await restartSequence();
        const marker = await centerOf(application, overlay, overlay.getByRole('button', { name: 'Open dashboard' }));
        await pointer('Move', marker);
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(true);
        await pointer('Click', marker, application.process().pid);
        await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.webContents.getURL().endsWith('#/dashboard'))).toBe(true);
        expect(application.windows().length).toBe(2);
      });

      await test.step('A real Windows click through blank overlay space reaches the dashboard beneath it', async () => {
        await restartSequence();
        await application.evaluate(({ BrowserWindow, screen }) => {
          const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/dashboard'));
          window.setBounds(screen.getPrimaryDisplay().workArea);
          window.show();
          window.focus();
        });
        const contentHeight = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/dashboard')).getContentBounds().height);
        await expect.poll(() => dashboard.evaluate(() => window.innerHeight)).toBe(contentHeight);
        const location = await application.evaluate(({ BrowserWindow }) => {
          const overlay = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion')).getContentBounds();
          const dashboard = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/dashboard')).getContentBounds();
          return { left: overlay.x - dashboard.x + 30, top: overlay.y - dashboard.y + 30 };
        });
        await dashboard.evaluate((location) => {
          const target = document.createElement('button');
          target.id = 'native-passthrough-probe';
          target.textContent = 'Native click-through probe';
          target.dataset.clicks = '0';
          Object.assign(target.style, { position: 'fixed', top: `${location.top}px`, left: `${location.left}px`, width: '120px', height: '48px', zIndex: '9999' });
          target.addEventListener('click', () => { target.dataset.clicks = String(Number(target.dataset.clicks) + 1); });
          document.body.appendChild(target);
        }, location);
        const probe = dashboard.locator('#native-passthrough-probe');
        const point = await centerOf(application, dashboard, probe);
        await pointer('Move', point);
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(false);
        await pointer('Click', point, application.process().pid);
        await expect(probe).toHaveAttribute('data-clicks', '1');
        await probe.evaluate((element) => element.remove());
      });

      await test.step('Showing the overlay under a stationary cursor restores bubble interaction', async () => {
        const instanceBefore = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion')).id);
        const marker = await centerOf(application, overlay, overlay.getByRole('button', { name: 'Open dashboard' }));
        await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
        await pointer('Move', marker);
        await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(true));
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(true);
        await pointer('Click', marker, application.process().pid);
        const instanceAfter = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion')).id);
        expect(instanceAfter).toBe(instanceBefore);
      });

      await test.step('Display changes restore hit testing without another mouse movement', async () => {
        await application.evaluate(({ screen }) => screen.emit('display-metrics-changed', {}, screen.getPrimaryDisplay(), ['scaleFactor']));
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(true);
        const marker = await centerOf(application, overlay, overlay.getByRole('button', { name: 'Open dashboard' }));
        await pointer('Click', marker, application.process().pid);
      });

      await test.step('Rounded bubble corners and the transparent character container pass input through', async () => {
        await restartSequence();
        const marker = await overlay.locator('.speech-bubble').boundingBox();
        const corner = { x: marker.x + 1, y: marker.y + 1 };
        const target = await overlay.evaluate((point) => document.elementFromPoint(point.x, point.y)?.closest('[data-overlay-interactive]')?.tagName ?? null, corner);
        expect(target).toBeNull();
        await pointer('Move', await physicalPoint(application, overlay, corner));
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(false);
        expect(await overlay.getByTestId('character').evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
      });
      await test.step('A real Windows click on painted artwork reacts without logging water', async () => {
        await restartSequence();
        const waterBefore = await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).hydration.currentWater);
        const local = await overlay.evaluate(() => {
          window.__paintedReactions = [];
          const character = document.querySelector('[data-testid="character"]');
          const observer = new MutationObserver(() => { if (character.dataset.reaction) window.__paintedReactions.push(character.dataset.reaction); });
          observer.observe(character, { attributes: true, attributeFilter: ['data-reaction'] });
          if(character.dataset.renderer==='three-webgl') { const canvas=document.querySelector('.companion-3d'),bounds=canvas.getBoundingClientRect();return{x:bounds.left+Number(canvas.dataset.hitX),y:bounds.top+Number(canvas.dataset.hitY)}; }
          const svg = document.querySelector('.mascot');
          const point = svg.createSVGPoint(); point.x = Number(svg.dataset.hitX ?? 77); point.y = Number(svg.dataset.hitY ?? 121);
          const body = point.matrixTransform(document.querySelector('.mascot').getScreenCTM());
          return { x: body.x, y: body.y };
        });
        const painted = await physicalPoint(application, overlay, local);
        await pointer('Move', painted);
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(true);
        await pointer('Click', painted, application.process().pid);
        await expect.poll(() => overlay.evaluate(() => window.__paintedReactions.includes('nod'))).toBe(true);
        expect(await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).hydration.currentWater)).toBe(waterBefore);
        await pointer('Move', await physicalPoint(application, overlay, { x: 30, y: 30 }));
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(false);
      });
    } else {
      await restartSequence();
      await overlay.getByRole('button', { name: 'Open dashboard' }).click();
    }

    await test.step('Closing the dashboard preserves the overlay, which can reopen it', async () => {
      await restartSequence();
      const countBeforeClose = await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.testClicks);
      await dashboard.close();
      await expect.poll(() => application.windows().length).toBe(1);
      await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).dashboardOpen)).toBe(false);
      if (process.platform === 'win32') {
        const openButton = await centerOf(application, overlay, overlay.getByRole('button', { name: 'Open dashboard' }));
        await pointer('Move', openButton);
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(true);
        await pointer('Click', openButton, application.process().pid);
      } else {
        await overlay.getByRole('button', { name: 'Open dashboard' }).click();
      }
      await expect.poll(() => application.windows().filter((page) => page.url().endsWith('#/dashboard')).length).toBe(1);
      dashboard = application.windows().find((page) => page.url().endsWith('#/dashboard'));
      await expect(dashboard.getByTestId('test-clicks')).toHaveText(String(countBeforeClose));
      expect(application.windows().length).toBe(2);
    });

    if (process.platform === 'win32') {
      await test.step('Real Windows hydration actions postpone and credit exactly one glass', async () => {
        await restartSequence();
        const later = await centerOf(application, overlay, overlay.getByRole('button', { name: 'Remind me later' }));
        await pointer('Move', later);
        await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(true);
        await pointer('Click', later, application.process().pid);
        await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'waiting');
        await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'hidden');
        await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder', { timeout: 20000 });
        const drink = await centerOf(application, overlay, overlay.getByTestId('drank-it'));
        await pointer('Move', drink);
        await pointer('Click', drink, application.process().pid);
        await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
        await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'success');
      });
    }

    await restartSequence();
    await overlay.getByRole('button', { name: 'Hide test' }).click();
    await expect(dashboard.getByTestId('toggle-overlay')).toContainText('Trigger Swing In');
    expect(await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.interactive)).toBe(false);

    await test.step('Rapid show/hide requests are applied in order to the same window', async () => {
      const originalId = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion')).id);
      const state = await dashboard.evaluate(async () => {
        await Promise.all([true, false, true, false].map((visible) => window.desktopCompanion.setOverlayVisible(visible)));
        return window.desktopCompanion.getSnapshot();
      });
      expect(state.overlay.visible).toBe(false);
      const nextId = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion')).id);
      expect(nextId).toBe(originalId);
    });

    await test.step('Concurrent show requests recreate one missing companion and preserve shared state', async () => {
      const countBefore = await dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.testClicks);
      const oldId = await application.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion'));
        const id = window.id;
        window.destroy();
        return id;
      });
      await dashboard.evaluate(() => Promise.all(Array.from({ length: 8 }, () => window.desktopCompanion.setOverlayVisible(true))));
      await expect.poll(() => application.windows().filter((page) => page.url().endsWith('#/companion')).length).toBe(1);
      overlay = application.windows().find((page) => page.url().endsWith('#/companion'));
      await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'swinging-in');
      const native = await application.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return { count: windows.length, id: windows.find((item) => item.webContents.getURL().endsWith('#/companion')).id };
      });
      expect(native.count).toBe(2);
      expect(native.id).not.toBe(oldId);
      expect(await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.testClicks)).toBe(countBefore);
    });

    await test.step('A failed companion renderer can be recreated from the dashboard', async () => {
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion')).webContents.forcefullyCrashRenderer());
      await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
      await dashboard.getByTestId('toggle-overlay').click();
      await expect.poll(() => application.windows().filter((page) => page.url().endsWith('#/companion') && !page.isClosed()).length).toBe(1);
      overlay = application.windows().find((page) => page.url().endsWith('#/companion') && !page.isClosed());
      await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'swinging-in');
      expect(await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(true);
      expect(application.windows().length).toBe(2);
      await overlay.getByRole('button', { name: 'Hide test' }).click();
    });
    expect(rendererErrors).toEqual([]);
  } catch (error) {
    const diagnostics = await application.evaluate(({ BrowserWindow, screen }) => ({
      cursor: screen.getCursorScreenPoint(),
      windows: BrowserWindow.getAllWindows().map((window) => ({ id: window.id, bounds: window.getBounds(), visible: window.isVisible(), focused: window.isFocused(), url: window.webContents.getURL() })),
    })).catch(() => null);
    const overlay = application.windows().find((page) => page.url().endsWith('#/companion'));
    const input = await overlay?.evaluate(async () => {
      const point = await window.desktopCompanion.getCursorPosition();
      const target = document.elementFromPoint(point.x, point.y);
      return { point, target: target?.outerHTML, state: await window.desktopCompanion.getSnapshot(), events: window.__nativeMouseEvents };
    }).catch(() => null);
    console.log(JSON.stringify({ diagnostics, input }, null, 2));
    throw error;
  } finally {
    await application.close();
    if (originalCursor) await pointer('Move', originalCursor);
  }
});
