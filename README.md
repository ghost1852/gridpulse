# GridPulse - Forza Horizon & Motorsport Telemetry Dashboard

A high-performance, real-time Progressive Web App (PWA) and telemetry engine for Forza Horizon (FH4, FH5, FH6) and Forza Motorsport. GridPulse ingests raw 60Hz UDP data-out packets from the game engine, computes precision vehicle dynamics, tracks drag strip sprints, provides chassis engineering diagnostics, and powers local and garage leaderboards.

---

## Architecture Overview

```
 +------------------------+
 | Forza Horizon / FM     |  (60Hz Little-Endian UDP)
 | Data Out: Port 20066   |
 +-----------+------------+
             |
             v
 +------------------------+
 | Python FastAPI Backend |
 | - UDP Socket Listener  |
 | - Packet Struct Parser |
 | - Real-Time Analytics  |
 | - SQLite Storage       |
 | - WebSocket Broadcaster|
 +-----------+------------+
             |  (WebSocket /ws & REST API /api)
             v
 +------------------------+
 | React 19 + TypeScript  |
 | - Real-Time Racing HUD |
 | - Time Slip & Drag Run |
 | - Chassis Tuning Bench |
 | - Stint Telemetry CSV  |
 +------------------------+
```

---

## Key Features

### 1. High-Precision Racing HUD
- Digital precision speedometer with instant MPH and KM/H toggling.
- 16-segment LED shift light tachometer calibrated with vehicle redline thresholds.
- Four-corner tire surface temperature heatmap with optimal compound operating windows.
- Dual-axis G-Force friction circle tracking lateral and longitudinal acceleration.
- Dynamic throttle, brake threshold, and clutch input telemetry meters.
- Chassis alert banner detecting bottom-out events, brake lockups, and thermal overload.

### 2. Time Attack & Drag Strip
- Automatic standstill staging and throttle-launch detection using 60Hz physics clock synchronization.
- Real-time milestone capture: 0-60 MPH (0-100 KM/H), 0-100 MPH (0-160 KM/H), 60-130 MPH (100-200 KM/H), 1/4 Mile (402m), and 1/2 Mile (805m).
- Numerical wheel speed distance integration for accurate quarter-mile timing on any map location.
- Persistent time slip display that retains previous run metrics while staged at the starting line.
- Garage leaderboard ranking fleet vehicles by quarter-mile elapsed times and trap speeds.

### 3. Chassis Tuning & Engineering Bench
- Mathematical setup calculator generating spring rates, anti-roll bars, damping, and camber from vehicle weight distribution and drivetrain configuration.
- Real-time telemetry diagnostic logger tracking bottom-out spikes, axle thermal imbalances, understeer, and power oversteer.
- Visual slider interface overlaying live engineering target recommendations against current baseline setups.
- One-tap vehicle configuration for tire compounds (Slick, Semi-Slick, Sport, Street, Drift, Rally, Drag, Off-Road) and aerodynamics.
- Persistent garage profiles retaining custom car names, manufacturers, and tune sheets.

### 4. Vehicle Stint Telemetry & CSV Export
- Live stint recording capturing high-frequency samples of speed, RPM, G-forces, tire thermals, and suspension travel.
- Stint summary debriefs with top speed, peak lateral Gs, estimated mileage, and bottom-out counts.
- Full CSV export and markdown debrief generator for race engineers and league competition logs.

---

## Technical Stack

| Component | Technology |
|---|---|
| Frontend Framework | React 19, TypeScript, Vite |
| Styling & Theme | Tailwind CSS v4, Motorsport JetBrains Mono Typography |
| Animation & Icons | Framer Motion, Lucide Icons |
| Backend Server | FastAPI, Uvicorn, Python 3.10+ |
| Real-Time Transport | Native WebSockets, Async UDP Socket Protocol |
| Database Layer | Async SQLite (aiosqlite) |
| Client Storage | IndexedDB / LocalStorage for garage and tune sheets |

---

## Getting Started

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher (Node 20+ recommended)
- PC / Xbox running Forza Horizon 4/5 or Forza Motorsport on the same local network

### 1. Backend Installation & Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Option A: Run with real game telemetry (Default UDP port 20066)
python server.py --no-simulate

# Option B: Run in simulation mode (no game required)
python server.py --simulate
```

### 2. Frontend Installation & Build

```bash
# Navigate to frontend directory
cd frontend

# Install node packages
npm install

# Start development server
npm run dev
```

For production deployment:
```bash
npm run build
# The FastAPI backend serves static assets directly from frontend/dist/ at http://localhost:8000
```

---

## In-Game Telemetry Configuration

To transmit telemetry from Forza to GridPulse:

1. Open **Forza Horizon 4 / 5** or **Forza Motorsport**.
2. Navigate to **Settings** > **HUD and Gameplay**.
3. Scroll down to the **Telemetry** section and configure:
   - **Data Out**: `ON`
   - **Data Out IP Address**:
     - Running on the same PC: `127.0.0.1`
     - Running on a separate PC / Phone / Tablet: Enter the local IP of the machine running GridPulse (e.g. `192.168.1.100`)
   - **Data Out IP Port**: `20066`
   - **Data Out Packet Format**: `Car Dash` (Default)

---

## API Endpoints

### REST API

- `GET /api/status` - Server health, active packet throughput, and connected vehicle ordinal.
- `GET /api/drag/recent?limit=30` - Recent sprint runs and milestone telemetry records.
- `GET /api/garage/fastest` - Garage leaderboard ranked by vehicle fastest quarter-mile times.
- `POST /api/drag/reset` - Reset active sprint timers.
- `POST /api/drag/clear` - Clear local sprint history database.
- `GET /api/leaderboard?category=0-60&car_class=S1` - Category records filtered by car class.
- `GET /api/daily-awards` - Peak telemetry award leaders for the active session.

### WebSocket Stream

- `WS /ws` - 60Hz JSON stream containing parsed telemetry frames, vehicle class, speed, temperatures, suspension travel, and live sprint timing state.

---

## License

MIT License. Developed for motorsport enthusiasts and simulation racers.
