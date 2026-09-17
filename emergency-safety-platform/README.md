# Guardian Response — Emergency Safety & Incident Response Platform

A web-only prototype of an emergency safety ecosystem: a person configures a
personal emergency keyword, activates it (or a simulated wearable trigger),
and a trusted network is notified in real time while evidence, location, and
wearable telemetry stream in automatically until the incident is resolved.

There is **no mobile app** in this build — the original spec called for one,
but that was explicitly dropped in favor of a single, fully-working web
dashboard covering both the "victim" and "trusted member" experiences.

This is a **hackathon-scope vertical slice**, not the full 50-section spec
implemented literally. It intentionally covers the entire activation →
resolution loop for real, with every simulated-hardware boundary clearly
labelled, and documents what's deferred (see [Known limitations](#known-limitations--whats-deferred)).

---

## 1. Concept

1. A user configures an emergency keyword (default: `HELP`).
2. Activation — via the keyword, a simulated wearable emergency button, or
   simulated fall detection — opens an **incident**.
3. The Incident Management Engine takes over: it retrieves a (simulated)
   location, notifies the trusted network, starts an evidence timer
   (~10s cadence), and elevates the simulated wearable's telemetry.
4. Trusted members (people who registered an account whose email matches a
   trusted-member entry) see the incident live, acknowledge it, mark
   themselves responding, escalate, or resolve it.
5. Everything — every state change, every piece of evidence, every sensor
   event — is written to the incident's timeline and pushed over
   Socket.IO in real time.
6. A dedicated **Demo Control Panel** lets a single operator (a judge) drive
   the entire lifecycle from one screen without needing hardware or a second
   browser tab.

---

## 2. Architecture

```
apps/
  api/     Express + TypeScript + Prisma (MySQL) + Socket.IO
  web/     React + TypeScript + Tailwind CSS + Vite
packages/
  types/   Shared TypeScript contract (enums, DTOs, Socket.IO event names)
docker-compose.yml   Local MySQL for development (if you don't already run one)
```

### The Incident Management Engine

Every activation path — keyword, wearable button, simulated fall, or (later)
a real hardware trigger — funnels through one function:
[`createIncidentFromTrigger`](apps/api/src/modules/incidents/incident.service.ts).
Nothing downstream knows or cares which trigger fired. This is the principle
the spec calls out as most important: activation methods are interchangeable
inputs to one engine, not separate feature silos.

```
Keyword / Wearable Button / Fall Detection
        │
        ▼
Incident Management Engine (incident.service.ts)
        │
        ├─ addTimelineEvent()          → incident_events table
        ├─ locationService             → simulated GPS fix
        ├─ notifyTrustedMembers()      → notifications table + Socket.IO
        ├─ startEvidenceTimer()        → evidence table, every ~10s
        └─ wearablesService.setElevated() → faster/more intense telemetry
        │
        ▼
Socket.IO rooms: user:<ownerId>, trusted:<ownerId>
        │
        ▼
Web dashboard (Dashboard, Incident Detail, Demo Mode) — updates live
```

### Simulated IoT architecture

The wearable/IoT layer is deliberately layered so a real device integration
can replace the simulator without touching the Incident Management Engine:

```
MockWearableProvider (SIMULATED DEVICE data generator)
        │  implements IWearableProvider
        ▼
wearables.service.ts   ("IoT Event Processor" — persists readings, updates
        │                the WearableDevice row, emits Socket.IO events)
        ▼
IoTSimulator (wearables.simulator.ts) — background interval scheduler
        │
        ▼
wearables.orchestrator.ts — decides whether a FALL / EMERGENCY_BUTTON event
        │                    should open a new incident
        ▼
Incident Management Engine
```

`IWearableProvider` ([apps/api/src/modules/wearables/providers/IWearableProvider.ts](apps/api/src/modules/wearables/providers/IWearableProvider.ts))
is the seam for future real hardware: a `BluetoothWearableProvider` or
`VendorApiWearableProvider` could implement the same interface — reading real
sensor data instead of generating it — and nothing in `wearables.service.ts`
or the Incident Management Engine would need to change.

### Object-level authorization

`assertIncidentAccess` ([apps/api/src/modules/incidents/incidents.access.ts](apps/api/src/modules/incidents/incidents.access.ts))
is the single choke point for "can this user see this incident": the
incident owner always can; anyone else only if their **registered account
email** matches an **enabled** `TrustedMember` row for that owner. This is
also how the demo's two-role experience works without a mobile app or SMS
provider — see [Demo Mode](#5-demo-mode) below.

---

## 3. Database

MySQL via Prisma ([apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)):

| Table | Purpose |
|---|---|
| `User` | Accounts (both "victims" and "trusted members" are just users) |
| `EmergencyKeyword` | One active keyword per user |
| `TrustedMember` | A contact on someone's trusted network; linked to a `User` once that email registers |
| `Incident` | The core incident record and its lifecycle status |
| `IncidentEvent` | The chronological timeline |
| `Evidence` | Simulated audio/image/video/location/sensor evidence, sequenced |
| `Location` | GPS history, simulated, tied to a user and optionally an incident |
| `Notification` | In-app notifications pushed to trusted members |
| `WearableDevice` | **SIMULATED DEVICE** — one demo wearable per user |
| `WearableEvent` | **DEMO SENSOR** readings/events emitted by the IoT simulator |
| `AuditLog` | Security-relevant actions: logins, keyword changes, incident lifecycle, demo resets |

Every simulated-hardware table/column is called out with a `SIMULATED
DEVICE` / `DEMO SENSOR` comment directly in the schema.

---

## 4. Real-time events (Socket.IO)

Defined once in [`packages/types`](packages/types/src/index.ts) as
`SocketEvents` and used identically by the server and the client:

`incident.created`, `incident.updated`, `incident.status_changed`,
`incident.resolved`, `incident.timeline_event`, `evidence.received`,
`location.updated`, `notification.created`, `wearable.connected`,
`wearable.disconnected`, `sensor.updated`, `fall.detected`,
`emergency_button.pressed`.

Clients authenticate the socket handshake with their JWT access token and
join `user:<theirId>` plus `trusted:<ownerId>` for every owner who lists
their email as a trusted contact.

---

## 5. Demo Mode

Every button in `/demo` (see [DemoModePage.tsx](apps/web/src/pages/DemoModePage.tsx))
calls the exact same API the "real" flows use — there is no separate mock
code path to keep in sync.

**Two-role demo (recommended, uses the seeded accounts):**

1. Log in as `victim@example.com` / `Password123!` (has the keyword `HELP`
   configured, and `trusted@example.com` already accepted as a trusted
   member) in one browser.
2. Log in as `trusted@example.com` / `Password123!` in a second
   browser/incognito window.
3. From the victim's **Demo Mode** tab, click **Simulate Keyword Detection**
   (or **Simulate Wearable Button** / **Simulate Fall**).
4. Watch the trusted account's Dashboard light up with the active incident
   in real time — evidence, location, and wearable telemetry keep arriving
   automatically.
5. From the trusted account, open the incident and click **Acknowledge** →
   **Responding** → **Resolve Incident**.
6. Or, from the victim's own Demo Mode panel, use **Advance Incident** /
   **Resolve Incident** to drive the whole lifecycle solo (these are
   explicitly labelled "Demo Control Panel" actions and bypass the
   trusted-member check so a single account can narrate the full story).
7. Click **Reset Demo** to wipe this account's incidents/notifications and
   restore the wearable to a clean baseline before the next run-through.

---

## 6. Installation

Prerequisites: Node.js 20+, npm 10+, and MySQL 8 (a local install like MySQL
Server + Workbench, or via Docker).

```bash
cd emergency-safety-platform
npm install                     # installs all workspaces + builds packages/types
cp .env.example apps/api/.env   # already pre-filled with dev defaults — edit as needed
cp .env.example apps/web/.env   # only the VITE_* keys matter here

# If you don't already have MySQL running locally:
docker compose up -d            # starts MySQL 8 on localhost:3306

npm run prisma:push             # creates/updates the schema directly (no migration history)
# or: npm run prisma:migrate    # for a real migration-history workflow
npm run prisma:seed             # seeds victim@example.com / trusted@example.com
```

`DATABASE_URL` defaults to `mysql://root:maika@localhost:3306/emergency_safety`
— point it at whatever MySQL instance and credentials you actually use (e.g.
the same server MySQL Workbench connects to).

Run the API and the web app in two terminals:

```bash
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:5173
```

### Tests

```bash
npm run test:api     # vitest + supertest against a running MySQL instance
```

The test suite needs `DATABASE_URL` pointing at a real (ideally disposable)
MySQL database — it exercises the full HTTP surface (registration,
keyword-triggered incidents, wearable-triggered incidents, trusted-member
authorization, resolution, demo reset). All 15 tests pass against a real
MySQL 8 server.

### Environment variables

All variables are documented in [.env.example](.env.example): database
connection, JWT secrets, evidence/telemetry interval tuning, and the two
apps' URLs. **Never commit a real `.env`** — only `.env.example` is tracked.

---

## 7. Security

- Passwords hashed with bcrypt (12 rounds).
- JWT access + refresh tokens; access tokens are short-lived (15m default).
- `helmet`, CORS restricted to the configured web origin, and rate limiting
  on `/auth/*` (20 requests / 15 min) and globally (120 requests / min).
- All input validated with `zod` at the route boundary.
- Object-level authorization on every incident read/action
  (`assertIncidentAccess`, `requireTrustedMemberActing`) — a trusted member
  can only act on incidents they're actually linked to; an owner can never
  resolve someone else's incident.
- Audit log entries for login, keyword changes, trusted-member changes,
  incident creation/acknowledgement/resolution, and demo resets.
- No secrets are ever sent to the frontend; the web app only holds its own
  JWT in `localStorage`.

## 8. Privacy

- Location and evidence are only ever visible to the incident owner and
  their explicitly-configured, enabled trusted members — enforced at the
  API layer, not just hidden in the UI.
- A trusted member with no linked account yet is never silently given
  access: the system logs "would notify via SMS/email" on the timeline
  instead of fabricating a data-sharing event.
- Trusted members can be disabled (revoking their visibility) or removed
  entirely from Settings → Trusted Members.

---

## 9. Known limitations / what's deferred

This was scoped as a **thin, real, end-to-end slice** rather than the full
literal spec, per an explicit scoping conversation. Deferred, not silently
dropped:

- **Mobile app** — out of scope per the user's request; the web dashboard
  serves both the "victim" and "trusted member" roles.
- **Real SMS/email delivery** — trusted members without a linked account are
  logged on the timeline as "would notify," not actually messaged. The seam
  for a real provider is `notifyTrustedMembers()` in `incident.service.ts`.
- **Trusted-member invitations** — adding a member auto-links if their email
  already has an account; there's no separate invitation-token/email flow.
- **Real evidence files** — audio/image/video evidence is simulated text
  metadata, not actual captured bytes/blobs in object storage.
- **Offline queueing** — the spec's offline/retry queue for evidence upload
  isn't implemented; evidence generation assumes the server is reachable.
- **Refresh-token rotation/revocation list** — refresh tokens are verified
  but not tracked in a `sessions` table, so they can't be revoked early.
- **Evidence timers are in-memory** — they don't survive an API process
  restart; a production build would move them to a durable job queue.
- **Automated test coverage** — covers the core lifecycle (auth, keyword
  config, keyword/fall/button-triggered incidents, authorization,
  resolution, demo reset) rather than every listed scenario. All 15 tests
  pass against a real MySQL 8 server.

## 10. Future real IoT integration

Swap `MockWearableProvider` for a real implementation of `IWearableProvider`
(e.g. reading BLE GATT characteristics or a vendor's cloud API) and update
`IoTSimulator` to source its tick loop from that hardware instead of a
timer. `wearables.service.ts`, `wearables.orchestrator.ts`, and the entire
Incident Management Engine are unaffected, because they only ever consume
the `IWearableProvider` interface — never the mock implementation directly.
