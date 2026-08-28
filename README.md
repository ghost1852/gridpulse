# GridPulse — Real-Time Forza Telemetry Suite & Mobile PWA

> **Zero Cloud Telemetry • 100% Privacy • Sub-millisecond Local Streaming • Standalone Windows Executable**

GridPulse is a high-performance, real-time motorsport telemetry dashboard, drag strip timer, and chassis tuning bench engineered specifically for **Forza Horizon (FH4, FH5, FH6)** and **Forza Motorsport**.

It ingests the native 60Hz Little-Endian UDP data-out packets streamed directly from the Forza physics engine, computes high-frequency vehicle dynamics (suspension travel, tire surface temperatures, slip vectors, G-forces, RPM), and broadcasts real-time telemetry to your phone, tablet, or browser mounted directly to your sim wheel.

---

## Architecture Overview

GridPulse operates on a **Zero-VPS, Local Edge Architecture**. No telemetry ever touches the internet or third-party servers.

```
   ┌─────────────────────────────────────────────────────────────┐
   │                       YOUR GAMING PC                        │
   │                                                             │
   │  ┌──────────────────────┐         ┌──────────────────────┐  │
   │  │ Forza Horizon / FM   │         │ GridPulse-Bridge.exe │  │
   │  │                      │ 60Hz UDP│                      │  │
   │  │ Data Out: 127.0.0.1  ├────────►│ - UDP Socket Listener│  │
   │  │ Port: 20066          │  (Port  │ - Packet Parser (324B)│  │
   │  └──────────────────────┘  20066) │ - Drag Strip Engine  │  │
   │                                   │ - Local SQLite DB    │  │
   │                                   │ - HTTP & WS Server   │  │
   │                                   └──────────┬───────────┘  │
   └──────────────────────────────────────────────┼──────────────┘
                                                  │
                                   Local Wi-Fi / LAN Streaming
                                   (http://<PC_IP>:8000 & /ws)
                                                  │
                                                  ▼
                               ┌──────────────────────────────────┐
                               │     PHONE / SIM WHEEL MOUNT      │
                               │                                  │
                               │  GridPulse PWA (Safari / Chrome) │
                               │  - 60Hz Racing HUD Dashboard     │
                               │  - Drag Strip & Time Slip Card   │
                               │  - Chassis Tuning & Camber Bench │
                               │  - Vehicle Stint CSV Logger      │
                               └──────────────────────────────────┘
```

---

## Quick Start (60 Seconds)

### Step 1: Run the GridPulse Bridge on your PC
1. Download **`GridPulse-Bridge-Windows.zip`** from [GitHub Releases](https://github.com/ghost1852/gridpulse/releases) or the [Live Site](https://gridpulse.wranglr.co.za).
2. Unzip the folder and double-click **`GridPulse-Bridge.exe`**.
   *(No Python or Node.js installation required!)*
3. A terminal window will open showing your LAN Gateway URL and a QR Code.

### Step 2: Configure Forza In-Game Telemetry
In **Forza Horizon 4 / 5** or **Forza Motorsport**:
1. Go to **Settings** > **HUD and Gameplay** > Scroll down to **Telemetry**.
2. Set the following options:
   * **Data Out**: `ON`
   * **Data Out IP Address**:
     * Playing on PC: `127.0.0.1`
     * Playing on Xbox: Enter your PC's LAN IP (e.g. `192.168.88.4` shown in the bridge window)
   * **Data Out IP Port**: `20066`
   * **Data Out Packet Format**: `Car Dash` (Default)

### Step 3: Open on Your Phone / Wheel Mount
1. Make sure your phone is connected to the **same Wi-Fi network** as your PC.
2. Scan the QR code shown in the bridge terminal, or open your PC's LAN address in your phone's browser:
   ```
   http://192.168.88.4:8000
   ```
3. *(Optional)* Tap **Share > Add to Home Screen** on iOS Safari or **Install App** on Android Chrome to run GridPulse as a fullscreen standalone PWA!

---

## Core Features

### 🏎️ 1. High-Precision Racing HUD
* **Digital Speedometer**: Switch instantly between MPH and KM/H.
* **16-Segment Tachometer**: Real-time RPM bar with redline strobe & optimal gear shift indicators.
* **4-Corner Tire Thermals**: Live tire surface temperatures (°F/°C) with compound color-coding (Cold, Optimal, Hot, Overheated).
* **Friction Circle (G-Force)**: Dual-axis accelerometer tracking lateral cornering Gs and longitudinal braking/acceleration forces.
* **Live Pedal Ingress**: Real-time throttle, threshold braking, and clutch telemetry bars.
* **Chassis Alert Banner**: Real-time alerts for bottom-out compression, brake lockup, and tire thermal overload.

### 🏁 2. Precision Drag Strip & Time Slip Engine
* **Automatic Staging Detection**: Senses vehicle standstill and arms the timing gate.
* **Milestone Timing**: 0-60 MPH (0-100 KM/H), 0-100 MPH (0-160 KM/H), 60-130 MPH (100-200 KM/H), 1/4 Mile (402m), and 1/2 Mile (805m).
* **Wheel-Speed Integration**: Precise trap speed and elapsed time calculated anywhere on the map.
* **Persistent Time Slip**: Keeps your latest drag slip visible at the starting line until your next launch.
* **Garage Fleet Leaderboard**: Stores and ranks your fastest personal runs per vehicle in local SQLite.

### 🔧 3. Chassis Tuning & Suspension Diagnostics
* **Target Setup Calculator**: Computes mathematically optimal spring rates, anti-roll bars, rebound/bump damping, and camber angles based on vehicle weight distribution and drivetrain.
* **Live Stroke Diagnostics**: Real-time suspension travel meters (meters & normalized 0.0–1.0) with bottom-out warning counters.
* **Tire Slip Vector Analysis**: Front/rear slip ratio and slip angle differential tracking to diagnose understeer vs. oversteer tendencies.
* **Compound Customizer**: Preset support for Slick, Semi-Slick, Sport, Street, Drift, Rally, Drag, and Off-Road tires.

### 📈 4. Vehicle Stints & CSV Telemetry Export
* **Live Stint Recording**: Capture 60Hz telemetry data points during practice laps, endurance stints, or drag sessions.
* **Session Debriefs**: Top speed, peak lateral Gs, bottom-out events, and average tire temperatures.
* **CSV Export**: 1-click download of full high-frequency telemetry logs for external analysis in Excel, MoTeC, or Python.

---

## Developer / Source Setup

If you wish to run or develop GridPulse from source:

### Prerequisites
* **Python 3.10+**
* **Node.js 18+**

### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Run with real game telemetry (Port 20066 UDP)
python server.py

# Or run with built-in physics simulator (no game required)
python server.py --simulate
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Building the Standalone Executable
```bash
cd backend
pyinstaller --noconfirm --onedir --name "GridPulse-Bridge" --add-data "..\frontend\dist;frontend\dist" server.py
```

---

## UDP Packet Specification (324 Bytes Little-Endian)

GridPulse decodes the official Forza "Car Dash" packet structure:

| Byte Offset | Type | Field Name | Description |
|:---:|:---:|---|---|
| `0–3` | `s32` | `IsRaceOn` | 1 = Active Driving, 0 = In Menus |
| `4–7` | `u32` | `TimestampMS` | Monotonic physics clock |
| `8–19` | `f32[3]` | `EngineMaxRpm`, `EngineIdleRpm`, `CurrentEngineRpm` | Engine RPM profile |
| `20–31` | `f32[3]` | `AccelerationX`, `AccelerationY`, `AccelerationZ` | Local vehicle G-forces |
| `32–43` | `f32[3]` | `VelocityX`, `VelocityY`, `VelocityZ` | Velocity vectors (m/s) |
| `68–83` | `f32[4]` | `NormalizedSuspensionTravel[FL, FR, RL, RR]` | 0.0 (fully extended) to 1.0 (bottomed out) |
| `84–99` | `f32[4]` | `TireSlipRatio[FL, FR, RL, RR]` | Longitudinal tire slip |
| `212–223` | `s32[3]` | `CarOrdinal`, `CarClass`, `CarPerformanceIndex` | Vehicle metadata (Class D–X, PI 100–999) |
| `256–267` | `f32[3]` | `Speed`, `Power`, `Torque` | Speed (m/s), Power (W), Torque (N·m) |
| `268–283` | `f32[4]` | `TireTemp[FL, FR, RL, RR]` | Surface tire temperatures (°F) |
| `315–320` | `u8[5], s8` | `Accel`, `Brake`, `Clutch`, `HandBrake`, `Gear`, `Steer` | Driver pedal and steering inputs |

---

## License

MIT License. Open source and built with ❤️ for sim racers, tuners, and motorsport enthusiasts.
