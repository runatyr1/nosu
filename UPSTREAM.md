# Upstream source tracking

Nosu begins with source-preserving imports so fixes can be compared and selectively adopted before deeper unification is justified.

| Component | Upstream | Imported revision | Local location | License |
| --- | --- | --- | --- | --- |
| Social client | `https://github.com/nostrichOS/nostrich-client` | `d693ab84544beb810e75577080c679e735fe26d5` | workspace root, `apps/web`, `packages/*` | MIT (`LICENSE`) |
| Group client | `nostr://npub10qdp2fc9ta6vraczxrcs8prqnv69fru2k6s2dj48gqjcylulmtjsg9arpj/relay.ngit.dev/armada` | `b99b496624723848f5bed6d23ed3a929b79b95c2` (`v0.61.0`) | `apps/armada` | AGPL-3.0 (`apps/armada/LICENSE`) |

The untouched research clones remain in `../nostr-stuff/nostrich-client` and `../nostr-stuff/armada-canonical`. They are comparison inputs, not runtime dependencies.

The workspace root is based directly on the social client's Git history, with its source remote named `upstream`. `apps/armada` is a submodule based directly on Armada's Git history and also names its source remote `upstream`. Local product changes are committed independently in each repository; the outer repository records the selected Armada commit as its submodule pointer. Before publishing a local Armada commit, configure a writable fork remote and update `.gitmodules` to a cloneable URL that contains that commit.

GitHub tracking for Armada uses `nosu-project/armada-upstream`. Its `canonical` branch is an exact mirror of the Nostr-hosted source, while `main` adds only the scheduled synchronization workflow and merge commits needed to retain that workflow. `runatyr1/nosu-armada` is a GitHub fork of this mirror. Its `main` intentionally remains based on Armada `v0.61.0` plus Nosu's integration commits; newer upstream commits are reviewed and merged deliberately rather than entering the embedded client automatically.

Dependency boundaries are source-preserving as well: the social workspace uses pnpm with the pinned Nostrich `pnpm-lock.yaml`, while `apps/armada` is excluded from that workspace and uses Armada's retained npm `package-lock.json`. This prevents React, Nostrify and cryptography dependency resolution in one client from silently changing the other client.

## Integration patches

Nostrich-derived files currently changed for Nosu:

- central public brand configuration and metadata;
- a Group Chat navigation destination and full-width shell route;
- a browser-only Group Chat frame;
- a strict-origin signer bridge that exposes only public signing/encryption methods;
- two-way route synchronization between Armada and the outer `/groups/...` URL;
- provisional social relay defaults recorded in `packages/nostr/src/relays.ts`.
- exclude `apps/armada` from pnpm resolution and expose root scripts that invoke its retained npm workflow.

Armada-derived files currently changed for Nosu:

- install the host signer facade before the React application mounts;
- synchronize Armada's active extension login with the host account;
- honor a configurable Vite base path and router basename.
- leave Armada's service worker disabled while embedded and scope a direct group build to its configured base path, so it cannot take control of the social application.
- reconcile the retained npm lockfile for the source-declared Three.js/Playwright dependencies, require `smol-toml` 1.7.1 or newer to exclude the malformed-TOML denial-of-service advisory affecting 1.7.0, and take compatible Vitest/ESLint transitive security updates. `npm audit` currently reports zero known vulnerabilities.

ArmadaDB, Concord, NIP-29/Buzz, relay routing, crypto, storage identifiers and message formats are otherwise retained. Nosu does not copy or export a user's private key into the group client.

## Updating

Review upstream changes against the recorded revisions and the GitHub fork comparison, then apply focused patches to the imported trees. Do not overwrite integration files blindly. Protocol, crypto and database changes require the original upstream tests plus Nosu cross-client interoperability tests. Keep both license notices and publish corresponding source for the combined AGPL derivative.
