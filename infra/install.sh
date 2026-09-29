#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONFIG="$ROOT/infra/.env"
COMPOSE="$ROOT/infra/compose.yaml"
ACTION=install
PUBLIC_URL=
COMPOSE_VERSION=v2.39.4
HOST_OS=$(uname -s)
COLIMA_CPUS=2
COLIMA_MEMORY_GIB=4
COLIMA_DISK_GIB=20

say() { printf '%s\n' "$*"; }
die() { say "nosu: $*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: sh infra/install.sh [install|update|status|logs|stop|restart] [--url http://localhost|https://DOMAIN]

The first install requires --url. Use http://localhost for local testing.
For a public deployment, use https://your.domain and point DNS at this host.
Update rebuilds local images and recreates containers using the saved configuration.
Reinstalls reuse the URL saved in infra/.env when --url is omitted.
macOS local installs use Homebrew and Colima when Docker is unavailable.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    install|update|status|logs|stop|restart) ACTION=$1 ;;
    --url) [ "$#" -ge 2 ] || die '--url needs a value'; PUBLIC_URL=$2; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done

if [ "$ACTION" != install ] && [ ! -f "$CONFIG" ]; then
  die "missing $CONFIG; run install first"
fi
if [ "$ACTION" != install ] && [ -n "$PUBLIC_URL" ]; then
  die '--url is only valid for install'
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

ensure_submodules() {
  if [ ! -f "$ROOT/apps/armada/package-lock.json" ] || \
     [ ! -f "$ROOT/apps/ditto-relay/Dockerfile" ]; then
    command -v git >/dev/null 2>&1 || die 'git is required to initialize Nosu submodules'
    say 'Initializing Nosu submodules...'
    git -C "$ROOT" submodule update --init --recursive
  fi
  [ -f "$ROOT/apps/armada/package-lock.json" ] || die 'Armada submodule initialization failed'
  [ -f "$ROOT/apps/ditto-relay/Dockerfile" ] || die 'Ditto Relay submodule initialization failed'
}

if [ "$ACTION" = install ]; then
  if [ -f "$CONFIG" ]; then
    saved_url=$(config_value NOSU_PUBLIC_URL)
    [ -n "$PUBLIC_URL" ] || PUBLIC_URL=$saved_url
    validate_url "$PUBLIC_URL"
    if [ "$HOST_OS" = Darwin ] && [ "$PUBLIC_URL" != http://localhost ]; then
      die 'macOS installation supports http://localhost only; use a Linux VM for a public deployment'
    fi
    [ "$saved_url" = "$PUBLIC_URL" ] || die "existing configuration uses $saved_url; edit infra/.env deliberately before changing the public URL"
  else
    [ -n "$PUBLIC_URL" ] || die 'first install requires --url http://localhost or --url https://your.domain'
    validate_url "$PUBLIC_URL"
    if [ "$HOST_OS" = Darwin ] && [ "$PUBLIC_URL" != http://localhost ]; then
      die 'macOS installation supports http://localhost only; use a Linux VM for a public deployment'
    fi
  fi
  ensure_submodules
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
TRENDING_INDEX_URL=https://api.nostr.wine/trending
VITE_CONCORD_AV_SERVERS=
EOF
    umask "$old_umask"
    say "Created $CONFIG (mode 600)."
  fi
fi

if [ "$ACTION" = update ]; then
  ensure_submodules
fi

check_linux_arch() {
  case "$(uname -m)" in x86_64|aarch64) ;; *) die 'only x86_64 and aarch64 are supported' ;; esac
}

check_apt_platform() {
  [ -r /etc/os-release ] || die 'unsupported host: /etc/os-release is missing'
  . /etc/os-release
  case "$ID:$VERSION_ID" in
    debian:12|debian:13|ubuntu:22.04|ubuntu:24.04) ;;
    *) die "automatic prerequisite install supports Debian 12/13 and Ubuntu 22.04/24.04; found $ID $VERSION_ID" ;;
  esac
  check_linux_arch
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else
    command -v sudo >/dev/null 2>&1 || die 'sudo is required to install Docker'
    sudo "$@"
  fi
}

install_docker_apt() {
  check_apt_platform
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

install_docker_rpm() {
  check_linux_arch
  command -v dnf >/dev/null 2>&1 || die 'dnf is required to install Docker on this RPM-based host'
  say "Installing Docker Engine and Compose from Docker's RPM repository for $ID..."
  if [ ! -f /etc/yum.repos.d/docker-ce.repo ]; then
    if [ "$ID" = fedora ]; then
      as_root dnf config-manager addrepo --from-repofile https://download.docker.com/linux/fedora/docker-ce.repo
    else
      as_root dnf -y install dnf-plugins-core
      as_root dnf config-manager --add-repo "https://download.docker.com/linux/$rpm_repo/docker-ce.repo"
    fi
  fi
  as_root dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  as_root systemctl enable --now docker
}

install_docker() {
  [ -r /etc/os-release ] || die 'unsupported host: /etc/os-release is missing'
  . /etc/os-release
  case "$ID:$VERSION_ID" in
    debian:12|debian:13|ubuntu:22.04|ubuntu:24.04)
      install_docker_apt ;;
    fedora:43|fedora:44)
      install_docker_rpm ;;
    rhel:8*|rhel:9*|rhel:10*|rocky:8*|rocky:9*|rocky:10*|almalinux:8*|almalinux:9*|almalinux:10*)
      rpm_repo=rhel
      install_docker_rpm ;;
    centos:9|centos:10)
      rpm_repo=centos
      install_docker_rpm ;;
    *) die "automatic Docker installation is unavailable for $ID $VERSION_ID; install Docker Engine and Compose first" ;;
  esac
}

install_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    BREW_BIN=$(command -v brew)
  elif [ -x /opt/homebrew/bin/brew ]; then
    BREW_BIN=/opt/homebrew/bin/brew
  elif [ -x /usr/local/bin/brew ]; then
    BREW_BIN=/usr/local/bin/brew
  else
    [ "$(id -u)" -ne 0 ] || die 'install Homebrew from a regular macOS user account'
    command -v curl >/dev/null 2>&1 || die 'curl is required to install Homebrew'
    say 'Installing Homebrew from its official installer...'
    brew_installer=$(mktemp)
    trap 'rm -f "$brew_installer"' EXIT HUP INT TERM
    curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$brew_installer"
    /bin/bash "$brew_installer"
    rm -f "$brew_installer"
    trap - EXIT HUP INT TERM
    if [ -x /opt/homebrew/bin/brew ]; then
      BREW_BIN=/opt/homebrew/bin/brew
    elif [ -x /usr/local/bin/brew ]; then
      BREW_BIN=/usr/local/bin/brew
    else
      die 'Homebrew installed but its executable was not found'
    fi
  fi
  eval "$("$BREW_BIN" shellenv)"
}

start_colima() {
  say "Starting Colima with $COLIMA_CPUS CPUs, ${COLIMA_MEMORY_GIB} GiB memory, and a ${COLIMA_DISK_GIB} GiB disk..."
  colima start --runtime docker --cpus "$COLIMA_CPUS" --memory "$COLIMA_MEMORY_GIB" --disk "$COLIMA_DISK_GIB"
  export DOCKER_CONTEXT=colima
}

ensure_colima_resources() {
  if ! colima status >/dev/null 2>&1; then
    start_colima
    return
  fi

  status_json=$(colima status --json 2>/dev/null || true)
  current_cpus=$(printf '%s\n' "$status_json" | sed -n 's/.*"cpu":\([0-9][0-9]*\).*/\1/p')
  current_memory=$(printf '%s\n' "$status_json" | sed -n 's/.*"memory":\([0-9][0-9]*\).*/\1/p')
  current_disk=$(printf '%s\n' "$status_json" | sed -n 's/.*"disk":\([0-9][0-9]*\).*/\1/p')
  min_memory=$((COLIMA_MEMORY_GIB * 1024 * 1024 * 1024))
  min_disk=$((COLIMA_DISK_GIB * 1024 * 1024 * 1024))

  if [ -z "$current_cpus" ] || [ -z "$current_memory" ] || [ -z "$current_disk" ]; then
    die 'could not read Colima resource configuration'
  fi
  if [ "$current_cpus" -lt "$COLIMA_CPUS" ] || \
     [ "$current_memory" -lt "$min_memory" ] || \
     [ "$current_disk" -lt "$min_disk" ]; then
    say 'Existing Colima instance is too small for the Nosu stack; resizing it...'
    colima stop
    start_colima
  else
    export DOCKER_CONTEXT=colima
  fi
}

install_macos_docker() {
  install_homebrew
  if ! command -v docker >/dev/null 2>&1; then "$BREW_BIN" install docker; fi
  if ! command -v colima >/dev/null 2>&1; then "$BREW_BIN" install colima; fi
  ensure_colima_resources
}

case "$HOST_OS" in
  Darwin)
    if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
      install_macos_docker
    elif command -v colima >/dev/null 2>&1 && [ "$(docker context show 2>/dev/null || true)" = colima ]; then
      ensure_colima_resources
    fi
    ;;
  Linux)
    if ! command -v docker >/dev/null 2>&1; then install_docker; fi
    ;;
  *) die "unsupported host operating system: $HOST_OS" ;;
esac

if [ "$HOST_OS" = Linux ] && ! docker info >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then
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

if docker_cmd compose version >/dev/null 2>&1; then
  COMPOSE_COMMAND=plugin
elif [ "$HOST_OS" = Darwin ]; then
  install_homebrew
  if ! command -v docker-compose >/dev/null 2>&1; then "$BREW_BIN" install docker-compose; fi
  COMPOSE_COMMAND=standalone
else
  say "Installing verified Docker Compose $COMPOSE_VERSION for this user..."
  install_compose_plugin
  COMPOSE_COMMAND=plugin
fi

compose() {
  if [ "$COMPOSE_COMMAND" = standalone ]; then
    docker-compose --env-file "$CONFIG" -f "$COMPOSE" "$@"
  else
    docker_cmd compose --env-file "$CONFIG" -f "$COMPOSE" "$@"
  fi
}

if [ "$ACTION" = install ] || [ "$ACTION" = update ]; then
  if ! grep -q '^DITTO_RELAY_URL=' "$CONFIG"; then
    relay_origin=$(config_value NOSU_PUBLIC_URL)
    case "$relay_origin" in
      https://*) relay_url="wss://${relay_origin#https://}/relay" ;;
      http://*) relay_url="ws://${relay_origin#http://}/relay" ;;
      *) die 'NOSU_PUBLIC_URL must be an HTTP origin' ;;
    esac
    printf '\nDITTO_RELAY_URL=%s\n' "$relay_url" >> "$CONFIG"
  fi
  if ! grep -q '^DITTO_NSEC=' "$CONFIG"; then
    say 'Building Ditto Relay and generating its signing key...'
    docker_cmd build -t nosu-ditto-relay:local "$ROOT/apps/ditto-relay"
    ditto_nsec=$(docker_cmd run --rm --entrypoint bun nosu-ditto-relay:local -e 'import { nip19, generateSecretKey } from "nostr-tools"; console.log(nip19.nsecEncode(generateSecretKey()))')
    case "$ditto_nsec" in nsec1*) ;; *) die 'Ditto Relay signing key generation failed' ;; esac
    chmod 600 "$CONFIG"
    printf '\nDITTO_NSEC=%s\n' "$ditto_nsec" >> "$CONFIG"
    say 'Saved Ditto Relay signing key in infra/.env.'
  fi
  [ -n "$(config_value DITTO_NSEC)" ] || die 'DITTO_NSEC is empty in infra/.env'
fi

case "$ACTION" in
  install)
    compose config --quiet
    compose build nosu groups controller ditto-relay
    compose up -d
    compose ps
    say "Nosu is starting at $PUBLIC_URL"
    say 'Local deployment overview: http://localhost:3401'
    say 'Check health with: sh infra/install.sh status'
    ;;
  update)
    compose config --quiet
    compose build nosu groups controller ditto-relay
    compose up -d --force-recreate
    compose ps
    say 'Nosu containers rebuilt and replaced. Data volumes and infra/.env kept.'
    ;;
  status) compose ps ;;
  logs) compose logs --tail=120 -f nosu groups trending postgres ingress controller ditto-relay ditto-sync opensearch ;;
  stop) compose stop ;;
  restart) compose up -d --force-recreate ;;
esac
