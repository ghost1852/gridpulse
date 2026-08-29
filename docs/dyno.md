# GridPulse — Virtual Chassis Dyno & Thrust Lab

## Overview

GridPulse features a real-time virtual chassis dyno and multi-gear thrust analyzer engineered to measure raw engine mechanical output, verify mathematical horsepower/torque crossover ($HP = \frac{TQ \times RPM}{5252}$), and calculate optimal transmission shift points.

---

## 1. Mathematical Principles & Data Ingress

During a wide-open-throttle (WOT) pull, GridPulse samples engine mechanical power (Watts) and engine torque (Newton-meters) at high frequency directly from the Forza physics engine packet:

* **Power Conversion**: $HP = \text{Power (Watts)} \times 0.00134102$
* **Torque Conversion**: $TQ (\text{lb-ft}) = \text{Torque (Nm)} \times 0.737562$
* **Crossover Verification**: At $5,252\text{ RPM}$, mechanical horsepower and torque must intersect ($HP \equiv TQ$). GridPulse validates this crossover mathematically on every sweep.

---

## 2. Signal Processing & Curve Generation

Raw telemetry during acceleration contains micro-oscillations caused by tire slip, drivetrain flex, and gear changes. GridPulse processes raw sweep points through a robust statistical pipeline:

1. **RPM Binning (100-RPM Windows)**: Data points collected during full throttle ($\text{Throttle} \ge 90\%$) are bucketed into 100-RPM intervals.
2. **Outlier Filtration & Mean Aggregation**: Transient RPM spikes and traction-control cuts are filtered.
3. **Polynomial Curve Smoothing**: Aggregated bins undergo 3-point polynomial smoothing to produce clean, dyno-grade horsepower and torque curves.

---

## 3. Automated WOT Pull Assistant

GridPulse includes an automated staging tachometer guiding the driver through single-gear dyno pulls:

```text
[ IDLE / STAGING ] ──> [ WIDE OPEN THROTTLE ] ──> [ REDLINE REACHED ] ──> [ COOLDOWN / SAVED ]
   (Gear 3 or 4)        (Hold 100% Throttle)      (Rev-Limiter Peak)      (Automatic Curve Plot)
```

* **Staging Phase**: Driver holds cruising RPM in the test gear (typically 3rd or 4th gear).
* **Pull Phase**: Driver pins throttle to 100%. The dyno logs continuous RPM, power, torque, and speed.
* **Completion**: When RPM crosses $96\%$ of rev limiter, the pull automatically completes and plots the power curve.

---

## 4. Multi-Gear Thrust Curves & Gearing Optimizer

In addition to single-gear engine sweeps, GridPulse records multi-gear road pulls to plot **Wheel Power / Thrust vs Road Speed (MPH / KM/H)**:

* **Per-Gear Speed Thrust Slices**: Visualizes how each gear transmits power to the tarmac as vehicle speed climbs.
* **Powerband Analysis**: Identifies the 85% peak horsepower operating window.
* **Upshift Shift Point Advisor**: Calculates the exact RPM at which the next gear delivers equal or greater wheel thrust, maximizing acceleration down straights.
