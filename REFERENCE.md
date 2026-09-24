# Nosu Reference

Historical research, architecture notes, and implementation context retained from the original project README. For current setup instructions, see [README.md](README.md).

Selected brand: **Nosu**. Intended domain: **nosu.social**. Project directory: `nosu/`.

The current implementation plan is maintained in the separate internal documentation repository. Status: **first source-preserving integration implemented; static checks and initial browser bridge verification pass, cross-client publication verification remains**.

## First implementation

Nosu currently combines two retained applications:

| Path | Responsibility |
| --- | --- |
| `apps/web` and `packages/*` | Nostrich-derived social shell and shared packages |
| `apps/armada` | Armada group client with Concord and NIP-29/Buzz behavior retained |
| `apps/web/components/groups` | Host frame and signer RPC boundary |
| `apps/armada/src/integration` | NIP-07-compatible host facade and account synchronization |
| `UPSTREAM.md` | Imported revisions, licenses and local integration patch inventory |

The applications keep separate databases, relay policies, routers, dependency installations and build outputs. The Nostrich-derived workspace retains pnpm and its original lockfile; the source-preserved Armada application retains npm and a minimally reconciled derivative of its `package-lock.json`. Group Chat runs inside the Nosu shell, while signing and NIP-44 operations delegate to the active Nosu signer without copying its private key. Armada's service worker is disabled only in embedded mode to avoid taking control of the social application.

The workspace root preserves the complete Nostrich Git history. `apps/armada` is a Git submodule preserving Armada's independent history. After cloning Nosu, initialize it with `git submodule update --init`; commit Armada changes inside `apps/armada` first, then commit the resulting submodule pointer in the outer repository.

The lightweight MVP can be developed on the user's macOS machine. Install the social workspace with `pnpm install --frozen-lockfile` and Armada with `pnpm install:groups`. Run `pnpm dev:social` and `pnpm dev:groups` in separate terminals; the social shell uses `http://localhost:3400` and Armada uses `http://localhost:8080`. Development uses public relays and compatible public services. Core social/groups work needs no container database: ArmadaDB is browser IndexedDB. Ranked Trending uses the native Homebrew PostgreSQL 17 service on port `5433` plus `pnpm dev:trending`; the non-default port avoids the existing Kubernetes port-forward on `5432`. Do not run a full relay/media/voice stack on this machine; use Linux later for the self-hosted environment. Environment examples are in `.env.example` and `apps/armada/.env.example`. Both application typechecks, focused bridge/relay tests, and 4,472 Armada tests pass; the remaining Armada packaging test requires an unbuilt Electron artifact. Production builds and browser interoperability tests remain pending.

Public-release requirement: **self-host all services operated by Nosu that can be self-hosted**, including its relays, media storage and enabled supporting backends. Keep endpoints configurable and preserve interoperability with public relays and existing Armada communities. Infrastructure rollout follows the public-relay MVP; see the plan's self-hosting section for scope and exceptions.

The notes below are historical research. The implementation plan supersedes the earlier broad package-extraction proposal and naming shortlist: preserve Nostrich's structure and Armada files, connect them through a contained Group Chat module, and postpone shared-storage/relay consolidation. Brand-neutral new code does not require renaming imported upstream packages.

## Product direction

Build one cohesive Nostr client that starts with:

1. A polished social-media experience based on the strongest ideas and reusable code from Nostrich.
2. A first-class **Group Chat** area implementing Armada's Concord communities plus its NIP-29/Buzz compatibility.
3. A Nostr-native marketplace as the next major module.
4. Additional focused Nostr capabilities later, without turning the interface into a collection of unrelated mini-apps.

The aim is not to place several websites beside each other. It is one application with one identity, navigation system, design language, relay policy, local data layer, notification model, and settings experience.

## Repositories researched

Research repositories are stored in `/Users/user1/syslab-new/1-projects-2/nostr-stuff/`; Nosu remains in `/Users/user1/syslab-new/1-projects-2/nosu/`.

| Repository | Role | License | Current finding |
| --- | --- | --- | --- |
| `nostrich-client` | Social client and likely initial UX basis | MIT | Current source for `nostrich.org`; React 19, Next.js 15, pnpm/Turborepo |
| `armada-canonical` | Concord, NIP-29 and Buzz community client | AGPL-3.0 | Current Armada client source; deployed version matched `armada.buzz` v0.61.0 during research |
| `concord` | Concord protocol specification | Repository-specific | Protocol reference and interoperability source |
| `armada-discord-bridge` | Discord import and live bridge | AGPL-3.0-only | Optional service; includes a headless Concord core extracted from Armada |
| `ditto-relay` | General/NIP-29 relay option | AGPL-3.0 | Replaceable infrastructure |
| `nostr-push` | Web Push, APNs and FCM gateway | AGPL-3.0 | Optional notification infrastructure |
| `armada-av` | Concord voice token broker and LiveKit deployment | No explicit license found | Source is public, but reuse needs license clarification |

## Important Nostrich findings

Nostrich is unusually suitable as a starting point because it already separates concerns:

```text
apps/web            Next.js web application
packages/nostr      Headless protocol core, relay pool, signers and NIPs
packages/app        Shared React UI rendered through react-native-web
packages/ui         Design tokens and CSS theme
packages/hooks      Shared React hooks
packages/api        Optional server-side trending index and worker
packages/types      Shared Zod contracts
```

It supports signed-out reading and NIP-07, NIP-46, NIP-49 and read-only identities through a common asynchronous signer interface. That signer boundary is a good candidate for the whole application.

The web client is mostly client-to-relay. Its server-side dependency is optional and primarily supplies ranked trending data. Media uploads go directly to Blossom.

## Important Armada findings

Armada contains three community paths behind one interface:

- Concord: serverless, end-to-end encrypted communities over ordinary Nostr relays.
- NIP-29: relay-hosted groups where the relay controls membership and moderation.
- Buzz: an enhanced NIP-29 workspace implementation with additional features.

New communities created in Armada are Concord communities. The main source tree includes the complete Concord implementation, cryptography, rekeying, local database, community UI, voice client, NIP-29/Buzz adapters, PWA support and platform wrappers.

## Recommended architecture

Create a new monorepo rather than embedding one complete application inside the other.

```text
apps/
  web/                 Unified browser application and navigation shell
  mobile/              Possible later native/Capacitor or React Native shell

packages/
  identity/            Accounts and shared async signer abstraction
  nostr-core/          Relay pool, event routing, NIP primitives and caches
  storage/             Versioned local database and migrations
  ui/                  Design tokens and reusable components
  social/              Feeds, profiles, notes, articles, spaces and search
  groups/              Concord, NIP-29 and Buzz feature module
  marketplace/         Future marketplace events, listings and transactions
  notifications/       Foreground notifications and optional push adapters
  media/               Blossom upload, mirroring and media presentation

services/
  trending/            Optional ranked-public-content worker
  av-broker/           Optional Concord voice infrastructure
  push/                Optional push gateway deployment
```

The application shell should own global navigation. `Social`, `Group Chat`, and later `Marketplace` should be feature modules, not independently bootstrapped applications.

## Integration strategy

| Approach | Use | Assessment |
| --- | --- | --- |
| iframe or embedded full Armada site | Disposable proof of concept | Fast, but produces duplicate login/state/navigation and a visibly fragmented product |
| Keep both complete apps and route between them | Early technical demonstration | Better than an iframe, but still duplicates signer, relay and storage behavior |
| Make Nostrich the shell and port Armada feature code | First serious implementation | Good starting direction because Nostrich already has package boundaries and navigation primitives |
| New shell with selected code from both | Long-term architecture | Cleanest and most maintainable if the integration quickly outgrows Nostrich's current assumptions |

Recommended path: start from the Nostrich monorepo structure, reuse its social UI and headless Nostr/signing packages, then port Armada's Concord/NIP-29/Buzz implementation behind shared interfaces. Preserve protocol behavior and test vectors even when restructuring the code.

## Upstream policy

Exact source compatibility is useful but not mandatory. Clean boundaries and maintainability take precedence.

- Keep the original repositories as read-only research/upstream clones.
- Record the upstream repository, commit and original path for imported modules.
- Prefer importing coherent modules with their tests instead of copying isolated functions.
- Keep protocol logic close to upstream wire behavior; allow the application shell and UI to diverge freely.
- Periodically compare security, protocol and interoperability changes from both upstreams.
- Avoid Git submodules for application code that requires cross-cutting integration. They preserve history but make shared identity, routing and UI changes unnecessarily awkward.
- Consider automated upstream-diff reports later, after module ownership stabilizes.

AI-assisted development makes a clean rewrite or substantial refactor practical, but interoperability tests, cryptographic vectors and migration tests remain the authority. Generated code should not become a substitute for protocol-level verification.

## Licensing

Nostrich is MIT licensed, so its code can be reused in an AGPL application with attribution and the MIT notice preserved.

Armada is AGPL-3.0. A single combined client derived from Armada should be planned as AGPL-compatible and source-available to its users. Trying to preserve a proprietary license by arranging Armada code as an internal package would not be a sound architectural assumption.

The public `armada-av` source currently has no explicit license. Treat it as reference-only until its maintainers add a license or grant permission. Stock LiveKit and an independently implemented CORD-07 broker remain alternatives.

## Suggested first milestone

1. Establish the new monorepo and unified web shell.
2. Bring over Nostrich social browsing, identity and signer flows with minimal behavioral change.
3. Define shared interfaces for signer, relay routing, media, profiles and local storage.
4. Add `Group Chat` to the main navigation.
5. Port Concord community discovery, creation, invites and text channels first.
6. Add rekeying/moderation, attachments, voice, then NIP-29/Buzz compatibility.
7. Validate interoperability against unchanged Armada and another Concord client.

This milestone deliberately postpones marketplace work until the shared core and the first two major experiences are stable.

## Decisions still open

- Final visual identity and assets for the confirmed Nosu name.
- Whether the first shell remains Next.js or becomes a client-only Vite application.
- Whether mobile should use React Native, Capacitor, or separate native shells.
- Local database choice and migration strategy for encrypted community history.
- Whether to adopt Nostrich's relay pool directly or define a shared interface with separate routing policies for social and Concord traffic.
- Marketplace protocol scope and supported NIPs.
- Final license and contribution policy for the combined repository.

## Naming research

The selected name is **Nosu**, with **nosu.social** registered by the user. Public Apple App Store and Google Play searches found no app named exactly “Nosu” on 2026-09-24. Apple has unrelated listings named “Nosu the Dinosaur” and “Nōsu”; neither is the exact name. Apple can reserve an unpublished localized name in App Store Connect, so creating the actual app record is the only definitive availability check. The former `nos.social` Nostr project appears inactive and `nosu.io` redirects rather than presenting an active Nosu product. This remains preliminary collision research, not formal trademark clearance.

Fantasy-oriented shortlist:

| Name | Theme and pronunciation | Preliminary assessment |
| --- | --- | --- |
| **Nosu** | `NO-soo` / `NO-su`; short Nostr-adjacent coined name | Selected: shortest, clearest cross-language pronunciation and strongest domain presentation |
| **Nostrune** | `NOS-rune` or `NOST-rune`; Nostr plus runes | Clearest fantasy connection and highly descriptive; slightly longer |
| **Nostyr** | `NOS-teer`; Nostr plus the Norse god Týr | Very short and distinctive; spelling does not immediately communicate pronunciation, and the name is used by a music artist |
| **Noswyrd** | `NOS-weerd`; Nostr plus the Old English concept of fate | Highly unique and atmospheric; pronunciation requires explanation |
| **Nostgald** | `NOST-gald`; inspired by Norse *galdr*, magical songs/spells | Most unusual and ownable; least immediately understandable |

Current decision: **Nosu**, using **nosu.social**.

### Brand modularity

Do not use the public product name as an architectural namespace. Keep private workspace packages under a neutral scope such as `@client/*`, and keep product-specific values in one versioned brand configuration:

```text
config/brand.ts
  displayName
  shortName
  description
  publicOrigin
  deepLinkScheme
  nostrClientTag
  supportLinks
  assetSet
```

Generate web metadata, manifests, share links, installer labels and legal-page names from that configuration. Keep logos and store artwork in replaceable brand asset directories. Native bundle identifiers and published deep-link domains are migration-sensitive, so they should derive from a stable organization identity rather than the temporary product name where platform rules allow it.
