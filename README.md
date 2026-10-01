# Nosu

Nosu project main goals are: make it easy for new users to deploy and self-host their own decentralised social media, and to integrate separate nostr based components to provide a single, clean client app.

Currently Nosu integrates trending data with postgresql db (trending posts and tags), ditto self-hosted relay with opensearch db (posts and search feature) and armada groups (dms and discord-like group chats). All accesible from the nostrich-based Nosu client. The deployment also provides an infra management dashboard (status, logs, operator options), and a Caddy web gateway.

## Install

```bash
git clone --recurse-submodules https://github.com/runatyr1/nosu.git
cd nosu
sh infra/install.sh --domain nosu.social --local-http
```

Use `--local-http` for a LAN deployment. For a public deployment, omit it and point the domain at the server. On macOS, Colima will be used to start local containers.

The dashboard is local by default at `http://localhost:3401`. To expose it at `/dashboard/` run:

```bash
sh infra/install.sh --domain nosu.social --local-http --public-dashboard --pin 6483
```

## Manage

```bash
sh infra/install.sh update
sh infra/install.sh status
sh infra/install.sh logs
sh infra/install.sh restart
sh infra/uninstall.sh
```

Use `sh infra/uninstall.sh --purge-data` to remove saved data and configuration.

## Configuration

- Relay synchronization: [infra/ditto-sync.json](infra/ditto-sync.json)
- Kubernetes example: [infra/k8s-example.yaml](infra/k8s-example.yaml)


Note: This document will be kept very concise, with only the main deployment commands.
