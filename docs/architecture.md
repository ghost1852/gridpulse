# GridPulse — System Architecture & Data Plane Specification

## Overview

GridPulse is a 100% local-first, high-frequency real-time telemetry instrument and performance analytics engine for Forza Horizon telemetry.

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
│  [ Forza Horizon Physics Engine ]                           │
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
| **Transport Protocol** | Binary WebSocket (`ws://<LAN-IP>:8000/ws`) + Direct HTTP PWA static serving |
| **Throughput & Frequency** | 60–100 Hz (~30–50 KB/s) continuous live physics stream |
| **Latency** | < 1 ms on local Wi-Fi / Gigabit LAN |
| **Data Persistence** | 100% Client-side IndexedDB (`stints`, `dyno_runs`) |
| **Cloud Dependence** | **Zero cloud dependencies or telemetry relaying** |

---

## Dual Deployment Distribution Model

GridPulse is distributed in two distinct deployment targets:

1. **Standalone Windows Bridge Executable (`GridPulse-Bridge.exe` / `GridPulse-Bridge-Windows.zip`)**:
   - Compiles Python backend + PyInstaller embedded `frontend/dist`.
   - Opens local UDP listener on port `20066` and HTTP/WebSocket server on port `8000`.
   - Completely standalone: requires no external runtime dependencies.

2. **Cloud Progressive Web App (`https://gridpulse.wranglr.co.za`)**:
   - Hosted on Wranglr Edge platform for instant browser access.
   - Connects seamlessly to your local bridge instance on your home network.
