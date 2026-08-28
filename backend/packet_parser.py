import struct
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Forza Little-Endian (Dash Format) Struct Definition
FORMAT_STRING = (
    "<"
    "i"          # 0: IsRaceOn
    "I"          # 1: TimestampMS
    "f"          # 2: EngineMaxRpm
    "f"          # 3: EngineIdleRpm
    "f"          # 4: CurrentEngineRpm
    "f"          # 5: AccelerationX
    "f"          # 6: AccelerationY
    "f"          # 7: AccelerationZ
    "f"          # 8: VelocityX
    "f"          # 9: VelocityY
    "f"          # 10: VelocityZ
    "f"          # 11: AngularVelocityX
    "f"          # 12: AngularVelocityY
    "f"          # 13: AngularVelocityZ
    "f"          # 14: Yaw
    "f"          # 15: Pitch
    "f"          # 16: Roll
    "f"          # 17: NormalizedSuspensionTravelFrontLeft
    "f"          # 18: NormalizedSuspensionTravelFrontRight
    "f"          # 19: NormalizedSuspensionTravelRearLeft
    "f"          # 20: NormalizedSuspensionTravelRearRight
    "f"          # 21: TireSlipRatioFrontLeft
    "f"          # 22: TireSlipRatioFrontRight
    "f"          # 23: TireSlipRatioRearLeft
    "f"          # 24: TireSlipRatioRearRight
    "f"          # 25: WheelRotationSpeedFrontLeft
    "f"          # 26: WheelRotationSpeedFrontRight
    "f"          # 27: WheelRotationSpeedRearLeft
    "f"          # 28: WheelRotationSpeedRearRight
    "i"          # 29: WheelOnRumbleStripFrontLeft
    "i"          # 30: WheelOnRumbleStripFrontRight
    "i"          # 31: WheelOnRumbleStripRearLeft
    "i"          # 32: WheelOnRumbleStripRearRight
    "f"          # 33: WheelInPuddleDepthFrontLeft
    "f"          # 34: WheelInPuddleDepthFrontRight
    "f"          # 35: WheelInPuddleDepthRearLeft
    "f"          # 36: WheelInPuddleDepthRearRight
    "f"          # 37: SurfaceRumbleFrontLeft
    "f"          # 38: SurfaceRumbleFrontRight
    "f"          # 39: SurfaceRumbleRearLeft
    "f"          # 40: SurfaceRumbleRearRight
    "f"          # 41: TireSlipAngleFrontLeft
    "f"          # 42: TireSlipAngleFrontRight
    "f"          # 43: TireSlipAngleRearLeft
    "f"          # 44: TireSlipAngleRearRight
    "f"          # 45: TireCombinedSlipFrontLeft
    "f"          # 46: TireCombinedSlipFrontRight
    "f"          # 47: TireCombinedSlipRearLeft
    "f"          # 48: TireCombinedSlipRearRight
    "f"          # 49: SuspensionTravelMetersFrontLeft
    "f"          # 50: SuspensionTravelMetersFrontRight
    "f"          # 51: SuspensionTravelMetersRearLeft
    "f"          # 52: SuspensionTravelMetersRearRight
    "i"          # 53: CarOrdinal
    "i"          # 54: CarClass
    "i"          # 55: CarPerformanceIndex
    "i"          # 56: DrivetrainType
    "i"          # 57: NumCylinders
    "12s"        # 58: 12 bytes padding
    "f"          # 59: PositionX
    "f"          # 60: PositionY
    "f"          # 61: PositionZ
    "f"          # 62: Speed
    "f"          # 63: Power
    "f"          # 64: Torque
    "f"          # 65: TireTempFrontLeft
    "f"          # 66: TireTempFrontRight
    "f"          # 67: TireTempRearLeft
    "f"          # 68: TireTempRearRight
    "f"          # 69: Boost
    "f"          # 70: Fuel
    "f"          # 71: DistanceTraveled
    "f"          # 72: BestLap
    "f"          # 73: LastLap
    "f"          # 74: CurrentLap
    "f"          # 75: CurrentRaceTime
    "H"          # 76: LapNumber
    "B"          # 77: RacePosition
    "B"          # 78: Accel
    "B"          # 79: Brake
    "B"          # 80: Clutch
    "B"          # 81: HandBrake
    "B"          # 82: Gear
    "b"          # 83: Steer
    "B"          # 84: NormalizedDrivingLine
    "B"          # 85: NormalizedAIBrakeDifference
)

FIELD_NAMES = [
    "IsRaceOn", "TimestampMS", "EngineMaxRpm", "EngineIdleRpm", "CurrentEngineRpm",
    "AccelerationX", "AccelerationY", "AccelerationZ", "VelocityX", "VelocityY", "VelocityZ",
    "AngularVelocityX", "AngularVelocityY", "AngularVelocityZ", "Yaw", "Pitch", "Roll",
    "NormalizedSuspensionTravelFrontLeft", "NormalizedSuspensionTravelFrontRight",
    "NormalizedSuspensionTravelRearLeft", "NormalizedSuspensionTravelRearRight",
    "TireSlipRatioFrontLeft", "TireSlipRatioFrontRight", "TireSlipRatioRearLeft", "TireSlipRatioRearRight",
    "WheelRotationSpeedFrontLeft", "WheelRotationSpeedFrontRight", "WheelRotationSpeedRearLeft", "WheelRotationSpeedRearRight",
    "WheelOnRumbleStripFrontLeft", "WheelOnRumbleStripFrontRight", "WheelOnRumbleStripRearLeft", "WheelOnRumbleStripRearRight",
    "WheelInPuddleDepthFrontLeft", "WheelInPuddleDepthFrontRight", "WheelInPuddleDepthRearLeft", "WheelInPuddleDepthRearRight",
    "SurfaceRumbleFrontLeft", "SurfaceRumbleFrontRight", "SurfaceRumbleRearLeft", "SurfaceRumbleRearRight",
    "TireSlipAngleFrontLeft", "TireSlipAngleFrontRight", "TireSlipAngleRearLeft", "TireSlipAngleRearRight",
    "TireCombinedSlipFrontLeft", "TireCombinedSlipFrontRight", "TireCombinedSlipRearLeft", "TireCombinedSlipRearRight",
    "SuspensionTravelMetersFrontLeft", "SuspensionTravelMetersFrontRight", "SuspensionTravelMetersRearLeft", "SuspensionTravelMetersRearRight",
    "CarOrdinal", "CarClass", "CarPerformanceIndex", "DrivetrainType", "NumCylinders",
    "_padding", "PositionX", "PositionY", "PositionZ", "Speed", "Power", "Torque",
    "TireTempFrontLeft", "TireTempFrontRight", "TireTempRearLeft", "TireTempRearRight",
    "Boost", "Fuel", "DistanceTraveled", "BestLap", "LastLap", "CurrentLap", "CurrentRaceTime",
    "LapNumber", "RacePosition", "Accel", "Brake", "Clutch", "HandBrake", "Gear", "Steer",
    "NormalizedDrivingLine", "NormalizedAIBrakeDifference"
]

EXPECTED_LEN = struct.calcsize(FORMAT_STRING)

CAR_CLASSES = {
    0: "D",
    1: "C",
    2: "B",
    3: "A",
    4: "S1",
    5: "S2",
    6: "R",
    7: "P",
    8: "X"
}

DRIVETRAINS = {
    0: "FWD",
    1: "RWD",
    2: "AWD"
}

def resolve_car_class(car_class_int: int, car_pi: int) -> str:
    """Resolve car class string accounting for official Forza PI thresholds."""
    if car_pi >= 999:
        return "X"
    if car_class_int == 6 or car_pi == 998:
        return "R"
    return CAR_CLASSES.get(car_class_int, str(car_class_int))

def parse_packet(data: bytes) -> Dict[str, Any]:
    """
    Parses a Forza Horizon / Motorsport telemetry packet (Dash format).
    Returns a mapped dictionary of telemetry fields, or empty dict if invalid.
    """
    if len(data) < EXPECTED_LEN:
        return {}

    try:
        values = struct.unpack(FORMAT_STRING, data[:EXPECTED_LEN])
    except struct.error as e:
        logger.error(f"Error unpacking packet: {e}")
        return {}

    telemetry: Dict[str, Any] = {}
    for name, val in zip(FIELD_NAMES, values):
        if name != "_padding":
            telemetry[name] = val

    speed_ms = telemetry.get("Speed", 0.0)
    car_class_int = telemetry.get("CarClass", 0)
    car_pi = telemetry.get("CarPerformanceIndex", 100)
    drivetrain_int = telemetry.get("DrivetrainType", 1)

    # Computed fields
    telemetry["speed_mph"] = speed_ms * 2.23694
    telemetry["speed_kph"] = speed_ms * 3.6
    telemetry["car_class_name"] = resolve_car_class(car_class_int, car_pi)
    telemetry["drivetrain_name"] = DRIVETRAINS.get(drivetrain_int, str(drivetrain_int))

    return telemetry
