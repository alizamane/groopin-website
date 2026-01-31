# Groopin Web Chat Implementation (landing-vercel)

This document explains how chat is implemented in the Groopin web app (landing-vercel), and describes the contracts a mobile app must follow to implement the same chat behavior.

## 1) Purpose and scope

This is a full technical reference for:
- API endpoints used by the web chat
- Realtime events (Pusher + Laravel Echo)
- Web chat behavior, including optimistic UI and polling
- Step-by-step flows for each feature (read, react, typing, poll, etc.)

## 2) Architecture summary

The web chat uses:
- REST API for initial data, pagination, and mutations (send, read, react, poll, pin, delete).
- Realtime (Pusher + Laravel Echo) for live updates.
- Polling fallback every 6 seconds to keep state consistent and to update polls.

Mobile can reuse the same REST endpoints and realtime events. Only the client implementation changes.

## 3) Key files (web and backend)

Web (landing-vercel):
- `landing-vercel/app/app/auth/conversations/[id]/page.jsx` - chat screen logic
- `landing-vercel/app/lib/api-client.js` - API wrapper, headers, caching
- `landing-vercel/app/lib/realtime-client.js` - Laravel Echo + Pusher client
- `landing-vercel/WEB_APP_API_REFERENCE.md` - endpoint summary

Backend (Laravel):
- `BACKEND/groopin-backend/app/Http/Controllers/Api/MessageController.php`
- `BACKEND/groopin-backend/app/Events/Messages/*Event.php`
- `BACKEND/groopin-backend/routes/api.php`
- `BACKEND/groopin-backend/routes/channels.php`

## 4) Environment and base URLs (web)

Required for realtime:
- `NEXT_PUBLIC_PUSHER_KEY`
- `NEXT_PUBLIC_PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_HOST` (optional)
- `NEXT_PUBLIC_PUSHER_PORT` (optional)
- `NEXT_PUBLIC_PUSHER_SCHEME` (optional)

Required for REST:
- `NEXT_PUBLIC_API_URL` (example: `https://tajrib.groopin.io/api`)

Important: `NEXT_PUBLIC_API_URL` must include `/api`. The realtime auth endpoint is:
`{NEXT_PUBLIC_API_URL}/broadcasting/auth`

## 5) Auth and headers

All chat endpoints require a Bearer token. The web API client sends:
- `Accept: application/json`
- `Accept-Language: <locale>`
- `Authorization: Bearer <token>`
- `Content-Type: application/json` (when body exists)

## 6) Data models (lite mode)

The web uses `?lite=1` for most chat endpoints to minimize payload size.

### 6.1 MessageLite
```json
{
  "id": 123,
  "content": "Hello",
  "type": "text",
  "automatic": false,
  "created_at": "2026-01-31 12:34:56",
  "user": {
    "id": 9,
    "first_name": "Amina",
    "last_name": "R",
    "name": "Amina R",
    "avatar_image_url": "https://.../avatar.jpg",
    "uses_default_image": false
  },
  "reply_to": {
    "id": 120,
    "content": "Previous message",
    "type": "text",
    "user": { "id": 5, "first_name": "Omar", "last_name": "S", "name": "Omar S" }
  },
  "reactions": [ { "emoji": "U+2764", "count": 2 } ],
  "my_reaction": null,
  "poll": null
}
```

Notes:
- `type` is usually `"text"` or `"poll"`.
- `automatic` messages are system messages from the server.
- `reply_to` is optional and includes a minimal user object.

### 6.2 Poll shape (when `type = "poll"`)
```json
{
  "id": 55,
  "allow_multiple": false,
  "allow_change": true,
  "closed_at": null,
  "is_closed": false,
  "options": [
    { "id": 201, "label": "Option A", "votes_count": 3 },
    { "id": 202, "label": "Option B", "votes_count": 1 }
  ],
  "my_votes": [201]
}
```

### 6.3 Read state (from meta.read_states)
```json
{
  "id": 2,
  "first_name": "Sara",
  "last_name": "K",
  "name": "Sara K",
  "avatar_image_url": "https://.../avatar.jpg",
  "uses_default_image": false,
  "last_read_message_id": 123,
  "last_read_at": "2026-01-31 12:40:10"
}
```

### 6.4 ConversationLite (used in list)
```json
{
  "id": 18,
  "offer_id": 42,
  "last_message_at": "2026-01-31 12:40:00",
  "unread_messages": 2,
  "has_unread_messages": true,
  "has_unread_messages_count": 1,
  "offer": {
    "id": 42,
    "title": "Hike in Agafay",
    "participants_count": 5,
    "owner": { "id": 2, "first_name": "Sara", "last_name": "K" },
    "participants": [
      { "id": 2, "first_name": "Sara", "last_name": "K" }
    ]
  },
  "last_message": {
    "id": 123,
    "content": "See you there",
    "automatic": false,
    "created_at": "2026-01-31 12:38:11",
    "user": { "id": 2, "first_name": "Sara", "last_name": "K" }
  }
}
```

## 7) HTTP API endpoints (with examples)

All URLs below are relative to `NEXT_PUBLIC_API_URL`, for example:
`https://tajrib.groopin.io/api`

### 7.1 List conversations (cursor pagination)
```
GET /conversations?lite=1&cursor=<cursor>
```
Response:
```json
{
  "data": [ { "id": 18, "...": "ConversationLite" } ],
  "meta": {
    "has_unread_messages": true,
    "has_unread_messages_count": 3,
    "next_cursor": "eyJ...",
    "prev_cursor": null
  }
}
```

### 7.2 Get messages (page pagination)
```
GET /conversations/18/messages?lite=1&page=1
```
Notes:
- Uses page pagination (not cursor).
- Server returns newest first; web sorts ascending for display.
- The backend also marks the conversation as read when messages are loaded.

Response:
```json
{
  "data": [
    { "id": 123, "...": "MessageLite" },
    { "id": 122, "...": "MessageLite" }
  ],
  "meta": {
    "conversation": {
      "id": 18,
      "last_message_at": "2026-01-31 12:40:00",
      "offer": {
        "id": 42,
        "title": "Hike in Agafay",
        "owner_id": 2,
        "owner": { "id": 2, "first_name": "Sara", "last_name": "K" }
      }
    },
    "unread_messages": 0,
    "read_states": [ { "...": "Read state" } ],
    "pagination": {
      "current_page": 1,
      "last_page": 3,
      "per_page": 15,
      "total": 42,
      "next_page_url": "https://.../conversations/18/messages?page=2",
      "prev_page_url": null,
      "has_more": true
    },
    "pinned_message": null
  }
}
```

### 7.3 Send a message (text)
```
POST /conversations/18/messages?lite=1
Content-Type: application/json

{
  "content": "Hello everyone",
  "reply_to_message_id": null
}
```
Response:
```json
{ "data": { "id": 124, "...": "MessageLite" } }
```

### 7.4 Send a poll message (offer owner only)
```
POST /conversations/18/messages?lite=1
Content-Type: application/json

{
  "content": "Which time works best?",
  "type": "poll",
  "poll": {
    "options": ["9:00", "10:00", "11:00"],
    "allow_multiple": false,
    "allow_change": true
  }
}
```
Response:
```json
{
  "data": {
    "id": 200,
    "type": "poll",
    "poll": { "...": "Poll shape" }
  }
}
```

### 7.5 Vote on a poll
```
POST /conversations/18/messages/200/poll-votes
Content-Type: application/json

{ "option_id": 201 }
```
Or multi-select:
```
{ "option_ids": [201, 202] }
```
Response:
```json
{
  "data": {
    "message_id": 200,
    "poll": { "...": "Poll shape" }
  }
}
```

### 7.6 Close a poll (offer owner only)
```
POST /conversations/18/messages/200/poll-close
```
Response:
```json
{
  "data": {
    "message_id": 200,
    "poll": { "...": "Poll shape (is_closed = true)" }
  }
}
```

### 7.7 Typing indicator
```
POST /conversations/18/typing
Content-Type: application/json

{ "is_typing": true }
```
Response:
```json
{ "data": { "conversation_id": 18, "is_typing": true } }
```

### 7.8 Mark as read
```
POST /conversations/18/read
Content-Type: application/json

{ "message_id": 124 }
```
Response:
```json
{
  "data": {
    "conversation_id": 18,
    "message_id": 124,
    "read_at": "2026-01-31 12:45:10"
  }
}
```

### 7.9 React to a message
```
POST /conversations/18/messages/124/reactions
Content-Type: application/json

{ "emoji": "U+2764" }
```
Response:
```json
{
  "data": {
    "conversation_id": 18,
    "message_id": 124,
    "emoji": "U+2764",
    "action": "added",
    "reactions": [ { "emoji": "U+2764", "count": 2 } ],
    "my_reaction": "U+2764"
  }
}
```

### 7.10 Pin / unpin a message (offer owner only)
```
POST /conversations/18/messages/124/pin
DELETE /conversations/18/messages/124/pin
```
Response:
```json
{ "data": { "conversation_id": 18, "message_id": 124 } }
```

### 7.11 Delete a message
```
DELETE /conversations/18/messages/124
```
Response: `204 No Content`

## 8) Realtime (Pusher + Laravel Echo)

### 8.1 Auth flow for private channels
Pusher private channels require a server auth step:

Request:
```
POST /broadcasting/auth
Content-Type: application/json
Authorization: Bearer <token>

{ "socket_id": "123.456", "channel_name": "private-App.Models.User.9" }
```

Response:
```json
{ "auth": "pusher_auth_token" }
```

### 8.2 Channel naming
Web subscribes using:
```
echo.private("App.Models.User.{userId}")
```
Echo automatically uses the underlying channel name:
```
private-App.Models.User.{userId}
```

### 8.3 Events used by chat

The web listens with:
```
channel.listen(".message:created", handler)
```

**message:created**
- Triggered when a message is created.
- Broadcast to all participants except the sender.
- Payload includes `message` (MessageResource shape).
```json
{
  "message": {
    "id": 124,
    "content": "Hello",
    "type": "text",
    "automatic": false,
    "created_at": "2026-01-31 12:44:56",
    "user": { "id": 9, "first_name": "Amina", "last_name": "R" },
    "conversation": { "id": 18 },
    "reply_to": null,
    "poll": null
  }
}
```

**message:read**
- Triggered after a participant marks read.
```json
{
  "conversation_id": 18,
  "message_id": 124,
  "user": { "id": 2, "first_name": "Sara", "last_name": "K" },
  "read_at": "2026-01-31 12:45:10"
}
```

**message:typing**
- Triggered when a participant is typing.
```json
{
  "conversation_id": 18,
  "user": { "id": 2, "first_name": "Sara", "last_name": "K" },
  "is_typing": true
}
```

**message:reaction**
- Triggered when a reaction is added/removed/updated.
```json
{
  "conversation_id": 18,
  "message_id": 124,
  "emoji": "U+2764",
  "action": "added",
  "user": { "id": 2, "first_name": "Sara", "last_name": "K" },
  "reactions": [ { "emoji": "U+2764", "count": 2 } ]
}
```

**message:poll**
- Triggered when a poll is voted or closed.
```json
{
  "conversation_id": 18,
  "message_id": 200,
  "action": "voted",
  "poll": { "...": "Poll shape" }
}
```
Notes:
- `poll.my_votes` is intentionally omitted in realtime payloads.
- Clients should preserve their local `my_votes` when merging poll updates.

**message:pin**
- Triggered when a message is pinned or unpinned.
```json
{
  "conversation_id": 18,
  "message_id": 124,
  "action": "pinned",
  "pinned_message": { "id": 124, "content": "Hello", "type": "text" }
}
```
Notes:
- `pinned_message` only includes minimal fields needed for preview.
- If the full message is already in memory, prefer using the cached message object.

**message:deleted**
- Triggered when a message is deleted.
```json
{
  "conversation_id": 18,
  "message_id": 124
}
```

## 9) Web chat behavior (implementation details)

This section describes how the web actually manages state, so mobile can copy the same logic.

### 9.1 Local state and normalization
The web keeps:
- `messages`: array of message objects
- `readStates`: array of read states for each participant
- `typingUsers`: users currently typing
- `pinnedMessage`
- `pagination` (`currentPage`, `lastPage`, `hasMore`)

Every incoming payload is normalized:
- Ensures `type`, `automatic`, `reactions`, `my_reaction`, `poll` are defined
- Normalizes `user` and `reply_to` shape
- Converts ids to numbers where needed

### 9.2 Ordering and deduplication
- Server returns messages newest first; UI sorts ascending by `created_at`.
- `mergeMessagesById()` merges by `id` to prevent duplicates.
- Incoming realtime messages are ignored if already present.

### 9.3 Polling and refresh
- Every 6 seconds, the web re-fetches page 1.
- If data signature did not change and no temp messages exist, it skips heavy updates.
- If temp messages exist, it tries to reconcile them with server messages by:
  - same author
  - same content
  - timestamps within ~15 seconds

### 9.4 Optimistic messages
On send:
- A temp message with `id = temp-<timestamp>` is inserted.
- On success, the temp message is replaced by the server message.
- On failure, the temp message is removed and an error is shown.

### 9.5 Read receipts rendering
The UI computes "seen" by comparing:
- `readStates[*].last_read_message_id` to each message `id`
- If all other readers have read beyond a message, it shows a stronger "seen" state.

### 9.6 Typing throttling
- Sends `is_typing: true` only if at least 2 seconds passed since last send.
- Sends `is_typing: false` after ~2.5 seconds of inactivity.
- Typing indicators auto-clear after ~3.5 seconds in UI.

### 9.7 Pinned message behavior
- `meta.pinned_message` is shown at top.
- If the pinned message is not in memory, the web paginates older pages until it finds it.

### 9.8 API caching in web
`api-client.js` caches GET responses by default, but chat calls use `cache: false` to avoid stale messages.

## 10) Feature flows (step-by-step)

These flows describe what to call, what to store, and how to update UI.

### 10.1 Load conversation + messages
1) `GET /conversations/{id}/messages?lite=1&page=1`
2) Build header from `meta.conversation` (offer/title/owner).
3) Set `readStates` from `meta.read_states`.
4) Show `meta.pinned_message` if present.
5) Sort messages by `created_at` ascending.
6) Start polling refresh every 6 seconds.

### 10.2 Pagination (load older)
1) Detect scroll near top.
2) `GET /conversations/{id}/messages?lite=1&page=<next>`
3) Merge by id and keep scroll position.

### 10.3 Send message (text)
1) Insert temp message into UI.
2) `POST /conversations/{id}/messages?lite=1` with `{ content, reply_to_message_id? }`
3) Replace temp with server response.
4) Other participants receive `message:created`.

### 10.4 Reply to message
1) User selects a message -> store `replyToMessage`.
2) On send, include `reply_to_message_id`.
3) Render `reply_to` preview from the API response.

### 10.5 Typing indicator
1) On input change, send `POST /conversations/{id}/typing` with `{ is_typing: true }` (throttled).
2) After idle, send `{ is_typing: false }`.
3) Show typing labels from `message:typing`.
4) Auto-clear when no update after a short timeout.

### 10.6 Read receipts
1) When latest visible message changes, send:
   - `POST /conversations/{id}/read` with `{ message_id }`
2) Backend updates pivot (unread counts, last_read_message_id, last_read_at).
3) Other users receive `message:read` event.
4) UI updates seen state.

### 10.7 Reactions
1) `POST /conversations/{id}/messages/{messageId}/reactions` with `{ emoji }`
2) API returns updated reactions + `my_reaction`.
3) Broadcast `message:reaction` updates other clients.
4) Update local message reactions.

### 10.8 Polls (create, vote, close)
**Create poll**
1) Only offer owner can create polls.
2) `POST /conversations/{id}/messages?lite=1` with:
   - `type: "poll"`
   - `content` = question
   - `poll.options` (2-10 unique options)
   - `poll.allow_multiple`, `poll.allow_change`
3) UI renders poll from `message.poll`.

**Vote**
1) Single select: `POST /messages/{messageId}/poll-votes` with `{ option_id }`
2) Multi select: `POST /messages/{messageId}/poll-votes` with `{ option_ids: [...] }`
3) Update local poll with response data.
4) Other participants receive `message:poll` realtime updates (polling still acts as fallback).
5) When merging realtime poll updates, keep local `my_votes` (not provided in event).

**Close poll**
1) Owner only: `POST /messages/{messageId}/poll-close`
2) Update local poll with response data (closed).

### 10.9 Pin / unpin a message
**Pin**
1) `POST /conversations/{id}/messages/{messageId}/pin`
2) Set `pinned_message` in UI.

**Unpin**
1) `DELETE /conversations/{id}/messages/{messageId}/pin`
2) Clear `pinned_message`.

### 10.10 Delete a message
1) `DELETE /conversations/{id}/messages/{messageId}`
2) Remove locally; other clients will see it on next refresh (no realtime event).

### 10.11 Conversation list updates
1) On `message:created`, update the conversation list item:
   - `last_message`
   - `last_message_at`
   - `has_unread_messages`
2) If current conversation is open, also append the message to the thread.

## 11) Validation rules and error cases

Common error shapes:
- `422` with `{ "message": "...", "errors": { "field": ["..."] } }`
- `403` when user is not allowed (not participant or not owner)
- `404` when conversation/message/reply target not found
- `409` for poll locked (allow_change = false)

Key validations (from backend):
- Send message:
  - `content` required
  - `type` must be `"text"` or `"poll"`
  - `reply_to_message_id` must exist in this conversation
- Poll creation:
  - options required (2-10)
  - option text length limited (160)
  - only offer owner can create poll
- Poll vote:
  - option(s) must exist
  - poll cannot be closed
  - if allow_change is false and user already voted, returns 409
- Reactions:
  - `emoji` required, max length 16
- Read / typing:
  - must be a participant of the conversation

## 12) Mobile implementation checklist (reuse web contracts)

To implement mobile chat that matches the web:
1) Use REST endpoints exactly as listed (lite mode for performance).
2) Subscribe to `private-App.Models.User.{id}` with Pusher or Reverb.
3) Listen to `message:created`, `message:read`, `message:typing`, `message:reaction`, `message:poll`, `message:pin`, `message:deleted`.
4) Implement polling or periodic refresh to cover missed events and keep polls consistent.
5) Sort messages by `created_at` ascending for display.
6) Call `POST /conversations/{id}/read` when the last message is visible.
7) Use optimistic UI for send and reconcile with server response.
8) Handle pagination with page-based requests (messages).
