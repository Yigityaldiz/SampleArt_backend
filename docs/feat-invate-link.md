## Phase 1 — Database & Models

### 🧩 Task 1.1 — Add `invites` table

- [x] Add Prisma model `Invite` with fields: `id`, `collectionId`, `inviterId`, `inviteeUserId?`, `inviteeUsername?`, `inviteeEmail?`, `role`, `token`, `status`, `expiresAt`, `createdAt`, `updatedAt`.
- [x] Enum `InviteStatus`: `PENDING | ACCEPTED | REJECTED | EXPIRED`.
- [x] Indexes: `(collectionId, status)`, `unique(token)`.

### 🧩 Task 1.2 — Add `audit_logs` table

- [x] Model: `id`, `actorId`, `action`, `collectionId?`, `targetUserId?`, `metadata`, `createdAt`.
- [x] Used for logging invite creation, acceptance, rejections.

### 🧩 Task 1.3 — Prisma migration

- [ ] Run `prisma migrate dev` to create new tables.
- [x] Update `schema.prisma` and seed script.

---

## Phase 2 — Service Layer

### ⚙️ Task 2.1 — Create `InviteService`

- [x] Methods:
  - `createInvite(collectionId, inviterId, role?)`
  - `resolveInvite(token)`
  - `acceptInvite(inviteId, userId)`
  - `rejectInvite(inviteId, userId)`
  - `expireInvites()` (used by scheduler)

- [x] Validations:
  - Enforce rate limiting per inviter (5 invites / 10 dakika).
  - Handle expiration and acceptance conflicts gracefully.

### ⚙️ Task 2.2 — Create `AuditLogService`

- [x] Method: `log(actorId, action, collectionId?, targetUserId?, metadata?)`.
- [x] Write on invite create/accept/reject.

---

## Phase 3 — Routes & Controllers

### 🌐 Task 3.1 — `POST /collections/:id/invites`

- [x] Auth: OWNER role required.
- [x] Body: `{ "role": "VIEW_ONLY" }` (required; backend enforces this role).
- [x] Logic:
  - [x] Create invite token (short random ID).
  - [x] Save invite with `PENDING` status and TTL (7 days) as a shareable link (no pre-assigned invitee).
  - [x] Return `{ inviteUrl, appStoreFallbackUrl }` with deep link payload.
  - [x] Client surfaces the **deep link** via native share sheet; App Store fallback handles missing app installs.

### 🌐 Task 3.2 — `GET /invites/resolve?token=<t>`

- [x] Public endpoint (auth optional).
- [x] Returns invite metadata:

  ```json
  {
    "data": {
      "collection": { "id": "col_123", "name": "Modern Marbles" },
      "inviter": { "username": "yigityaldiz" },
      "role": "VIEW_ONLY",
      "status": "PENDING"
    }
  }
  ```

- [x] Used by mobile app to show “Join this collection?” screen.

### 🌐 Task 3.3 — `POST /invites/:id/accept`

- [x] Auth required.
- [x] Validate token & ownership → if valid:
  - [x] Create/update `collection_member` as needed.
  - [x] Mark invite `ACCEPTED`.
  - [x] Log `INVITE_ACCEPTED`.
  - [x] Return `{ data: { collectionId, role } }`.

### 🌐 Task 3.4 — `POST /invites/:id/reject`

- [x] Auth required.
- [x] Mark invite `REJECTED`.
- [x] Log `INVITE_REJECTED`.

### 🌐 Task 3.5 — Cron: Expire invites

- [x] Scheduler runs every hour.
- [x] Marks invites `EXPIRED` where `expiresAt < now()`.
- [x] Logs `INVITE_EXPIRED`.

---

## Phase 4 — Helpers & Security

### 🔐 Task 4.1 — Token Generator

- [x] Create `generateInviteToken(length = 16)` → nanoid-based.
- [x] Ensure uniqueness via database lookup.

### 🔐 Task 4.2 — Rate Limiter

- [x] Enforce 5 invites / 10 min / inviter (paylaşım linki üretimi).

### 🔐 Task 4.3 — Message/Notification Stub

- [x] Send invite message containing **deep link** (stub logs payload).

- [x] Example message handled by stub; iOS fallback URL included.

### 🔐 Task 4.4 — Middleware: Invite Auth Validation

- [x] Ensure only OWNERs can create invites.
- [x] Ensure accepting user matches `inviteeUserId` or verified email.

---

## Phase 5 — Deep Link Support (App Store only)

### 📱 Task 5.1 — Generate Deep Link URLs

- [x] Replace web URL with App Store fallback:

  ```ts
  const deepLink = `sampleart://invite/${token}`;
  const appStoreFallbackUrl = `https://apps.apple.com/app/id6749925767`;
  ```

- [x] Always return both values to client.

### 📱 Task 5.2 — Resolve Endpoint (App use)

- [x] Add `GET /invites/resolve?token=<t>` → public data for pre-login display.
- [x] Include inviter name, collection name, and role.

### 📱 Task 5.3 — Accept after Login

- [x] App uses Clerk JWT → backend verifies token.
- [x] Accept flow continues normally.

---

## Phase 6 — Testing & Validation

### ✅ Task 6.1 — Unit Tests

- InviteService methods (create, resolve, accept, reject).
- Invite expiration scheduler.

### ✅ Task 6.2 — Integration Tests

- End-to-end: create → resolve → accept.
- Invalid token, expired token, already accepted.

### ✅ Task 6.3 — Security Tests

- [x] Share links default to `VIEW_ONLY`; owner can upgrade roles after members join.
- [x] Unauthorized access.
- [x] Rate limit enforcement.

---

## Phase 7 — Documentation & Cleanup

### 📘 Task 7.1 — Update ARCHITECTURE.md

- Add new Invite endpoints.
- Document token flow, deep link (App Store-only).

### 📘 Task 7.2 — Update Postman / Insomnia collection

- Add `createInvite`, `resolve`, `accept`, `reject` requests.

### 📘 Task 7.3 — Add Developer Notes

## iOS Integration Checklist

### Create invite (OWNER only)
- Endpoint: `POST /collections/:collectionId/invites`
- Headers: `Authorization: Bearer <Clerk JWT>`, `Content-Type: application/json`
- Body: `{ "role": "VIEW_ONLY" }` (required; backend always stores the invite as `VIEW_ONLY` and rejects `OWNER`).
- Success 201 payload:
  ```json
  {
    "data": {
      "id": "inv_123",
      "token": "inv_abcd...",
      "role": "VIEW_ONLY",
      "status": "PENDING",
      "expiresAt": "2024-11-15T10:00:00.000Z",
      "deepLink": "sampleart://invite/inv_abcd...",
      "appStoreFallbackUrl": "https://apps.apple.com/app/id6749925767",
      "collection": { "id": "col_123", "name": "Modern Marbles" },
      "inviter": { "id": "user_owner", "email": "owner@example.com", "name": "Owner" }
    }
  }
  ```

### Resolve invite (public)
- Endpoint: `GET /invites/resolve?token=<token>`
- No auth header required.
- Success 200 payload:
  ```json
  {
    "data": {
      "id": "inv_123",
      "collection": { "id": "col_123", "name": "Modern Marbles" },
      "inviter": { "id": "user_owner", "email": "owner@example.com", "name": "Owner" },
      "invitee": null,
      "role": "VIEW_ONLY",
      "status": "PENDING",
      "expiresAt": "2024-11-15T10:00:00.000Z"
    }
  }
  ```

### Accept invite (logged-in user)
- Endpoint: `POST /invites/:inviteId/accept`
- Headers: `Authorization: Bearer <Clerk JWT>`, `Content-Type: application/json`
- Body: empty `{}`
- Success 200 payload:
  ```json
  {
    "data": {
      "collectionId": "col_123",
      "role": "VIEW_ONLY",
      "status": "ACCEPTED"
    }
  }
  ```

### Reject invite (logged-in user)
- Endpoint: `POST /invites/:inviteId/reject`
- Headers: `Authorization: Bearer <Clerk JWT>`
- Body: empty `{}`
- Success 200 payload:
  ```json
  {
    "data": {
      "collectionId": "col_123",
      "status": "REJECTED"
    }
  }
  ```

- Write short `docs/invites-flow.md` explaining token + deep link lifecycle.

---

## ✅ Final Output Summary

After completing all microtasks:

- Owners share invite links; collaborators join with view-only access and can be upgraded later.
- Each invite generates a **deep link** → opens iOS app (redirects to App Store if not installed).
- Accepting joins the collection, rejecting cancels it.
- System protected by rate limiting, expiration, and audit logging.
