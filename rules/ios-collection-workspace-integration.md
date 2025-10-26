# iOS Workspace RBAC Integration Guide

This note packages the REST contracts the iOS client needs in order to support the new collaborative collection (workspace) behaviour.

## 1. Listing Working Collections

```
GET /collections
Authorization: Bearer <JWT>
```

Returns every collection where the signed-in user is a member (Owner/Editor/ViewOnly). Samples are returned in the existing structure.

### Response

```json
{
  "data": [
    {
      "id": "col_123",
      "name": "Client Boards",
      "userId": "user_owner",
      "samples": [
        {
          "sampleId": "samp_789",
          "position": 1,
          "addedAt": "2025-10-20T12:10:15.123Z",
          "sample": {
            "id": "samp_789",
            "userId": "user_owner",
            "title": "Calacatta Marble",
            "materialType": "stone",
            "isDeleted": false,
            "createdAt": "2025-10-19T09:42:11.567Z",
            "updatedAt": "2025-10-20T11:59:02.444Z"
          }
        }
      ],
      "createdAt": "2025-10-19T09:40:00.000Z",
      "updatedAt": "2025-10-20T11:59:02.444Z"
    }
  ]
}
```

## 2. Reading a Single Collection

```
GET /collections/{collectionId}
Authorization: Bearer <JWT>
```

Any member (Owner/Editor/ViewOnly) can access the details, returned in the same shape as the list response.

## 3. Managing Collection Members (Owner Only)

### 3.1 List Members

```
GET /collections/{collectionId}/members
Authorization: Bearer <JWT>
```

```json
{
  "data": [
    {
      "id": "cm_456",
      "collectionId": "col_123",
      "userId": "user_editor",
      "role": "EDITOR",
      "user": {
        "id": "user_editor",
        "email": "designer@example.com",
        "name": "Designer",
        "displayName": "Designer",
        "profileStatus": "COMPLETE",
        "locale": "en"
      },
      "createdAt": "2025-10-20T12:00:00.000Z",
      "updatedAt": "2025-10-20T12:00:00.000Z"
    }
  ],
  "count": 2
}
```

### 3.2 Invite Member

```
POST /collections/{collectionId}/members
Authorization: Bearer <JWT>
```

```json
{
  "name": "enes küçükoğlu",
  "role": "EDITOR"
}
```

Successful response mirrors the list payload. Role must be `EDITOR` or `VIEW_ONLY`; attempting to add an existing member returns `409`.

> **Önemli:** Modalda girilen ad, Cognito kullanıcı bilgilerinden normalize edilerek backend’de aranır. İsim bulunamazsa `404` döner, aynı ad iki farklı kullanıcıda varsa (olmamalı) `409` döner. İstemci tarafında ayrıca ID çözümlemesi yapmaya gerek yoktur.

### 3.3 Update Member Role

```
PATCH /collections/{collectionId}/members/{memberId}
Authorization: Bearer <JWT>
```

```json
{
  "role": "VIEW_ONLY"
}
```

Owner role cannot be changed (returns `400`).

### 3.4 Remove Member

```
DELETE /collections/{collectionId}/members/{memberId}
Authorization: Bearer <JWT>
```

Removes the member (`204 No Content`). Owner cannot remove themselves.

## 4. Editing Collection Content

Owner and Editor roles can call the existing sample-link endpoints; ViewOnly receives `403`.

- Add sample: `POST /collections/{collectionId}/samples` with `{ "sampleId": "samp_123" }`.
- Reorder samples: `PATCH /collections/{collectionId}/samples/reorder` with `{ "sampleIds": ["samp_456","samp_123"] }`.
- Remove sample: `DELETE /collections/{collectionId}/samples/{sampleId}`.

Responses reuse the historical structures (collection summary with samples).

## 5. Sample Creation With Workspace Awareness

`POST /samples` now enforces membership when the caller attempts to attach a sample to collections:

```json
{
  "title": "New Tile",
  "materialType": "tile",
  "collectionIds": ["col_123"]
}
```

- Non-admin users must be Owner/Editor in each collection listed.
- When the request succeeds, backend attaches the new sample after creation.

## 6. Role Matrix (for client gating)

| Action                        | Owner | Editor | ViewOnly |
|------------------------------|:-----:|:------:|:--------:|
| List/read collections        |  ✅   |   ✅   |    ✅    |
| Add/update/remove samples    |  ✅   |   ✅   |    ❌    |
| Reorder samples              |  ✅   |   ✅   |    ❌    |
| Invite/update/remove members |  ✅   |   ❌   |    ❌    |
| Delete collection            |  ✅   |   ❌   |    ❌    |
