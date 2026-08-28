# GridPulse — Telemetry & Dynamics Specification

## Overview

GridPulse consumes the official 324-byte little-endian UDP "Data Out" stream transmitted by Forza Horizon 6, Forza Horizon 5, and Forza Motorsport on port `20066`.

This document outlines the raw packet structure, vehicle identification database, derived physics indicators, and tuning advisory heuristics.

---

## 1. Raw Telemetry Packet Structure (324 Bytes)

| Byte Range | Type | Field Name | Description / Units |
| :--- | :--- | :--- | :--- |
| `0–3` | `s32` | `IsRaceOn` | `1` when race/driving is active, `0` in menus |
| `4–7` | `u32` | `TimestampMS` | Session timestamp in milliseconds |
| `8–11` | `f32` | `EngineMaxRpm` | Engine rev limiter RPM |
| `12–15` | `f32` | `EngineIdleRpm` | Idle RPM |
| `16–19` | `f32` | `CurrentEngineRpm` | Current engine RPM |
| `20–31` | `f32[3]` | `AccelerationX/Y/Z` | Vehicle acceleration in local coordinates ($\text{m/s}^2$) |
| `32–43` | `f32[3]` | `VelocityX/Y/Z` | Velocity vector ($\text{m/s}$) |
| `44–55` | `f32[3]` | `AngularVelocityX/Y/Z` | Angular rotation rates ($\text{rad/s}$) |
| `56–67` | `f32[3]` | `Yaw / Pitch / Roll` | Vehicle orientation angles ($\text{rad}$) |
| `68–83` | `f32[4]` | `NormalizedSuspensionTravel` | Suspension travel ($0.0 = \text{max extension}, 1.0 = \text{max compression}$) |
| `84–99` | `f32[4]` | `TireSlipRatio` | Slip ratio per wheel ($> 1.0 = \text{wheelspin / sliding}$) |
| `100–115` | `f32[4]` | `WheelRotationSpeed` | Angular velocity per wheel ($\text{rad/s}$) |
| `164–179` | `f32[4]` | `TireSlipAngle` | Tire slip angles per wheel ($\text{radians}$) |
| `180–195` | `f32[4]` | `TireCombinedSlip` | Normalized combined lateral + longitudinal slip |
| `196–211` | `f32[4]` | `SuspensionTravelMeters` | Suspension compression distance ($\text{meters}$) |
| `212–215` | `s32` | `CarOrdinal` | Unique vehicle ID mapped to 660-car database |
| `216–219` | `s32` | `CarClass` | `0=D, 1=C, 2=B, 3=A, 4=S1, 5=S2, 6=X` |
| `220–223` | `s32` | `CarPerformanceIndex` | PI rating ($100–999$) |
| `224–227` | `s32` | `DrivetrainType` | `0=FWD, 1=RWD, 2=AWD` |
| `228–231` | `s32` | `NumCylinders` | Cylinder count |
| `244–255` | `f32[3]` | `PositionX/Y/Z` | World 3D spatial coordinates ($\text{meters}$) |
| `256–259` | `f32` | `Speed` | Absolute vehicle speed ($\text{m/s}$) |
| `260–263` | `f32` | `Power` | Engine mechanical output ($\text{watts}$) |
| `264–267` | `f32` | `Torque` | Engine torque ($\text{N}\cdot\text{m}$) |
| `268–283` | `f32[4]` | `TireTemp` | Surface tire temperatures FL, FR, RL, RR ($^\circ\text{F}$) |
| `284–287` | `f32` | `Boost` | Manifold boost pressure ($\text{PSI}$) |
| `288–291` | `f32` | `Fuel` | Fuel level ($0.0–1.0$) |
| `292–295` | `f32` | `DistanceTraveled` | Cumulative distance driven ($\text{meters}$) |
| `296–299` | `f32` | `BestLap` | Personal best lap time in seconds |
| `300–303` | `f32` | `LastLap` | Previous lap time in seconds |
| `304–307` | `f32` | `CurrentLap` | Active lap time in seconds ($0.0 = \text{free roam / stage}$) |
| `308–311` | `f32` | `CurrentRaceTime` | Continuous session uptime in seconds |
| `312–313` | `u16` | `LapNumber` | Current lap number |
| `314` | `u8` | `RacePosition` | Grid/event race position |
| `315–319` | `u8[5]` | `Accel / Brake / Clutch / HandBrake / Gear` | Driver inputs ($0–255$) and active gear |
| `320` | `s8` | `Steer` | Steering angle input ($-127 \text{ to } +127$) |

---

## 2. Raw Telemetry vs Derived Analytics

GridPulse strictly differentiates between direct physics facts from the game engine and derived heuristic calculations:

```text
RAW TELEMETRY (Deterministic Engine State)
├─ Speed & RPM
├─ Throttle, Brake, Clutch, Steer
├─ 4-Corner Tire Surface Temperatures
├─ 4-Corner Slip Angles & Slip Ratios
├─ 4-Corner Suspension Travel
└─ Lateral & Longitudinal Accelerations

DERIVED ANALYTICS & DYNAMICS (Heuristic Indicators)
├─ Handling Balance (Understeer / Oversteer Differential)
├─ Traction Utilization Estimate (%)
├─ Dynamic Wheelspin & Lockup Detection
├─ Thermal Envelope Warnings (Cold / Blistering)
└─ Suspension Bottoming Spike Detection
```

---

## 3. Chassis Balance & Traction Dynamics Engine

### A. Understeer vs Oversteer Differential
The real-time chassis balance indicator compares front axle slip angle against rear axle slip angle:

$$\Delta\alpha = \bar{\alpha}_{\text{rear}} - \bar{\alpha}_{\text{front}}$$

Where:
* $\bar{\alpha}_{\text{front}} = \frac{|\alpha_{\text{FL}}| + |\alpha_{\text{FR}}|}{2}$
* $\bar{\alpha}_{\text{rear}} = \frac{|\alpha_{\text{RL}}| + |\alpha_{\text{RR}}|}{2}$

**Interpretation**:
* $\Delta\alpha < -0.06\text{ rad}$: **Understeer (Push)** — Front tires are scrubbing with greater slip angle than rear tires.
* $-0.06 \le \Delta\alpha \le 0.08\text{ rad}$: **Balanced / Neutral Rotation** — Chassis is cornering near optimal slip yaw rate.
* $\Delta\alpha > 0.08\text{ rad}$: **Oversteer (Slip)** — Rear axle is stepping out into dynamic slip/slide.

*Note: This metric is a derived handling indicator, not a direct measurement of absolute chemical tire grip.*

### B. Traction Utilization Estimate
Calculates instantaneous friction circle acceleration demand against estimated compound envelope:

$$G_{\text{demand}} = \frac{\sqrt{a_x^2 + a_z^2}}{g}, \quad \text{Traction \%} = \min\left(100, \frac{G_{\text{demand}}}{G_{\text{max}}} \times 100\right)$$

Where $G_{\text{max}} \approx 2.4G$ (estimated peak race tire envelope). Clearly exposed in UI as an **estimate**.

### C. Live Event Detection Rules

* **Wheelspin**: Detected when Throttle $> 28\%$ ($70/255$) and any driven wheel slip ratio $> 1.15$.
* **Brake Lockup**: Detected when Brake $> 31\%$ ($80/255$) and wheel slip ratio $> 1.30$ (axle dragging).
* **Cold Tires**: Surface temperature $< 135^\circ\text{F} / 57^\circ\text{C}$ (reduced friction coefficient).
* **Overheating / Blistering**: Surface temperature $> 235^\circ\text{F} / 112^\circ\text{C}$ (compound thermal degradation).
* **Suspension Bottoming**: Normalized travel $< 0.04$ ($> 96\%$ maximum compression, bump-stop impact).

---

## 4. Telemetry-Driven Tuning Advisor Philosophy

The tuning advisor provides directional mechanical adjustments structured around a rigorous 3-step diagnostic framework:

```text
OBSERVATION ──► INFERENCE ──► DIRECTIONAL RECOMMENDATION
```

### Example Diagnostic Rules

1. **Tire Pressures (Thermal Spread)**:
   * *Observation*: Front average temperature is $18^\circ\text{F}$ higher than rear average temperature.
   * *Inference*: Front axle is carrying excessive thermal load and overheating.
   * *Recommendation*: Lower front tire pressure by $1.0 - 2.0\text{ PSI}$ (or increase rear pressure).
   * *Confidence*: High ($85\%$).

2. **Anti-Roll Bars (Corner Entry / Mid-Corner Push)**:
   * *Observation*: $\Delta\alpha < -0.07\text{ rad}$ sustained across corner apex under lateral acceleration $> 1.2G$.
   * *Inference*: Mid-corner understeer / insufficient front mechanical roll grip.
   * *Recommendation*: Soften front ARB by $3–6\text{ points}$ or stiffen rear ARB.
   * *Confidence*: High ($80\%$).

3. **Suspension Springs & Ride Height**:
   * *Observation*: Front suspension travel $< 0.03$ under braking compression dips.
   * *Inference*: Chassis is bottoming out on bump-stops, inducing sudden mechanical grip loss.
   * *Recommendation*: Raise front ride height by $+0.5\text{ cm}$ or increase spring stiffness by $+50–100\text{ N/mm}$.
   * *Confidence*: Very High ($92\%$).

> **Disclaimer**: Telemetry recommendations represent suggested baseline tuning directions derived from physical vehicle dynamics observations, rather than guarantees of in-game slider values.
