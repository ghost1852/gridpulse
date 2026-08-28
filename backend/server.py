import asyncio
import json
import logging
import argparse
import time
import socket
import random
from typing import Set, Dict, Any
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from packet_parser import parse_packet
from analytics import TelemetryAnalytics
import database
from simulator import TelemetrySimulator
from webrtc_host import WebRtcHost

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("GridPulse")

app = FastAPI(title="GridPulse Telemetry Engine", version="2.1.0")

# Security Hardened CORS (permits localhost, LAN, and Wranglr edge deployments)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.*\.wranglr\.co\.za)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

analytics_engine = TelemetryAnalytics()
active_connections: Set[WebSocket] = set()
webrtc_engine = WebRtcHost()

# 6-Digit Device Pairing Code
PAIRING_CODE = f"{random.randint(100, 999)} {random.randint(100, 999)}"

# Asynchronous non-blocking Database Queue
db_queue: asyncio.Queue = asyncio.Queue()

# Diagnostics & Telemetry Rate Tracking
stats = {
    "packets_received": 0,
    "last_car_ordinal": 0,
    "last_packet_time": 0.0,
    "packet_rate_hz": 0.0,
    "udp_listening": False,
    "active_clients": 0,
}

CONFIG = {
    "simulate": False,
    "udp_port": 20066,
    "port": 8000,
    "host": "0.0.0.0"
}

_recent_packet_timestamps = []

# =========================================================================
# ASYNC DATABASE WORKER (Decoupled from hot 60Hz telemetry loop)
# =========================================================================
async def db_worker():
    """Consumes telemetry milestone records from queue and writes to SQLite asynchronously."""
    while True:
        try:
            record = await db_queue.get()
            rec_type = record.get("type")
            if rec_type == "sprint":
                await database.save_sprint(record)
            elif rec_type == "peak":
                await database.save_peak(record)
            db_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in DB worker: {e}")

# =========================================================================
# TELEMETRY PIPELINE (Low-jitter, non-blocking ingestion & broadcast)
# =========================================================================
async def process_and_broadcast(data: bytes, source: str = "udp"):
    global _recent_packet_timestamps

    if source == "sim" and not CONFIG["simulate"]:
        return

    now = time.time()
    stats["packets_received"] += 1
    stats["last_packet_time"] = now

    # Rolling packet rate calculation (over last 1 second window)
    _recent_packet_timestamps.append(now)
    cutoff = now - 1.0
    while _recent_packet_timestamps and _recent_packet_timestamps[0] < cutoff:
        _recent_packet_timestamps.pop(0)
    stats["packet_rate_hz"] = round(len(_recent_packet_timestamps), 1)

    telemetry = parse_packet(data)
    if not telemetry:
        return

    stats["last_car_ordinal"] = telemetry.get("CarOrdinal", 0)

    # Process driving physics & sprint detection
    result = analytics_engine.process(telemetry)
    records = result.get("records", [])

    # Push to async DB queue (Zero filesystem wait in 60Hz loop)
    for rec in records:
        db_queue.put_nowait(rec)

    message = {
        "telemetry": telemetry,
        "analytics_state": result.get("state", {})
    }
    msg_str = json.dumps(message)

    # 1. Broadcast via WebRTC DataChannel (Encrypted direct P2P)
    webrtc_engine.broadcast(msg_str)

    # 2. Broadcast via Local WebSockets
    if active_connections:
        dead_connections = []
        for conn in list(active_connections):
            try:
                await conn.send_text(msg_str)
            except Exception:
                dead_connections.append(conn)

        for dead in dead_connections:
            active_connections.discard(dead)
            stats["active_clients"] = len(active_connections)

# =========================================================================
# UDP PROTOCOL LISTENER
# =========================================================================
class TelemetryUDPProtocol(asyncio.DatagramProtocol):
    def connection_made(self, transport):
        self.transport = transport
        stats["udp_listening"] = True
        logger.info(f"UDP Telemetry listener active on port {CONFIG['udp_port']}")

    def datagram_received(self, data, addr):
        # Auto-switch from simulator when real Forza packets arrive
        if CONFIG["simulate"]:
            logger.info("Live Forza packets detected! Automatically disabling simulator.")
            CONFIG["simulate"] = False
            stop_simulator()

        asyncio.create_task(process_and_broadcast(data, source="udp"))

    def connection_lost(self, exc):
        stats["udp_listening"] = False
        logger.info("UDP Telemetry listener closed")

runtime_state = {
    "simulator_task": None,
    "udp_transport": None,
    "db_worker_task": None
}

def start_simulator():
    if runtime_state["simulator_task"] is None or runtime_state["simulator_task"].done():
        simulator = TelemetrySimulator()
        runtime_state["simulator_task"] = asyncio.create_task(
            simulator.run(lambda packet: process_and_broadcast(packet, source="sim"))
        )
        logger.info("Physics simulator started")

def stop_simulator():
    if runtime_state["simulator_task"] and not runtime_state["simulator_task"].done():
        runtime_state["simulator_task"].cancel()
        runtime_state["simulator_task"] = None
        logger.info("Physics simulator stopped")

def get_lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def print_terminal_banner(lan_ip: str, port: int, udp_port: int):
    clean_code = PAIRING_CODE.replace(" ", "")
    pairing_url = f"https://gridpulse.wranglr.co.za?bridge=http://{lan_ip}:{port}&code={clean_code}"
    print("\n" + "=" * 60)
    print("             GRIDPULSE TELEMETRY BRIDGE v2.1")
    print("=" * 60)
    print(f" * PAIRING CODE          : {PAIRING_CODE}")
    print(f" * UDP Telemetry Ingress : 0.0.0.0:{udp_port}")
    print(f" * WebRTC DataChannel    : ACTIVE (P2P Encrypted)")
    print(f" * LAN Gateway           : http://{lan_ip}:{port}")
    print("=" * 60)
    print(" FORZA IN-GAME SETUP (HUD & Gameplay > Telemetry):")
    print(f"   Data Out            : ON")
    print(f"   Data Out IP Address : 127.0.0.1 (or {lan_ip})")
    print(f"   Data Out IP Port    : {udp_port}")
    print("=" * 60)
    print(" SCAN WITH PHONE CAMERA TO AUTO-PAIR INSTANTLY:")
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=1, border=1)
        qr.add_data(pairing_url)
        qr.print_ascii(invert=True)
    except Exception:
        pass
    print(f" Direct Link: {pairing_url}")
    print("=" * 60 + "\n")

# =========================================================================
# LIFECYCLE HOOKS
# =========================================================================
@app.on_event("startup")
async def startup():
    await database.init_db()

    # Start non-blocking DB worker
    runtime_state["db_worker_task"] = asyncio.create_task(db_worker())

    loop = asyncio.get_running_loop()
    try:
        transport, _ = await loop.create_datagram_endpoint(
            lambda: TelemetryUDPProtocol(),
            local_addr=("0.0.0.0", CONFIG["udp_port"])
        )
        runtime_state["udp_transport"] = transport
    except Exception as e:
        logger.error(f"Failed to bind UDP port {CONFIG['udp_port']}: {e}")

    if CONFIG["simulate"]:
        start_simulator()

    lan_ip = get_lan_ip()
    print_terminal_banner(lan_ip, CONFIG["port"], CONFIG["udp_port"])

@app.on_event("shutdown")
async def shutdown():
    stop_simulator()
    if runtime_state["udp_transport"]:
        runtime_state["udp_transport"].close()
    if runtime_state["db_worker_task"]:
        runtime_state["db_worker_task"].cancel()
    await webrtc_engine.close_all()

# =========================================================================
# REST & WEBRTC API ENDPOINTS
# =========================================================================
@app.post("/api/webrtc/offer")
async def webrtc_offer(payload: Dict[str, str]):
    """WebRTC SDP offer negotiation endpoint."""
    sdp = payload.get("sdp")
    sdp_type = payload.get("type", "offer")
    if not sdp:
        raise HTTPException(status_code=400, detail="Missing SDP offer payload")
    try:
        answer = await webrtc_engine.handle_offer(sdp, sdp_type)
        return answer
    except Exception as e:
        logger.error(f"WebRTC offer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status")
async def get_status():
    """Rich 3-tier diagnostic status for the frontend."""
    is_receiving = (time.time() - stats["last_packet_time"]) < 2.0 if stats["last_packet_time"] > 0 else False
    return {
        "status": "online",
        "pairing_code": PAIRING_CODE,
        "simulate_mode": CONFIG["simulate"],
        "udp_port": CONFIG["udp_port"],
        "udp_listening": stats["udp_listening"],
        "telemetry_state": "RECEIVING" if is_receiving else ("SIMULATING" if CONFIG["simulate"] else "WAITING"),
        "packet_rate_hz": stats["packet_rate_hz"] if is_receiving or CONFIG["simulate"] else 0.0,
        "packets_received": stats["packets_received"],
        "last_car_ordinal": stats["last_car_ordinal"],
        "active_clients": len(active_connections) + len(webrtc_engine.active_datachannels),
        "webrtc_channels": len(webrtc_engine.active_datachannels)
    }

@app.get("/api/config")
async def get_config():
    return {
        "pairing_code": PAIRING_CODE,
        "simulate": CONFIG["simulate"],
        "udp_port": CONFIG["udp_port"],
        "udp_listening": stats["udp_listening"],
        "packets_received": stats["packets_received"],
        "packet_rate_hz": stats["packet_rate_hz"]
    }

@app.post("/api/config")
async def update_config(payload: Dict[str, Any]):
    new_sim = payload.get("simulate", CONFIG["simulate"])
    new_port = payload.get("udp_port", CONFIG["udp_port"])
    
    if new_sim != CONFIG["simulate"]:
        CONFIG["simulate"] = new_sim
        if new_sim:
            start_simulator()
        else:
            stop_simulator()
            
    if new_port != CONFIG["udp_port"]:
        CONFIG["udp_port"] = new_port
        if runtime_state["udp_transport"]:
            runtime_state["udp_transport"].close()
        loop = asyncio.get_running_loop()
        transport, _ = await loop.create_datagram_endpoint(
            lambda: TelemetryUDPProtocol(),
            local_addr=("0.0.0.0", CONFIG["udp_port"])
        )
        runtime_state["udp_transport"] = transport
        
    return {"status": "ok", "simulate": CONFIG["simulate"], "udp_port": CONFIG["udp_port"]}

@app.get("/api/leaderboard")
async def get_leaderboard(category: str = "0-60", car_class: str = None, limit: int = 50):
    entries = await database.get_leaderboard(category=category, car_class=car_class, limit=limit)
    return {"category": category, "car_class": car_class, "leaderboard": entries}

@app.get("/api/daily-awards")
async def get_daily_awards():
    awards = await database.get_daily_awards()
    return {"awards": awards}

@app.get("/api/drag/recent")
async def get_recent_sprints(limit: int = 30):
    runs = await database.get_recent_sprints(limit=limit)
    return {"recent_runs": runs}

@app.get("/api/garage/fastest")
async def get_fastest_cars():
    cars = await database.get_fastest_cars_per_ordinal()
    return {"fastest_cars": cars}

@app.post("/api/drag/reset")
async def reset_drag():
    analytics_engine.reset_sprint()
    return {"status": "reset"}

@app.post("/api/drag/clear")
async def clear_drag_history():
    await database.clear_all_sprints()
    analytics_engine.reset_sprint()
    return {"status": "cleared"}

# =========================================================================
# WEBSOCKET STREAM
# =========================================================================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    stats["active_clients"] = len(active_connections)
    logger.info(f"WebSocket client connected. Active: {len(active_connections)}")

    # Send initial status payload
    init_state = analytics_engine.get_current_state()
    try:
        await websocket.send_text(json.dumps({
            "type": "analytics",
            "payload": init_state
        }))
        while True:
            # Keepalive listener
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WebSocket exception: {e}")
    finally:
        active_connections.discard(websocket)
        stats["active_clients"] = len(active_connections)
        logger.info(f"WebSocket client disconnected. Active: {len(active_connections)}")

# =========================================================================
# STATIC FRONTEND MOUNT (For local standalone single-server mode)
# =========================================================================
if getattr(sys, 'frozen', False):
    bundle_dir = Path(getattr(sys, '_MEIPASS', Path(sys.executable).parent))
    frontend_dist = bundle_dir / "frontend" / "dist"
    if not frontend_dist.exists():
        frontend_dist = Path(sys.executable).parent / "frontend" / "dist"
else:
    frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"

if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

def main():
    parser = argparse.ArgumentParser(description="GridPulse Forza Telemetry Engine")
    parser.add_argument("--port", type=int, default=8000, help="Web/WS port (default: 8000)")
    parser.add_argument("--udp-port", type=int, default=20066, help="Forza UDP port (default: 20066)")
    parser.add_argument("--simulate", action="store_true", default=False, help="Run in simulator mode")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host address to bind (default: 0.0.0.0)")

    args = parser.parse_args()
    CONFIG["port"] = args.port
    CONFIG["udp_port"] = args.udp_port
    CONFIG["simulate"] = args.simulate
    CONFIG["host"] = args.host

    try:
        import uvicorn
        uvicorn.run(app, host=CONFIG["host"], port=CONFIG["port"])
    except Exception as e:
        logger.error(f"Fatal error running GridPulse server: {e}")
        import traceback
        traceback.print_exc()
        if getattr(sys, 'frozen', False):
            input("\n[ERROR] An error occurred. Press Enter to exit...")

if __name__ == "__main__":
    main()
