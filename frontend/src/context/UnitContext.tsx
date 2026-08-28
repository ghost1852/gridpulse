import React, { createContext, useContext, useState, useEffect } from 'react';

export type SpeedUnit = 'mph' | 'kph';
export type TempUnit = 'f' | 'c';
export type PressureUnit = 'psi' | 'bar' | 'kpa';
export type PowerUnit = 'hp' | 'kw' | 'bhp';
export type TorqueUnit = 'lbft' | 'nm';
export type LengthUnit = 'in' | 'cm' | 'mm';
export type SpringUnit = 'lbs_in' | 'kgf_mm' | 'n_mm';
export type WeightUnit = 'lbs' | 'kg';

export interface UnitPreferences {
  speed: SpeedUnit;
  temperature: TempUnit;
  pressure: PressureUnit;
  power: PowerUnit;
  torque: TorqueUnit;
  length: LengthUnit;
  springs: SpringUnit;
  weight: WeightUnit;
}

const DEFAULT_UNITS: UnitPreferences = {
  speed: 'mph',
  temperature: 'f',
  pressure: 'psi',
  power: 'hp',
  torque: 'lbft',
  length: 'in',
  springs: 'lbs_in',
  weight: 'lbs',
};

interface UnitContextType {
  units: UnitPreferences;
  setUnit: <K extends keyof UnitPreferences>(key: K, value: UnitPreferences[K]) => void;
  toggleUnit: (key: keyof UnitPreferences) => void;
  // Conversion helper functions
  convertSpeed: (mph: number) => { value: number; label: string };
  convertTemp: (fahrenheit: number) => { value: number; label: string };
  convertPressure: (psi: number) => { value: number; label: string };
  convertPower: (hp: number) => { value: number; label: string };
  convertTorque: (lbft: number) => { value: number; label: string };
  convertLength: (inches: number) => { value: number; label: string };
  convertSprings: (lbsIn: number) => { value: number; label: string };
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [units, setUnitsState] = useState<UnitPreferences>(() => {
    try {
      const saved = localStorage.getItem('forza_unit_preferences');
      return saved ? { ...DEFAULT_UNITS, ...JSON.parse(saved) } : DEFAULT_UNITS;
    } catch {
      return DEFAULT_UNITS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('forza_unit_preferences', JSON.stringify(units));
    } catch {}
  }, [units]);

  const setUnit = <K extends keyof UnitPreferences>(key: K, value: UnitPreferences[K]) => {
    setUnitsState(prev => ({ ...prev, [key]: value }));
  };

  const toggleUnit = (key: keyof UnitPreferences) => {
    setUnitsState(prev => {
      let nextVal = prev[key];
      if (key === 'speed') nextVal = (prev.speed === 'mph' ? 'kph' : 'mph') as any;
      else if (key === 'temperature') nextVal = (prev.temperature === 'f' ? 'c' : 'f') as any;
      else if (key === 'pressure') nextVal = (prev.pressure === 'psi' ? 'bar' : prev.pressure === 'bar' ? 'kpa' : 'psi') as any;
      else if (key === 'power') nextVal = (prev.power === 'hp' ? 'kw' : 'hp') as any;
      else if (key === 'torque') nextVal = (prev.torque === 'lbft' ? 'nm' : 'lbft') as any;
      else if (key === 'length') nextVal = (prev.length === 'in' ? 'cm' : prev.length === 'cm' ? 'mm' : 'in') as any;
      else if (key === 'springs') nextVal = (prev.springs === 'lbs_in' ? 'kgf_mm' : 'lbs_in') as any;
      else if (key === 'weight') nextVal = (prev.weight === 'lbs' ? 'kg' : 'lbs') as any;

      return { ...prev, [key]: nextVal };
    });
  };

  const convertSpeed = (mph: number) => {
    if (units.speed === 'kph') {
      return { value: Math.round(mph * 1.60934), label: 'KM/H' };
    }
    return { value: Math.round(mph), label: 'MPH' };
  };

  const convertTemp = (f: number) => {
    if (units.temperature === 'c') {
      return { value: Math.round(((f - 32) * 5) / 9), label: '°C' };
    }
    return { value: Math.round(f), label: '°F' };
  };

  const convertPressure = (psi: number) => {
    if (units.pressure === 'bar') {
      return { value: Number((psi * 0.0689476).toFixed(2)), label: 'BAR' };
    }
    if (units.pressure === 'kpa') {
      return { value: Math.round(psi * 6.89476), label: 'KPA' };
    }
    return { value: Number(psi.toFixed(1)), label: 'PSI' };
  };

  const convertPower = (hp: number) => {
    if (units.power === 'kw') {
      return { value: Math.round(hp * 0.7457), label: 'KW' };
    }
    if (units.power === 'bhp') {
      return { value: Math.round(hp * 0.9863), label: 'BHP' };
    }
    return { value: Math.round(hp), label: 'HP' };
  };

  const convertTorque = (lbft: number) => {
    if (units.torque === 'nm') {
      return { value: Math.round(lbft * 1.35582), label: 'NM' };
    }
    return { value: Math.round(lbft), label: 'LB·FT' };
  };

  const convertLength = (inches: number) => {
    if (units.length === 'cm') {
      return { value: Number((inches * 2.54).toFixed(1)), label: 'CM' };
    }
    if (units.length === 'mm') {
      return { value: Math.round(inches * 25.4), label: 'MM' };
    }
    return { value: Number(inches.toFixed(1)), label: 'IN' };
  };

  const convertSprings = (lbsIn: number) => {
    if (units.springs === 'kgf_mm') {
      return { value: Number((lbsIn * 0.017858).toFixed(1)), label: 'KGF/MM' };
    }
    if (units.springs === 'n_mm') {
      return { value: Number((lbsIn * 0.175127).toFixed(1)), label: 'N/MM' };
    }
    return { value: Math.round(lbsIn), label: 'LBS/IN' };
  };

  return (
    <UnitContext.Provider
      value={{
        units,
        setUnit,
        toggleUnit,
        convertSpeed,
        convertTemp,
        convertPressure,
        convertPower,
        convertTorque,
        convertLength,
        convertSprings,
      }}
    >
      {children}
    </UnitContext.Provider>
  );
};

export const useUnits = () => {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error('useUnits must be used within a UnitProvider');
  }
  return context;
};
