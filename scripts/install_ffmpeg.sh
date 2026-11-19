#!/usr/bin/env bash
set -e

# Check if ffmpeg is already installed
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
    echo "FFmpeg and FFprobe are already installed: $(which ffmpeg)"
    exit 0
fi

echo "Installing FFmpeg and FFprobe static binaries..."
INSTALL_DIR="${HOME}/bin"
mkdir -p "${INSTALL_DIR}"

ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
else
    FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
fi

TMP_DIR=$(mktemp -d)
curl -sSL "$FFMPEG_URL" | tar -xJ -C "$TMP_DIR"
EXTRACTED_DIR=$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if [ -d "$EXTRACTED_DIR" ]; then
    cp "$EXTRACTED_DIR/ffmpeg" "$INSTALL_DIR/"
    cp "$EXTRACTED_DIR/ffprobe" "$INSTALL_DIR/"
    chmod +x "$INSTALL_DIR/ffmpeg" "$INSTALL_DIR/ffprobe"
    echo "FFmpeg successfully installed into $INSTALL_DIR"
fi

rm -rf "$TMP_DIR"
