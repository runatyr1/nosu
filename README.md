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

On macOS, the installer detects the host and installs Homebrew, Docker CLI, Compose, and Colima if needed; it starts Colima when no Docker daemon is available and ensures the Colima VM has at least 2 CPUs, 4 GiB memory, and a 20 GiB disk. This macOS path is for local testing. For a public Linux VM, use `--url https://your.domain` on the first install and point DNS at the VM. The installer builds the images locally and starts Nosu, Groups, Trending, PostgreSQL, Ditto Relay, OpenSearch, native relay synchronization, and the web gateway. The local relay is available at `ws://localhost/relay`. After changing source code, rebuild and replace the containers with:

If an existing checkout predates a newly added submodule, the installer initializes all missing submodules automatically.

```bash
sh infra/install.sh update
```

To remove the stack:

```bash
sh infra/uninstall.sh
```

The default uninstall keeps data, configuration, and locally built images for a later install. Use `sh infra/uninstall.sh --purge-data` to remove them too. Uninstalling does not stop Colima or remove Docker tooling. Open the local app at `http://localhost` and the deployment overview at `http://localhost:3401`.

## Relay synchronization

Configure the peer and transfer limits in [infra/ditto-sync.json](infra/ditto-sync.json). The default peer is `wss://relay.ditto.pub/`: import the previous public hour, then stream live events and reconcile reconnect gaps. Downloads use 25 IDs per batch with a shared one-second request interval; uploads use a one-second event interval. Relay admission and authentication still apply.

The controller's `/ditto-relay` page shows progress, queues, rates, failures, and completed coverage. It provides pause/resume, retry, and backfill of the hour before completed coverage. Coverage records processed intervals; rejected or unavailable events are reported separately.

Set `NEXT_PUBLIC_LOCAL_RELAY_ONLY=true` in `infra/.env` and run the update command to route Nosu social, search, and DM requests to this deployment's relay. This preserves the account's published relay preferences and Armada routing; signer and wallet transports keep their protocol routes. Signed-in users automatically authenticate for their full accessible history on the configured peer. Keys and decryption stay in the browser signer; extensions may require their usual signing approvals.

The Kubernetes example is [infra/k8s-example.yaml](infra/k8s-example.yaml); native sync deployment there has not been validated.
