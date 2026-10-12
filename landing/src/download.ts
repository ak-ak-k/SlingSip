export const RELEASES_URL = 'https://github.com/ak-ak-k/slingsip/releases';
export const LATEST_RELEASE_API = 'https://api.github.com/repos/ak-ak-k/slingsip/releases/latest';

export type WindowsRelease = { version: string; url: string; asset: string };

/** Only a stable x64 installer belonging to the official repository becomes a direct download. */
export function windowsRelease(value: unknown): WindowsRelease | null {
  if (!value || typeof value !== 'object') return null;
  const release = value as Record<string, unknown>;
  if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string'
    || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name) || !Array.isArray(release.assets)) return null;
  const version = release.tag_name.replace(/^v/, '');
  for (const value of release.assets) {
    if (!value || typeof value !== 'object') continue;
    const asset = value as Record<string, unknown>;
    if (asset.name !== `SlingSip-Setup-${version}-x64.exe` || typeof asset.browser_download_url !== 'string') continue;
    try {
      const url = new URL(asset.browser_download_url);
      const [, owner, repository, ...path] = url.pathname.split('/');
      // GitHub canonicalizes this repository to "SlingSip". Only its owner/name
      // are case-insensitive; the release tag and installer filename stay exact.
      const officialRepository = owner?.toLowerCase() === 'ak-ak-k' && repository?.toLowerCase() === 'slingsip';
      const expected = `releases/download/${encodeURIComponent(release.tag_name)}/${asset.name}`;
      if (url.protocol === 'https:' && url.host === 'github.com' && officialRepository && path.join('/') === expected
        && !url.username && !url.password && !url.search && !url.hash) return { version, url: url.href, asset: asset.name };
    } catch { /* Invalid metadata keeps the safe releases-page fallback. */ }
  }
  return null;
}

export function initDownloads(): () => void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.download-link')];
  const status = document.querySelector<HTMLElement>('#release-status')!;
  const labels = [...document.querySelectorAll<HTMLElement>('.release-version')];
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  let disposed = false;
  // Both CTAs remain usable during the one shared request, including on failure.
  function render(state: 'loading' | 'ready' | 'fallback', release?: WindowsRelease) {
    for (const link of links) { link.href = release?.url ?? RELEASES_URL; link.dataset.downloadState = state; }
    for (const label of labels) label.textContent = release ? `v${release.version}` : 'Version on GitHub';
    status.dataset.downloadState = state;
    status.textContent = release ? `Windows installer · ${release.asset}`
      : state === 'loading' ? 'Finding the Windows installer…'
      : 'Direct download is unavailable. The button opens official GitHub Releases.';
  }
  render('loading');
  void (async () => {
    try {
      const response = await fetch(LATEST_RELEASE_API, { signal: controller.signal, credentials: 'omit',
        headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error('Release unavailable');
      const release = windowsRelease(await response.json());
      if (!release) throw new Error('No compatible installer');
      if (!disposed) render('ready', release);
    } catch {
      if (!disposed) render('fallback');
    } finally { window.clearTimeout(timeout); }
  })();
  return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
}
