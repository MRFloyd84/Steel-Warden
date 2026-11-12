#!/usr/bin/env bash
# Installiert das STEEL-WARDEN-AppImage für den aktuellen Benutzer (kein root nötig):
#   - Programm nach ~/Applications/STEEL_WARDEN.AppImage
#   - Startmenü-Eintrag und Symbol (KDE, GNOME, XFCE …)
#
# Aufruf:  bash install-desktop.sh [PFAD/ZUM/STEEL_WARDEN-….AppImage]
#          bash install-desktop.sh --remove     (wieder entfernen)
set -euo pipefail

APP_DIR="$HOME/Applications"
TARGET="$APP_DIR/STEEL_WARDEN.AppImage"
DESKTOP="$HOME/.local/share/applications/steel-warden.desktop"
ICON="$HOME/.local/share/icons/hicolor/512x512/apps/steel-warden.png"

refresh() {
  update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
  gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
}

if [[ "${1:-}" == "--remove" ]]; then
  rm -f "$TARGET" "$DESKTOP" "$ICON"
  refresh
  echo "STEEL WARDEN entfernt."
  exit 0
fi

SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  # Neuestes AppImage neben dem Skript oder in release/
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  SRC="$(ls -t "$here"/STEEL_WARDEN-*.AppImage "$here"/../release/STEEL_WARDEN-*.AppImage 2>/dev/null | head -n1 || true)"
fi
[[ -f "$SRC" ]] || { echo "AppImage nicht gefunden. Aufruf: bash install-desktop.sh PFAD/STEEL_WARDEN-….AppImage" >&2; exit 1; }

# AppImages brauchen FUSE 2 (unter CachyOS/Arch: sudo pacman -S fuse2)
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; then
  echo "Hinweis: libfuse2 fehlt – bitte einmal 'sudo pacman -S fuse2' ausführen." >&2
fi

mkdir -p "$APP_DIR" "$(dirname "$DESKTOP")" "$(dirname "$ICON")"
cp -f "$SRC" "$TARGET"
chmod +x "$TARGET"

# Symbol aus dem AppImage holen
tmp="$(mktemp -d)"
( cd "$tmp" && "$TARGET" --appimage-extract 'usr/share/icons/hicolor/*/apps/*.png' >/dev/null 2>&1 || true )
found="$(ls -S "$tmp"/squashfs-root/usr/share/icons/hicolor/*/apps/*.png 2>/dev/null | head -n1 || true)"
[[ -n "$found" ]] && cp -f "$found" "$ICON"
rm -rf "$tmp"

cat > "$DESKTOP" <<DESK
[Desktop Entry]
Type=Application
Name=STEEL WARDEN
Comment=Walker-Kampagne gegen die Synthese
Exec="$TARGET" %U
Icon=steel-warden
Terminal=false
Categories=Game;Simulation;
StartupWMClass=steel-warden
DESK
refresh
echo "Installiert: $TARGET"
echo "Startmenü: STEEL WARDEN (Spiele)"
