import carsJson from '../data/forzaHorizon6Cars.json';

export interface CarBuild {
  tireCompound: 'stock' | 'street' | 'sport' | 'semi-slick' | 'slick' | 'drift' | 'rally' | 'offroad' | 'drag';
  aspiration: 'na' | 'turbo' | 'twin_turbo' | 'supercharger' | 'centrifugal' | 'ev';
  suspensionType: 'race' | 'drift' | 'rally' | 'offroad' | 'street';
  aeroType: 'full' | 'rear_only' | 'none';
  tuningGoal: 'circuit' | 'drift' | 'drag' | 'touge' | 'rally' | 'speed' | 'offroad';
}

export interface CarData {
  name: string;
  manufacturer: string;
  year: number;
  class: string;
  pi: number;
  drivetrain: 'FWD' | 'RWD' | 'AWD';
  build?: CarBuild;
}

export const DEFAULT_BUILD: CarBuild = {
  tireCompound: 'slick',
  aspiration: 'na',
  suspensionType: 'race',
  aeroType: 'full',
  tuningGoal: 'circuit',
};

// Raw static dataset map (ordinal string -> full car name)
export const FORZA_CARS: Record<string, string> = carsJson as Record<string, string>;

/**
 * Robust, offline vehicle lookup by Forza telemetry ordinal ID.
 * Handles:
 * - known ordinals (number or string)
 * - unknown ordinals -> returns "Unknown Vehicle"
 * - string vs number formats
 * - null / undefined / NaN / zero / negative ordinals
 */
export function getCarByOrdinal(ordinal: number | string | null | undefined): string {
  if (ordinal === null || ordinal === undefined) {
    return 'Unknown Vehicle';
  }

  const num = typeof ordinal === 'number' ? ordinal : parseInt(String(ordinal).trim(), 10);
  if (isNaN(num) || num <= 0) {
    return 'Unknown Vehicle';
  }

  const key = String(num);
  if (FORZA_CARS[key]) {
    return FORZA_CARS[key];
  }

  return 'Unknown Vehicle';
}

const KNOWN_MANUFACTURERS = [
  'Mercedes-AMG', 'Mercedes-Benz', 'Alfa Romeo', 'Aston Martin', 'Austin-Healey',
  'De Tomaso', 'Ford Supervan', 'Formula Drift', 'Hot Wheels', 'Hennessey',
  'Lamborghini', 'Land Rover', 'Maserati', 'McLaren', 'Mitsubishi',
  'Plymouth', 'Pontiac', 'Porsche', 'Renault', 'Rolls-Royce', 'Shelby',
  'Subaru', 'Toyota', 'Vauxhall', 'Volkswagen', 'Acura', 'Alpine', 'Apollo',
  'Ariel', 'Audi', 'Austin', 'Auto Union', 'BAC', 'Bentley', 'BMW', 'Brabham',
  'Bugatti', 'Buick', 'Cadillac', 'Caterham', 'Chevrolet', 'Chrysler', 'Citroën',
  'Datsun', 'Dodge', 'Donkervoort', 'Eagle', 'Ferrari', 'Fiat', 'Ford',
  'GMC', 'Gordon Murray Automotive', 'HDT', 'Holden', 'Honda', 'HSV', 'Hummer',
  'Hyundai', 'Infiniti', 'International', 'Italdesign', 'Jaguar', 'Jeep',
  'Kia', 'Koenigsegg', 'KTM', 'Lada', 'Lancia', 'Lexus', 'Lincoln', 'Local Motors',
  'Lola', 'Lotus', 'Lucid', 'Lynk & Co', 'Mazda', 'Meyers', 'MG', 'MINI',
  'Morgan', 'Morris', 'Mosler', 'NIO', 'Nissan', 'Noble', 'Oldsmobile', 'Opel',
  'Pagani', 'Peugeot', 'Polaris', 'Radical', 'RAM', 'Reliant', 'Rimac', 'Rivian',
  'Saleen', 'Schuppan', 'Sierra Cars', 'Spania GTA', 'Spyker', 'SRT', 'Subaru',
  'Sunbeam', 'Talbot', 'Tamo', 'Tesla', 'Toyota', 'TVR', 'Ultima', 'Vauxhall',
  'Vector', 'Venturi', 'Viper', 'Volkswagen', 'Volvo', 'VUHL', 'W Motors', 'Zenvo'
];

export function parseCarNameDetails(fullName: string): { manufacturer: string; name: string; year: number } {
  const matchYear = fullName.match(/^(\d{4})\s+(.*)$/);
  let year = 2024;
  let rest = fullName;
  if (matchYear) {
    year = parseInt(matchYear[1], 10);
    rest = matchYear[2];
  }

  let manufacturer = 'Forza Garage';
  let name = rest;

  for (const mfg of KNOWN_MANUFACTURERS) {
    if (rest.toLowerCase().startsWith(mfg.toLowerCase() + ' ') || rest.toLowerCase() === mfg.toLowerCase()) {
      manufacturer = mfg;
      const model = rest.slice(mfg.length).trim();
      name = model ? `${mfg} ${model}` : mfg;
      break;
    }
  }

  if (manufacturer === 'Forza Garage') {
    const parts = rest.split(' ');
    manufacturer = parts[0] || 'Forza Garage';
    name = rest;
  }

  return { manufacturer, name, year };
}

export function getCustomCars(): Record<number, CarData> {
  try {
    const saved = localStorage.getItem('forza_custom_cars');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveCustomCar(ordinal: number, data: Partial<CarData>) {
  try {
    if (!ordinal || ordinal <= 0) return;
    const existing = getCustomCars();
    const carName = getCarByOrdinal(ordinal);
    const parsed = parseCarNameDetails(carName);
    
    const prev = existing[ordinal] || {
      name: carName !== 'Unknown Vehicle' ? parsed.name : `Vehicle Ordinal #${ordinal}`,
      manufacturer: carName !== 'Unknown Vehicle' ? parsed.manufacturer : 'Forza Garage',
      year: carName !== 'Unknown Vehicle' ? parsed.year : 2024,
      class: 'S1',
      pi: 900,
      drivetrain: 'RWD',
      build: DEFAULT_BUILD,
    };

    existing[ordinal] = {
      ...prev,
      ...data,
      build: {
        ...(prev.build || DEFAULT_BUILD),
        ...(data.build || {}),
      },
    };
    localStorage.setItem('forza_custom_cars', JSON.stringify(existing));
    window.dispatchEvent(new Event('car_garage_updated'));
  } catch (e) {
    console.error('Failed to save custom car to garage:', e);
  }
}

export function getCarInfo(
  ordinal: number | string | null | undefined, 
  fallbackClass: string = 'S1', 
  fallbackPi: number = 900,
  fallbackDrivetrain: string = 'RWD'
): CarData {
  const numOrdinal = typeof ordinal === 'number' ? ordinal : parseInt(String(ordinal || 0), 10);
  const customCars = getCustomCars();
  
  if (numOrdinal > 0 && customCars[numOrdinal]) {
    const savedCar = customCars[numOrdinal];
    const fullCarName = getCarByOrdinal(numOrdinal);
    const isPlaceholder = !savedCar.name || savedCar.name.startsWith('Car #') || savedCar.name.startsWith('Vehicle Ordinal') || savedCar.manufacturer === 'Forza Garage';
    
    if (isPlaceholder && fullCarName !== 'Unknown Vehicle') {
      const parsed = parseCarNameDetails(fullCarName);
      return {
        ...savedCar,
        name: parsed.name,
        manufacturer: parsed.manufacturer,
        year: parsed.year,
        class: fallbackClass || savedCar.class || 'S1',
        pi: fallbackPi || savedCar.pi || 900,
        build: savedCar.build || DEFAULT_BUILD,
      };
    }

    return {
      ...savedCar,
      class: fallbackClass || savedCar.class || 'S1',
      pi: fallbackPi || savedCar.pi || 900,
      build: savedCar.build || DEFAULT_BUILD,
    };
  }

  const dt = (fallbackDrivetrain === 'FWD' || fallbackDrivetrain === 'AWD' || fallbackDrivetrain === 'RWD') 
    ? fallbackDrivetrain 
    : 'RWD';

  const fullCarName = getCarByOrdinal(numOrdinal);
  if (fullCarName !== 'Unknown Vehicle') {
    const parsed = parseCarNameDetails(fullCarName);
    return {
      name: parsed.name,
      manufacturer: parsed.manufacturer,
      year: parsed.year,
      class: fallbackClass || 'S1',
      pi: fallbackPi || 900,
      drivetrain: dt as any,
      build: DEFAULT_BUILD,
    };
  }

  return {
    name: numOrdinal > 0 ? `Car #${numOrdinal}` : 'Forza Horizon Vehicle',
    manufacturer: 'Forza Garage',
    year: 2024,
    class: fallbackClass || 'S1',
    pi: fallbackPi || 900,
    drivetrain: dt as any,
    build: DEFAULT_BUILD,
  };
}
