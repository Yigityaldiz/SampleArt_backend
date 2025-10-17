# iOS Integration — Collection Invite Share Flow

## 1. Create Invite Link (Owner Only)
- **Endpoint:** `POST /collections/{collectionId}/invites`
- **Headers:**  
  - `Authorization: Bearer <Clerk JWT>`  
  - `Content-Type: application/json`
- **Body:** Required. Always send `{ "role": "VIEW_ONLY" }` to keep a consistent payload (backend enforces `VIEW_ONLY` and rejects `OWNER`).

### Example Request
```http
POST /collections/col_123/invites
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "VIEW_ONLY"
}
```

### Example Response
```json
{
  "data": {
    "id": "inv_123",
    "token": "inv_abcd1234",
    "role": "VIEW_ONLY",
    "status": "PENDING",
    "expiresAt": "2024-11-15T10:00:00.000Z",
    "deepLink": "sampleart://invite/inv_abcd1234",
    "appStoreFallbackUrl": "https://apps.apple.com/app/id6749925767",
    "collection": {
      "id": "col_123",
      "name": "Modern Marbles"
    },
    "inviter": {
      "id": "user_owner",
      "email": "owner@example.com",
      "name": "Owner"
    }
  }
}
```

**Client Action:** Present the deep link in the native share sheet (Messages, Mail, etc.). If the app is not installed, iOS redirects to the App Store fallback URL.

## 2. Resolve Invite (Public Preview)
- **Endpoint:** `GET /invites/resolve?token={token}`
- **Auth:** Not required.
- **Purpose:** Display invite details before login.

### Example Response
```json
{
  "data": {
    "id": "inv_123",
    "collection": { "id": "col_123", "name": "Modern Marbles" },
    "inviter": { "id": "user_owner", "name": "Owner", "email": "owner@example.com" },
    "invitee": null,
    "role": "VIEW_ONLY",
    "status": "PENDING",
    "expiresAt": "2024-11-15T10:00:00.000Z"
  }
}
```

## 3. Accept Invite (Signed-in User)
- **Endpoint:** `POST /invites/{inviteId}/accept`
- **Headers:** `Authorization: Bearer <Clerk JWT>`
- **Body:** `{}` (empty)
- **Response:**
```json
{
  "data": {
    "collectionId": "col_123",
    "role": "VIEW_ONLY",
    "status": "ACCEPTED"
  }
}
```
The backend records collection membership. Owners can later promote members within the app.

## 4. Reject Invite (Signed-in User)
- **Endpoint:** `POST /invites/{inviteId}/reject`
- **Headers:** `Authorization: Bearer <Clerk JWT>`
- **Body:** `{}` (empty)
- **Response:**
```json
{
  "data": {
    "collectionId": "col_123",
    "status": "REJECTED"
  }
}
```

## 5. Integration Checklist
1. When owner taps “Share,” call `POST /collections/{id}/invites`.
2. Launch the share sheet using the returned `deepLink`.
3. If the invitee is not signed in, open the app via deep link → app fetches `GET /invites/resolve?token=...`.
4. After login, user accepts via `POST /invites/{inviteId}/accept`.
5. Collection owner manages roles post-acceptance.

## 6. Error Notes
- `400` if `role` is `OWNER`.
- `403` if the caller lacks `OWNER` role or the invitee mismatch occurs during accept.
- `404` when invite/token is not found.
- `409` if invite already processed.
- `410` when invite expired (resolve/accept/reject).
- `429` when invite creation exceeds 5 invites per 10 minutes per owner.
