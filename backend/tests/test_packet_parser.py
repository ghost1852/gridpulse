import struct
import pytest
from packet_parser import parse_packet, resolve_car_class, FORMAT_STRING, EXPECTED_LEN

def test_resolve_car_class():
    assert resolve_car_class(0, 450) == "D"
    assert resolve_car_class(3, 800) == "A"
    assert resolve_car_class(4, 900) == "S1"
    assert resolve_car_class(5, 998) == "R"  # PI 998 is R class
    assert resolve_car_class(6, 998) == "R"  # Ordinal 6 is R class
    assert resolve_car_class(5, 999) == "X"  # PI >= 999 is X class

def test_parse_invalid_short_packet():
    data = b"\x00" * 100
    res = parse_packet(data)
    assert res == {}

def test_parse_valid_packet():
    # Construct a synthetic 324-byte packet
    # Speed = 44.704 m/s (100 MPH)
    values = [0] * 86
    values[0] = 1       # IsRaceOn
    values[1] = 123456  # TimestampMS
    values[2] = 8500.0  # EngineMaxRpm
    values[4] = 6200.0  # CurrentEngineRpm
    values[53] = 4199   # CarOrdinal
    values[54] = 4      # CarClass (S1)
    values[55] = 900    # PI
    values[56] = 2      # AWD
    values[57] = 8      # NumCylinders
    values[58] = b"\x00" * 12 # Padding
    values[62] = 44.704 # Speed (m/s) -> 100 MPH
    values[63] = 450000.0 # Power
    values[64] = 600.0    # Torque
    values[65] = 185.0    # TireTempFrontLeft
    values[66] = 185.0    # TireTempFrontRight
    values[67] = 190.0    # TireTempRearLeft
    values[68] = 190.0    # TireTempRearRight
    values[78] = 255      # Throttle
    values[82] = 3        # Gear

    packed = struct.pack(FORMAT_STRING, *values)
    assert len(packed) >= EXPECTED_LEN

    telemetry = parse_packet(packed)
    assert telemetry != {}
    assert telemetry["IsRaceOn"] == 1
    assert telemetry["CarOrdinal"] == 4199
    assert telemetry["car_class_name"] == "S1"
    assert telemetry["drivetrain_name"] == "AWD"
    assert round(telemetry["speed_mph"], 1) == 100.0
    assert round(telemetry["speed_kph"], 1) == 160.9
    assert telemetry["CurrentEngineRpm"] == 6200.0
    assert telemetry["Gear"] == 3
    assert telemetry["Accel"] == 255
