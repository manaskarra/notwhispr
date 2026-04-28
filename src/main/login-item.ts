import { app } from 'electron';

export function applyLaunchAtLogin(openAtLogin: boolean): void {
  if (process.platform !== 'darwin') {
    try {
      app.setLoginItemSettings({ openAtLogin });
    } catch {
      // Ignore platform-specific startup registration errors in development.
    }
    return;
  }

  if (!app.isPackaged) {
    return;
  }

  try {
    app.setLoginItemSettings({ openAtLogin });
  } catch {
    // Packaged builds can still hit OS policy issues; keep the app usable.
  }
}
