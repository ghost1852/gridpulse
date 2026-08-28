import sqlite3
import datetime
import asyncio
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

def get_db_path() -> str:
    # Use user LocalAppData / GridPulse directory for 100% reliable write access on Windows
    appdata = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
    if appdata:
        db_dir = Path(appdata) / "GridPulse"
        try:
            db_dir.mkdir(parents=True, exist_ok=True)
            return str(db_dir / "gridpulse.db")
        except Exception:
            pass

    # Fallback to executable / script directory
    if getattr(sys, 'frozen', False):
        base_dir = Path(sys.executable).parent
    else:
        base_dir = Path(__file__).parent
    return str(base_dir / "gridpulse.db")

DB_PATH = get_db_path()

def _init_db_sync():
    with sqlite3.connect(DB_PATH) as db:
        db.execute('''
            CREATE TABLE IF NOT EXISTS sprint_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_ordinal INTEGER,
                car_class INTEGER,
                car_pi INTEGER,
                category TEXT,
                time_seconds REAL,
                speed_mph REAL,
                created_at TIMESTAMP
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS peak_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_ordinal INTEGER,
                car_class INTEGER,
                car_pi INTEGER,
                award_type TEXT,
                value REAL,
                created_at TIMESTAMP
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                car_ordinal INTEGER,
                car_class INTEGER,
                car_pi INTEGER
            )
        ''')
        db.commit()

async def init_db():
    await asyncio.to_thread(_init_db_sync)

def _save_sprint_sync(record: Dict[str, Any]):
    with sqlite3.connect(DB_PATH) as db:
        db.execute('''
            INSERT INTO sprint_records (car_ordinal, car_class, car_pi, category, time_seconds, speed_mph, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.get("car_ordinal"),
            record.get("car_class"),
            record.get("car_pi"),
            record.get("category"),
            record.get("time_seconds"),
            record.get("speed_mph"),
            datetime.datetime.utcnow().isoformat()
        ))
        db.commit()

async def save_sprint(record: Dict[str, Any]):
    await asyncio.to_thread(_save_sprint_sync, record)

def _save_peak_sync(record: Dict[str, Any]):
    with sqlite3.connect(DB_PATH) as db:
        db.execute('''
            INSERT INTO peak_records (car_ordinal, car_class, car_pi, award_type, value, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            record.get("car_ordinal"),
            record.get("car_class"),
            record.get("car_pi"),
            record.get("award_type"),
            record.get("value"),
            datetime.datetime.utcnow().isoformat()
        ))
        db.commit()

async def save_peak(record: Dict[str, Any]):
    await asyncio.to_thread(_save_peak_sync, record)

def _get_leaderboard_sync(category: str = "0-60", car_class: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        
        query = '''
            SELECT * FROM sprint_records 
            WHERE category = ?
        '''
        params = [category]
        
        if car_class is not None:
            query += ' AND car_class = ?'
            params.append(car_class)
            
        query += ' ORDER BY time_seconds ASC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

async def get_leaderboard(category: str = "0-60", car_class: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_leaderboard_sync, category, car_class, limit)

def _get_recent_sprints_sync(limit: int = 30) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('''
            SELECT * FROM sprint_records
            ORDER BY id DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in cursor.fetchall()]

async def get_recent_sprints(limit: int = 30) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_recent_sprints_sync, limit)

def _get_fastest_cars_per_ordinal_sync() -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('''
            SELECT car_ordinal, car_class, car_pi, MIN(time_seconds) as best_0_60, MAX(speed_mph) as top_speed, COUNT(*) as total_runs
            FROM sprint_records
            WHERE category = '0-60' AND car_ordinal IS NOT NULL AND car_ordinal > 0
            GROUP BY car_ordinal
            ORDER BY best_0_60 ASC
        ''')
        return [dict(row) for row in cursor.fetchall()]

async def get_fastest_cars_per_ordinal() -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_fastest_cars_per_ordinal_sync)

def _get_daily_awards_sync() -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        today = datetime.date.today().isoformat()
        cursor.execute('''
            SELECT award_type, MAX(value) as max_value, car_ordinal, car_class, car_pi
            FROM peak_records 
            WHERE created_at LIKE ?
            GROUP BY award_type
        ''', (f"{today}%",))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

async def get_daily_awards() -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_daily_awards_sync)

def _clear_all_sprints_sync():
    with sqlite3.connect(DB_PATH) as db:
        db.execute('DELETE FROM sprint_records')
        db.commit()

async def clear_all_sprints():
    await asyncio.to_thread(_clear_all_sprints_sync)
