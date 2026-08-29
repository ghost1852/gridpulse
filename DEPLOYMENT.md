# GridPulse — Deployment & Packaging Runbook

> **Critical Architecture & Operational Guide**  
> Preserves the standard operating procedure for building the Windows Bridge executable and deploying the web application to Wranglr (`gridpulse.wranglr.co.za`).

---

## 1. Dual Deployment Architecture

GridPulse is distributed in two distinct deployment targets:

| Deployment Target | Primary URL / Host | Target Directory | Serving Mechanism |
| :--- | :--- | :--- | :--- |
| **Cloud Web App** | `https://gridpulse.wranglr.co.za` | `frontend/dist/` | Wranglr Edge Platform (`wranglr deploy`) |
| **Local Standalone Bridge** | `http://<LAN-IP>:8000` | `backend/dist/GridPulse-Bridge.exe` | Embedded PyInstaller (`_MEIPASS` / FastAPI WebSockets) |

---

## 2. Deployment Procedures

### A. Deploying the Cloud Web App (`gridpulse.wranglr.co.za`)

1. **Build the Pure Frontend**:
   ```powershell
   npm run build --prefix frontend
   ```
2. **Ensure No Large Binaries in `frontend/dist/`**:
   - The Wranglr platform limits individual asset uploads to < 50 MB.
   - Large executables (`GridPulse-Bridge.exe` ~500 MB) or ZIP files (`GridPulse-Bridge-Windows.zip` ~200 MB) **MUST NOT** be copied into `frontend/dist/` for Wranglr deployments.
   - The download CTA on the live web app points directly to GitHub Releases (`https://github.com/ghost1852/gridpulse/releases/latest/download/GridPulse-Bridge-Windows.zip`).

3. **Deploy via Wranglr CLI**:
   ```powershell
   wranglr deploy frontend/dist --site e788b234-39e0-4254-bac6-619048c61eb9
   ```

---

## 3. Telemetry & Stint Recording Specifications

- **Local LAN Priority**: All live telemetry streams via local binary WebSockets directly between your gaming PC and phone. Zero cloud servers relay telemetry data.
- **Session Modes**:
  - `TIME_ATTACK`: Fast single-lap or hot-lap session. Does not get overridden by mild corner-exit wheelspin on high-power RWD cars.
  - `CIRCUIT`: Multi-lap race stints with lap-to-lap delta and consistency scoring.
  - `DRIFT`: Sustained slides (> 35% slide duration, sustained slip angle > 22°, multiple steering transitions).
  - `OFFROAD`: Jump airtime and suspension bottoming spikes.
  - `SPRINT`: Short drag pulls (< 35s, high top speed).
  - `FREE_ROAM`: General cruising.
- **Suspension Travel**: 4-corner normalized telemetry (`suspFl`, `suspFr`, `suspRl`, `suspRr`) logged at 10Hz with bump-stop bottoming detection at < 5% travel.
- **Ground Distance Integration**: Ground distance is calculated by integrating linear road velocity (v * dt) rather than raw wheel-rotation ticks to prevent burnout wheelspin from inflating stint miles.
