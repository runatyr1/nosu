# Run Nosu on a VM or Kubernetes

This is the first deployable Social + Groups + Trending stack. It uses one Nosu app image for the web server, Trending worker, and one-shot Prisma migration; a separate Groups static image; PostgreSQL; and one public origin. Public Nostr relays and the configured public Trending index remain in use. The self-hosted relay/media/voice/push phase is not included.

## VM with Docker Compose

On Debian 12/13 or Ubuntu 22.04/24.04, on x86_64 or arm64:

```sh
git clone --recurse-submodules https://github.com/runatyr1/nosu.git
cd nosu
sh infra/install.sh --url https://nosu.example.com
```

The first install requires an explicit URL. For local testing, use `--url http://localhost`; it serves HTTP without a public certificate. A public install requires an HTTPS domain such as `--url https://nosu.example.com`. Point its DNS at the VM and open inbound TCP 80/443 (and UDP 443 for HTTP/3). Caddy obtains and renews a certificate. The script installs Docker Engine from Docker's official APT repository if absent, and installs a checksum-verified Compose plugin if absent. It may prompt for sudo. Existing Docker installations are preserved.

The first run creates `infra/.env` with mode 600 and random PostgreSQL and unfurl secrets. Keep a copy of this file in a protected backup. Rerunning the command preserves it and the named volumes. `sh infra/install.sh status`, `logs`, `restart`, and `stop` are available. `sh infra/uninstall.sh` removes the stack but keeps data and configuration for a later reinstall. `sh infra/uninstall.sh --purge-data` also permanently deletes the Compose database, caches, TLS state, and `.env`. Neither command uninstalls Docker.

The VM stack exposes Caddy's 80/443 ports and the local-only controller at `http://localhost:3401`. PostgreSQL, Nosu on 3400, and Groups on 80 are internal to Compose. `GET /api/health/live` checks the web process; `/api/health/ready` checks PostgreSQL. The first Trending snapshot can take time to populate after startup. Inspect it with `/api/trending?hours=4` and the Trending worker logs.

`NOSU_PRIVACY_MODE=true` is deliberately rejected for now: the browser runtime policy and upstream endpoint audit are not implemented yet. Declaring the deployment private before those controls exist would be misleading.

## Kubernetes example

Build the **same** application images without Compose. Replace the origin with your intended public domain:

```sh
docker build -f Dockerfile \
  --build-arg NEXT_PUBLIC_APP_URL=https://nosu.example.com \
  --build-arg NEXT_PUBLIC_GROUPS_APP_URL=/groups-app/ \
  -t registry.example.com/nosu-app:YOUR_TAG .
docker build -f infra/groups.Dockerfile \
  --build-arg VITE_BASE_PATH=/groups-app/ \
  --build-arg VITE_PUBLIC_WEB_ORIGIN=https://nosu.example.com/groups \
  --build-arg VITE_NOSU_PARENT_ORIGIN=https://nosu.example.com \
  -t registry.example.com/nosu-groups:YOUR_TAG .
```

Push the images to your registry or load them into your cluster using its normal workflow. Edit `infra/k8s-example.yaml` before applying:

1. Replace both image references and tags with those you built.
2. Replace `nosu.example.com` in ConfigMap and Ingress with exactly the origin used at image build time.
3. Replace the Secret's PostgreSQL password **in both values** and its unfurl secret. Use a URL-safe password or percent-encode it in `DATABASE_URL`. Treat the manifest containing real Secret values as confidential; do not commit it.
4. Set `ingressClassName` to your controller and provide the named TLS Secret through your normal certificate workflow. Ensure the StorageClass can provision both PVCs.
5. Apply the manifest in your chosen namespace, then check `kubectl rollout status deployment/nosu-postgres`, `deployment/nosu`, and `deployment/nosu-groups`.

The Nosu pod runs the Prisma migration in an init container before web and Trending start. It has one replica to avoid concurrent workers. Groups is served at `/groups-app/` and the Ingress does **not** rewrite that prefix. The PostgreSQL PVC persists snapshots and migration history; the profile-cache PVC is rebuildable. External PostgreSQL can replace the bundled Deployment/Service/PVC by changing the Secret's `DATABASE_URL` and removing those resources.

The image contains public build-time origin values. Changing the public origin or Groups prefix requires rebuilding the images; changing database credentials or the Trending index does not. The Kubernetes bundle does not depend on Compose-generated files, Docker DNS names, or the VM's Caddy configuration.

## Deployment boundary

The first `nosu-controller` is a local-only health dashboard. It checks the web app, Groups, PostgreSQL TCP reachability, ingress, and Trending snapshot freshness every 15 seconds. It has no Docker socket or cluster credentials, so service start/stop, logs, upgrades, backups, and Kubernetes management remain CLI tasks. On a remote VM, view it through an SSH tunnel such as `ssh -L 3401:localhost:3401 user@vm`. Later management features need a deliberately scoped host agent or Kubernetes role. Loki and Prometheus instrumentation belongs to that later phase.
