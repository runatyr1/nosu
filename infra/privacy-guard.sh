#!/bin/sh
set -eu

case "${NOSU_PRIVACY_MODE:-false}" in
  false) ;;
  true)
    echo 'nosu: privacy mode requires runtime endpoint enforcement and is not available in this release' >&2
    exit 1
    ;;
  *)
    echo 'nosu: NOSU_PRIVACY_MODE must be true or false' >&2
    exit 1
    ;;
esac

if [ "$#" -gt 0 ]; then exec "$@"; fi
