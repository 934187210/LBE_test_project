## ADDED Requirements

### Requirement: GPS position acquisition
The system SHALL acquire the device's GPS position using the browser Geolocation API with high accuracy enabled.

#### Scenario: Permission granted
- **WHEN** the user grants location permission
- **THEN** the system SHALL begin watching position with `enableHighAccuracy: true`

#### Scenario: Permission denied
- **WHEN** the user denies location permission
- **THEN** the system SHALL display an error message and prevent room join

### Requirement: 10Hz position broadcast
The system SHALL broadcast the local peer's position to all connected peers at up to 10Hz.

#### Scenario: Position update broadcast
- **WHEN** the Geolocation API fires a position update
- **THEN** the system SHALL encode it as Float32Array(2) [lat, lng] and send over all open DataChannels within 100ms

### Requirement: Position encoding
The system SHALL encode position data as a binary ArrayBuffer to minimize DataChannel payload size.

#### Scenario: Encode position
- **WHEN** a position (lat, lng) is ready to send
- **THEN** the system SHALL produce an 8-byte ArrayBuffer using Float32Array with lat at index 0 and lng at index 1

#### Scenario: Decode position
- **WHEN** an 8-byte ArrayBuffer is received on a DataChannel
- **THEN** the system SHALL decode it as Float32Array and extract lat (index 0) and lng (index 1)
