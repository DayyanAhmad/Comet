#!/bin/bash
# Outputs the installed Discord version string, e.g. "0.0.48"
# Exits with code 1 if Discord is not installed.

VERSION=$(dpkg -l discord 2>/dev/null | grep '^ii' | awk '{print $3}')

if [ -z "$VERSION" ]; then
  echo "not-installed"
  exit 1
fi

echo "$VERSION"
exit 0
