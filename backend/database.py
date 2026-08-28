import sqlite3
import datetime
import asyncio
from typing import List, Dict, Any, Optional

DB_PATH = "gridpulse.db"

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

def _save_sprint_sync(record: dict):
    with sqlite3.connect(DB_PATH) as db:
        db.execute('''
            INSERT INTO sprint_records (car_ordinal, car_class, car_pi, category, time_seconds, speed_mph, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (record["car_ordinal"], record["car_class"], record["car_pi"], record["category"], 
              record["time_seconds"], record["speed_mph"], datetime.datetime.utcnow().isoformat()))
        db.commit()

async def save_sprint(record: dict):
    await asyncio.to_thread(_save_sprint_sync, record)

def _save_peak_sync(record: dict):
    with sqlite3.connect(DB_PATH) as db:
        db.execute('''
            INSERT INTO peak_records (car_ordinal, car_class, car_pi, award_type, value, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (record["car_ordinal"], record["car_class"], record["car_pi"], record["award_type"], 
              record["value"], datetime.datetime.utcnow().isoformat()))
        db.commit()

async def save_peak(record: dict):
    await asyncio.to_thread(_save_peak_sync, record)

def _get_leaderboard_sync(category: str, car_class: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        query = "SELECT * FROM sprint_records WHERE category = ?"
        params = [category]
        if car_class is not None:
            query += " AND car_class = ?"
            params.append(car_class)
        query += " ORDER BY time_seconds ASC LIMIT ?"
        params.append(limit)
        
        cursor = db.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

async def get_leaderboard(category: str, car_class: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_leaderboard_sync, category, car_class, limit)

def _get_recent_sprints_sync(limit: int = 40) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        cursor = db.execute('''
            SELECT id, car_ordinal, car_class, car_pi, category, time_seconds, speed_mph, created_at
            FROM sprint_records
            ORDER BY id DESC
            LIMIT ?
        ''', (limit,))
        return [dict(r) for r in cursor.fetchall()]

async def get_recent_sprints(limit: int = 40) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_recent_sprints_sync, limit)

def _get_fastest_cars_sync() -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        cursor = db.execute('''
            SELECT 
                car_ordinal,
                car_class,
                car_pi,
                MIN(CASE WHEN category = '0-60' AND time_seconds > 0.05 THEN time_seconds END) as best_0_60,
                MIN(CASE WHEN category = '0-100' AND time_seconds > 0.05 THEN time_seconds END) as best_0_100,
                MIN(CASE WHEN category = 'quarter_mile' AND time_seconds > 0.05 THEN time_seconds END) as best_quarter_mile,
                MAX(CASE WHEN category = 'quarter_mile' THEN speed_mph END) as best_quarter_trap,
                MIN(CASE WHEN category = 'half_mile' AND time_seconds > 0.05 THEN time_seconds END) as best_half_mile,
                MAX(speed_mph) as top_speed,
                COUNT(*) as total_runs,
                MAX(created_at) as last_driven
            FROM sprint_records
            WHERE car_ordinal > 0
            GROUP BY car_ordinal
            ORDER BY 
                CASE WHEN MIN(CASE WHEN category = 'quarter_mile' AND time_seconds > 0.05 THEN time_seconds END) IS NOT NULL THEN 0 ELSE 1 END,
                best_quarter_mile ASC,
                best_0_60 ASC
        ''')
        return [dict(r) for r in cursor.fetchall()]

async def get_fastest_cars() -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_fastest_cars_sync)

def _clear_sprints_sync():
    with sqlite3.connect(DB_PATH) as db:
        db.execute('DELETE FROM sprint_records')
        db.commit()

async def clear_sprints():
    await asyncio.to_thread(_clear_sprints_sync)

def _get_daily_awards_sync(date_str: Optional[str] = None) -> List[Dict[str, Any]]:
    if not date_str:
        date_str = datetime.datetime.utcnow().date().isoformat()
        
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        query = '''
            SELECT award_type, MAX(value) as max_val, car_ordinal, car_class, car_pi, created_at
            FROM peak_records 
            WHERE date(created_at) = date(?)
            GROUP BY award_type
        '''
        cursor = db.execute(query, (date_str,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

async def get_daily_awards(date_str: Optional[str] = None) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_daily_awards_sync, date_str)
