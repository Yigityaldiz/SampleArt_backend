# Invite Default Role Refactor — Microtasks

- [x] Remove `identifier` from `createInviteBodySchema` and default the request body role to `VIEW_ONLY` when omitted.
- [x] Adjust `InviteService.createInvite` to support invites without a predefined target (skip user lookup, duplicate checks, and rate limits when no identifier is supplied).
- [x] Ensure invite creation no longer depends on target-specific repository helpers (any remaining duplicate/rate logic safely handles `null` invitee fields).
- [x] Modify auditing and notification payloads so they cope with missing identifier details.
- [x] Add or update tests covering invite creation with and without identifiers, verifying default role assignment and invitation acceptance flow.
- [x] Review iOS/backend documentation (`docs/ios-invite-endpoints.md`, etc.) to reflect the simplified request payload and default role behaviour.
- [x] Remove legacy username-based collection member invite endpoint and related service/tests/docs.
