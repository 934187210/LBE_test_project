## ADDED Requirements

### Requirement: Room creation via WebSocket server
The system SHALL connect to a WebSocket signaling server and register the room when a user starts a new room, generating a unique roomId.

#### Scenario: Room created
- **WHEN** a user clicks "Create Room"
- **THEN** the system SHALL connect to the signaling server, send a `create` message with `roomId` and `peerId`, and display the shareable URL

### Requirement: Offer/Answer/ICE exchange via WebSocket
The system SHALL use the WebSocket connection as the signaling channel to exchange WebRTC SDP offers, answers, and ICE candidates between peers.

#### Scenario: Offer sent
- **WHEN** the initiator peer creates an SDP offer
- **THEN** the system SHALL send a WebSocket message `{ type: 'offer', to: peerId, sdp: ... }`

#### Scenario: Answer sent
- **WHEN** the receiving peer processes an offer
- **THEN** the system SHALL send a WebSocket message `{ type: 'answer', to: peerId, sdp: ... }`

#### Scenario: ICE candidate exchange
- **WHEN** a peer generates an ICE candidate
- **THEN** the system SHALL send a WebSocket message `{ type: 'ice', to: peerId, candidate: ... }`

### Requirement: Presence tracking via heartbeat
The system SHALL use a WebSocket heartbeat mechanism to track peer online status and detect disconnections.

#### Scenario: Heartbeat send
- **WHEN** the WebSocket connection is open
- **THEN** the system SHALL send a heartbeat ping/pong every 5 seconds to keep the connection alive

#### Scenario: Peer disconnection detected
- **WHEN** the WebSocket connection to a peer is lost or a `leave` message is received
- **THEN** the system SHALL mark that peer as offline and trigger UI cleanup

### Requirement: Reconnection on WebSocket disconnect
The system SHALL automatically attempt to reconnect to the signaling server after a network interruption.

#### Scenario: WebSocket reconnect
- **WHEN** the WebSocket connection drops unexpectedly
- **THEN** the system SHALL attempt to reconnect with exponential backoff, up to 5 attempts
