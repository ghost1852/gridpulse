import json
import sys
from pathlib import Path
from typing import Optional, Union, Any

# Load static dataset (handles both development and PyInstaller bundled binaries)
if getattr(sys, 'frozen', False):
    meipass = getattr(sys, '_MEIPASS', None)
    if meipass and (Path(meipass) / "data" / "forzaHorizon6Cars.json").exists():
        _DATA_PATH = Path(meipass) / "data" / "forzaHorizon6Cars.json"
    else:
        _DATA_PATH = Path(sys.executable).parent / "data" / "forzaHorizon6Cars.json"
else:
    _DATA_PATH = Path(__file__).parent / "data" / "forzaHorizon6Cars.json"

_FORZA_CARS: dict = {}

if _DATA_PATH.exists():
    try:
        with open(_DATA_PATH, "r", encoding="utf-8") as f:
            _FORZA_CARS = json.load(f)
    except Exception:
        _FORZA_CARS = {}

def get_car_by_ordinal(ordinal: Optional[Union[int, str, Any]]) -> str:
    """
    Robust, offline vehicle lookup by Forza telemetry ordinal ID.
    
    Handles:
    - known ordinals (int or str)
    - unknown ordinals -> returns 'Unknown Vehicle'
    - string vs number types
    - None / malformed / negative / zero ordinals
    """
    if ordinal is None:
        return "Unknown Vehicle"
    
    try:
        if isinstance(ordinal, str):
            num = int(ordinal.strip())
        elif isinstance(ordinal, (int, float)):
            num = int(ordinal)
        else:
            return "Unknown Vehicle"
    except (ValueError, TypeError):
        return "Unknown Vehicle"

    if num <= 0:
        return "Unknown Vehicle"

    return _FORZA_CARS.get(str(num), "Unknown Vehicle")
