#!/bin/sh
set -eu

# Run on the VPS as the user that owns the Hermes Docker data directory.
dashboard_ip=${HERMES_DASHBOARD_IP:-100.70.251.71}
private_dir="$HOME/.config/hermes-ruang-kerja"
override_file="$private_dir/compose.dashboard.yml"
compose_file=$(docker inspect hermes --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}')

if [ ! -f "$compose_file" ]; then
  echo "Pengaturan Docker Hermes tidak ditemukan: $compose_file" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose tidak tersedia di VPS ini." >&2
  exit 1
fi
if ! ip -o -4 addr show | grep -Fq "$dashboard_ip/"; then
  echo "Alamat jaringan pribadi $dashboard_ip tidak ditemukan di VPS ini." >&2
  exit 1
fi
if [ ! -f "$HOME/.hermes/plugins/hermes-ruang-kerja/dashboard/manifest.json" ]; then
  echo "Plugin belum terpasang. Jalankan install.sh terlebih dahulu." >&2
  exit 1
fi

if [ ! -f "$override_file" ]; then
  umask 077
  mkdir -p "$private_dir"
  dashboard_password=$(openssl rand -hex 16)
  dashboard_secret=$(openssl rand -hex 32)
  cat > "$override_file" <<EOF
services:
  hermes:
    environment:
      HERMES_DASHBOARD: "1"
      HERMES_DASHBOARD_BASIC_AUTH_USERNAME: "admin"
      HERMES_DASHBOARD_BASIC_AUTH_PASSWORD: "$dashboard_password"
      HERMES_DASHBOARD_BASIC_AUTH_SECRET: "$dashboard_secret"
    ports:
      - "$dashboard_ip:9119:9119"
EOF
  printf 'Alamat: http://%s:9119\nNama pengguna: admin\nKata sandi: %s\n' "$dashboard_ip" "$dashboard_password" > "$private_dir/login.txt"
else
  echo "Memakai pengaturan dashboard yang sudah ada di $override_file."
fi

cd "$(dirname "$compose_file")"
docker compose -f "$compose_file" -f "$override_file" config --quiet
docker compose -f "$compose_file" -f "$override_file" up -d --no-deps hermes
docker exec hermes hermes plugins enable hermes-ruang-kerja
echo "Dashboard sedang dinyalakan. Alamat dan sandi tersimpan di $private_dir/login.txt."
echo "Baca sendiri dengan: cat $private_dir/login.txt"
echo "Jangan kirim isi berkas login tersebut ke chat atau GitHub."
