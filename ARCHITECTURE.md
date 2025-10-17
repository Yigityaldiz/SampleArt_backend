# SampleArt Backend Architecture

## 1. Overview

SampleArt is a collaborative material sample catalog for designers, studios, and clients. It powers both web and iOS clients that organize material samples into shared collections, manage member access, and securely view/upload sample images.

This backend exposes a REST API built with TypeScript and Express, uses Clerk for authentication, Prisma for data access, PostgreSQL for persistence, and AWS S3 for object storage. It includes role-based access controls at both the global user level (admin/user/viewer) and per-collection roles (Owner/Editor/Viewer) to enable secure collaboration.


## 2. Tech Stack

- Runtime & Framework
  - Node.js 20
  - Express 5 (JSON API, routing, middlewares)
  - TypeScript 5
- ORM / Database
  - Prisma Client 6
  - PostgreSQL 16
- Cloud & Storage
  - AWS S3 via AWS SDK v3
  - Pre-signed upload/download flows
- Authentication
  - Clerk (JWT verification via `@clerk/backend`)
  - Dev mode mock auth helper for local testing
- Validation & Safety
  - Zod (schemas for params, query, and bodies)
  - Helmet (security headers)
  - express-rate-limit (DoS and spam mitigation)
  - CORS
- Logging & Observability
  - Pino + pino-http (structured logs)
  - Per-request IDs propagated via middleware
- Background Jobs
  - Cleanup scheduler & tasks for S3/object cleanup and cascading deletes
- Tooling & Ops
  - Vitest (unit tests)
  - ESLint + Prettier
  - Dockerfile (multi-stage build) and docker-compose (app + Postgres)


## 3. Directory Structure

```
.
├─ src/
│  ├─ app.ts                  # Express app composition
│  ├─ server.ts               # HTTP/HTTPS server bootstrap + cleanup scheduler
│  ├─ config/                 # Env loading, type-safe validation
│  ├─ lib/                    # Cross-cutting libs (logger, prisma, s3)
│  ├─ middlewares/            # Request ID, not-found, error handler
│  ├─ errors/                 # HttpError, NotFoundError
│  ├─ types/                  # Express request/locals augmentation
│  └─ modules/
│     ├─ auth/                # Clerk adapter, guards, mock + middleware
│     ├─ users/               # Users router, service, repository, schemas
│     ├─ samples/             # Samples router, service, repository, schemas, access
│     ├─ collections/         # Collections router, service, repository, schemas
│     ├─ uploads/             # S3 presign flows (upload + download)
│     ├─ cleanup/             # Cleanup tasks & scheduler
│     └─ health/              # /health endpoint
├─ prisma/
│  ├─ schema.prisma           # Prisma models & enums
│  ├─ migrations/             # Generated prisma migrations
│  ├─ seed.ts                 # Seed data
│  └─ cleanup-db.ts           # Local DB cleanup helper
├─ docs/                      # API and client integration notes
├─ rules/                     # Backend guidelines & roadmaps
├─ ops/                       # Local infra helpers (e.g., Postgres)
├─ Dockerfile                 # Multi-stage container build
├─ docker-compose.yml         # App + Postgres stack
└─ README.md
```


## 4. Database Design

Datastore: PostgreSQL, modeled via Prisma. Names below reflect table mappings from `@@map` entries.

- Enums
  - `ProfileStatus`: `INCOMPLETE` | `COMPLETE`
  - `CollectionRole`: `OWNER` | `EDITOR` | `VIEW_ONLY`
  - Cleanup enums for background tasks (not user-facing)

### users (table: `users`)
```json
{
  "id": "string (PK)",
  "email": "string? (unique, CITEXT)",
  "name": "string?",
  "locale": "string?", 
  "profileStatus": "INCOMPLETE | COMPLETE (default INCOMPLETE)",
  "createdAt": "DateTime (default now)",
  "updatedAt": "DateTime (updatedAt)",
  "deletedAt": "DateTime?"
}
```
- Relations: `collections` (owned), `collectionMemberships`, `samples`
- Indexes: `(id)` primary, `(email)` unique

### collections (table: `collections`)
```json
{
  "id": "cuid (PK)",
  "userId": "string (FK → users.id)",
  "name": "string",
  "isDeleted": "boolean (default false)",
  "createdAt": "DateTime (default now)",
  "updatedAt": "DateTime (updatedAt)",
  "deletedAt": "DateTime?"
}
```
- Relations: `user` (owner), `members` (CollectionMember[]), `samples` (CollectionSample[])
- Indexes: `unique(userId, name)`, `index(userId, updatedAt)`

### samples (table: `samples`)
```json
{
  "id": "cuid (PK)",
  "userId": "string (FK → users.id)",
  "title": "string",
  "materialType": "string",
  "applicationArea": "string?",
  "surface": "string?",
  "colorHex": "#RRGGBB?",
  "colorName": "string?",
  "companyName": "string?",
  "priceMinor": "int?",
  "priceCurrency": "char(3)?",
  "quantityValue": "decimal(10,2)?",
  "quantityUnit": "string?",
  "sizeText": "string?",
  "locationLat": "decimal(9,6)?",
  "locationLng": "decimal(9,6)?",
  "notes": "string?",
  "isDeleted": "boolean (default false)",
  "createdAt": "DateTime",
  "updatedAt": "DateTime (updatedAt)",
  "deletedAt": "DateTime?"
}
```
- Relations: `user`, `image` (SampleImage?), `collections` (CollectionSample[])
- Indexes: `index(userId, updatedAt)`, `index(isDeleted)`

### sample_images (table: `sample_images`)
```json
{
  "id": "cuid (PK)",
  "sampleId": "string (unique, FK → samples.id)",
  "storageProvider": "string",
  "objectKey": "string",
  "url": "string",
  "width": "int?",
  "height": "int?",
  "blurhash": "string?",
  "exif": "json?",
  "createdAt": "DateTime",
  "deletedAt": "DateTime?"
}
```
- Relation: `sample` (one-to-one)

### collection_samples (table: `collection_samples`)
```json
{
  "collectionId": "string (FK → collections.id)",
  "sampleId": "string (FK → samples.id)",
  "position": "int",
  "addedAt": "DateTime (default now)"
}
```
- PK: `(collectionId, sampleId)`
- Indexes: `index(collectionId, position)`

### collection_members (table: `collection_members`)
```json
{
  "id": "cuid (PK)",
  "collectionId": "string (FK → collections.id)",
  "userId": "string (FK → users.id)",
  "role": "OWNER | EDITOR | VIEW_ONLY",
  "createdAt": "timestamptz",
  "updatedAt": "timestamptz"
}
```
- Unique: `(collectionId, userId)`
- Indexes: `index(collectionId, role)`, `index(userId)`

### invites (planned)
Currently there is no `invites` table or invite tokens. Owners add members directly by user identity (see Members API). For a future invite workflow, a minimal schema could be:
```json
{
  "id": "cuid (PK)",
  "collectionId": "string (FK → collections.id)",
  "inviterId": "string (FK → users.id)",
  "targetEmail": "citext",
  "role": "EDITOR | VIEW_ONLY",
  "token": "string (unique)",
  "status": "PENDING | ACCEPTED | REJECTED | EXPIRED",
  "expiresAt": "DateTime",
  "createdAt": "DateTime",
  "updatedAt": "DateTime"
}
```
- Indexes: `unique(token)`, `index(collectionId, status)`, `index(targetEmail, status)`


## 5. API Endpoints

All responses are JSON. Successful responses wrap payloads as `{ "data": ... }`. Errors follow `{ "error": { "message": string, ... } }` with appropriate HTTP status.

Authentication: All routes except `/health` require auth. In development, mock auth is active; in production, Clerk middleware verifies JWTs.

### Health
- `GET /health`
  - Purpose: Health check and environment info
  - Auth: Not required
  - Response 200:
    ```json
    { "status": "ok", "environment": "development|production", "uptime": 12.34, "timestamp": "ISO" }
    ```

### Users
- `GET /users`
  - Purpose: List users
  - Auth: Required. Admins see all; others receive their own record
  - Query: `skip? number`, `take? number`
  - Response 200: `{ "data": User[] }`

- `GET /users/me`
  - Purpose: Return current user, creating a record if missing
  - Auth: Required
  - Response 200: `{ "data": User }`

- `PATCH /users/me/language`
  - Purpose: Update current user’s language preference
  - Auth: Required
  - Body: `{ "locale": "<language-code>" }`
  - Response 200: `{ "data": User }`

- `GET /users/:id`
  - Purpose: Get a user by ID
  - Auth: Required; must be self or admin
  - Response 200: `{ "data": User }`

- `POST /users`
  - Purpose: Create user entry (sync with Clerk identity)
  - Auth: Required; body `id` must match authenticated user
  - Body:
    ```json
    { "id": "string", "email": "string|null", "name": "string|null", "locale": "string|null" }
    ```
  - Response 201: `{ "data": User }`

- `PATCH /users/:id`
  - Purpose: Update user fields
  - Auth: Required; must be self or admin
  - Body: Any subset of updatable fields
  - Response 200: `{ "data": User }`

### Samples
- `GET /samples`
  - Purpose: List samples
  - Auth: Required
  - Query:
    - `userId? string` (admin only)
    - `collectionId? string` (members of that collection gain read access)
    - `skip? number`, `take? number`, `includeDeleted? boolean` (non-admin forced to false)
  - Response 200: `{ "data": Sample[] }`

- `GET /samples/:id`
  - Purpose: Get a single sample
  - Auth: Required; owner, admin, or collection member (via access check)
  - Response 200: `{ "data": Sample }`

- `POST /samples`
  - Purpose: Create a sample (and optionally link to collections)
  - Auth: Required; non-admins can only create for themselves
  - Body (subset):
    ```json
    {
      "userId": "string",
      "title": "string",
      "materialType": "string",
      "image?": { "storageProvider": "string", "objectKey": "string", "url": "string" },
      "collectionIds?": ["col_...", "col_..."]
    }
    ```
  - Response 201: `{ "data": Sample }` (with `collections` and `image` when present)

- `PATCH /samples/:id`
  - Purpose: Update a sample and/or reconcile collection links
  - Auth: Required; owner or admin for metadata; collection links validated against permissions
  - Body: Any subset of fields plus optional `collectionIds: string[]` to fully replace memberships
  - Response 200: `{ "data": Sample }`

- `DELETE /samples/:id`
  - Purpose: Soft-delete a sample; schedules cleanup tasks for objects and links
  - Auth: Required; owner or admin
  - Response 200: `{ "data": Sample }` (soft-deleted state)

### Collections
- `GET /collections`
  - Purpose: List collections visible to current user (owner or member)
  - Auth: Required
  - Query: `skip? number`, `take? number`
  - Response 200: `{ "data": Collection[] }`

- `GET /collections/:id`
  - Purpose: Get a collection with samples
  - Auth: Required; must be a member (any role)
  - Response 200: `{ "data": Collection }`

- `POST /collections`
  - Purpose: Create a collection (caller becomes OWNER member)
  - Auth: Required
  - Body: `{ "name": "string" }`
  - Response 201: `{ "data": Collection }`

- `PATCH /collections/:id`
  - Purpose: Update collection metadata (e.g., name)
  - Auth: Required; role OWNER
  - Body: `{ "name": "string" }`
  - Response 200: `{ "data": Collection }`

- `DELETE /collections/:id`
  - Purpose: Delete a collection
  - Auth: Required; role OWNER
  - Response 204: No content

- `POST /collections/:id/samples`
  - Purpose: Attach a sample to a collection
  - Auth: Required; roles OWNER or EDITOR; sample owner must be a member
  - Body: `{ "sampleId": "string" }`
  - Response 201: `{ "data": { sampleId, position, addedAt, sample? } }`

- `PATCH /collections/:id/samples/reorder`
  - Purpose: Reorder selected samples; unspecified remain after
  - Auth: Required; roles OWNER or EDITOR
  - Body: `{ "sampleIds": ["samp_1", "samp_2", ...] }`
  - Response 200: `{ "data": Collection }`

- `DELETE /collections/:id/samples/:sampleId`
  - Purpose: Detach a sample from a collection
  - Auth: Required; roles OWNER or EDITOR
  - Response 200: `{ "data": Collection }`

### Members (per-collection)
- `GET /collections/:id/members`
  - Purpose: List members for a collection
  - Auth: Required; any collection role
  - Response 200: `{ "data": CollectionMember[], "count": number }`

- `PATCH /collections/:id/members/:memberId`
  - Purpose: Change a member’s role
  - Auth: Required; role OWNER; cannot change OWNER’s role
  - Body: `{ "role": "EDITOR" | "VIEW_ONLY" }`
  - Response 200: `{ "data": CollectionMember }`

- `DELETE /collections/:id/members/:memberId`
  - Purpose: Remove a member
  - Auth: Required; role OWNER; cannot remove OWNER
  - Response 204: No content

### Invites (share links)
- `POST /collections/:id/invites`
  - Purpose: Create a shareable invite link (token) for the collection
  - Auth: Owner only
  - Body: `{ "role": "VIEW_ONLY" }`
  - Response 201: `{ "data": { id, token, role, status, expiresAt, deepLink, appStoreFallbackUrl, collection, inviter } }`
- `GET /invites/resolve?token=<token>`
  - Purpose: Public preview of invite metadata before login
  - Auth: None
  - Response 200: `{ "data": { id, collection, inviter, invitee, role, status, expiresAt } }`
- `POST /invites/:id/accept`
  - Purpose: Accept invite and join collection (role defaults to view-only unless owner later upgrades)
  - Auth: Logged-in user (Clerk JWT)
  - Body: `{}`
  - Response 200: `{ "data": { collectionId, role, status } }`
- `POST /invites/:id/reject`
  - Purpose: Decline invite
  - Auth: Logged-in user
  - Response 200: `{ "data": { collectionId, status } }`

### Uploads (S3 presign)
- `POST /uploads/presign`
  - Purpose: Create a pre-signed PUT URL to upload a sample image
  - Auth: Required
  - Body: `{ "contentType": "image/<type>", "extension?": "png|jpg|..." }`
  - Response 201: `{ "data": { key, uploadUrl, publicUrl, expiresIn, expiresAt, contentType } }`

- `POST /uploads/presign-download`
  - Purpose: Create a pre-signed GET URL for an existing object
  - Auth: Required; owners, admins, or authorized collection members
  - Body: `{ "objectKey": "samples/<userId>/<file>", "sampleId": "string", "collectionId?": "string" }`
  - Notes: Backend validates the `objectKey` against the `sampleId`, and enforces collection membership when provided. Admins may be allowed broader keys.
  - Response 200: `{ "data": { key, downloadUrl, expiresIn, expiresAt } }`


## 6. Authentication and Authorization

- Middleware Chain
  - Development: `mockAuthMiddleware` injects a test user; can be tuned via custom headers for roles and locale.
  - Production: `clerkAuthMiddleware` extracts tokens from `Authorization: Bearer <JWT>` or `__session` cookie and verifies with Clerk’s `verifyToken`.
  - `requireAuth` guard enforces presence of `req.authUser` on protected routes.

- Global Roles (from Clerk metadata)
  - `admin`: Elevated privileges (e.g., broad listing, bypass in some access checks)
  - `user`, `viewer`: Standard accounts

- Collection Roles (stored per membership)
  - `OWNER`: Full control, can manage metadata and membership
  - `EDITOR`: Manage content (attach/remove/reorder samples)
  - `VIEW_ONLY`: Read-only

- Authorization Model
  - Collection-level checks are centralized in service layer helpers. Typical gates:
    - Manage metadata: OWNER only
    - Manage content: OWNER or EDITOR
    - Read: Any member
  - Sample access:
    - Owners and admins have read access
    - Otherwise, users must be a member of a collection that contains the sample (server validates membership, optionally using `collectionId` for faster checks)


## 7. Invitation Flow

Current v1 behavior: Owners add members directly by searching an existing user (via sanitized name) and assigning `EDITOR` or `VIEW_ONLY`. There is no persisted invite or acceptance flow yet.

Planned security model for invites:
- Invitation Creation
  - Owner posts an email and desired role, backend creates an invite row with a one-time token and expiry; optional email delivery via provider.
- Acceptance / Rejection
  - Recipient opens tokenized link, authenticates with Clerk, and accepts or rejects. On acceptance, backend creates a `collection_members` row and marks the invite accepted.
- Expiration & Spam Prevention
  - Expiration enforced at creation (`expiresAt`), rate-limiting at API gateway (already present globally), and optional domain allowlists.


## 8. Deployment and Environment

- Node & Package Manager
  - Node.js >= 20
  - Package manager: pnpm (pinned in `package.json`)

- Build & Run
  - Local dev: `pnpm dev` (tsx watch), `pnpm prisma:migrate`, `pnpm prisma:generate`
  - Production: multi-stage Dockerfile builds TS → JS, prunes dev deps, runs `node dist/server.js`
  - Compose stack: app + Postgres for local/preview use

- HTTPS Support
  - Optional TLS termination inside the app via `HTTPS_CERT_PATH` + `HTTPS_KEY_PATH` (and optional `HTTPS_CA_PATH`); `FORCE_HTTPS_REDIRECT` triggers HTTP→HTTPS redirects.

- Environment Variables (validated via Zod in `src/config/env.ts`)

| Name | Required | Default | Notes |
|------|----------|---------|-------|
| `NODE_ENV` | no | `development` | `development` | `test` | `production` |
| `PORT` | no | `3000` | HTTP port |
| `DATABASE_URL` | yes | – | Postgres connection string |
| `UPLOAD_ROOT` | no | `storage/uploads` | Local uploads root (fallback) |
| `AWS_REGION` | no | `eu-central-1` | S3 region |
| `S3_BUCKET` | conditional | – | Required for S3 presign flows |
| `AWS_ACCESS_KEY_ID` | conditional | – | Optional if instance profile/role is used |
| `AWS_SECRET_ACCESS_KEY` | conditional | – | Optional if instance profile/role is used |
| `CDN_BASE_URL` | no | – | If set, presigned `publicUrl` uses this base |
| `LOG_LEVEL` | no | `debug` (dev) | `info` (prod) |
| `CLERK_PUBLISHABLE_KEY` | no | – | Required when Clerk is enabled |
| `CLERK_SECRET_KEY` | no | – | Required when Clerk is enabled |
| `CLEANUP_POLL_INTERVAL_MS` | no | `60000` | Cleanup scheduler interval |
| `HTTPS_CERT_PATH` | with key | – | Enable HTTPS when paired with key |
| `HTTPS_KEY_PATH` | with cert | – | Enable HTTPS when paired with cert |
| `HTTPS_CA_PATH` | no | – | Optional CA chain |
| `FORCE_HTTPS_REDIRECT` | no | `true` in prod | Enforce HTTPS redirects |

- Deployment Targets
  - Containerized runtime is suitable for EC2 (systemd or ECS), ECS/Fargate, or other orchestrators. S3 and a managed Postgres (RDS/Aurora) are recommended for production.


## 9. Future Improvements

- Invitations
  - Persisted invites with tokens, email delivery, acceptance/rejection, and expiration
- Notifications & Activity
  - Email/push notifications for membership changes and sample updates; audit logs
- Real-time Collaboration
  - WebSocket/SSE for collection updates and sample reordering
- Search & Indexing
  - Full-text search on samples and collections; faceted filters
- Media Pipeline
  - Server-side image processing, thumbnails, safety checks, and EXIF normalization
- Access & Governance
  - Granular permissions, organization/workspace model, collection ownership transfer
- Reliability
  - Idempotency keys for uploads, retries around S3 operations, dead-lettering for cleanup tasks
- Observability
  - Request tracing, metrics (Prometheus), and structured error taxonomy

---

References
- API reference: `docs/api-endpoints.md`
- iOS notes: `docs/ios-collection-members-endpoint.md`, `docs/ios-collection-presign-integration.md`
- Backend guidelines & roadmaps: `rules/backend-guidelines.md`, `rules/backend-roadmap.md`
