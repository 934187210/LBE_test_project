## ADDED Requirements

### Requirement: Room creation with shareable link
The system SHALL allow a user to create a room and receive a shareable URL that others can use to join.

#### Scenario: Room created
- **WHEN** a user clicks "Create Room"
- **THEN** the system SHALL generate a unique roomId, connect to the WebSocket signaling server, and display a URL in the format `<origin>?room=<roomId>`

### Requirement: Join room via URL
The system SHALL allow a user to join an existing room by opening a shared URL.

#### Scenario: Join via URL
- **WHEN** a user opens a URL containing a `room` query parameter
- **THEN** the system SHALL automatically join that room without requiring manual input

### Requirement: Online member list
The system SHALL display a real-time list of all currently online members in the room.

#### Scenario: Member list updates on join
- **WHEN** a new peer joins the room
- **THEN** the system SHALL add that peer to the visible member list within 3 seconds

#### Scenario: Member list updates on leave
- **WHEN** a peer disconnects
- **THEN** the system SHALL remove that peer from the member list

### Requirement: Join and leave notifications
The system SHALL display a transient notification when a peer joins or leaves the room.

#### Scenario: Join notification
- **WHEN** a peer joins the room
- **THEN** the system SHALL display a notification message visible for at least 3 seconds

#### Scenario: Leave notification
- **WHEN** a peer leaves or is detected as offline
- **THEN** the system SHALL display a leave notification

### Requirement: New joiner sees all current positions
The system SHALL ensure a newly joined peer receives the current positions of all existing peers within 3 seconds.

#### Scenario: Initial position sync
- **WHEN** a new peer's DataChannel opens with an existing peer
- **THEN** the existing peer SHALL immediately send its current position over the DataChannel
