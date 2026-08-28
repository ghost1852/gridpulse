import struct
import logging

logger = logging.getLogger(__name__)

# Based on Forza Horizon telemetry format (Dash format)
# Total size expected is around 324 bytes.
# We'll use struct to unpack the data.
# < means little-endian

FORMAT_STRING = (
    "<"
    "i"          # 0: IsRaceOn
    "I"          # 4: TimestampMS
    "f"          # 8: EngineMaxRpm
    "f"          # 12: EngineIdleRpm
    "f"          # 16: CurrentEngineRpm
    "f"          # 20: AccelerationX
    "f"          # 24: AccelerationY
    "f"          # 28: AccelerationZ
    "f"          # 32: VelocityX
    "f"          # 36: VelocityY
    "f"          # 40: VelocityZ
    "f"          # 44: AngularVelocityX
    "f"          # 48: AngularVelocityY
    "f"          # 52: AngularVelocityZ
    "f"          # 56: Yaw
    "f"          # 60: Pitch
    "f"          # 64: Roll
    "f"          # 68: NormalizedSuspensionTravelFrontLeft
    "f"          # 72: NormalizedSuspensionTravelFrontRight
    "f"          # 76: NormalizedSuspensionTravelRearLeft
    "f"          # 80: NormalizedSuspensionTravelRearRight
    "f"          # 84: TireSlipRatioFrontLeft
    "f"          # 88: TireSlipRatioFrontRight
    "f"          # 92: TireSlipRatioRearLeft
    "f"          # 96: TireSlipRatioRearRight
    "f"          # 100: WheelRotationSpeedFrontLeft
    "f"          # 104: WheelRotationSpeedFrontRight
    "f"          # 108: WheelRotationSpeedRearLeft
    "f"          # 112: WheelRotationSpeedRearRight
    "i"          # 116: WheelOnRumbleStripFrontLeft
    "i"          # 120: WheelOnRumbleStripFrontRight
    "i"          # 124: WheelOnRumbleStripRearLeft
    "i"          # 128: WheelOnRumbleStripRearRight
    "f"          # 132: WheelInPuddleDepthFrontLeft
    "f"          # 136: WheelInPuddleDepthFrontRight
    "f"          # 140: WheelInPuddleDepthRearLeft
    "f"          # 144: WheelInPuddleDepthRearRight
    "f"          # 148: SurfaceRumbleFrontLeft
    "f"          # 152: SurfaceRumbleFrontRight
    "f"          # 156: SurfaceRumbleRearLeft
    "f"          # 160: SurfaceRumbleRearRight
    "f"          # 164: TireSlipAngleFrontLeft
    "f"          # 168: TireSlipAngleFrontRight
    "f"          # 172: TireSlipAngleRearLeft
    "f"          # 176: TireSlipAngleRearRight
    "f"          # 180: TireCombinedSlipFrontLeft
    "f"          # 184: TireCombinedSlipFrontRight
    "f"          # 188: TireCombinedSlipRearLeft
    "f"          # 192: TireCombinedSlipRearRight
    "f"          # 196: SuspensionTravelMetersFrontLeft
    "f"          # 200: SuspensionTravelMetersFrontRight
    "f"          # 204: SuspensionTravelMetersRearLeft
    "f"          # 208: SuspensionTravelMetersRearRight
    "i"          # 212: CarOrdinal
    "i"          # 216: CarClass
    "i"          # 220: CarPerformanceIndex
    "i"          # 224: DrivetrainType
    "i"          # 228: NumCylinders
    "12s"        # 232: 12 bytes padding
    "f"          # 244: PositionX
    "f"          # 248: PositionY
    "f"          # 252: PositionZ
    "f"          # 256: Speed
    "f"          # 260: Power
    "f"          # 264: Torque
    "f"          # 268: TireTempFrontLeft
    "f"          # 272: TireTempFrontRight
    "f"          # 276: TireTempRearLeft
    "f"          # 280: TireTempRearRight
    "f"          # 284: Boost
    "f"          # 288: Fuel
    "f"          # 292: DistanceTraveled
    "f"          # 296: BestLap
    "f"          # 300: LastLap
    "f"          # 304: CurrentLap
    "f"          # 308: CurrentRaceTime
    "H"          # 312: LapNumber
    "B"          # 314: RacePosition
    "B"          # 315: Accel
    "B"          # 316: Brake
    "B"          # 317: Clutch
    "B"          # 318: HandBrake
    "B"          # 319: Gear
    "b"          # 320: Steer
    "B"          # 321: NormalizedDrivingLine
    "B"          # 322: NormalizedAIBrakeDifference
)
# We will only unpack the exact expected length (323 bytes). If 324 is sent, we slice.
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

def parse_packet(data: bytes) -> dict:
    """
    Parses a Forza Horizon telemetry packet.
    """
    if len(data) < EXPECTED_LEN:
        # Not a complete dash packet
        return {}

    # Slice out just the portion we're unpacking
    try:
        unpacked = struct.unpack(FORMAT_STRING, data[:EXPECTED_LEN])
    except struct.error as e:
        logger.error(f"Error unpacking packet: {e}")
        return {}

    speed_ms = unpacked[62]
    speed_mph = speed_ms * 2.23694
    speed_kph = speed_ms * 3.6

    car_class_int = unpacked[54]
    car_pi = unpacked[55]

    if car_pi >= 999:
        car_class_name = "X"
    elif car_class_int == 6 or car_pi == 998:
        car_class_name = "R"
    else:
        car_class_name = CAR_CLASSES.get(car_class_int, str(car_class_int))
    
    telemetry = {
        "IsRaceOn": unpacked[0],
        "TimestampMS": unpacked[1],
        "EngineMaxRpm": unpacked[2],
        "EngineIdleRpm": unpacked[3],
        "CurrentEngineRpm": unpacked[4],
        "AccelerationX": unpacked[5],
        "AccelerationY": unpacked[6],
        "AccelerationZ": unpacked[7],
        "VelocityX": unpacked[8],
        "VelocityY": unpacked[9],
        "VelocityZ": unpacked[10],
        "AngularVelocityX": unpacked[11],
        "AngularVelocityY": unpacked[12],
        "AngularVelocityZ": unpacked[13],
        "Yaw": unpacked[14],
        "Pitch": unpacked[15],
        "Roll": unpacked[16],
        "NormalizedSuspensionTravelFrontLeft": unpacked[17],
        "NormalizedSuspensionTravelFrontRight": unpacked[18],
        "NormalizedSuspensionTravelRearLeft": unpacked[19],
        "NormalizedSuspensionTravelRearRight": unpacked[20],
        "TireSlipRatioFrontLeft": unpacked[21],
        "TireSlipRatioFrontRight": unpacked[22],
        "TireSlipRatioRearLeft": unpacked[23],
        "TireSlipRatioRearRight": unpacked[24],
        "WheelRotationSpeedFrontLeft": unpacked[25],
        "WheelRotationSpeedFrontRight": unpacked[26],
        "WheelRotationSpeedRearLeft": unpacked[27],
        "WheelRotationSpeedRearRight": unpacked[28],
        "WheelOnRumbleStripFrontLeft": unpacked[29],
        "WheelOnRumbleStripFrontRight": unpacked[30],
        "WheelOnRumbleStripRearLeft": unpacked[31],
        "WheelOnRumbleStripRearRight": unpacked[32],
        "WheelInPuddleDepthFrontLeft": unpacked[33],
        "WheelInPuddleDepthFrontRight": unpacked[34],
        "WheelInPuddleDepthRearLeft": unpacked[35],
        "WheelInPuddleDepthRearRight": unpacked[36],
        "SurfaceRumbleFrontLeft": unpacked[37],
        "SurfaceRumbleFrontRight": unpacked[38],
        "SurfaceRumbleRearLeft": unpacked[39],
        "SurfaceRumbleRearRight": unpacked[40],
        "TireSlipAngleFrontLeft": unpacked[41],
        "TireSlipAngleFrontRight": unpacked[42],
        "TireSlipAngleRearLeft": unpacked[43],
        "TireSlipAngleRearRight": unpacked[44],
        "TireCombinedSlipFrontLeft": unpacked[45],
        "TireCombinedSlipFrontRight": unpacked[46],
        "TireCombinedSlipRearLeft": unpacked[47],
        "TireCombinedSlipRearRight": unpacked[48],
        "SuspensionTravelMetersFrontLeft": unpacked[49],
        "SuspensionTravelMetersFrontRight": unpacked[50],
        "SuspensionTravelMetersRearLeft": unpacked[51],
        "SuspensionTravelMetersRearRight": unpacked[52],
        "CarOrdinal": unpacked[53],
        "CarClass": car_class_int,
        "CarPerformanceIndex": unpacked[55],
        "DrivetrainType": unpacked[56],
        "NumCylinders": unpacked[57],
        # skipped padding 58
        "PositionX": unpacked[59],
        "PositionY": unpacked[60],
        "PositionZ": unpacked[61],
        "Speed": speed_ms,
        "Power": unpacked[63],
        "Torque": unpacked[64],
        "TireTempFrontLeft": unpacked[65],
        "TireTempFrontRight": unpacked[66],
        "TireTempRearLeft": unpacked[67],
        "TireTempRearRight": unpacked[68],
        "Boost": unpacked[69],
        "Fuel": unpacked[70],
        "DistanceTraveled": unpacked[71],
        "BestLap": unpacked[72],
        "LastLap": unpacked[73],
        "CurrentLap": unpacked[74],
        "CurrentRaceTime": unpacked[75],
        "LapNumber": unpacked[76],
        "RacePosition": unpacked[77],
        "Accel": unpacked[78],
        "Brake": unpacked[79],
        "Clutch": unpacked[80],
        "HandBrake": unpacked[81],
        "Gear": unpacked[82],
        "Steer": unpacked[83],
        "NormalizedDrivingLine": unpacked[84],
        "NormalizedAIBrakeDifference": unpacked[85],
        
        "speed_mph": speed_mph,
        "speed_kph": speed_kph,
        "car_class_name": CAR_CLASSES.get(car_class_int, str(car_class_int)),
        "drivetrain_name": DRIVETRAINS.get(unpacked[56], str(unpacked[56])),
    }
    
    return telemetry
