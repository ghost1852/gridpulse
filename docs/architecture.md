# GridPulse — System Architecture

## Overview

GridPulse is a high-frequency real-time telemetry instrument and performance analytics engine for Forza Horizon 6 and Forza Motorsport.

The core design principle of GridPulse is **Control Plane ≠ Data Plane**:
* **Control Plane (Signaling & Pairing)**: Hosted via Wranglr / Ephemeral broker. Coordinates PWA distribution, session room discovery, and SDP/ICE candidate exchange.
* **Data Plane (Direct High-Frequency Telemetry)**: End-to-end encrypted WebRTC `RTCDataChannel` direct P2P link between the gaming PC and the client browser/phone. **Zero telemetry bytes are ever relayed through cloud infrastructure.**

---

## Architectural Diagram

```text
                    WRANGLR
              ┌─────────────────┐
              │ PWA Hosting      │
              │ Pairing Broker  │
              │ SDP / ICE        │
              │ Control Plane    │
              └────────┬────────┘
                       │
                  ephemeral
                  signaling
                       │
              connection established
                       │
                       X
                 signaling closes
                       │
        ╔══════════════╧══════════════╗
        ║       DIRECT P2P DATA       ║
        ║                             ║
        ║  PC ═══════════════ Phone   ║
        ║       WebRTC/DTLS           ║
        ║       SCTP DataChannel      ║
        ║                             ║
        ╚═════════════════════════════╝
                 ▲
                 │
          Forza UDP telemetry (20066)
```

---

## Control Plane vs Data Plane

| Attribute | Control Plane (Wranglr / Signaling) | Data Plane (WebRTC DataChannel) |
| :--- | :--- | :--- |
| **Purpose** | PWA asset delivery, room pairing, SDP offer/answer exchange | High-frequency live telemetry stream & RTT measurement |
| **Bandwidth** | Ephemeral (~2 KB one-time exchange per session) | High-frequency telemetry stream (60–100 Hz, ~30–50 KB/s) |
| **Duration** | Active only during handshake (~1–2 seconds) | Active continuously for the entire driving session |
| **Security** | Ephemeral single-use room topic | DTLS 1.2/1.3 end-to-end encryption & SCTP data channel |
| **Cloud Relay** | Ephemeral signaling broker | **0 Bytes relayed through cloud** |

---

## Connection Modes

### 1. LAN Direct P2P (Optimal LAN / Wi-Fi)
```text
Gaming PC (Bridge.exe) ───────── Phone (Safari / Chrome)
                 Direct WebRTC (host candidate)
```
* **Transport**: Local UDP socket via DTLS/SCTP (`host` candidate pair, e.g. `192.168.88.4:52920` ↔ `192.168.88.21:59641`).
* **Observed Latency (RTT)**: 1.0 – 2.5 ms.
* **Signaling**: Initial SDP exchange completed via local LAN API or ephemeral room code.

### 2. Remote P2P (Cross-Network / Cellular / WAN)
```text
Gaming PC (Bridge.exe) ═════════════ Phone (PWA on WAN)
                 Direct WebRTC (srflx candidate)
                              ↑
                     Wranglr Signaling
                (only during connection setup)
```
* **Transport**: STUN-resolved reflexive candidate pair (`srflx`).
* **Cloud Relay**: **0 Bytes** (direct UDP punchthrough).
* **TURN Policy**: By default, GridPulse operates with zero cloud relay using public Google STUN. For restrictive symmetric corporate NATs, custom TURN server credentials can optionally be provided via environment variables (`GRIDPULSE_TURN_SERVER`, `GRIDPULSE_TURN_USER`, `GRIDPULSE_TURN_PASS`) or client settings.

### 3. Local Standalone Fallback (Same-Machine / Embedded)
```text
Gaming PC (Bridge.exe) ───────── Local Browser (Desktop)
                 WebSocket (ws://localhost:8000/ws)
```
* **Transport**: Loopback WebSocket connection for local desktop monitoring.

---

## Diagnostics & Telemetry Verification

GridPulse provides live transport diagnostics in the UI:
* **Transport**: `Direct P2P` (or `Local WebSocket`)
* **ICE Connection State**: `completed` / `connected`
* **Selected Candidate Type**: `host` (LAN) or `srflx` (WAN)
* **Telemetry Delivery Rate**: Dynamically measured (e.g. `95.3 Hz`)
* **Round-Trip Time (RTT)**: High-resolution ping/pong measurement (e.g. `1.8 ms`)
* **Cloud Telemetry Relayed**: `0 Bytes` (strictly verified)
