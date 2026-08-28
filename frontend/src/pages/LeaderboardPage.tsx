import { useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';

export function LeaderboardPage() {
  const [category, setCategory] = useState('0_60');
  const [carClass, setCarClass] = useState('All');
  
  const { data, loading } = useLeaderboard(category, carClass);

  const categories = [
    { id: '0_60', name: '0-60 MPH' },
    { id: '0_100', name: '0-100 MPH' },
    { id: 'quarter_mile', name: '1/4 Mile' },
    { id: 'half_mile', name: '1/2 Mile' },
    { id: 'top_speed', name: 'Top Speed' }
  ];

  const classes = ['All', 'D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-widest uppercase mb-2">Global Records</h1>
          <p className="text-gray-500 font-mono text-sm">Top times across all drivers</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-[#111118] border border-white/10 text-white font-mono text-sm rounded-lg px-4 py-2 outline-none focus:border-[var(--color-accent-primary)]"
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          
          <select 
            value={carClass}
            onChange={(e) => setCarClass(e.target.value)}
            className="bg-[#111118] border border-white/10 text-white font-mono text-sm rounded-lg px-4 py-2 outline-none focus:border-[var(--color-accent-primary)]"
          >
            {classes.map(c => <option key={c} value={c}>Class: {c}</option>)}
          </select>
        </div>
      </div>

      <LeaderboardTable data={data} loading={loading} />
    </div>
  );
}
