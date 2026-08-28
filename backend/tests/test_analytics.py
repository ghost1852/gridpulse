import pytest
from analytics import TelemetryAnalytics

def test_analytics_initial_state():
    engine = TelemetryAnalytics()
    state = engine.get_current_state()
    assert state["sprint_status"] == "READY"
    assert state["sprint_times"]["0_60"] is None
    assert state["sprint_times"]["quarter_mile"] is None

def test_analytics_sprint_sequence():
    engine = TelemetryAnalytics()
    
    # 1. Car holding brake at the line -> STAGING
    frame_staging = {
        "IsRaceOn": 1,
        "TimestampMS": 1000,
        "Speed": 0.0,
        "speed_mph": 0.0,
        "speed_kph": 0.0,
        "Accel": 0,
        "Brake": 100,
        "CarOrdinal": 4199,
        "CarClass": 4,
        "CarPerformanceIndex": 900,
        "TireTempFrontLeft": 180,
        "TireTempFrontRight": 180,
        "TireTempRearLeft": 180,
        "TireTempRearRight": 180,
        "AccelerationX": 0.0,
        "AccelerationZ": 0.0,
    }
    res = engine.process(frame_staging)
    assert res["state"]["sprint_status"] == "STAGING"

    # 2. Driver launches on full throttle -> RUNNING
    records_emitted = []
    ts = 1000
    for i in range(1, 180): # 3 seconds of 60Hz telemetry
        ts += 16
        progress = i / 180.0
        current_speed_mph = progress * 70.0 # Reaches 70 MPH at 3.0s (crosses 60 at ~2.57s)
        current_speed_ms = current_speed_mph / 2.23694
        
        frame = {
            "IsRaceOn": 1,
            "TimestampMS": ts,
            "Speed": current_speed_ms,
            "speed_mph": current_speed_mph,
            "speed_kph": current_speed_mph * 1.60934,
            "Accel": 255,
            "Brake": 0,
            "CarOrdinal": 4199,
            "CarClass": 4,
            "CarPerformanceIndex": 900,
            "TireTempFrontLeft": 195,
            "TireTempFrontRight": 195,
            "TireTempRearLeft": 205,
            "TireTempRearRight": 205,
            "AccelerationX": 0.2,
            "AccelerationZ": 0.8,
        }
        res = engine.process(frame)
        records_emitted.extend(res.get("records", []))

    # Verify 0-60 MPH was detected and recorded
    assert engine.sprint_60_done is True
    assert engine.sprint_times["0_60"] is not None
    assert 2.0 < engine.sprint_times["0_60"] < 3.0
    
    # Verify sprint record was queued for async DB writer
    sprint_60_rec = next((r for r in records_emitted if r.get("category") == "0-60"), None)
    assert sprint_60_rec is not None
    assert sprint_60_rec["car_ordinal"] == 4199

def test_analytics_reset():
    engine = TelemetryAnalytics()
    engine.sprint_times["0_60"] = 2.45
    engine.sprint_status = "COMPLETED"
    engine.reset_sprint()
    assert engine.sprint_status == "READY"
    assert engine.sprint_times["0_60"] is None
