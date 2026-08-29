# GridPulse — High-Frequency Telemetry Suite & Mobile Cockpit PWA

> **Direct WebRTC P2P Data Plane • Zero Telemetry Relay • Sub-2ms Latency • 660-Car Database**

GridPulse is a real-time motorsport telemetry instrument, performance analytics engine, and chassis tuning advisor engineered for **Forza Horizon 6, Forza Horizon 5, FH4, and Forza Motorsport**.

It ingests high-frequency 324-byte UDP Data-Out packets streamed directly from the Forza physics engine, computes vehicle dynamics (suspension travel, 4-corner tire surface thermals, slip vectors, G-forces, and chassis balance), and streams telemetry directly to your phone, tablet, or browser over an end-to-end encrypted WebRTC DataChannel.

---

## Architectural Overview

GridPulse strictly separates the **Control Plane** from the **Data Plane**:

* **Control Plane (Wranglr / Ephemeral Broker)**: Serves the client Progressive Web App (PWA) assets and coordinates the ephemeral WebRTC handshake (SDP offer/answer and ICE candidate exchange via a single-use 6-digit session code).
* **Data Plane (Direct WebRTC P2P)**: Once connected, the control plane closes. 100% of live telemetry travels directly between the gaming PC and your phone over an encrypted, unordered `RTCDataChannel` with **zero telemetry relayed through cloud infrastructure**.

```text
                    WRANGLR
              ┌─────────────────┐
              │ PWA Hosting      │
              │ Pairing          │
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

> **Product Guarantee**: GridPulse uses Wranglr for ephemeral WebRTC connection signaling. Once connected, telemetry travels directly between the user's devices over an encrypted WebRTC DataChannel. GridPulse does not relay telemetry through cloud infrastructure.

---

## Quick Start (60 Seconds)

### Step 1: Run the GridPulse Bridge on your PC
1. Download **`GridPulse-Bridge-Windows.zip`** from [GitHub Releases](https://github.com/ghost1852/gridpulse/releases) or use the live PWA at [https://gridpulse.wranglr.co.za](https://gridpulse.wranglr.co.za).
2. Unzip and run **`GridPulse-Bridge.exe`** (or `python server.py`).
3. The bridge generates a 6-digit session code and displays a QR code in the terminal.

### Step 2: Configure Forza In-Game Telemetry
In **Forza Horizon 6 / 5 / 4** or **Forza Motorsport**:
1. Open **Settings** > **HUD and Gameplay** > Scroll to **Telemetry / Data Out**.
2. Set:
   * **Data Out**: `ON`
   * **Data Out IP Address**: `127.0.0.1` (or your PC's LAN IP if running Forza on Xbox)
   * **Data Out IP Port**: `20066`
   * **Data Out Packet Format**: `Car Dash` (Default 324-byte packet)

### Step 3: Scan with Phone & Mount
The bridge prints **two QR codes** in the terminal:
1. **QR Code 1 (Cloud PWA Pairing)**: Points to `https://gridpulse.wranglr.co.za?code=XXXXXX`. Uses ephemeral signaling to establish a direct, zero-cloud-relay WebRTC P2P DataChannel to your PC.
2. **QR Code 2 (Local LAN Dashboard)**: Points directly to `http://<LAN-IP>:8000` on your home Wi-Fi network.

Scan either QR code with your phone camera, tap **Add to Home Screen** on iOS Safari or Android Chrome to launch in fullscreen cockpit mode, and enjoy live 60-100Hz telemetry!

---

## Core Capabilities

### 🏎️ 1. High-Precision Racing HUD
* **Digital Speedometer**: Massive high-contrast speed readout with instant MPH / KM/H toggle.
* **Flanking Pedal Meters**: Integrated glowing Throttle (`THR`, electric green) and Brake (`BRK`, glowing red) vertical meters.
* **16-LED Shift Lights**: F1-style shift lights with redline strobe flashing at 93%+ max RPM.
* **4-Corner Tire Thermals & Lap Timer**: Embedded central lap timing (Current Lap, Delta vs Best, Best Lap, Lap #) situated cleanly between FL, FR, RL, RR tire thermals.
* **Tap-to-Inspect Telemetry**: Tap any tire pod to inspect slip angle, slip ratio, suspension compression, and wheel speed.
* **Friction Circle (G-Force)**: Dual-axis accelerometer with dynamic particle decay trail and peak-hold LAT/LON G-meters.

### ⚖️ 2. Dynamic Chassis Balance & Traction Instrument
* **Understeer vs Oversteer Differential**: Real-time handling balance indicator derived from front vs rear slip angle differential ($\Delta\alpha = \alpha_{\text{rear}} - \alpha_{\text{front}}$).
* **Traction Utilization Estimate**: Friction circle acceleration demand calculated against tire compound grip envelope.
* **Real-Time Physics Flags**: Live badges for `WHEELSPIN`, `LOCKUP`, `COLD TIRES` ($<135^\circ\text{F}$), `OVERHEATING` ($>235^\circ\text{F}$), and `BOTTOMING` ($<4\%$ suspension travel).

### 🚘 3. 660-Car Offline Identification Database
* Complete offline vehicle mapping covering 660 cars (Acura NSX Type S, BMW M3 E46, Alfa Romeo Giulia GTAM, etc.).
* Zero API calls needed for car metadata resolution.

### 🔧 4. Telemetry-Driven Tuning Advisor
* Rigorous diagnostic framework: `Observation → Inference → Directional Recommendation`.
* Concrete setup advisories (`▼ Lower Front Pressure by 1–2 PSI`, `▼ Soften Front ARB`, `▲ Stiffen Springs / Raise Height` if bottoming out).
* Vehicle build calibration controls (Tire Compound, Tuning Goal, Aero Package) with a 1-click **Copy Setup Guide** checklist.

### 📊 5. Virtual Chassis Dyno & Multi-Gear Thrust Lab
* **Live WOT Pull Assistant**: Automated staging tachometer guiding the driver through single-gear pulls (IDLE ➔ STAGING ➔ FULL THROTTLE ➔ REDLINE ➔ COOLDOWN).
* **High-Precision Dyno Curves**: 100-RPM binning with 3-point polynomial smoothing, peak power / torque tracking, and mathematical 5,252 RPM crossover verification ($HP = \frac{TQ \times RPM}{5252}$).
* **Multi-Gear Thrust Sweeps**: Per-gear speed thrust slices, 85% peak power band width analysis, and optimal transmission upshift RPM recommendations.

### 💨 6. Intelligent Session Mode System & Impact Logger
* **Auto-Detected Session Profiles**: Classifies driving stints into `DRIFT` (slip angle, time-in-slide, rear tire thermal buildup °F/s, transition counters), `TIME_ATTACK` / `CIRCUIT` (delta to best, lap consistency score %, thermal balance), `SPRINT` (launch wheelspin time, 1/4-mile ET & trap), and `OFFROAD` (jump airtime, landing G forces, bottoming frequency).
* **Physics-Based Wall / Barrier Impact Detection**: Automatically flags external collisions ($G \ge 4.2\text{G}$ or rapid deceleration with $<50\%$ brake), logging impact speed, speed lost, and peak impact G-force.
* **1-Click AI Race Coach Prompt**: Instant export formatted for Claude / ChatGPT / Gemini to diagnose driving technique and chassis balance bottlenecks.

### 🏁 7. Precision Drag Strip & Time Attack
* Automatic launch detection with milestone timing: 0-60 MPH, 0-100 MPH, 60-130 MPH, 1/4 Mile (trap speed + ET), and 1/2 Mile.
* Garage fleet ranking stored in local SQLite / IndexedDB.

---

## Technical Documentation

* [System Architecture & Connection Modes](docs/architecture.md)
* [WebRTC DataChannel Specification](docs/webrtc.md)
* [Ephemeral Pairing & Security Model](docs/pairing.md)
* [Telemetry Packet Structure & Derived Dynamics](docs/telemetry.md)

---

## License

MIT License. Designed for sim-racers and vehicle dynamicists.
