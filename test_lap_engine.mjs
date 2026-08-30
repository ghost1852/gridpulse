import { LapInferenceEngine } from "./frontend/src/lib/lapEngine.ts";

console.log("================================================================================");
console.log("GRIDPULSE: SPATIAL LAP INFERENCE & VEHICLE-MOTION STATE ENGINE VERIFICATION");
console.log("================================================================================");

const engine = new LapInferenceEngine();
engine.reset(false);

let allPassed = true;
function assert(desc, condition) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
    allPassed = false;
  }
}

// ---------------------------------------------------------------------------------------------
// Test 1: Set S/F Gate at (0, 0, 0) with forward track vector (0, 1) [Heading North along +Z]
// ---------------------------------------------------------------------------------------------
engine.setCustomGate(0, 0, 0, 0, 1, 30.0);
assert("Gate created at (0, 0, 0) facing +Z", engine.getGate() !== null && engine.getGate().normal.z === 1);

// ---------------------------------------------------------------------------------------------
// Test 2: Crossing S/F from behind (z: -5 -> +5) moving forward -> Starts Lap 1
// ---------------------------------------------------------------------------------------------
engine.processFrame(0, 0, -5, 0, 0, 20, 45, 1.0, 1000);
const r1 = engine.processFrame(0, 0, 5, 0, 0, 20, 45, 1.1, 1100);
assert("Starts Lap 1 upon first crossing", r1.lapNumber === 1 && r1.completedLap === null);

// ---------------------------------------------------------------------------------------------
// Test 3: Stopping or lingering near S/F line does NOT repeatedly trigger crossings
// ---------------------------------------------------------------------------------------------
const rStay1 = engine.processFrame(0, 0, 0.5, 0, 0, 0, 0, 2.0, 2000);
const rStay2 = engine.processFrame(0, 0, -0.2, 0, 0, 0, 0, 3.0, 3000);
assert("Lingering/stopping on S/F line does not falsely complete lap", engine.getCompletedLaps().length === 0 && rStay2.completedLap === null);

// ---------------------------------------------------------------------------------------------
// Test 4: Complete circular circuit (radius ~100m, perimeter ~628m, ~30s elapsed) -> Records Lap 1
// ---------------------------------------------------------------------------------------------
let t = 4.0;
let tsMs = 4000;
const radius = 100;
for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
  const x = Math.sin(angle) * radius;
  const z = -Math.cos(angle) * radius + radius; // loop starting at z=0, curving out and back to z=0
  const vx = Math.cos(angle) * 20;
  const vz = Math.sin(angle) * 20;
  t += 0.5;
  tsMs += 500;
  engine.processFrame(x, 0, z, vx, 0, vz, 45, t, tsMs);
}

// Now approach S/F from -5 to +5 on finish straight
engine.processFrame(0, 0, -5, 0, 0, 20, 50, t + 0.1, tsMs + 100);
const rLap1 = engine.processFrame(0, 0, 5, 0, 0, 20, 50, t + 0.2, tsMs + 200);
assert("Crossing S/F after completing circuit records Lap 1", rLap1.completedLap !== null && rLap1.completedLap.lapNumber === 1 && rLap1.completedLap.lapTime > 15);
assert("Lap 1 is valid", rLap1.completedLap.valid === true);
assert("Engine transitions to Lap 2", rLap1.lapNumber === 2);

// ---------------------------------------------------------------------------------------------
// Test 5: Crossing from wrong direction (driving backward North -> South, z: 5 -> -5) -> IGNORED
// ---------------------------------------------------------------------------------------------
t += 20;
tsMs += 20000;
// Advance circuit far enough to arm
engine.processFrame(100, 0, 100, 0, 0, 20, 50, t, tsMs);
t += 10;
tsMs += 10000;
engine.processFrame(0, 0, 5, 0, 0, -20, 50, t + 0.1, tsMs + 100); // Heading -Z (backward)
const rWrongWay = engine.processFrame(0, 0, -5, 0, 0, -20, 50, t + 0.2, tsMs + 200);
assert("Wrong-way crossing is correctly ignored", rWrongWay.completedLap === null && engine.getCompletedLaps().length === 1);

// ---------------------------------------------------------------------------------------------
// Test 6: In-game Rewind during lap -> Lap becomes DIRTY/INVALID
// ---------------------------------------------------------------------------------------------
t += 5;
tsMs += 5000;
engine.processFrame(150, 0, 150, 20, 0, 0, 50, t, tsMs);
// Rewind occurs: timestampMs drops by 2000ms
const rRewind = engine.processFrame(140, 0, 150, 20, 0, 0, 50, t - 2.0, tsMs - 2000);
assert("Rewind detected and state updated to REWOUND/DIRTY", rRewind.isDirty === true);

// Complete lap after rewind
for (let angle = 0; angle < Math.PI * 2; angle += 0.15) {
  const x = Math.sin(angle) * radius;
  const z = -Math.cos(angle) * radius + radius;
  t += 0.5;
  tsMs += 500;
  engine.processFrame(x, 0, z, 0, 0, 20, 45, t, tsMs);
}
engine.processFrame(0, 0, -5, 0, 0, 20, 50, t + 0.1, tsMs + 100);
const rLap2 = engine.processFrame(0, 0, 5, 0, 0, 20, 50, t + 0.2, tsMs + 200);
assert("Lap completed after rewind is flagged valid=false (DIRTY)", rLap2.completedLap !== null && rLap2.completedLap.valid === false && rLap2.completedLap.dirtyReason === "REWIND");

// ---------------------------------------------------------------------------------------------
// Test 7: Native FH6 In-Game Circuit telemetry -> Native timing is authoritative
// ---------------------------------------------------------------------------------------------
engine.reset(false);
const rNative1 = engine.processFrame(0, 0, 0, 0, 0, 0, 60, 50.0, 50000, 42.125, 0, 1);
assert("Native live lap time is used when current_lap > 0", rNative1.liveLapTime === 42.125);

// Native Lap 1 finish broadcast
const rNative2 = engine.processFrame(0, 0, 0, 0, 0, 0, 65, 75.0, 75000, 1.250, 64.892, 2);
assert("Native completed lap logged with exact FH6 lap time", rNative2.completedLap !== null && rNative2.completedLap.lapTime === 64.892 && rNative2.completedLap.lapNumber === 1);

console.log("================================================================================");
if (allPassed) {
  console.log(">>> ALL 7 LAP INFERENCE & MOTION TESTS PASSED PERFECTLY! <<<");
} else {
  console.error(">>> SOME TESTS FAILED <<<");
  process.exit(1);
}
