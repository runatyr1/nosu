# Run Nosu on a VM or Kubernetes

This stack runs Social, Groups, Trending, a local Ditto Relay, and OpenSearch. It uses one Nosu app image for the web server, Trending worker, and one-shot Prisma migration; a separate Groups static image; PostgreSQL; and one public origin. The Ditto Relay is not yet a Nosu client default or a public Caddy route. Social and Groups still use their existing relay settings, and Trending still uses the configured public candidate index.

## macOS local testing

On macOS, `sh infra/install.sh --url http://localhost` detects the host and installs Homebrew (when absent), Docker CLI, Compose, and Colima as needed. It starts Colima's Docker runtime if no Docker daemon is available. An already working Docker daemon is reused. The macOS path is for local testing; public HTTPS deployment remains on a Linux VM. The macOS flow has not yet been tested on a Mac.

## VM with Docker Compose

On Debian 12/13, Ubuntu 22.04/24.04, Fedora 43/44, RHEL 8–10, CentOS Stream 9/10, Rocky Linux 8–10, or AlmaLinux 8–10, on x86_64 or arm64:

```sh
git clone --recurse-submodules https://github.com/runatyr1/nosu.git
cd nosu
sh infra/install.sh --url https://nosu.example.com
```

The first install requires an explicit URL. For local testing, use `--url http://localhost`; it serves HTTP without a public certificate. A public install requires an HTTPS domain such as `--url https://nosu.example.com`. Point its DNS at the VM and open inbound TCP 80/443 (and UDP 443 for HTTP/3). Caddy is configured to obtain and renew a certificate; this has not yet been validated on a public VM. If Docker is absent, the script installs Docker Engine and Compose from Docker's APT or RPM repository, according to the detected distribution. If an existing Docker installation lacks Compose, it installs a checksum-verified Compose plugin. It may prompt for sudo. Existing working Docker installations are preserved. RPM installation has not yet been tested on an RPM host.

The first run creates `infra/.env` with mode 600 and random PostgreSQL, unfurl, and Ditto Relay signing secrets. After changing source code, run `sh infra/install.sh update` to rebuild the local Nosu, Groups, controller, and Ditto Relay images and recreate the Compose containers. The update keeps `infra/.env` and named volumes, including PostgreSQL, OpenSearch, and Caddy's TLS state; it does not fetch source changes. Rerunning the install command also preserves configuration and volumes. `sh infra/install.sh status`, `logs`, `restart`, and `stop` are available. `sh infra/uninstall.sh` removes the stack but keeps data and configuration for a later reinstall. `sh infra/uninstall.sh --purge-data` also permanently deletes the Compose data, caches, TLS state, and `.env`. Neither command uninstalls Docker. Ditto Relay introduces durable event data in OpenSearch; do not treat its volume as a regenerable cache.

The VM stack exposes Caddy's 80/443 ports, the local-only controller at `http://localhost:3401`, and Ditto Relay at `ws://localhost:13131/` on host loopback only. OpenSearch, PostgreSQL, Nosu on 3400, and Groups on 80 are internal to Compose. `GET /api/health/live` checks the web process; `/api/health/ready` checks PostgreSQL. The controller shows whether Ditto Relay responds and how many events OpenSearch has indexed. An empty index is expected until events are published or a separate ingestion job is configured. The first Trending snapshot can take time to populate after startup. Inspect it with `/api/trending?hours=4` and the Trending worker logs.

## Kubernetes example

This example passed client-side validation but has not been applied to a cluster.

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

The first `nosu-controller` is a local-only health dashboard. It checks the web app, Groups, PostgreSQL TCP reachability, Caddy, and Trending snapshot freshness every 15 seconds. The Trending card reports data age, not worker process state; it asks for attention when the four-hour snapshot is older than 15 minutes. The Logs view has a tab for each component, manual refresh, text filtering, old-first or new-first ordering, copy, and a live polling toggle. Docker forwards the five services' stdout/stderr to the controller over a loopback-only UDP syslog port; the controller does not receive Docker socket access or cluster credentials. The UI keeps 2,000 recent entries per service in memory and shows up to 500 at once. Entries can be lost while the controller is down or if UDP drops packets; use `sh infra/install.sh logs` for older output retained by Docker. On a remote VM, view the controller through an SSH tunnel such as `ssh -L 3401:localhost:3401 user@vm`. Service start/stop is handled by the installer CLI; the dashboard does not control containers. Later management features need a deliberately scoped host agent or Kubernetes role.
