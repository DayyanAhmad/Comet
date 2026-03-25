#!/usr/bin/env bash
# =============================================================================
# update_discord.sh — Install or update Discord from a .deb package on Ubuntu
#
# Usage:
#   ./update_discord.sh <path-to-discord.deb>
#   ./update_discord.sh discord-0.0.XX.deb
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Sanity checks ─────────────────────────────────────────────────────────────
if [[ $# -ne 1 ]]; then
    error "No .deb file specified."
    echo "Usage: $0 <path-to-discord.deb>"
    exit 1
fi

DEB_FILE="$1"

if [[ ! -f "$DEB_FILE" ]]; then
    error "File not found: $DEB_FILE"
    exit 1
fi

if [[ "${DEB_FILE,,}" != *.deb ]]; then
    error "File does not appear to be a .deb package: $DEB_FILE"
    exit 1
fi

# Confirm it looks like a Discord package
PKG_NAME=$(dpkg-deb --field "$DEB_FILE" Package 2>/dev/null || true)
if [[ "$PKG_NAME" != discord* ]]; then
    warn "Package name is '${PKG_NAME:-unknown}', which doesn't look like Discord."
    read -rp "Continue anyway? [y/N] " confirm
    [[ "${confirm,,}" == "y" ]] || { info "Aborted."; exit 0; }
fi

NEW_VERSION=$(dpkg-deb --field "$DEB_FILE" Version 2>/dev/null || echo "unknown")
info "Package  : $PKG_NAME"
info "New ver  : $NEW_VERSION"

# ── Check currently installed version ────────────────────────────────────────
if dpkg -s "$PKG_NAME" &>/dev/null; then
    CUR_VERSION=$(dpkg -s "$PKG_NAME" | awk '/^Version:/ {print $2}')
    info "Installed: $CUR_VERSION"

    # Compare versions with dpkg's built-in comparator
    if dpkg --compare-versions "$NEW_VERSION" le "$CUR_VERSION"; then
        warn "The package version ($NEW_VERSION) is not newer than the installed version ($CUR_VERSION)."
        read -rp "Install anyway? [y/N] " confirm
        [[ "${confirm,,}" == "y" ]] || { info "Aborted."; exit 0; }
    fi
else
    info "Discord is not currently installed — performing fresh install."
fi

# ── Kill running Discord instances ────────────────────────────────────────────
if pgrep -x discord &>/dev/null || pgrep -x Discord &>/dev/null; then
    warn "Discord is running. Closing it before updating..."
    pkill -x discord 2>/dev/null || pkill -x Discord 2>/dev/null || true
    sleep 1
    success "Discord closed."
fi

# ── Install the package ───────────────────────────────────────────────────────
info "Installing $DEB_FILE ..."
if sudo dpkg -i "$DEB_FILE"; then
    success "dpkg install succeeded."
else
    warn "dpkg reported errors — attempting to fix broken dependencies..."
    sudo apt-get install -f -y
fi

# ── Verify installation ───────────────────────────────────────────────────────
if dpkg -s "$PKG_NAME" &>/dev/null; then
    INSTALLED_VERSION=$(dpkg -s "$PKG_NAME" | awk '/^Version:/ {print $2}')
    success "Discord $INSTALLED_VERSION is now installed."
else
    error "Installation failed — '$PKG_NAME' is not registered by dpkg."
    exit 1
fi

echo ""
success "Done! Launch Discord normally or run: discord"
