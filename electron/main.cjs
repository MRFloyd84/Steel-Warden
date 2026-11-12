// STEEL WARDEN as a desktop app (Electron), built after the IRON VAULT pattern.
// Loads the finished Vite build from dist/ through an own protocol app://steel-warden/
// (fixed origin: settings and progress in localStorage survive updates).
// Updates: electron-updater checks GitHub Releases at every start (see package.json →
// build.publish), downloads in the background and offers a restart.
const { app, BrowserWindow, Menu, dialog, net, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveDistPath } = require('./paths.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://steel-warden';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
// Laptops with Intel/AMD + NVIDIA: use the dedicated chip (before the GPU process starts).
// STEEL_WARDEN_GPU=auto|nvidia|integrated or <userData>/gpu.json choose.
const gpu = require('./gpu.cjs');
gpu.preferDedicatedGpu(path.join(app.getPath('userData'), 'gpu.json'));
// Sound without a click first; Wayland when available.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
// One window: a second start brings the running one to the front.
if (!app.requestSingleInstanceLock()) app.quit();

function serve() {
  protocol.handle('app', (request) => {
    const file = resolveDistPath(DIST, new URL(request.url).pathname);
    if (!file) return new Response('Nicht gefunden', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'STEEL WARDEN',
    backgroundColor: '#050805',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => win.show());
  // F11: full screen (the game itself does not use F11)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault();
  });
  void win.loadURL(ORIGIN + '/');
  return win;
}

// Only in the installed AppImage; without internet the game starts normally.
// STEEL_WARDEN_UPDATE_URL=http://… uses an own web server instead (e.g. a Pi).
function checkForUpdates(win) {
  if (!app.isPackaged || !process.env.APPIMAGE) return;
  const log = (...a) => console.log('[Update]', ...a);
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  if (process.env.STEEL_WARDEN_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.STEEL_WARDEN_UPDATE_URL });
  autoUpdater.on('update-available', (info) => log('verfügbar', info.version));
  autoUpdater.on('update-not-available', () => log('aktuell', app.getVersion()));
  autoUpdater.on('download-progress', (p) => win.setProgressBar(p.percent / 100));
  autoUpdater.on('error', (e) => {
    log('nicht möglich:', String(e?.message ?? e).split('\n')[0]);
    win.setProgressBar(-1);
  });
  autoUpdater.on('update-downloaded', async (info) => {
    win.setProgressBar(-1);
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'STEEL WARDEN – Update',
      message: `Version ${info.version} ist bereit.`,
      detail: 'Jetzt neu starten? Mit „Später“ wird das Update beim nächsten Beenden eingespielt.',
      buttons: ['Jetzt neu starten', 'Später'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serve();
  const win = createWindow();
  // Check once the game has loaded: the download does not slow the start.
  win.webContents.once('did-finish-load', () => setTimeout(() => checkForUpdates(win), 4000));
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
});
app.on('window-all-closed', () => app.quit());
