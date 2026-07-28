import React, { useState } from 'react';
import { 
  Trophy, 
  Users, 
  TrendingUp, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Swords, 
  ShieldCheck, 
  Medal,
  Activity,
  ArrowUpRight
} from 'lucide-react';

// Types
type Player = {
  id: string;
  rank: number;
  username: string;
  titles: string[];
  rating: number;
  isMember: boolean;
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
  stats: {
    gamesPlayed: number;
    winRate: number;
    streak: number;
  };
};

const mockPlayers: Player[] = [
  { 
    id: '1', rank: 1, username: 'Somerandomguy25', titles: ['RKM'], rating: 2231, isMember: true,
    trend: 'up', trendValue: 12,
    stats: { gamesPlayed: 452, winRate: 68.5, streak: 4 }
  },
  { 
    id: '2', rank: 2, username: 'Mysterious_Past', titles: ['RKM', 'RKHM'], rating: 2140, isMember: true,
    trend: 'up', trendValue: 5,
    stats: { gamesPlayed: 890, winRate: 62.1, streak: 1 }
  },
  { 
    id: '3', rank: 3, username: 'Rank-8_RK', titles: ['RKIM'], rating: 2075, isMember: false,
    trend: 'neutral', trendValue: 0,
    stats: { gamesPlayed: 312, winRate: 59.8, streak: 0 }
  },
  { 
    id: '4', rank: 4, username: 'spidermandavi', titles: [], rating: 1988, isMember: true,
    trend: 'up', trendValue: 45,
    stats: { gamesPlayed: 128, winRate: 72.3, streak: 8 }
  },
];

export function SeasonHub() {
  const [activeTab, setActiveTab] = useState<'all' | 'members' | 'titled'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'rank' | 'titles'>('rating');

  const filteredPlayers = mockPlayers.filter(p => {
    if (activeTab === 'members') return p.isMember;
    if (activeTab === 'titled') return p.titles.length > 0;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'rank') return a.rank - b.rank;
    if (sortBy === 'titles') return b.titles.length - a.titles.length;
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      {/* Header / Hero Section */}
      <header className="bg-indigo-950 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Season 12: Autumn Series
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Racing Kings <br className="hidden md:block"/>Leaderboard</h1>
            <p className="text-indigo-200 max-w-xl text-lg">The community hub for competitive Racing Kings. Track rankings, discover players, and climb the seasonal ladder.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 w-40">
              <div className="flex items-center gap-2 text-indigo-300 mb-1">
                <Users size={16} />
                <span className="text-sm font-medium">Active</span>
              </div>
              <div className="text-3xl font-bold">1,248</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 w-40">
              <div className="flex items-center gap-2 text-indigo-300 mb-1">
                <Swords size={16} />
                <span className="text-sm font-medium">Games</span>
              </div>
              <div className="text-3xl font-bold">45.2k</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20 space-y-8">
        
        {/* Rising Player Callout */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-1 sm:p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 overflow-hidden">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 sm:w-1/3 flex flex-col justify-center text-white relative overflow-hidden group cursor-pointer">
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300"></div>
            <div className="flex items-center gap-2 font-bold text-amber-50 mb-4 uppercase tracking-wider text-xs">
              <TrendingUp size={16} className="text-amber-100" />
              Rising Star
            </div>
            <h3 className="text-2xl font-bold mb-1">spidermandavi</h3>
            <div className="flex items-center gap-2 text-amber-100 text-sm">
              <span className="font-semibold text-white">+45 Rating</span> this week
            </div>
          </div>
          
          <div className="p-4 sm:p-6 sm:pl-4 flex-1 flex flex-col justify-center">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-slate-500 text-sm font-medium mb-1">Current Standing</div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">#4 <span className="text-xl text-slate-400 font-medium ml-1">/ 1988</span></div>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Win Rate</div>
                  <div className="text-lg font-bold text-slate-800">72.3%</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Streak</div>
                  <div className="text-lg font-bold text-emerald-600">8W</div>
                </div>
              </div>
            </div>
            <button className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm flex items-center gap-1 group w-fit">
              View full profile 
              <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-4 z-30 bg-slate-50/80 backdrop-blur-xl py-4 rounded-2xl">
          <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-200 w-full sm:w-auto">
            {(['all', 'members', 'titled'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-6 py-2 rounded-full text-sm font-semibold capitalize transition-all duration-200 ${
                  activeTab === tab 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Filter size={16} />
              </div>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-9 pr-10 rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm cursor-pointer"
              >
                <option value="rating">Sort by Rating</option>
                <option value="rank">Sort by Rank</option>
                <option value="titles">Sort by Titles</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown size={16} />
              </div>
            </div>
            
            <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 shadow-sm transition-colors">
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Leaderboard Feed */}
        <div className="space-y-3">
          {filteredPlayers.map((player, index) => {
            const isExpanded = expandedId === player.id;
            
            return (
              <div 
                key={player.id} 
                className={`group bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded ? 'border-indigo-300 shadow-md shadow-indigo-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Main Row */}
                <div 
                  className="px-4 sm:px-6 py-4 flex items-center gap-4 sm:gap-6 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : player.id)}
                >
                  {/* Rank */}
                  <div className="flex flex-col items-center justify-center w-8 shrink-0">
                    <span className={`text-xl font-black ${
                      player.rank === 1 ? 'text-amber-500' : 
                      player.rank === 2 ? 'text-slate-400' : 
                      player.rank === 3 ? 'text-amber-700' : 'text-slate-300'
                    }`}>
                      #{player.rank}
                    </span>
                  </div>
                  
                  {/* Avatar Placeholder */}
                  <div className="hidden sm:flex w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 items-center justify-center border border-indigo-100 text-indigo-400 font-bold shrink-0">
                    {player.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-lg text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                        {player.username}
                      </span>
                      {player.titles.map(title => (
                        <span key={title} className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 tracking-wider">
                          {title}
                        </span>
                      ))}
                      {player.isMember && (
                        <span title="Verified Member" className="text-emerald-500 bg-emerald-50 rounded-full p-0.5">
                          <ShieldCheck size={16} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Activity size={14} />
                        {player.stats.gamesPlayed} games
                      </span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-slate-900 tracking-tight">{player.rating}</div>
                    <div className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                      player.trend === 'up' ? 'text-emerald-600' : 
                      player.trend === 'down' ? 'text-rose-600' : 'text-slate-400'
                    }`}>
                      {player.trend === 'up' && <ArrowUpRight size={12} />}
                      {player.trend === 'up' ? `+${player.trendValue}` : '-'}
                    </div>
                  </div>

                  {/* Expand Toggle */}
                  <div className="shrink-0 text-slate-300 group-hover:text-slate-500 ml-2">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* Expanded State */}
                {isExpanded && (
                  <div className="bg-slate-50 px-4 sm:px-6 py-5 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Win Rate</div>
                        <div className="text-xl font-bold text-slate-900">{player.stats.winRate}%</div>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Streak</div>
                        <div className="text-xl font-bold text-slate-900">{player.stats.streak}W</div>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 col-span-2 sm:col-span-2">
                        <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Status</div>
                        <div className="text-sm font-medium text-slate-700 flex items-center gap-2 mt-1">
                          {player.isMember ? (
                            <><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Official Club Member</>
                          ) : (
                            <><span className="w-2 h-2 rounded-full bg-slate-300"></span> Unregistered Player</>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors">
                        View Profile
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-semibold text-sm transition-colors">
                        <ExternalLink size={16} className="text-slate-400" />
                        Lichess Profile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredPlayers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
              <Users size={32} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No players found</h3>
              <p className="text-slate-500">Try adjusting your filters.</p>
            </div>
          )}
        </div>
        
        {/* Load More */}
        <div className="pt-6 pb-12 flex justify-center">
          <button className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all">
            Load More Players
          </button>
        </div>

      </main>
    </div>
  );
}
