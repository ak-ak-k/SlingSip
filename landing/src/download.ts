export const RELEASES_URL = 'https://github.com/ak-ak-k/slingsip/releases';
export const LATEST_RELEASE_API = 'https://api.github.com/repos/ak-ak-k/slingsip/releases/latest';

type ReleaseAsset = { name?: unknown; browser_download_url?: unknown };
export type WindowsRelease = { version: string; url: string; asset: string };

/** Only a stable x64 installer belonging to the official repository becomes a direct download. */
export function windowsRelease(value: unknown): WindowsRelease | null {
  if (!value || typeof value !== 'object') return null;
  const release = value as Record<string, unknown>;
  if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string'
    || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name) || !Array.isArray(release.assets)) return null;
  const version = release.tag_name.replace(/^v/, '');
  for (const asset of release.assets as ReleaseAsset[]) {
    if (asset.name !== `SlingSip-Setup-${version}-x64.exe` || typeof asset.browser_download_url !== 'string') continue;
    try {
      const url = new URL(asset.browser_download_url);
      const expected = `/ak-ak-k/slingsip/releases/download/${encodeURIComponent(release.tag_name)}/${asset.name}`;
      if (url.protocol === 'https:' && url.host === 'github.com' && url.pathname === expected
        && !url.username && !url.password && !url.search && !url.hash) return { version, url: url.href, asset: asset.name };
    } catch { /* Invalid metadata keeps the safe releases-page fallback. */ }
  }
  return null;
}

export function initDownloads(): () => void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.download-link')];
  const status = document.querySelector<HTMLElement>('#release-status')!;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  for (const link of links) { link.href = RELEASES_URL; link.dataset.downloadState = 'fallback'; }
  void (async () => {
    try {
      const response = await fetch(LATEST_RELEASE_API, { signal: controller.signal, credentials: 'omit',
        headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error('Release unavailable');
      const release = windowsRelease(await response.json());
      if (!release) throw new Error('No compatible installer');
      for (const link of links) { link.href = release.url; link.dataset.downloadState = 'ready'; }
      for (const label of document.querySelectorAll('.release-version')) label.textContent = `v${release.version}`;
      status.textContent = `Windows installer · ${release.asset}`;
    } catch {
      status.textContent = 'The download button opens official GitHub Releases. If no release is listed yet, please check back soon.';
    } finally { window.clearTimeout(timeout); }
  })();
  return () => { window.clearTimeout(timeout); controller.abort(); };
}
