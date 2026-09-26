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

See [REFERENCE.md](REFERENCE.md) for architecture and research notes, and [UPSTREAM.md](UPSTREAM.md) for source history and integration details.
