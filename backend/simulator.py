import asyncio
import struct
import time
import math
from packet_parser import FORMAT_STRING, EXPECTED_LEN

class TelemetrySimulator:
    def __init__(self):
        self.start_time = time.time()
        self.distance = 0.0
        
        self.is_race_on = 1
        self.engine_max_rpm = 8500.0
        self.engine_idle_rpm = 1000.0
        
        self.car_ordinal = 1234
        self.car_class = 4 # S1
        self.car_pi = 900
        self.drivetrain = 2 # AWD
        self.cylinders = 8
        
        self.state = "accelerating" # accelerating, braking
        self.speed = 0.0 # m/s
        self.gear = 1
        self.rpm = self.engine_idle_rpm
        
        self.tire_temp = 80.0
        self.accel_g = 0.0
        
        self.pos_x = 0.0
        self.pos_y = 0.0
        self.pos_z = 10.0

        # Gear ratios for fake RPM calculation
        self.gears = {1: 3.5, 2: 2.2, 3: 1.6, 4: 1.2, 5: 0.9, 6: 0.7}
        self.final_drive = 3.5
        self.wheel_radius = 0.35

    def update(self, dt: float):
        # State machine
        if self.state == "accelerating":
            if self.speed > 67.0: # ~150 mph
                self.state = "braking"
        elif self.state == "braking":
            if self.speed <= 0.1:
                self.state = "accelerating"
                self.speed = 0.0
                self.gear = 1

        accel_input = 0
        brake_input = 0
        
        if self.state == "accelerating":
            accel_input = 255
            # Accelerate at ~0.5G -> 4.9 m/s^2
            accel = 4.9
            self.speed += accel * dt
            self.accel_g = 0.5
            
            # Tire temp climbs
            self.tire_temp = min(220.0, self.tire_temp + 2.0 * dt)
        elif self.state == "braking":
            brake_input = 255
            # Brake at ~1.0G -> 9.8 m/s^2
            accel = -9.8
            self.speed += accel * dt
            if self.speed < 0:
                self.speed = 0
            self.accel_g = -1.0
            
            # Tire temp cools slightly
            self.tire_temp = max(80.0, self.tire_temp - 5.0 * dt)

        # Update distance and position
        self.distance += self.speed * dt
        self.pos_x += self.speed * dt

        # RPM and Gear logic
        if self.speed > 0:
            # V = (RPM * 2 * pi * r) / (60 * gear * final_drive)
            # RPM = (V * 60 * gear * final_drive) / (2 * pi * r)
            self.rpm = (self.speed * 60 * self.gears[self.gear] * self.final_drive) / (2 * math.pi * self.wheel_radius)
            
            if self.rpm > self.engine_max_rpm * 0.95 and self.gear < 6:
                self.gear += 1
                self.rpm = (self.speed * 60 * self.gears[self.gear] * self.final_drive) / (2 * math.pi * self.wheel_radius)
            elif self.rpm < 3000 and self.gear > 1:
                self.gear -= 1
                self.rpm = (self.speed * 60 * self.gears[self.gear] * self.final_drive) / (2 * math.pi * self.wheel_radius)
        else:
            self.rpm = self.engine_idle_rpm
            self.gear = 1

        self.rpm = max(self.engine_idle_rpm, min(self.engine_max_rpm + 200, self.rpm))
        
        return accel_input, brake_input

    def generate_packet(self) -> bytes:
        now = time.time()
        dt = 1.0 / 60.0
        accel_input, brake_input = self.update(dt)
        
        timestamp_ms = int((now - self.start_time) * 1000)
        
        # Prepare list for unpacking
        values = [
            self.is_race_on,           # 0
            timestamp_ms,              # 1
            self.engine_max_rpm,       # 2
            self.engine_idle_rpm,      # 3
            self.rpm,                  # 4 CurrentEngineRpm
            self.accel_g * 9.8,        # 5 AccelX
            0.0,                       # 6 AccelY
            0.0,                       # 7 AccelZ
            self.speed,                # 8 VelX
            0.0,                       # 9 VelY
            0.0,                       # 10 VelZ
            0.0, 0.0, 0.0,             # 11-13 AngVel
            0.0, 0.0, 0.0,             # 14-16 Yaw/Pitch/Roll
            0.5, 0.5, 0.5, 0.5,        # 17-20 NormSusp
            0.0, 0.0, 0.0, 0.0,        # 21-24 SlipRatio
            self.speed / self.wheel_radius, self.speed / self.wheel_radius, self.speed / self.wheel_radius, self.speed / self.wheel_radius, # 25-28 WheelRotSpeed
            0, 0, 0, 0,                # 29-32 RumbleStrip
            0.0, 0.0, 0.0, 0.0,        # 33-36 Puddle
            0.0, 0.0, 0.0, 0.0,        # 37-40 Rumble
            0.0, 0.0, 0.0, 0.0,        # 41-44 SlipAngle
            0.0, 0.0, 0.0, 0.0,        # 45-48 CombinedSlip
            0.2, 0.2, 0.2, 0.2,        # 49-52 SuspTravelMeters
            self.car_ordinal,          # 53
            self.car_class,            # 54
            self.car_pi,               # 55
            self.drivetrain,           # 56
            self.cylinders,            # 57
            b'\x00' * 12,              # 58 padding
            self.pos_x, self.pos_y, self.pos_z, # 59-61 Pos
            self.speed,                # 62 Speed
            200000.0,                  # 63 Power
            400.0,                     # 64 Torque
            self.tire_temp, self.tire_temp, self.tire_temp, self.tire_temp, # 65-68 TireTemp
            0.0,                       # 69 Boost
            1.0,                       # 70 Fuel
            self.distance,             # 71 Dist
            0.0, 0.0, 0.0, 0.0,        # 72-75 Laps/Time
            1,                         # 76 LapNumber
            1,                         # 77 RacePos
            accel_input,               # 78 Accel
            brake_input,               # 79 Brake
            0,                         # 80 Clutch
            0,                         # 81 Handbrake
            self.gear,                 # 82 Gear
            0,                         # 83 Steer
            0,                         # 84 Line
            0                          # 85 AIBrake
        ]
        
        packet = struct.pack(FORMAT_STRING, *values)
        return packet

    async def run(self, callback):
        while True:
            packet = self.generate_packet()
            await callback(packet)
            await asyncio.sleep(1/60.0)
