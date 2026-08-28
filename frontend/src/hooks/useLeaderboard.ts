import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export interface LeaderboardEntry {
  rank: number;
  gamertag: string;
  car_name: string;
  car_class: string;
  car_performance_index: number;
  value: number;
  date: string;
}

export interface DailyAward {
  id: string;
  name: string;
  icon: string;
  gamertag: string;
  value: string | number;
  car_info: string;
}

const AWARD_META: Record<string, { name: string; icon: string; unit: string }> = {
  'Hottest Tire': { name: 'Hottest Tire', icon: 'hottest_tire', unit: '°F' },
  'G-Force Gladiator': { name: 'G-Force Gladiator', icon: 'g_force_gladiator', unit: 'G' },
  'Brake Cooker': { name: 'Brake Cooker', icon: 'brake_cooker', unit: 'G' },
  'Speed Demon': { name: 'Speed Demon', icon: 'speed_demon', unit: 'MPH' },
  'Suspension Slammer': { name: 'Suspension Slammer', icon: 'suspension_slammer', unit: '%' },
  'Rev-Limiter Addict': { name: 'Rev-Limiter Addict', icon: 'rev_limiter_addict', unit: 's' },
  'Drift King': { name: 'Drift King', icon: 'drift_king', unit: '°' },
  'Launch Master': { name: 'Launch Master', icon: 'launch_master', unit: 's' },
};

const DEFAULT_AWARDS: DailyAward[] = [
  { id: '1', name: 'Hottest Tire', icon: 'hottest_tire', gamertag: 'Waiting for run...', value: '-- °F', car_info: 'Any Class' },
  { id: '2', name: 'Speed Demon', icon: 'speed_demon', gamertag: 'Waiting for run...', value: '-- MPH', car_info: 'Any Class' },
  { id: '3', name: 'G-Force Gladiator', icon: 'g_force_gladiator', gamertag: 'Waiting for run...', value: '-- G', car_info: 'Any Class' },
  { id: '4', name: 'Brake Cooker', icon: 'brake_cooker', gamertag: 'Waiting for run...', value: '-- G', car_info: 'Any Class' },
];

export function useLeaderboard(category: string, carClass: string = 'All') {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const classParam = carClass === 'All' ? '' : `&car_class=${encodeURIComponent(carClass)}`;
      const url = `/api/leaderboard?category=${encodeURIComponent(category)}${classParam}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const json = await res.json();
      const rawEntries = Array.isArray(json) ? json : (json.leaderboard || []);
      
      const mapped: LeaderboardEntry[] = rawEntries.map((item: Record<string, unknown>, idx: number) => ({
        rank: typeof item.rank === 'number' ? item.rank : idx + 1,
        gamertag: String(item.gamertag || 'Driver'),
        car_name: String(item.car_name || `Car #${item.car_ordinal || '1234'}`),
        car_class: String(item.car_class || 'S1'),
        car_performance_index: Number(item.car_pi || 900),
        value: Number(item.time_seconds ?? item.value ?? 0),
        date: String(item.created_at || new Date().toISOString()),
      }));

      setData(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [category, carClass]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { data, loading, error, refetch: fetchLeaderboard };
}

export function useDailyAwards() {
  const [awards, setAwards] = useState<DailyAward[]>(DEFAULT_AWARDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/daily-awards');
      if (!res.ok) throw new Error('Failed to fetch daily awards');
      const json = await res.json();
      const rawAwards = Array.isArray(json) ? json : (json.awards || []);
      
      if (rawAwards.length > 0) {
        const mapped: DailyAward[] = rawAwards.map((item: Record<string, unknown>, idx: number) => {
          const typeName = String(item.award_type || 'Award');
          const meta = AWARD_META[typeName] || { name: typeName, icon: 'trophy', unit: '' };
          const val = Number(item.max_val ?? item.value ?? 0);
          return {
            id: String(item.id || idx),
            name: meta.name,
            icon: meta.icon,
            gamertag: String(item.gamertag || 'Top Driver'),
            value: `${val.toFixed(1)} ${meta.unit}`.trim(),
            car_info: `Class ${item.car_class || 'S1'} • PI ${item.car_pi || 900}`,
          };
        });
        setAwards(mapped);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  return { awards, loading, error, refetch: fetchAwards };
}
