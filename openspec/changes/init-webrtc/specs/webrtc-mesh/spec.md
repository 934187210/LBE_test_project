## ADDED Requirements

### Requirement: Mesh full-mesh topology
The system SHALL establish direct P2P WebRTC connections between all peers in a room, forming a full-mesh topology where every peer connects to every other peer.

#### Scenario: New peer joins existing room
- **WHEN** a new peer joins a room with N existing peers
- **THEN** the new peer SHALL establish N DataChannel connections, one to each existing peer

#### Scenario: Initiator role assignment
- **WHEN** two peers need to connect
- **THEN** the peer with the lexicographically smaller peerId SHALL be the offer initiator, preventing duplicate offers

### Requirement: Position data via DataChannel
The system SHALL transmit location data exclusively via WebRTC DataChannel in P2P fashion, never through the signaling server.

#### Scenario: Position broadcast
- **WHEN** a peer's GPS position updates
- **THEN** the peer SHALL encode the position as Float32Array (8 bytes: lat, lng) and send it over all active DataChannels

#### Scenario: Position receive
- **WHEN** a peer receives a DataChannel message
- **THEN** the system SHALL decode the ArrayBuffer and update that peer's marker on the map

### Requirement: Heartbeat and disconnect detection
The system SHALL detect peer disconnections within 30 seconds using a heartbeat mechanism.

#### Scenario: Heartbeat send
- **WHEN** a DataChannel is open
- **THEN** the system SHALL send a heartbeat message every 5 seconds

#### Scenario: Peer timeout
- **WHEN** no message is received from a peer for 30 seconds
- **THEN** the system SHALL mark that peer as offline and remove their map marker

### Requirement: Reconnection on network recovery
The system SHALL automatically attempt to re-establish connections after a network interruption.

#### Scenario: Reconnect after disconnect
- **WHEN** a DataChannel closes unexpectedly
- **THEN** the system SHALL attempt to re-establish the WebRTC connection via the signaling channel
