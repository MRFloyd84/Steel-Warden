/**
 * Desktop app (electron/): the app:// protocol serves only dist/, the release config points
 * at the public repo, and the icon is where electron-builder expects it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { resolveDistPath } = require('../electron/paths.cjs');
const DIST = path.resolve('/opt/sw/dist');

test('app:// serves files from dist/, start page for / and routes', () => {
  assert.equal(resolveDistPath(DIST, '/'), path.join(DIST, 'index.html'));
  assert.equal(resolveDistPath(DIST, '/menu/prep'), path.join(DIST, 'index.html'));
  assert.equal(resolveDistPath(DIST, '/assets/index-abc.js'), path.join(DIST, 'assets/index-abc.js'));
  assert.equal(resolveDistPath(DIST, '/assets/a%20b.glb'), path.join(DIST, 'assets/a b.glb'));
});

test('app:// refuses everything outside dist/', () => {
  assert.equal(resolveDistPath(DIST, '/../package.json'), null);
  assert.equal(resolveDistPath(DIST, '/%2e%2e/%2e%2e/etc/passwd'), null);
  assert.equal(resolveDistPath(DIST, '/../dist-evil/x.js'), null);
  assert.equal(resolveDistPath(DIST, '/%E0%A4%A'), null, 'broken escape');
});

test('release config: GitHub Releases of MRFloyd84/steel-warden, AppImage, icon present', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.build.publish[0], { provider: 'github', owner: 'MRFloyd84', repo: 'steel-warden', releaseType: 'release' });
  assert.deepEqual(pkg.build.linux.target, ['AppImage']);
  assert.ok(pkg.dependencies['electron-updater']);
  assert.ok(!pkg.dependencies.three, 'three is bundled by Vite, not shipped as a module');
  assert.ok(existsSync(new URL('../build/icon.png', import.meta.url)));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});
