#!/bin/bash
# Usage: pkexec /path/to/install-discord.sh /tmp/discord-updater/discord-X.Y.Z.deb
# Must be run as root (via pkexec).

DEB_PATH="$1"

if [ -z "$DEB_PATH" ] || [ ! -f "$DEB_PATH" ]; then
  echo "ERROR: .deb file not found at $DEB_PATH"
  exit 1
fi

dpkg -i "$DEB_PATH"

# Fix any broken dependencies
apt-get install -f -y

# Clean up downloaded file
rm -f "$DEB_PATH"

exit 0
