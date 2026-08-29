# GridPulse — System Architecture

## Overview

GridPulse is a 100% local-first, high-frequency real-time telemetry instrument and performance analytics engine for Forza Horizon 6, Forza Horizon 5, FH4, and Forza Motorsport.

The core design principle of GridPulse is **Local-First Zero-Cloud Architecture**:
* **Local Ingress Engine**: Listens directly on UDP port `20066` for Forza's 324-byte binary telemetry stream.
* **Integrated PWA Host & Fast WebSocket Server**: Runs locally on your gaming PC via FastAPI & Uvicorn, serving the complete Progressive Web App at `http://<LAN-IP>:8000` and streaming low-latency frames over `ws://<LAN-IP>:8000/ws`.
* **Zero Cloud Relay**: Telemetry never leaves your home network. Zero external cloud servers, databases, or subscriptions required.

---

## Architectural Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                      LOCAL GAMING PC                        │
│                                                             │
│  [ Forza Horizon / Motorsport ]                             │
│               │ (UDP 324-Byte Data-Out on port 20066)       │
│               ▼                                             │
│  [ GridPulse-Bridge.exe (Python / FastAPI / WebSockets) ]   │
│               │ (HTTP static files + WebSocket stream)      │
│               │ Port 8000                                   │
└───────────────┼─────────────────────────────────────────────┘
                │
                │ Local Wi-Fi / LAN (< 1ms latency)
                ▼
┌─────────────────────────────────────────────────────────────┐
│               MOBILE PHONE / TABLET / BROWSER               │
│                                                             │
│  [ GridPulse PWA Dashboard (http://<LAN-IP>:8000) ]         │
│  - Live Digital Cockpit HUD (Speed, RPM, Boost, Tires, G)   │
│  - Precision Boost / Vacuum Gauge (PSI / BAR switcher)      │
│  - Virtual Chassis Dyno & Thrust Analyzer                   │
│  - AI Powertrain Tuning Coach & Mechanical Advisor          │
│  - Stint Recording Engine (IndexedDB Local-First)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Local Architecture Specifications

| Attribute | Local LAN Engine |
| :--- | :--- |
| **Ingress Protocol** | UDP 324-Byte Little-Endian binary on port `20066` |
| **Transport Protocol** | WebSocket (`ws://<LAN-IP>:8000/ws`) + Direct HTTP PWA static serving |
| **Throughput & Frequency** | 60–100 Hz (~30–50 KB/s) continuous live physics stream |
| **Latency** | < 1 ms on local Wi-Fi / Gigabit LAN |
| **Data Persistence** | 100% Client-side IndexedDB (`stints`, `dyno_runs`, `custom_cars`) |
| **Cloud Dependence** | **Zero cloud dependencies or telemetry relaying** |

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
