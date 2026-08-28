import asyncio
import json
import logging
import argparse
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from packet_parser import parse_packet
from analytics import TelemetryAnalytics
import database
from simulator import TelemetrySimulator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GridPulse Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analytics_engine = TelemetryAnalytics()
active_connections = []
stats = {
    "packets_received": 0,
    "last_car_ordinal": 0
}

# Config flags
CONFIG = {
    "simulate": False,
    "udp_port": 20066,
    "port": 8000
}

async def process_and_broadcast(data: bytes, source: str = "udp"):
    # If live UDP is streaming, ignore any residual simulator frames
    if source == "sim" and not CONFIG["simulate"]:
        return

    stats["packets_received"] += 1
    telemetry = parse_packet(data)
    
    if not telemetry:
        return
        
    stats["last_car_ordinal"] = telemetry.get("CarOrdinal", 0)
    
    result = analytics_engine.process(telemetry)
    records = result.get("records", [])
    
    for rec in records:
        if rec["type"] == "sprint":
            await database.save_sprint(rec)
        elif rec["type"] == "peak":
            await database.save_peak(rec)

    # Broadcast to connected WebSockets
    if active_connections:
        message = {
            "telemetry": telemetry,
            "analytics_state": result.get("state", {})
        }
        msg_str = json.dumps(message)
        dead_connections = []
        for conn in active_connections:
            try:
                await conn.send_text(msg_str)
            except Exception as e:
                logger.debug(f"Websocket error: {e}")
                dead_connections.append(conn)
        for dead in dead_connections:
            if dead in active_connections:
                active_connections.remove(dead)

class TelemetryUDPProtocol(asyncio.DatagramProtocol):
    def connection_made(self, transport):
        self.transport = transport
        logger.info(f"UDP Server listening on port {CONFIG['udp_port']}")

    def datagram_received(self, data, addr):
        # When real game data arrives, ensure simulator is silenced
        if CONFIG["simulate"]:
            logger.info("Real Forza packets detected! Automatically disabling simulator mode.")
            CONFIG["simulate"] = False
            stop_simulator()
            
        asyncio.create_task(process_and_broadcast(data, source="udp"))

# Current running background tasks/transports
runtime_state = {
    "simulator_task": None,
    "udp_transport": None,
}

async def start_udp_listener(port: int):
    loop = asyncio.get_running_loop()
    if runtime_state["udp_transport"]:
        try:
            runtime_state["udp_transport"].close()
        except Exception:
            pass
    try:
        transport, _ = await loop.create_datagram_endpoint(
            lambda: TelemetryUDPProtocol(),
            local_addr=('0.0.0.0', port)
        )
        runtime_state["udp_transport"] = transport
        logger.info(f"UDP listener active on 0.0.0.0:{port}")
    except Exception as e:
        logger.error(f"Failed to bind UDP port {port}: {e}")

async def start_simulator():
    if runtime_state["simulator_task"] and not runtime_state["simulator_task"].done():
        runtime_state["simulator_task"].cancel()
    
    sim = TelemetrySimulator()
    async def sim_callback(packet):
        await process_and_broadcast(packet, source="sim")
        
    runtime_state["simulator_task"] = asyncio.create_task(sim.run(sim_callback))
    logger.info("Simulator task started")

def stop_simulator():
    if runtime_state["simulator_task"] and not runtime_state["simulator_task"].done():
        runtime_state["simulator_task"].cancel()
        runtime_state["simulator_task"] = None
        logger.info("Simulator task stopped")

@app.on_event("startup")
async def startup_event():
    await database.init_db()
    await start_udp_listener(CONFIG["udp_port"])
    if CONFIG["simulate"]:
        await start_simulator()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"Client connected to telemetry stream. Total active: {len(active_connections)}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
        logger.info(f"Client disconnected. Remaining: {len(active_connections)}")

@app.get("/api/config")
async def get_config():
    return {
        "simulate": CONFIG["simulate"],
        "udp_port": CONFIG["udp_port"],
        "port": CONFIG["port"],
        "packets_received": stats["packets_received"],
        "connections": len(active_connections),
        "last_car_ordinal": stats["last_car_ordinal"]
    }

@app.post("/api/config")
async def set_config(payload: dict):
    if "simulate" in payload:
        new_sim = bool(payload["simulate"])
        CONFIG["simulate"] = new_sim
        if new_sim:
            await start_simulator()
        else:
            stop_simulator()

    if "udp_port" in payload and int(payload["udp_port"]) != CONFIG["udp_port"]:
        new_port = int(payload["udp_port"])
        CONFIG["udp_port"] = new_port
        await start_udp_listener(new_port)

    return {"status": "updated", "config": CONFIG}

@app.get("/api/leaderboard")
async def api_leaderboard(category: str = "0-60", car_class: str = None):
    class_int = None
    if car_class and car_class.isdigit():
        class_int = int(car_class)
    records = await database.get_leaderboard(category, class_int)
    return {"leaderboard": records}

@app.get("/api/daily-awards")
async def api_daily_awards(date: str = None):
    awards = await database.get_daily_awards(date)
    return {"awards": awards}

@app.post("/api/drag/reset")
async def api_drag_reset():
    analytics_engine.reset_sprint()
    return {"status": "sprint_reset"}

@app.get("/api/drag/recent")
async def api_drag_recent(limit: int = 40):
    records = await database.get_recent_sprints(limit)
    return {"recent_runs": records}

@app.get("/api/garage/fastest")
async def api_garage_fastest():
    cars = await database.get_fastest_cars()
    return {"fastest_cars": cars}

@app.post("/api/drag/clear")
async def api_drag_clear():
    await database.clear_sprints()
    analytics_engine.reset_sprint()
    return {"status": "cleared"}

@app.get("/api/status")
async def api_status():
    return {
        "status": "online",
        "simulate_mode": CONFIG["simulate"],
        "udp_port": CONFIG["udp_port"],
        "connections": len(active_connections),
        "packets_received": stats["packets_received"],
        "last_car_ordinal": stats["last_car_ordinal"]
    }

# Mount static frontend
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

def start_server(port: int = 8000, udp_port: int = 20066, simulate: bool = True):
    import uvicorn
    CONFIG["port"] = port
    CONFIG["udp_port"] = udp_port
    CONFIG["simulate"] = simulate
    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GridPulse Backend")
    parser.add_argument("--port", type=int, default=8000, help="HTTP/WS server port")
    parser.add_argument("--udp-port", type=int, default=20066, help="Forza UDP listening port")
    parser.add_argument("--no-simulate", action="store_true", help="Disable simulator and listen on UDP socket")
    parser.add_argument("--simulate", action="store_true", default=True, help="Run with simulated telemetry")
    args = parser.parse_args()
    
    sim_mode = not args.no_simulate
    start_server(port=args.port, udp_port=args.udp_port, simulate=sim_mode)
