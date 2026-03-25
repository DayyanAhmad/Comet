#!/bin/bash
# Runs as root after the discord-updater .deb is installed.

# Copy polkit policy into place
cp /opt/discord-updater/com.discordupdater.install.policy \
   /usr/share/polkit-1/actions/

# Make shell scripts executable
chmod +x /opt/discord-updater/scripts/*.sh

# Reload polkit
systemctl reload polkit || true
