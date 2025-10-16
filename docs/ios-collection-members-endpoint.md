# iOS Integration Notes — Collection Members Endpoint

## Endpoint
- `GET /collections/:collectionId/members`
- Requires the standard authenticated headers (e.g., bearer token).

## Response Shape
```json
{
  "data": [
    {
      "id": "cmem_456",
      "collectionId": "col_123",
      "userId": "usr_789",
      "role": "EDITOR",
      "user": {
        "id": "usr_789",
        "email": "member@example.com",
        "name": "Member Name",
        "displayName": "Member Name",
        "profileStatus": "ACTIVE",
        "locale": "tr-TR"
      },
      "createdAt": "2024-06-15T12:34:56.000Z",
      "updatedAt": "2024-06-16T09:15:00.000Z"
    }
  ],
  "count": 1
}
```

## Notes for Client
- `role` can be `OWNER`, `EDITOR`, or `VIEW_ONLY`.
- `displayName` already resolves to either the full name, email prefix, or a fallback identifier (`user-xxxxxx`).
- Handle `profileStatus` as a string enum coming from the backend.
