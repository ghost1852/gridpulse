import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getCarInfo, saveCustomCar } from '../../lib/cars';
import { Trophy, Car, Edit2, X, Check } from 'lucide-react';

interface CarInfoProps {
  carOrdinal?: number;
  carClass: string;
  pi: number;
  drivetrainType: number;
  racePosition: number;
}

export function CarInfo({ carOrdinal = 2544, carClass, pi, drivetrainType, racePosition }: CarInfoProps) {
  const [car, setCar] = useState(() => getCarInfo(carOrdinal, carClass, pi));
  const [isEditing, setIsEditing] = useState(false);
  const [brandInput, setBrandInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [yearInput, setYearInput] = useState('2024');

  const updateCar = () => {
    const updated = getCarInfo(carOrdinal, carClass, pi);
    setCar(updated);
  };

  useEffect(() => {
    updateCar();
    const handleUpdate = () => updateCar();
    window.addEventListener('car_garage_updated', handleUpdate);
    return () => window.removeEventListener('car_garage_updated', handleUpdate);
  }, [carOrdinal, carClass, pi]);

  const openEditor = () => {
    setBrandInput(car.manufacturer === 'Forza Garage' ? '' : car.manufacturer);
    setModelInput(car.name.startsWith('Car #') ? '' : car.name);
    setYearInput(String(car.year || 2024));
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomCar(carOrdinal, {
      manufacturer: brandInput.trim() || 'Forza Garage',
      name: modelInput.trim() || `Car #${carOrdinal}`,
      year: parseInt(yearInput, 10) || 2024,
      class: carClass,
      pi: pi,
    });
    setIsEditing(false);
  };

  const getDrivetrain = (type: number) => {
    if (type === 0) return 'FWD';
    if (type === 1) return 'RWD';
    if (type === 2) return 'AWD';
    return car.drivetrain || 'RWD';
  };

  return (
    <>
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 sm:p-3 landscape:p-1.5 px-3 sm:px-4 landscape:px-3 bg-gradient-to-r from-[#111118] via-[#161622] to-[#111118] border-white/10 gap-2 landscape:gap-1.5 shrink-0">
        {/* Left: Car Manufacturer & Model Name */}
        <div 
          onClick={openEditor}
          className="flex items-center gap-2.5 landscape:gap-2 group cursor-pointer hover:opacity-95 transition-opacity"
          title="Click to rename or set car brand/model"
        >
          <div className="w-7 h-7 sm:w-9 sm:h-9 landscape:w-7 landscape:h-7 rounded-lg bg-white/5 border border-white/10 group-hover:border-emerald-400/50 flex items-center justify-center text-emerald-400 shrink-0 transition-colors">
            <Car size={16} />
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
                {car.manufacturer}
              </span>
              <span className="text-[9px] font-mono text-gray-500">• {car.year}</span>
              <Edit2 size={9} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-sm sm:text-base landscape:text-sm font-bold text-white tracking-tight font-mono flex items-center gap-1">
              {car.name}
            </span>
          </div>
        </div>

        {/* Right: Class, PI, Drivetrain & Position Badges */}
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4 landscape:gap-3 border-t sm:border-t-0 border-white/5 pt-1 sm:pt-0">
          {/* Class + PI */}
          <div className="flex items-center gap-2">
            <Badge carClass={carClass || car.class} className="text-xs px-2 py-0.5" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-mono font-bold uppercase">INDEX</span>
              <span className="text-sm sm:text-base landscape:text-sm font-mono font-black tracking-wider text-white">
                {pi || car.pi || '---'}
              </span>
            </div>
          </div>
          
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          
          {/* Drivetrain */}
          <div className="flex flex-col">
            <span className="text-[8px] text-gray-500 font-mono font-bold uppercase">LAYOUT</span>
            <span className="text-[11px] font-mono font-bold text-gray-300">
              {getDrivetrain(drivetrainType)}
            </span>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Position */}
          <div className="flex items-center gap-1.5">
            <Trophy size={14} className="text-amber-400" />
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-gray-500 font-mono font-bold uppercase">POS</span>
              <span className="text-base sm:text-lg landscape:text-base font-mono font-black text-amber-400 leading-none">
                {racePosition > 0 ? `P${racePosition}` : 'P1'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Car Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Car size={18} className="text-emerald-400" />
                <h3 className="font-mono font-bold text-white text-base">
                  Name Vehicle (Car #{carOrdinal})
                </h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-gray-400 uppercase text-[10px] font-bold mb-1">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lamborghini, Porsche, BMW, Ferrari"
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-gray-400 uppercase text-[10px] font-bold mb-1">
                  Car Model Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Huracán EVO, 911 GT3 RS, M3 Competition"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-gray-400 uppercase text-[10px] font-bold mb-1">
                  Year
                </label>
                <input
                  type="number"
                  placeholder="2022"
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Check size={14} />
                  Save to Garage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
