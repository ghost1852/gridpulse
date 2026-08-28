import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getCarInfo, saveCustomCar } from '../../lib/cars';
import { useUnits } from '../../context/UnitContext';
import { Trophy, Edit3, Crown } from 'lucide-react';

interface FastestCar {
  car_ordinal: number;
  car_class: number;
  car_pi: number;
  best_0_60: number | null;
  best_0_100: number | null;
  best_quarter_mile: number | null;
  best_quarter_trap: number | null;
  best_half_mile: number | null;
  top_speed: number | null;
  total_runs: number;
  last_driven: string;
}

export function GarageRankings() {
  const [cars, setCars] = useState<FastestCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrdinal, setEditingOrdinal] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editManufacturer, setEditManufacturer] = useState('');
  const { units } = useUnits();
  const isKph = units.speed === 'kph';

  const fetchFastest = async () => {
    try {
      const res = await fetch('/api/garage/fastest');
      const data = await res.json();
      if (data && data.fastest_cars) {
        setCars(data.fastest_cars);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFastest();
    const interval = setInterval(fetchFastest, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveCar = (ordinal: number) => {
    if (editName.trim()) {
      saveCustomCar(ordinal, {
        name: editName.trim(),
        manufacturer: editManufacturer.trim() || 'Custom',
      });
      setEditingOrdinal(null);
      fetchFastest();
    }
  };

  const formatSpeed = (mph: number | null) => {
    if (!mph) return '---';
    if (isKph) {
      return `${(mph * 1.60934).toFixed(1)} KM/H`;
    }
    return `${mph.toFixed(1)} MPH`;
  };

  const resolveClass = (c: number | string, pi: number) => {
    if (pi >= 999) return 'X';
    if (c === 6 || c === '6' || pi === 998) return 'R';
    const map: Record<string, string> = {
      '0': 'D', '1': 'C', '2': 'B', '3': 'A', '4': 'S1', '5': 'S2', '6': 'R', '7': 'P', '8': 'X'
    };
    return map[String(c)] || String(c);
  };

  return (
    <Card className="p-4 sm:p-5 space-y-4 bg-[#111118] border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" />
          <h2 className="text-sm sm:text-base font-bold font-mono tracking-wider text-white uppercase">
            GARAGE RANKINGS • FASTEST CARS LEADERBOARD
          </h2>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
          {cars.length} Active Vehicles
        </span>
      </div>

      {loading && cars.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono text-gray-500">
          Loading garage rankings...
        </div>
      ) : cars.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-gray-500 space-y-1">
          <div>No vehicles registered in garage runs yet.</div>
          <div className="text-gray-600 text-[10px]">Complete drag runs to rank your cars by performance!</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {cars.map((c, index) => {
            const resolvedClass = resolveClass(c.car_class, c.car_pi);
            const car = getCarInfo(c.car_ordinal, resolvedClass, c.car_pi);
            const isTopRanked = index === 0;

            return (
              <div 
                key={c.car_ordinal}
                className={`p-3.5 rounded-xl border font-mono transition-all ${
                  isTopRanked 
                    ? 'bg-gradient-to-br from-amber-500/10 via-[#181824] to-[#111118] border-amber-500/40 shadow-lg' 
                    : 'bg-[#14141e] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    {isTopRanked ? (
                      <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <Crown size={14} />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-gray-500 pl-1">#{index + 1}</span>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Badge carClass={resolvedClass} className="text-[9px] px-1.5 py-0 font-black" />
                        <span className="font-bold text-white text-sm tracking-tight">
                          {car.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {car.manufacturer} • PI {c.car_pi}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onPointerDown={() => {
                      setEditingOrdinal(c.car_ordinal);
                      setEditName(car.name);
                      setEditManufacturer(car.manufacturer);
                    }}
                    onClick={() => {
                      setEditingOrdinal(c.car_ordinal);
                      setEditName(car.name);
                      setEditManufacturer(car.manufacturer);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 text-[10px] bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 cursor-pointer touch-manipulation flex items-center gap-1"
                  >
                    <Edit3 size={10} />
                    <span>Rename</span>
                  </button>
                </div>

                {/* Performance Numbers Grid */}
                <div className="grid grid-cols-3 gap-2 text-[10px] pt-2.5">
                  <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-gray-500 block text-[8px] uppercase font-bold">1/4 Mile (400M)</span>
                    <span className="font-black text-emerald-400 text-xs">
                      {c.best_quarter_mile ? `${Number(c.best_quarter_mile).toFixed(3)}s` : '---'}
                    </span>
                  </div>
                  <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-gray-500 block text-[8px] uppercase font-bold">
                      {isKph ? '0-100 KM/H' : '0-60 MPH'}
                    </span>
                    <span className="font-black text-white text-xs">
                      {c.best_0_60 ? `${Number(c.best_0_60).toFixed(3)}s` : '---'}
                    </span>
                  </div>
                  <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-gray-500 block text-[8px] uppercase font-bold">Top Speed</span>
                    <span className="font-black text-cyan-400 text-xs">
                      {formatSpeed(c.top_speed)}
                    </span>
                  </div>
                </div>

                {/* Total Runs Footer */}
                <div className="flex justify-between items-center text-[9px] text-gray-500 pt-2 mt-1 border-t border-white/5">
                  <span>Ordinal #{c.car_ordinal}</span>
                  <span>{c.total_runs} Completed {c.total_runs === 1 ? 'Run' : 'Runs'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Rename Vehicle Modal */}
      {editingOrdinal !== null && (
        <Card className="p-4 space-y-3 bg-[#181826] border-cyan-500/40 mt-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-bold text-white uppercase">
              Identify Vehicle Ordinal #{editingOrdinal}
            </span>
            <button 
              type="button" 
              onPointerDown={() => setEditingOrdinal(null)}
              onClick={() => setEditingOrdinal(null)} 
              className="text-gray-400 hover:text-white touch-manipulation cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Manufacturer (e.g. Porsche, Ferrari, Audi)</label>
              <input
                type="text"
                value={editManufacturer}
                onChange={(e) => setEditManufacturer(e.target.value)}
                placeholder="Manufacturer"
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Vehicle Model (e.g. 911 GT3 RS, R8 V10)</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Model Name"
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onPointerDown={() => handleSaveCar(editingOrdinal)}
              onClick={() => handleSaveCar(editingOrdinal)}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold uppercase transition-colors cursor-pointer touch-manipulation"
            >
              Save Vehicle Profile
            </button>
          </div>
        </Card>
      )}
    </Card>
  );
}
