class TelemetryAnalytics:
    def __init__(self):
        self.sprint_active = False
        self.sprint_completed = False
        self.sprint_start_timestamp_ms = 0
        self.sprint_distance_m = 0.0
        self.last_packet_timestamp_ms = 0
        
        self.time_at_60_s = 0.0
        self.time_at_100kph_s = 0.0
        
        self.sprint_60_done = False
        self.sprint_100_done = False
        self.sprint_60_130_done = False
        self.sprint_100kph_done = False
        self.sprint_160kph_done = False
        self.sprint_100_200kph_done = False
        self.sprint_quarter_done = False
        self.sprint_half_done = False
        self.sprint_1km_done = False
        
        self.sprint_times = {
            "0_60": None,
            "0_100": None,
            "60_130": None,
            "0_100kph": None,
            "0_160kph": None,
            "100_200kph": None,
            "quarter_mile": None,
            "half_mile": None,
            "1km": None,
            "trap_speed_quarter_mph": None,
            "trap_speed_quarter_kph": None,
            "trap_speed_half_mph": None,
            "trap_speed_half_kph": None,
            "trap_speed_1km_kph": None,
            "distance_m": 0.0,
            "distance_ft": 0.0,
        }
        self.sprint_status = "READY"
        
        self.braking_active = False
        self.braking_start_speed = 0.0
        self.braking_distance_m = 0.0
        self.braking_start_timestamp_ms = 0

        # Peak stats
        self.peak_tire_temp = 0.0
        self.peak_lat_g = 0.0
        self.peak_dec_g = 0.0
        self.top_speed = 0.0

        # Rewind tracking
        self.last_timestamp_ms = 0
        self.is_rewinding = False

        self.current_state = {}

    def reset_sprint(self):
        self.sprint_active = False
        self.sprint_completed = False
        self.sprint_start_timestamp_ms = 0
        self.sprint_distance_m = 0.0
        self.time_at_60_s = 0.0
        self.time_at_100kph_s = 0.0
        self.sprint_60_done = False
        self.sprint_100_done = False
        self.sprint_60_130_done = False
        self.sprint_100kph_done = False
        self.sprint_160kph_done = False
        self.sprint_100_200kph_done = False
        self.sprint_quarter_done = False
        self.sprint_half_done = False
        self.sprint_1km_done = False
        self.sprint_status = "READY"
        self.sprint_times = {
            "0_60": None,
            "0_100": None,
            "60_130": None,
            "0_100kph": None,
            "0_160kph": None,
            "100_200kph": None,
            "quarter_mile": None,
            "half_mile": None,
            "1km": None,
            "trap_speed_quarter_mph": None,
            "trap_speed_quarter_kph": None,
            "trap_speed_half_mph": None,
            "trap_speed_half_kph": None,
            "trap_speed_1km_kph": None,
            "distance_m": 0.0,
            "distance_ft": 0.0,
        }

    def process(self, telemetry: dict) -> dict:
        records = []
        speed_ms = float(telemetry.get("Speed", 0.0))
        speed_mph = float(telemetry.get("speed_mph", 0.0))
        speed_kph = float(telemetry.get("speed_kph", 0.0))
        timestamp_ms = telemetry.get("TimestampMS", 0)
        accel = telemetry.get("Accel", 0)
        brake = telemetry.get("Brake", 0)
        
        # Rewind detection: timestamp moved backwards
        self.is_rewinding = False
        if self.last_timestamp_ms > 0 and timestamp_ms < (self.last_timestamp_ms - 200):
            self.is_rewinding = True
            self.sprint_active = False
            self.braking_active = False
            self.sprint_status = "REWIND"

        dt_s = 0.0
        if self.last_packet_timestamp_ms > 0 and timestamp_ms > self.last_packet_timestamp_ms:
            dt_s = (timestamp_ms - self.last_packet_timestamp_ms) / 1000.0
            if dt_s > 0.5:
                dt_s = 0.016

        self.last_timestamp_ms = timestamp_ms
        self.last_packet_timestamp_ms = timestamp_ms

        car_info = {
            "car_ordinal": telemetry.get("CarOrdinal", 0),
            "car_class": telemetry.get("CarClass", 0),
            "car_pi": telemetry.get("CarPerformanceIndex", 0)
        }

        # ----------------------------------------------------
        # HIGH-PRECISION DRAG STRIP TIMING ENGINE
        # ----------------------------------------------------
        if not self.is_rewinding and timestamp_ms > 0:
            # When vehicle is stopped: Auto-Ready / Staging
            if speed_mph < 2.0:
                if self.sprint_active:
                    # Vehicle was running and has now come to a stop
                    self.sprint_active = False
                    self.sprint_completed = True
                
                # Automatically ready the strip whenever stopped!
                if brake > 30:
                    self.sprint_status = "STAGING"
                else:
                    self.sprint_status = "READY"
            
            # Launch from Stop: Vehicle begins accelerating under throttle
            elif not self.sprint_active and speed_mph >= 2.0 and accel > 30:
                self.sprint_active = True
                self.sprint_completed = False
                self.sprint_status = "RUNNING"
                self.sprint_start_timestamp_ms = timestamp_ms
                self.sprint_distance_m = 0.0
                self.time_at_60_s = 0.0
                self.time_at_100kph_s = 0.0
                self.sprint_60_done = False
                self.sprint_100_done = False
                self.sprint_60_130_done = False
                self.sprint_100kph_done = False
                self.sprint_160kph_done = False
                self.sprint_100_200kph_done = False
                self.sprint_quarter_done = False
                self.sprint_half_done = False
                self.sprint_1km_done = False
                self.sprint_times = {
                    "0_60": None,
                    "0_100": None,
                    "60_130": None,
                    "0_100kph": None,
                    "0_160kph": None,
                    "100_200kph": None,
                    "quarter_mile": None,
                    "half_mile": None,
                    "1km": None,
                    "trap_speed_quarter_mph": None,
                    "trap_speed_quarter_kph": None,
                    "trap_speed_half_mph": None,
                    "trap_speed_half_kph": None,
                    "trap_speed_1km_kph": None,
                    "distance_m": 0.0,
                    "distance_ft": 0.0,
                }

            # Active Sprint Tracking
            if self.sprint_active:
                elapsed_s = max(0.0, (timestamp_ms - self.sprint_start_timestamp_ms) / 1000.0)
                
                # Accurately integrate distance from speed (in meters)
                if dt_s > 0:
                    self.sprint_distance_m += speed_ms * dt_s

                self.sprint_times["distance_m"] = round(self.sprint_distance_m, 1)
                self.sprint_times["distance_ft"] = round(self.sprint_distance_m * 3.28084, 1)

                # 0-60 MPH
                if not self.sprint_60_done and speed_mph >= 60.0:
                    self.sprint_60_done = True
                    self.time_at_60_s = elapsed_s
                    self.sprint_times["0_60"] = round(elapsed_s, 3)
                    if elapsed_s < 15.0:
                        records.append({"type": "sprint", "category": "0-60", "time_seconds": elapsed_s, "speed_mph": speed_mph, **car_info})

                # 0-100 KM/H
                if not self.sprint_100kph_done and speed_kph >= 100.0:
                    self.sprint_100kph_done = True
                    self.time_at_100kph_s = elapsed_s
                    self.sprint_times["0_100kph"] = round(elapsed_s, 3)
                    
                # 0-100 MPH
                if not self.sprint_100_done and speed_mph >= 100.0:
                    self.sprint_100_done = True
                    self.sprint_times["0_100"] = round(elapsed_s, 3)
                    if elapsed_s < 25.0:
                        records.append({"type": "sprint", "category": "0-100", "time_seconds": elapsed_s, "speed_mph": speed_mph, **car_info})

                # 0-160 KM/H
                if not self.sprint_160kph_done and speed_kph >= 160.0:
                    self.sprint_160kph_done = True
                    self.sprint_times["0_160kph"] = round(elapsed_s, 3)

                # 60-130 MPH
                if self.sprint_60_done and not self.sprint_60_130_done and speed_mph >= 130.0:
                    self.sprint_60_130_done = True
                    diff_60_130 = elapsed_s - self.time_at_60_s
                    self.sprint_times["60_130"] = round(diff_60_130, 3)
                    records.append({"type": "sprint", "category": "60-130", "time_seconds": diff_60_130, "speed_mph": speed_mph, **car_info})

                # 100-200 KM/H
                if self.sprint_100kph_done and not self.sprint_100_200kph_done and speed_kph >= 200.0:
                    self.sprint_100_200kph_done = True
                    diff_100_200 = elapsed_s - self.time_at_100kph_s
                    self.sprint_times["100_200kph"] = round(diff_100_200, 3)

                # 1/4 mile (402.336 meters)
                if not self.sprint_quarter_done and self.sprint_distance_m >= 402.336:
                    self.sprint_quarter_done = True
                    self.sprint_times["quarter_mile"] = round(elapsed_s, 3)
                    self.sprint_times["trap_speed_quarter_mph"] = round(speed_mph, 1)
                    self.sprint_times["trap_speed_quarter_kph"] = round(speed_kph, 1)
                    if elapsed_s < 30.0:
                        records.append({"type": "sprint", "category": "quarter_mile", "time_seconds": elapsed_s, "speed_mph": speed_mph, **car_info})
                    
                # 1/2 mile (804.672 meters)
                if not self.sprint_half_done and self.sprint_distance_m >= 804.672:
                    self.sprint_half_done = True
                    self.sprint_times["half_mile"] = round(elapsed_s, 3)
                    self.sprint_times["trap_speed_half_mph"] = round(speed_mph, 1)
                    self.sprint_times["trap_speed_half_kph"] = round(speed_kph, 1)
                    if elapsed_s < 50.0:
                        records.append({"type": "sprint", "category": "half_mile", "time_seconds": elapsed_s, "speed_mph": speed_mph, **car_info})

                # 1000m / 1 KM
                if not self.sprint_1km_done and self.sprint_distance_m >= 1000.0:
                    self.sprint_1km_done = True
                    self.sprint_times["1km"] = round(elapsed_s, 3)
                    self.sprint_times["trap_speed_1km_kph"] = round(speed_kph, 1)
                    self.sprint_active = False
                    self.sprint_completed = True
                    self.sprint_status = "COMPLETED"

        # ----------------------------------------------------
        # 100-0 BRAKING DETECTION
        # ----------------------------------------------------
        if not self.is_rewinding and timestamp_ms > 0:
            if not self.braking_active and speed_mph >= 100.0 and brake > 200:
                self.braking_active = True
                self.braking_start_speed = speed_mph
                self.braking_distance_m = 0.0
                self.braking_start_timestamp_ms = timestamp_ms
            elif self.braking_active:
                if dt_s > 0:
                    self.braking_distance_m += speed_ms * dt_s

                if speed_mph <= 1.0:
                    braking_dist_ft = self.braking_distance_m * 3.28084
                    braking_time_s = (timestamp_ms - self.braking_start_timestamp_ms) / 1000.0
                    self.braking_active = False
                    if braking_dist_ft > 40 and braking_time_s < 10.0:
                        records.append({
                            "type": "sprint",
                            "category": "braking_100_0",
                            "time_seconds": round(braking_time_s, 3),
                            "speed_mph": self.braking_start_speed,
                            "distance_feet": round(braking_dist_ft, 1),
                            **car_info
                        })
                elif brake < 40:
                    self.braking_active = False

        # ----------------------------------------------------
        # PEAK STATS / AWARDS
        # ----------------------------------------------------
        if not self.is_rewinding:
            if speed_mph > self.top_speed:
                self.top_speed = speed_mph
                records.append({"type": "peak", "award_type": "speed_demon", "value": speed_mph, "unit": "mph", **car_info})
            
            max_tire_temp = max(
                telemetry.get("TireTempFrontLeft", 0),
                telemetry.get("TireTempFrontRight", 0),
                telemetry.get("TireTempRearLeft", 0),
                telemetry.get("TireTempRearRight", 0)
            )
            if max_tire_temp > self.peak_tire_temp:
                self.peak_tire_temp = max_tire_temp
                records.append({"type": "peak", "award_type": "hottest_tire", "value": max_tire_temp, "unit": "fahrenheit", **car_info})
                
            lat_g = abs(telemetry.get("AccelerationX", 0)) / 9.81
            if lat_g > self.peak_lat_g:
                self.peak_lat_g = lat_g
                records.append({"type": "peak", "award_type": "g_force_gladiator", "value": lat_g, "unit": "g", **car_info})

            dec_g = max(0, -telemetry.get("AccelerationZ", 0)) / 9.81
            if dec_g > self.peak_dec_g:
                self.peak_dec_g = dec_g
                records.append({"type": "peak", "award_type": "brake_cooker", "value": dec_g, "unit": "g", **car_info})

        self.current_state = {
            "sprint_status": self.sprint_status,
            "sprint_times": self.sprint_times,
            "sprint_active": self.sprint_active,
            "braking_active": self.braking_active,
            "is_rewinding": self.is_rewinding,
            "peak_tire_temp": self.peak_tire_temp,
            "peak_lat_g": self.peak_lat_g,
            "peak_dec_g": self.peak_dec_g,
            "top_speed": self.top_speed,
        }

        return {
            "records": records,
            "state": self.current_state
        }

    def get_current_state(self) -> dict:
        """Returns the active state payload for WebSockets and HUD."""
        return {
            "sprint_status": self.sprint_status,
            "sprint_times": self.sprint_times,
            "sprint_active": self.sprint_active,
            "braking_active": self.braking_active,
            "is_rewinding": self.is_rewinding,
            "peak_tire_temp": self.peak_tire_temp,
            "peak_lat_g": self.peak_lat_g,
            "peak_dec_g": self.peak_dec_g,
            "top_speed": self.top_speed,
        }
