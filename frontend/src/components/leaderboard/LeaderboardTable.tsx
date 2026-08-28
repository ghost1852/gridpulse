import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { LeaderboardEntry } from '../../hooks/useLeaderboard';
import { cn } from '../../lib/utils';

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  loading: boolean;
  currentUserTag?: string;
}

export function LeaderboardTable({ data, loading, currentUserTag }: LeaderboardTableProps) {
  
  const getRankStyle = (rank: number) => {
    switch(rank) {
      case 1: return 'text-yellow-400 font-bold bg-yellow-400/10 border-l-2 border-yellow-400';
      case 2: return 'text-gray-300 font-bold bg-gray-300/10 border-l-2 border-gray-300';
      case 3: return 'text-amber-600 font-bold bg-amber-600/10 border-l-2 border-amber-600';
      default: return 'text-gray-400 border-l-2 border-transparent';
    }
  };

  const formatValue = (val: number) => {
    // Assuming val is ms for time, simple formatting for now
    if (val > 100000) {
      // it's likely a speed or something else, but let's treat all as time for this simple generic table, or just show number
      return val.toString();
    }
    return (val / 1000).toFixed(3) + 's';
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-mono">Loading Leaderboard...</div>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/50 border-b border-white/10 text-xs uppercase tracking-wider text-gray-500 font-mono">
              <th className="p-4 w-16 text-center">Rank</th>
              <th className="p-4">Driver</th>
              <th className="p-4">Vehicle</th>
              <th className="p-4 text-center">Class / PI</th>
              <th className="p-4 text-right">Record</th>
              <th className="p-4 text-right hidden sm:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500 font-mono">No records found for this category.</td>
              </tr>
            ) : (
              data.map((entry, idx) => {
                const isUser = currentUserTag && entry.gamertag.toLowerCase() === currentUserTag.toLowerCase();
                return (
                  <tr 
                    key={idx} 
                    className={cn(
                      "hover:bg-white/5 transition-colors font-mono text-sm",
                      getRankStyle(entry.rank),
                      isUser && "bg-[var(--color-accent-primary)]/10"
                    )}
                  >
                    <td className="p-4 text-center">{entry.rank}</td>
                    <td className={cn("p-4", isUser ? "text-[var(--color-accent-primary)] font-bold" : "text-gray-200")}>
                      {entry.gamertag}
                    </td>
                    <td className="p-4 text-gray-400">{entry.car_name}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge carClass={entry.car_class} />
                        <span className="text-gray-300">{entry.car_performance_index}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-white">
                      {formatValue(entry.value)}
                    </td>
                    <td className="p-4 text-right text-gray-500 text-xs hidden sm:table-cell">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
