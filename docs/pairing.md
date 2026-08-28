# GridPulse — Ephemeral Pairing Specification

## Overview

GridPulse provides a frictionless, zero-configuration pairing mechanism allowing mobile phones (iOS Safari, Android Chrome) to discover and connect to a local gaming PC's telemetry bridge without manual IP entry, port forwarding, or account creation.

---

## The Pairing Lifecycle

```text
  [Gaming PC: Bridge.exe]                         [Phone: Mobile Browser]
           │                                                │
1. Generates 6-digit code (e.g. 847 291)                    │
2. Renders QR Code in Terminal                              │
3. Starts ephemeral signaling listener                      │
           │                                                │
           │           4. Camera scans QR Code              │
           │  ────────► Opens https://gridpulse.wranglr.co.za?code=847291
           │                                                │
           │           5. Generates RTCPeerConnection       │
           │              and publishes SDP Offer           │
           │           ◄─────────────────────────────────── │
6. Receives SDP Offer via room                              │
7. Generates SDP Answer & ICE candidates                    │
8. Publishes SDP Answer to room                             │
   ────────────────────────────────────────────────────────►│
                                                9. Sets remote description
                                                10. DataChannel opens ('telemetry')
           │                                                │
           │════════════════════════════════════════════════│
           │   DIRECT WebRTC P2P TELEMETRY STREAM ACTIVE    │
           │════════════════════════════════════════════════│
           │                                                │
11. Signaling shuts down / room expires                     │
12. 100% of telemetry travels Direct P2P (0 cloud relay bytes)
```

---

## Pairing Code & Session Semantics

### 1. Code Generation
* When the Bridge boots, it generates a cryptographically random 6-digit session identifier (`XXX XXX`).
* The code maps directly to ephemeral signaling topics:
  * Offer topic: `gridpulse-sig-offer-{code}`
  * Answer topic: `gridpulse-sig-answer-{code}`

### 2. QR Code URL Format
The terminal QR code encodes:
```text
https://gridpulse.wranglr.co.za?code=847291
```
* **No Telemetry in URL**: The URL contains only the ephemeral session code.
* **No Secrets in URL**: No authentication tokens, game secrets, or sensitive IP data are present in the QR code.

### 3. Single-Use Semantics & Expiration
* **Ephemeral Scope**: The pairing window remains active for session initialization (default timeout: 120 seconds).
* **Signaling Teardown**: Once the WebRTC `RTCDataChannel` transitions to `OPEN` and host/srflx candidates are confirmed, active signaling polling ceases.
* **Zero Residual Cloud State**: Neither Wranglr nor the signaling broker stores connection logs or historical telemetry.

---

## Security Model: Identifier vs Cryptographic Boundary

> **Important Architectural Distinction:**
> The six-digit code is a user-friendly pairing identifier to facilitate discovery, NOT the cryptographic security boundary.

* **Transport Encryption**: Security is enforced at the WebRTC data layer via **DTLS 1.2/1.3** (Datagram Transport Layer Security) with ephemeral ECDSA/RSA keypairs negotiated directly between the browser and Bridge.
* **Telemetry Secrecy**: Telemetry payloads are encrypted point-to-point and never transit plaintext over the wire or through intermediate brokers.
* **Zero Telemetry Relay**: At no point is telemetry piped to or through cloud servers.
