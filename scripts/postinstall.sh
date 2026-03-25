#!/bin/bash
# Runs as root after the comet .deb is installed.

# Copy polkit policy into place
cp /opt/comet/com.comet.install.policy \
   /usr/share/polkit-1/actions/

# Make shell scripts executable
chmod +x /opt/comet/scripts/*.sh

# Create symlink so 'comet' works from terminal
ln -sf /opt/comet/comet /usr/local/bin/comet

# Fix Electron sandbox permissions
chown root /opt/comet/chrome-sandbox
chmod 4755 /opt/comet/chrome-sandbox

# Restart polkit to pick up new policy
systemctl restart polkit 2>/dev/null || pkill -HUP polkitd 2>/dev/null || true
