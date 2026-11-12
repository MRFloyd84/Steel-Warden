// Which file of dist/ answers a request to app://steel-warden/… (pure, tested in
// tests/desktop.test.mjs). Nothing outside dist/ is served; "/" and paths without an
// extension get the start page.
const path = require('node:path');

function resolveDistPath(dist, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.normalize(path.join(dist, decoded));
  if (file !== dist && !file.startsWith(dist + path.sep)) return null;
  if (decoded === '/' || decoded === '' || !path.extname(file)) return path.join(dist, 'index.html');
  return file;
}

module.exports = { resolveDistPath };
