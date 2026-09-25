#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONFIG="$ROOT/infra/.env"
COMPOSE="$ROOT/infra/compose.yaml"
ACTION=install
PUBLIC_URL=
COMPOSE_VERSION=v2.39.4

say() { printf '%s\n' "$*"; }
die() { say "nosu: $*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: sh infra/install.sh [install|status|logs|stop|restart] [--url http://localhost|https://DOMAIN]

The first install requires --url. Use http://localhost for local testing.
For a public deployment, use https://your.domain and point DNS at this host.
Reinstalls reuse the URL saved in infra/.env when --url is omitted.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    install|status|logs|stop|restart) ACTION=$1 ;;
    --url) [ "$#" -ge 2 ] || die '--url needs a value'; PUBLIC_URL=$2; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done

if [ "$ACTION" != install ] && [ ! -f "$CONFIG" ]; then
  die "missing $CONFIG; run install first"
fi

validate_url() {
  case "$1" in
    *[!A-Za-z0-9.:/_-]*|*/*/*/*|*/) die 'URL must be an origin only, without path, query, fragment, or trailing slash' ;;
  esac
  authority=${1#*://}
  case "$authority" in
    ''|*/*|*:* ) die 'URL must contain only a hostname, without a port' ;;
  esac
  case "$1" in
    http://localhost) SITE_ADDRESS=:80 ;;
    https://*)
      case "$authority" in
        *[!A-Za-z0-9.-]*|.*|*.|*..*|localhost) die 'public URL must be a valid domain name' ;;
        *.*) ;;
        *) die 'public URL must be a fully qualified domain name' ;;
      esac
      case "$authority" in
        *[!0-9.]*) ;;
        *) die 'public URL must be a domain name, not an IP address' ;;
      esac
      SITE_ADDRESS=$authority
      ;;
    *) die 'use http://localhost for local testing or https://DOMAIN for a public deployment' ;;
  esac
}

config_value() {
  sed -n "s/^$1=//p" "$CONFIG" | head -n 1
}

if [ "$ACTION" = install ]; then
  if [ -f "$CONFIG" ]; then
    saved_url=$(config_value NOSU_PUBLIC_URL)
    [ -n "$PUBLIC_URL" ] || PUBLIC_URL=$saved_url
    validate_url "$PUBLIC_URL"
    [ "$saved_url" = "$PUBLIC_URL" ] || die "existing configuration uses $saved_url; edit infra/.env deliberately before changing the public URL"
  else
    [ -n "$PUBLIC_URL" ] || die 'first install requires --url http://localhost or --url https://your.domain'
    validate_url "$PUBLIC_URL"
  fi
  [ -f "$ROOT/apps/armada/package-lock.json" ] || die 'Armada submodule is missing; run git submodule update --init --recursive'
  if [ ! -f "$CONFIG" ]; then
    command -v openssl >/dev/null 2>&1 || die 'openssl is required to generate deployment secrets'
    old_umask=$(umask)
    umask 077
    db_password=$(openssl rand -hex 24)
    unfurl_secret=$(openssl rand -hex 32)
    cat > "$CONFIG" <<EOF
NOSU_PUBLIC_URL=$PUBLIC_URL
NOSU_SITE_ADDRESS=$SITE_ADDRESS
POSTGRES_PASSWORD=$db_password
NOSU_DATABASE_URL=postgresql://nostrich:$db_password@postgres:5432/nostrich
UNFURL_PROXY_SECRET=$unfurl_secret
NOSU_PRIVACY_MODE=false
TRENDING_INDEX_URL=https://api.nostr.wine/trending
VITE_CONCORD_AV_SERVERS=
EOF
    umask "$old_umask"
    say "Created $CONFIG (mode 600)."
  fi
  [ "$(config_value NOSU_PRIVACY_MODE)" = false ] || die 'privacy mode is not implemented end-to-end; refusing to start an incorrectly labeled private deployment'
fi

if [ "$ACTION" = restart ]; then
  [ "$(config_value NOSU_PRIVACY_MODE)" = false ] || die 'privacy mode is not implemented end-to-end; refusing to restart an incorrectly labeled private deployment'
fi

check_platform() {
  [ -r /etc/os-release ] || die 'unsupported host: /etc/os-release is missing'
  . /etc/os-release
  case "$ID:$VERSION_ID" in
    debian:12|debian:13|ubuntu:22.04|ubuntu:24.04) ;;
    *) die "automatic prerequisite install supports Debian 12/13 and Ubuntu 22.04/24.04; found $ID $VERSION_ID" ;;
  esac
  case "$(uname -m)" in x86_64|aarch64) ;; *) die 'only x86_64 and aarch64 are supported' ;; esac
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else
    command -v sudo >/dev/null 2>&1 || die 'sudo is required to install Docker'
    sudo "$@"
  fi
}

install_docker() {
  check_platform
  . /etc/os-release
  command -v curl >/dev/null 2>&1 || die 'curl is required to install Docker from its official repository'
  say 'Installing Docker Engine and Compose from the official Docker APT repository...'
  as_root apt-get update
  as_root apt-get install -y ca-certificates curl git
  as_root install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" | as_root tee /etc/apt/keyrings/docker.asc >/dev/null
  as_root chmod a+r /etc/apt/keyrings/docker.asc
  arch=$(dpkg --print-architecture)
  repo="deb [arch=$arch signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable"
  printf '%s\n' "$repo" | as_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  as_root apt-get update
  as_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  as_root systemctl enable --now docker
}

if ! command -v docker >/dev/null 2>&1; then install_docker; fi

if ! docker info >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then
  as_root systemctl start docker 2>/dev/null || true
fi

if docker info >/dev/null 2>&1; then
  DOCKER_USE_SUDO=false
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
  DOCKER_USE_SUDO=true
else
  die 'Docker daemon is unavailable; start Docker or grant this user Docker access'
fi

docker_cmd() {
  if [ "$DOCKER_USE_SUDO" = true ]; then sudo docker "$@"; else docker "$@"; fi
}

install_compose_plugin() {
  case "$(uname -m)" in x86_64) machine=x86_64 ;; aarch64) machine=aarch64 ;; *) die 'unsupported Compose architecture' ;; esac
  command -v curl >/dev/null 2>&1 || die 'curl is required to install Compose'
  command -v sha256sum >/dev/null 2>&1 || die 'sha256sum is required to verify Compose'
  if [ "$DOCKER_USE_SUDO" = true ]; then
    plugin_dir=/usr/local/lib/docker/cli-plugins
  else
    plugin_dir=${DOCKER_CONFIG:-"$HOME/.docker"}/cli-plugins
    mkdir -p "$plugin_dir"
  fi
  temp_dir=$(mktemp -d)
  trap 'rm -rf "$temp_dir"' EXIT HUP INT TERM
  file="docker-compose-linux-$machine"
  release="https://github.com/docker/compose/releases/download/$COMPOSE_VERSION"
  curl -fsSL "$release/$file" -o "$temp_dir/$file"
  curl -fsSL "$release/checksums.txt" -o "$temp_dir/checksums.txt"
  (cd "$temp_dir" && grep " \*$file$" checksums.txt | sha256sum -c -) || die 'Compose checksum verification failed'
  if [ "$DOCKER_USE_SUDO" = true ]; then
    as_root install -m 0755 -d "$plugin_dir"
    as_root install -m 0755 "$temp_dir/$file" "$plugin_dir/docker-compose"
  else
    install -m 0755 "$temp_dir/$file" "$plugin_dir/docker-compose"
  fi
  rm -rf "$temp_dir"
  trap - EXIT HUP INT TERM
}

if ! docker_cmd compose version >/dev/null 2>&1; then
  say "Installing verified Docker Compose $COMPOSE_VERSION for this user..."
  install_compose_plugin
fi

compose() { docker_cmd compose --env-file "$CONFIG" -f "$COMPOSE" "$@"; }

case "$ACTION" in
  install)
    compose config --quiet
    compose build nosu groups controller
    compose up -d
    compose ps
    say "Nosu is starting at $PUBLIC_URL"
    say 'Local deployment overview: http://localhost:3401'
    say 'Check health with: sh infra/install.sh status'
    ;;
  status) compose ps ;;
  logs) compose logs --tail=120 -f nosu groups trending postgres ingress controller ;;
  stop) compose stop ;;
  restart) compose up -d --force-recreate ;;
esac
