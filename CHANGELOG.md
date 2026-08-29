# GridPulse — Changelog & Version History

All notable changes, architectural milestones, and telemetry dynamics features of GridPulse are documented in this file.

---

## [2.2.0] — 2026-08-29

### 🚀 Virtual Chassis Dyno & Gearing Thrust Lab
* **Live WOT Pull Assistant**: Automated state machine (`IDLE` ➔ `STAGING` ➔ `PULLING` ➔ `COOLDOWN` ➔ `COMPLETED`) with interactive tachometer staging guidance.
* **Polynomial Curve Smoothing**: 100-RPM binning with 3-point moving average and mathematical 5,252 RPM crossover verification ($HP = \frac{TQ \times RPM}{5252}$).
* **Multi-Gear Thrust Lab**: Per-gear speed slices, 85% peak power band width analysis, and optimal transmission upshift RPM calculations.
* **AI Tuning Coach Exporter**: Instant copy prompt formatted with dyno metrics for ChatGPT/Claude/Gemini tuning analysis.

### 💨 Session Type System & Impact Engine
* **Automated Driving Style Classification**: Intelligently tags and formats stints as `DRIFT`, `TIME_ATTACK`, `CIRCUIT`, `SPRINT`, `OFFROAD`, or `FREE_ROAM`.
* **Physics-Based Wall / Barrier Impact Detection**: Real-time collision classifier ($G \ge 4.2\text{G}$ or rapid deceleration with $<50\%$ brake) logging impact speed, speed lost, and peak impact G.
* **Drift Dynamics & Counter-Steer Overlay**: Auto-scaling slip angle axis with counter-steer line, transition counter, and rear tire thermal buildup rate (°F/s).
* **Off-Road Dynamics**: 4-corner droop jump detection, airtime calculation, landing G force, and bump-stop bottoming frequency.

### ⚡ Engine & Transport Hardening
* **Zero Tab-Switch Disconnects on LAN**: Direct WebSocket prioritizer on local HTTP LAN (`http://<LAN-IP>:8000`), connecting in 1ms with zero renegotiation on tab switches.
* **Standstill Sensor Filter**: Clamped drift angle and yaw rate strictly to `0.0°` when vehicle is stationary ($<1.5\text{ MPH}$), eliminating floating-point micro-noise.
* **660-Car Database Bundled**: PyInstaller frozen environment fix ensuring offline vehicle dictionary loads in standalone Windows binary.
* **Service Worker v4**: Cache invalidation for iOS Safari and mobile PWAs.

---

## [2.1.0] — 2026-08-28

### 🏎️ Local-First Stint Recording Engine
* **IndexedDB Stint Storage**: Full 60Hz telemetry sessions saved directly to local browser IndexedDB.
* **AI-Ready JSON Stint Export & Import**: Standardized telemetry schema for sharing and external analysis.
* **Chassis Balance Matrix**: Real-time understeer/oversteer differential ($\Delta\alpha = \alpha_{\text{rear}} - \alpha_{\text{front}}$).

### 🔒 Zero-Relay WebRTC Security Hardening
* Stripped hardcoded test credentials; standardized on public Google STUN with optional environment variables.
* Ephemeral single-use 6-digit pairing code room coordination.

---

## [2.0.0] — 2026-08-27

### 📱 WebRTC P2P Data Plane Migration
* Migrated from cloud WebSockets to direct WebRTC `RTCDataChannel` (SCTP/DTLS) with sub-2ms local latency.
* 660-car offline vehicle database.
* Full motorsport HUD layout with F1 shift lights, friction circle, and 4-corner tire thermals.

---

## [1.0.0] — 2026-08-25

### 🏁 Initial Release
* High-frequency 324-byte UDP Forza telemetry parser (Dash format).
* Real-time drag strip milestone timers (0-60, 0-100, 1/4 mile, 1/2 mile).
* Local SQLite database and daily awards engine.
