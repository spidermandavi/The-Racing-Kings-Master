import React, { useState } from 'react';
import { Trophy, Crown, Medal, User, ExternalLink, ChevronDown, ChevronUp, Filter, TrendingUp, Zap, Target } from 'lucide-react';

type Player = {
  rank: number;
  username: string;
  titles: string[];
  rating: number;
  isMember: boolean;
  gamesPlayed: number;
  winRate: number;
  streak: number;
};

const mockPlayers: Player[] = [
  { rank: 1, username: 'Somerandomguy25', titles: ['RKM'], rating: 2231, isMember: true, gamesPlayed: 847, winRate: 68.4, streak: 7 },
  { rank: 2, username: 'Mysterious_Past', titles: ['RKM', 'RKHM'], rating: 2140, isMember: true, gamesPlayed: 612, winRate: 64.2, streak: -2 },
  { rank: 3, username: 'Rank-8_RK', titles: ['RKIM'], rating: 2075, isMember: false, gamesPlayed: 1203, winRate: 61.8, streak: 4 },
  { rank: 4, username: 'spidermandavi', titles: [], rating: 1988, isMember: true, gamesPlayed: 428, winRate: 58.9, streak: 0 },
  { rank: 5, username: 'KnightRider_77', titles: ['RKM'], rating: 1965, isMember: true, gamesPlayed: 891, winRate: 57.3, streak: -5 },
  { rank: 6, username: 'CheckmateQueen', titles: [], rating: 1942, isMember: false, gamesPlayed: 324, winRate: 55.1, streak: 2 },
  { rank: 7, username: 'RacingAce_2024', titles: ['RKIM'], rating: 1921, isMember: true, gamesPlayed: 567, winRate: 59.4, streak: 1 },
  { rank: 8, username: 'TacticalGenius', titles: [], rating: 1908, isMember: false, gamesPlayed: 238, winRate: 53.7, streak: 0 },
];

type SortBy = 'rank' | 'rating' | 'title';
type FilterTitle = 'all' | 'titled' | 'RKM' | 'RKIM' | 'RKHM';

export function ArenaLeaderboard() {
  const [sortBy, setSortBy] = useState<SortBy>('rank');
  const [filterTitle, setFilterTitle] = useState<FilterTitle>('all');
  const [membersOnly, setMembersOnly] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);

  const filteredPlayers = mockPlayers
    .filter(p => {
      if (membersOnly && !p.isMember) return false;
      if (filterTitle === 'all') return true;
      if (filterTitle === 'titled') return p.titles.length > 0;
      return p.titles.includes(filterTitle);
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'title') {
        const aTitle = a.titles.length > 0 ? 1 : 0;
        const bTitle = b.titles.length > 0 ? 1 : 0;
        return bTitle - aTitle;
      }
      return a.rank - b.rank;
    });

  const topThree = filteredPlayers.slice(0, 3);
  const restPlayers = filteredPlayers.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Racing Kings Arena</h1>
                <p className="text-xs text-slate-400 mt-0.5">Live competitive leaderboard</p>
              </div>
            </div>
            
            {/* Stats Summary */}
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">{filteredPlayers.length} competitors</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300">2.4k games today</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSortBy('rank')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortBy === 'rank'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              By Rank
            </button>
            <button
              onClick={() => setSortBy('rating')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortBy === 'rating'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              By Rating
            </button>
            <button
              onClick={() => setSortBy('title')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortBy === 'title'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              By Title
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select
                value={filterTitle}
                onChange={(e) => setFilterTitle(e.target.value as FilterTitle)}
                className="appearance-none pl-8 pr-8 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <option value="all">All Titles</option>
                <option value="titled">Titled Only</option>
                <option value="RKM">RKM</option>
                <option value="RKIM">RKIM</option>
                <option value="RKHM">RKHM</option>
              </select>
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setMembersOnly(!membersOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                membersOnly
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {membersOnly ? '★ Members Only' : 'All Players'}
            </button>
          </div>
        </div>

        {/* Podium - Top 3 */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {topThree.map((player, idx) => {
              const podiumColors = [
                { bg: 'from-amber-500/20 to-yellow-600/20', border: 'border-amber-500/40', icon: 'text-amber-400', shadow: 'shadow-amber-500/20' },
                { bg: 'from-slate-400/20 to-slate-500/20', border: 'border-slate-400/40', icon: 'text-slate-300', shadow: 'shadow-slate-400/20' },
                { bg: 'from-orange-600/20 to-orange-700/20', border: 'border-orange-500/40', icon: 'text-orange-400', shadow: 'shadow-orange-500/20' },
              ];
              const color = podiumColors[idx];
              const Icon = idx === 0 ? Trophy : idx === 1 ? Medal : Medal;

              return (
                <div
                  key={player.username}
                  className={`relative bg-gradient-to-br ${color.bg} border ${color.border} rounded-xl p-4 shadow-xl ${color.shadow} overflow-hidden`}
                >
                  {/* Rank badge */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/60 backdrop-blur-sm flex items-center justify-center border border-slate-700/50">
                    <span className="text-xs font-bold">{player.rank}</span>
                  </div>

                  {/* Icon */}
                  <div className="mb-3">
                    <Icon className={`w-7 h-7 ${color.icon}`} />
                  </div>

                  {/* Player info */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-base text-white truncate">{player.username}</h3>
                      {player.isMember && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-600/80 text-violet-100">
                          ★
                        </span>
                      )}
                    </div>
                    {player.titles.length > 0 && (
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {player.titles.map(title => (
                          <span key={title} className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="mb-3">
                    <div className="text-3xl font-black text-white tracking-tight">{player.rating}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">Rating</div>
                  </div>

                  {/* Stats chips */}
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950/40 border border-slate-700/40">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs font-medium">{player.winRate}%</span>
                    </div>
                    {player.streak !== 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${player.streak > 0 ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-red-500/20 border-red-500/40'}`}>
                        <Zap className={`w-3 h-3 ${player.streak > 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                        <span className="text-xs font-bold">{player.streak > 0 ? '+' : ''}{player.streak}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">
                      Profile
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ranking Rail - Rest of players */}
        {restPlayers.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-950/40">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Ranking Rail</h2>
            </div>

            <div className="divide-y divide-slate-800/30">
              {restPlayers.map((player) => {
                const isExpanded = expandedPlayer === player.rank;
                
                return (
                  <div key={player.username} className="bg-slate-900/30 hover:bg-slate-800/40 transition-colors">
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Rank */}
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
                        <span className="text-sm font-bold text-slate-300">#{player.rank}</span>
                      </div>

                      {/* Player identity */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-semibold text-sm text-white truncate">{player.username}</span>
                          {player.isMember && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-600/60 text-violet-100 flex-shrink-0">
                              ★
                            </span>
                          )}
                          {player.titles.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {player.titles.map(title => (
                                <span key={title} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-lg font-black text-white">{player.rating}</span>
                          {player.streak !== 0 && (
                            <span className={`text-xs font-bold ${player.streak > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {player.streak > 0 ? '↑' : '↓'} {Math.abs(player.streak)} streak
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{player.winRate}% WR</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button className="hidden sm:block px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors">
                          Profile
                        </button>
                        <button className="hidden sm:block p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedPlayer(isExpanded ? null : player.rank)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded stats */}
                    {isExpanded && (
                      <div className="px-4 pb-3 border-t border-slate-800/30 bg-slate-950/40">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Games Played</div>
                            <div className="text-base font-bold text-white">{player.gamesPlayed}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Win Rate</div>
                            <div className="text-base font-bold text-emerald-400">{player.winRate}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Current Streak</div>
                            <div className={`text-base font-bold ${player.streak > 0 ? 'text-emerald-400' : player.streak < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              {player.streak > 0 ? '+' : ''}{player.streak}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Rating</div>
                            <div className="text-base font-bold text-white">{player.rating}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 sm:hidden">
                          <button className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors">
                            View Profile
                          </button>
                          <button className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredPlayers.length === 0 && (
          <div className="text-center py-16 px-4">
            <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No players match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
