#!/bin/bash
# Usage: ./download-discord.sh <destination_dir>
# Outputs the full path of the downloaded .deb file on stdout.

DEST="${1:-/tmp/discord-updater}"
mkdir -p "$DEST"

URL="https://discord.com/api/download?platform=linux&format=deb"

# Resolve the redirect to get the real filename
FILENAME=$(curl -sI "$URL" | grep -i 'location:' | sed 's/.*\///' | tr -d '\r\n')
if [ -z "$FILENAME" ]; then
  FILENAME="discord-latest.deb"
fi

OUTPATH="$DEST/$FILENAME"

curl -L --progress-bar "$URL" -o "$OUTPATH"

if [ $? -ne 0 ]; then
  echo "ERROR: Download failed"
  exit 1
fi

echo "$OUTPATH"
exit 0
