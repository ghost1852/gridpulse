# GridPulse — WebRTC Data Plane Specification

## Overview

GridPulse utilizes **WebRTC DataChannels** as its primary high-frequency telemetry transport between the gaming PC (`Bridge.exe` using `aiortc`) and client mobile browsers (Safari / Chrome using standard W3C `RTCPeerConnection`).

> **Core Principle**: WebRTC provides encryption and peer-to-peer transport. Wranglr is involved strictly during ephemeral connection establishment (signaling). Once established, 100% of telemetry travels directly peer-to-peer.

---

## Data Channel Configuration

To achieve near-zero jitter and sub-2ms local latency at high packet rates (~60–100 Hz), the `RTCDataChannel` is configured with **unordered, zero-retransmission semantics**:

```typescript
const dc = pc.createDataChannel('telemetry', {
  ordered: false,
  maxRetransmits: 0
});
```

### Why Unordered & Zero Retransmit?
* **Real-time State Replacement**: In high-frequency racing telemetry, late packets are obsolete. If packet $N$ is dropped, receiving packet $N+1$ immediately is strictly superior to blocking the pipeline waiting for a TCP-like retransmission of packet $N$.
* **Eliminates Head-of-Line Blocking**: Packets are delivered immediately upon receipt by the network stack without buffering delays.
* **Low Latency Under Burst**: Maintains smooth 60–100Hz animation frames on mobile displays even over busy 5GHz Wi-Fi networks.

---

## Protocol & Encryption Stack

```text
┌──────────────────────────────────────────────────┐
│      GridPulse Telemetry JSON Payload            │
├──────────────────────────────────────────────────┤
│      SCTP (Stream Control Transmission Protocol) │
├──────────────────────────────────────────────────┤
│      DTLS (Datagram Transport Layer Security)    │
├──────────────────────────────────────────────────┤
│      UDP (User Datagram Protocol)                │
└──────────────────────────────────────────────────┘
```

1. **DTLS 1.2 / 1.3**: Guarantees end-to-end encryption, authentication, and tamper protection directly between the PC and mobile device.
2. **SCTP**: Multiplexes application data channels over the secure DTLS tunnel.

---

## ICE Candidate Resolution & NAT Traversal

1. **Host Candidates (`host`)**:
   * Resolved directly from local network interfaces (e.g. `192.168.88.4:52920`).
   * When both the PC and Phone are on the same LAN/Wi-Fi, WebRTC completes handshake over local UDP sockets with ~1–2 ms RTT.
2. **Server Reflexive Candidates (`srflx`)**:
   * Resolved via public STUN servers (`stun:stun.l.google.com:19302`).
   * Enables direct P2P connectivity across compatible NAT topologies.
3. **No Cloud Relay (TURN Policy)**:
   * GridPulse intentionally avoids TURN relay servers. If direct P2P communication fails, the UI surfaces a diagnostic warning rather than silently routing high-bandwidth telemetry through cloud relays.

---

## Real-Time Latency (RTT) Measurement

Latency is continuously measured using high-precision heartbeat pings over the active DataChannel:
1. Client sends: `__ping__:<timestamp_ms>` once per second.
2. Bridge immediately responds: `__pong__:<timestamp_ms>`.
3. Client computes: $\text{RTT} = \text{Date.now()} - \text{timestamp\_ms}$.
4. Typical measured LAN RTT: **1.2 ms – 2.4 ms**.

---

## Failure Recovery & Fallback

* **ICE Reconnection**: If the network connection drops temporarily (e.g. Wi-Fi band switch), `RTCPeerConnection` attempts automatic ICE restarts.
* **Local WebSocket Fallback**: When running locally in same-origin or localhost desktop environments, the client can fall back to `ws://localhost:8000/ws`.
* **State Reporting**: The HUD dynamically surfaces `Transport: Direct P2P`, `Candidate: host`, and `Cloud Telemetry: 0 B`.
