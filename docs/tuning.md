# GridPulse — Telemetry-Driven Mechanical Tuning Advisor

## Overview

The GridPulse Tuning Advisor replaces arbitrary setup guessing with a rigorous, telemetry-backed vehicle dynamics framework:

$$\text{Telemetry Fact} \longrightarrow \text{Physical Inference} \longrightarrow \text{Directional Setup Recommendation}$$

---

## 1. Diagnostic Framework

GridPulse continuously processes suspension travel, tire surface temperatures, lateral accelerations, and slip differentials to provide actionable setup adjustments.

### A. Anti-Roll Bar (ARB) Optimization
* **Observation**: High cornering slip angle on front axle ($\Delta\alpha < -0.08\text{ rad}$, understeer).
* **Inference**: Front roll stiffness is excessively high, overloading outer front tire grip.
* **Directional Recommendation**:
  * `▼ Soften Front ARB by 2–4 clicks`
  * `▲ Stiffen Rear ARB by 1–2 clicks`

### B. Tire Pressure & Thermal Spread
* **Observation**: Front tires overheating ($>225^\circ\text{F}$) while rears remain cold ($<140^\circ\text{F}$).
* **Inference**: Unequal thermal workload and excessive front tire scrubbing.
* **Directional Recommendation**:
  * `▼ Lower Front Cold Pressure by 1.0–1.5 PSI` (broadens contact patch)
  * `▲ Increase Rear Pressure by 0.5–1.0 PSI`

### C. Damper Bump / Rebound & Bump-Stop Strikes
* **Observation**: Suspension compression strikes bump-stops ($<5\%$ clearance / `BOTTOMING` event).
* **Inference**: Spring rates or bump damping are too soft for the aero downforce generated at high speed.
* **Directional Recommendation**:
  * `▲ Stiffen Front / Rear Spring Rates by 50–100 lbs/in`
  * `▲ Increase Ride Height by 0.2–0.4 inches`
  * `▲ Increase Bump Damping to control high-speed chassis compression`

### D. Differential Lock Calibration
* **Observation**: Sudden power oversteer on corner exits with heavy inside wheelspin.
* **Inference**: Rear differential acceleration lock is too open or too aggressive.
* **Directional Recommendation**:
  * `Adjust Rear Acceleration Differential Lock (45%–65% optimal for RWD)`

---

## 2. 1-Click Calibration Checklist

Drivers can export or copy an actionable tuning checklist directly to clipboard to dial in setups quickly within the Forza tuning menu.
