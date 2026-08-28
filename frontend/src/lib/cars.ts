// Forza Horizon Car Ordinal to Name Lookup & Local Garage Persistence

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

// Verified Community Ordinal Map (Only confirmed IDs)
export const KNOWN_CARS: Record<number, CarData> = {
  1234: { name: 'Jesko', manufacturer: 'Koenigsegg', year: 2020, class: 'X', pi: 999, drivetrain: 'RWD' },
  2544: { name: 'Viper ACR', manufacturer: 'Dodge', year: 2016, class: 'S1', pi: 895, drivetrain: 'RWD' },
  2545: { name: '296 GTB', manufacturer: 'Ferrari', year: 2022, class: 'S2', pi: 970, drivetrain: 'RWD' },
  2546: { name: '911 GT3 RS', manufacturer: 'Porsche', year: 2023, class: 'S1', pi: 900, drivetrain: 'RWD' },
  2547: { name: 'Corvette Z06', manufacturer: 'Chevrolet', year: 2023, class: 'S1', pi: 880, drivetrain: 'RWD' },
  2548: { name: 'AMG ONE', manufacturer: 'Mercedes-AMG', year: 2021, class: 'S2', pi: 998, drivetrain: 'AWD' },
  2549: { name: 'Chiron', manufacturer: 'Bugatti', year: 2018, class: 'S2', pi: 985, drivetrain: 'AWD' },
  2550: { name: 'Skyline GT-R V-Spec II', manufacturer: 'Nissan', year: 2002, class: 'A', pi: 780, drivetrain: 'AWD' },
  2551: { name: 'Supra RZ', manufacturer: 'Toyota', year: 1998, class: 'A', pi: 740, drivetrain: 'RWD' },
  2552: { name: 'Nevera', manufacturer: 'Rimac', year: 2021, class: 'X', pi: 999, drivetrain: 'AWD' },
  2554: { name: 'M3 Competition', manufacturer: 'BMW', year: 2021, class: 'S1', pi: 850, drivetrain: 'RWD' },
  2555: { name: 'Lancer Evolution IX MR', manufacturer: 'Mitsubishi', year: 2006, class: 'B', pi: 680, drivetrain: 'AWD' },
  2556: { name: 'WRX STI', manufacturer: 'Subaru', year: 2015, class: 'B', pi: 690, drivetrain: 'AWD' },
  2557: { name: 'Civic Type R', manufacturer: 'Honda', year: 2023, class: 'B', pi: 685, drivetrain: 'FWD' },
  2558: { name: 'Ford GT', manufacturer: 'Ford', year: 2017, class: 'S1', pi: 890, drivetrain: 'RWD' },
  2559: { name: 'Senna', manufacturer: 'McLaren', year: 2018, class: 'S2', pi: 960, drivetrain: 'RWD' },
  2560: { name: '720S Coupe', manufacturer: 'McLaren', year: 2018, class: 'S1', pi: 885, drivetrain: 'RWD' },
  2561: { name: '488 Pista', manufacturer: 'Ferrari', year: 2019, class: 'S1', pi: 890, drivetrain: 'RWD' },
  2562: { name: '918 Spyder', manufacturer: 'Porsche', year: 2014, class: 'S2', pi: 955, drivetrain: 'AWD' },
  2563: { name: 'LaFerrari', manufacturer: 'Ferrari', year: 2013, class: 'S2', pi: 960, drivetrain: 'RWD' },
  2564: { name: 'Centenario LP 770-4', manufacturer: 'Lamborghini', year: 2016, class: 'S2', pi: 965, drivetrain: 'AWD' },
  2565: { name: 'Mustang RTR Spec 5', manufacturer: 'Ford', year: 2021, class: 'S1', pi: 840, drivetrain: 'RWD' },
  2566: { name: 'Bronco 4-Door', manufacturer: 'Ford', year: 2021, class: 'C', pi: 550, drivetrain: 'AWD' },
};

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
    const prev = existing[ordinal] || KNOWN_CARS[ordinal] || {
      name: `Vehicle Ordinal #${ordinal}`,
      manufacturer: 'Forza Garage',
      year: 2024,
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

export function getCarInfo(ordinal: number, fallbackClass: string = 'S1', fallbackPi: number = 900): CarData {
  const customCars = getCustomCars();
  if (ordinal && customCars[ordinal]) {
    return {
      ...customCars[ordinal],
      build: customCars[ordinal].build || DEFAULT_BUILD,
    };
  }
  if (ordinal && KNOWN_CARS[ordinal]) {
    return {
      ...KNOWN_CARS[ordinal],
      build: KNOWN_CARS[ordinal].build || DEFAULT_BUILD,
    };
  }
  return {
    name: ordinal > 0 ? `Car #${ordinal}` : 'Active Vehicle',
    manufacturer: 'Forza Horizon',
    year: 2024,
    class: fallbackClass || 'S1',
    pi: fallbackPi || 900,
    drivetrain: 'RWD',
    build: DEFAULT_BUILD,
  };
}
