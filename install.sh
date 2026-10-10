#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
hermes_home=${HERMES_HOME:-"$HOME/.hermes"}
source_dir="$repo_dir/hermes-ruang-kerja/dashboard"
target_dir="$hermes_home/plugins/hermes-ruang-kerja/dashboard"

if [ ! -f "$source_dir/manifest.json" ] || [ ! -f "$source_dir/dist/index.js" ] || [ ! -f "$source_dir/dist/style.css" ]; then
  echo "Berkas plugin tidak lengkap." >&2
  exit 1
fi

if [ ! -d "$hermes_home" ] && ! command -v hermes >/dev/null 2>&1; then
  echo "Instalasi Hermes tidak ditemukan di server ini. Set HERMES_HOME jika lokasinya berbeda." >&2
  exit 1
fi

mkdir -p "$target_dir/dist"
cp "$source_dir/manifest.json" "$target_dir/manifest.json"
cp "$source_dir/dist/index.js" "$target_dir/dist/index.js"
cp "$source_dir/dist/style.css" "$target_dir/dist/style.css"

echo "Ruang Kerja terpasang di: $target_dir"
echo "Buka ulang dashboard Hermes. Jika tab belum muncul, gunakan Rescan Plugins atau mulai ulang dashboard."
