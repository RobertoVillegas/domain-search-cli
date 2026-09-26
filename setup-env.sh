#!/usr/bin/env bash
set -euo pipefail
f="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/.env"
test -f "$f" || { echo "No encontré .env"; exit 1; }
umask 077
IFS= read -r -p "Pega el Account ID de Cloudflare: " account
[[ "$account" =~ ^[[:xdigit:]]{32}$ ]] || {
  echo "El Account ID debe tener 32 caracteres hexadecimales."
  exit 1
}
IFS= read -r -s -p "Pega el API token de Cloudflare: " token
printf "\n"
[[ -n "$token" && "$token" != *[[:space:]]* ]] || {
  echo "El token no debe estar vacío ni contener espacios."
  exit 1
}
tmp=$(mktemp "${f}.XXXXXX")
trap 'rm -f "$tmp"' EXIT
awk '!/^(ACCOUNT_ID|CLOUDFLARE_API_TOKEN)=/' "$f" > "$tmp"
printf "ACCOUNT_ID=%s\nCLOUDFLARE_API_TOKEN=%s\n" "$account" "$token" >> "$tmp"
unset account token
chmod 600 "$tmp"
mv "$tmp" "$f"
echo "Valores guardados en .env privado."
