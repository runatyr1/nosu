# Nosu

Nosu is a modular Nostr client combining a social experience with Armada-compatible encrypted group chat.

## Clone

Armada is maintained as a Git submodule. Clone both repositories together:

```bash
git clone --recurse-submodules https://github.com/runatyr1/nosu.git
cd nosu
```

If Nosu was cloned without submodules:

```bash
git submodule update --init --recursive
```

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm install:groups
```

Start the social client and Armada in separate terminals:

```bash
pnpm dev:social
pnpm dev:groups
```

Open `http://localhost:3400`.

## Deploy

For a VM install and a Kubernetes example, see [infra/README.md](infra/README.md). The VM path builds the Nosu and Groups images locally and starts PostgreSQL and Trending. The Kubernetes manifest uses the same images and configuration contract.

## Planned deployment modes

Nosu's deployment tooling will default to **availability mode**: self-hosted services are preferred, while configured public Nostr relays and original Armada-compatible services remain available as fallbacks. This gives new operators broad Nostr distribution and useful service continuity without requiring them to understand every infrastructure component first.

Operators who require a self-hosted-only network policy will be able to enable **privacy mode**:

```bash
curl -fsSL https://nosu.social/install | sh -s -- --privacy-mode
```

The equivalent deployment setting will be `NOSU_PRIVACY_MODE=true` for Docker Compose and Kubernetes. Privacy mode disables public/original fallback endpoints—including ordinary public Nostr relays—and fails closed when a configured self-hosted service is unavailable. External communities or features that require non-approved infrastructure may therefore remain unavailable until privacy mode is disabled or the operator deploys and allowlists compatible self-hosted infrastructure.

These deployment commands and enforcement are planned and are not implemented yet.

See [REFERENCE.md](REFERENCE.md) for architecture and research notes, and [UPSTREAM.md](UPSTREAM.md) for source history and integration details.
