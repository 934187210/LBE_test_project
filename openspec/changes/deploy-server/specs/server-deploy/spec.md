# server-deploy

## ADDED Requirements

### Requirement: HTTPS front-end service
The nginx server on port 443 SHALL serve static files from `/var/www/locateroom` over TLS.

#### Scenario: Browser loads the front-end page
- **WHEN** user navigates to `https://114.55.135.92/`
- **THEN** nginx returns the index.html and associated assets over TLS 1.2+

#### Scenario: Invalid TLS handshake
- **WHEN** browser initiates TLS handshake with invalid certificate
- **THEN** nginx terminates the connection; no fallback to plain HTTP

### Requirement: WSS signaling proxy
The nginx server SHALL forward WebSocket connections at `/ws` path to the signaling server at `127.0.0.1:8080` without TLS termination.

#### Scenario: WebSocket upgrade request
- **WHEN** client sends `Upgrade: websocket` and `Connection: Upgrade` headers to `wss://114.55.135.92/ws`
- **THEN** nginx proxies the request to `http://127.0.0.1:8080` with the same headers intact

#### Scenario: Non-websocket request to /ws
- **WHEN** client sends a plain HTTP GET to `/ws`
- **THEN** nginx returns 400 Bad Request

### Requirement: Signaling server process management
The signaling-server.js process SHALL be managed by pm2 and automatically restart after crashes.

#### Scenario: Process crash
- **WHEN** the node process running signaling-server.js exits unexpectedly
- **THEN** pm2 automatically restarts the process within 1 second

#### Scenario: System reboot
- **WHEN** the server machine restarts
- **THEN** pm2 restores all managed processes via `pm2 save` / `pm2 startup`

### Requirement: Heartbeat keepalive
The signaling server SHALL maintain WebSocket connections alive via client-side ping every 5 seconds, and remove peers after 15 seconds of no heartbeat.

#### Scenario: Peer heartbeat timeout
- **WHEN** a peer does not send a `pong` (or any message) for 15 seconds
- **THEN** the signaling server removes the peer from its room and broadcasts `member-left` to remaining peers

#### Scenario: Peer stays connected
- **WHEN** a peer sends messages at least every 15 seconds
- **THEN** the signaling server keeps the peer in the room indefinitely

### Requirement: Room membership tracking
The signaling server SHALL track which peers belong to which room, and broadcast `member-joined` / `member-left` events to remaining room members.

#### Scenario: New peer joins room
- **WHEN** a peer sends `join` message with `roomId` that already has other peers
- **THEN** the signaling server sends `room-members` (with existing peer list) to the joining peer, and broadcasts `member-joined` to all existing peers

#### Scenario: Host creates a new room
- **WHEN** a peer sends `create` message
- **THEN** the signaling server creates the room, adds the peer, and sends back `created` confirmation

### Requirement: Signaling message relay
The signaling server SHALL relay WebRTC offer/answer/ice messages between peers based on the `to` field.

#### Scenario: Offer relay
- **WHEN** a peer sends `{ type: 'offer', to: <peerId>, sdp: <offer> }`
- **THEN** the signaling server forwards the message to the peer identified by `to`

#### Scenario: ICE candidate relay
- **WHEN** a peer sends `{ type: 'ice', to: <peerId>, candidate: <ice> }`
- **THEN** the signaling server forwards the candidate to the target peer