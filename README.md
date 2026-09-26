# Nosu

Nosu is a modular Nostr client combining a social experience with Armada-compatible encrypted group chat.

## Clone

Clone Nosu with its Armada and Ditto Relay submodules:

```bash
git clone --recurse-submodules https://github.com/runatyr1/nosu.git
cd nosu
```

## Install, update, or uninstall

```bash
sh infra/install.sh --url http://localhost
```

On macOS, the installer detects the host and installs Homebrew, Docker CLI, Compose, and Colima if needed; it starts Colima when no Docker daemon is available. This macOS path is for local testing. For a public Linux VM, use `--url https://your.domain` on the first install and point DNS at the VM. The installer builds the images locally and starts Nosu, Groups, Trending, PostgreSQL, and the web gateway. After changing source code, rebuild and replace the containers with:

```bash
sh infra/install.sh update
```

To remove the stack:

```bash
sh infra/uninstall.sh
```

The default uninstall keeps data and configuration for a later install. Use `sh infra/uninstall.sh --purge-data` to remove them too. Open the local app at `http://localhost` and the deployment overview at `http://localhost:3401`.

For VM details and the Kubernetes example, see [infra/README.md](infra/README.md).
