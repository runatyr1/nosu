#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONFIG="$ROOT/infra/.env"
COMPOSE="$ROOT/infra/compose.yaml"
PURGE=false

usage() {
  cat <<'EOF'
Usage: sh infra/uninstall.sh [--purge-data]

Stop and remove the Nosu Compose stack. By default, PostgreSQL data, caches,
TLS state, and infra/.env remain for a later reinstall.

--purge-data also deletes the Compose volumes and infra/.env. This permanently
removes the local database, caches, and TLS state. It does not uninstall Docker.
EOF
}

for arg do
  case "$arg" in
    --purge-data) PURGE=true ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'nosu: unknown argument: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  printf 'nosu: Docker is unavailable\n' >&2
  exit 1
fi

if docker info >/dev/null 2>&1; then
  docker_cmd() { docker "$@"; }
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
  docker_cmd() { sudo docker "$@"; }
else
  printf 'nosu: Docker daemon is unavailable\n' >&2
  exit 1
fi

if ! docker_cmd compose version >/dev/null 2>&1; then
  printf 'nosu: Docker Compose is unavailable\n' >&2
  exit 1
fi

if [ -f "$CONFIG" ]; then
  compose() { docker_cmd compose --env-file "$CONFIG" -f "$COMPOSE" "$@"; }
else
  # Compose interpolation requires these values even for "down". No secret is
  # used to contact the containers during removal.
  compose() {
    NOSU_PUBLIC_URL=http://localhost NOSU_DATABASE_URL=postgresql://unused:unused@postgres:5432/unused \
      POSTGRES_PASSWORD=unused UNFURL_PROXY_SECRET=unused \
      docker_cmd compose -f "$COMPOSE" "$@"
  }
fi

if [ "$PURGE" = true ]; then
  compose down --remove-orphans --volumes
  rm -f -- "$CONFIG"
  printf 'Nosu containers, network, data volumes, and configuration removed.\n'
else
  compose down --remove-orphans
  printf 'Nosu containers and network removed. Data volumes and infra/.env kept.\n'
fi
