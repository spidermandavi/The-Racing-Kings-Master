import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Search, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  Swords,
  Medal,
  Award,
  Filter
} from 'lucide-react';

// --- Types ---

type Title = 'RKGM' | 'RKIM' | 'RKM' | 'RKHM';

interface Player {
  id: string;
  rank: number;
  previousRank: number;
  username: string;
  titles: Title[];
  rating: number;
  isMember: boolean;
  gamesPlayed: number;
  winRate: number;
  recentForm: ('W' | 'L' | 'D')[];
  blitzRating?: number;
  bulletRating?: number;
}

// --- Mock Data ---

const MOCK_PLAYERS: Player[] = [
  { 
    id: 'p1', 
    rank: 1, 
    previousRank: 2,
    username: 'Somerandomguy25', 
    titles: ['RKM'], 
    rating: 2231, 
    isMember: true, 
    gamesPlayed: 1452, 
    winRate: 68.4,
    recentForm: ['W', 'W', 'W', 'D', 'W'],
    blitzRating: 2150,
    bulletRating: 2090
  },
  { 
    id: 'p2', 
    rank: 2, 
    previousRank: 2,
    username: 'Mysterious_Past', 
    titles: ['RKM', 'RKHM'], 
    rating: 2140, 
    isMember: true, 
    gamesPlayed: 3205, 
    winRate: 64.2,
    recentForm: ['W', 'L', 'W', 'W', 'D'],
    blitzRating: 2210,
    bulletRating: 2100
  },
  { 
    id: 'p3', 
    rank: 3, 
    previousRank: 1,
    username: 'Rank-8_RK', 
    titles: ['RKIM'], 
    rating: 2075, 
    isMember: false, 
    gamesPlayed: 892, 
    winRate: 61.0,
    recentForm: ['L', 'L', 'W', 'D', 'L'],
    blitzRating: 2010,
    bulletRating: 1980
  },
  { 
    id: 'p4', 
    rank: 4, 
    previousRank: 7,
    username: 'spidermandavi', 
    titles: [], 
    rating: 1988, 
    isMember: true, 
    gamesPlayed: 512, 
    winRate: 54.8,
    recentForm: ['W', 'W', 'W', 'W', 'L'],
    blitzRating: 1850,
    bulletRating: 1920
  },
  { 
    id: 'p5', 
    rank: 5, 
    previousRank: 4,
    username: 'VariantKing99', 
    titles: ['RKGM'], 
    rating: 1950, 
    isMember: false, 
    gamesPlayed: 5100, 
    winRate: 59.5,
    recentForm: ['D', 'D', 'L', 'W', 'W'],
    blitzRating: 2300,
    bulletRating: 2450
  },
  { 
    id: 'p6', 
    rank: 6, 
    previousRank: 6,
    username: 'Rook_Runner', 
    titles: ['RKHM'], 
    rating: 1910, 
    isMember: true, 
    gamesPlayed: 420, 
    winRate: 52.1,
    recentForm: ['L', 'W', 'L', 'W', 'D'],
    blitzRating: 1800,
    bulletRating: 1750
  }
];

// --- Utilities & Sub-components ---

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

const TITLE_COLORS: Record<Title, { bg: string, text: string, border: string }> = {
  RKGM: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30' },
  RKIM: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  RKM:  { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  RKHM: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
};

const TitlePill = ({ title }: { title: Title }) => {
  const colors = TITLE_COLORS[title];
  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
      colors.bg, colors.text, colors.border
    )}>
      {title}
    </span>
  );
};

const FormBadge = ({ result }: { result: 'W' | 'L' | 'D' }) => {
  const colors = {
    W: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    L: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    D: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };
  
  return (
    <span className={cn("flex items-center justify-center w-5 h-5 rounded border text-[10px] font-bold", colors[result])}>
      {result}
    </span>
  );
};

const RankTrend = ({ current, previous }: { current: number, previous: number }) => {
  const diff = previous - current;
  if (diff > 0) return <div className="flex items-center text-emerald-400 text-xs"><TrendingUp className="w-3 h-3 mr-0.5" />{diff}</div>;
  if (diff < 0) return <div className="flex items-center text-rose-400 text-xs"><TrendingDown className="w-3 h-3 mr-0.5" />{Math.abs(diff)}</div>;
  return <div className="flex items-center text-slate-500 text-xs"><Minus className="w-3 h-3" /></div>;
};

// --- Main Component ---

export function CompetitiveTable() {
  const [search, setSearch] = useState('');
  const [membersOnly, setMembersOnly] = useState(false);
  const [titleFilter, setTitleFilter] = useState<Title | 'ALL'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Player, direction: 'asc' | 'desc' }>({ key: 'rank', direction: 'asc' });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Derive Data
  const filteredAndSortedPlayers = useMemo(() => {
    let result = [...MOCK_PLAYERS];

    if (search) {
      result = result.filter(p => p.username.toLowerCase().includes(search.toLowerCase()));
    }
    
    if (membersOnly) {
      result = result.filter(p => p.isMember);
    }

    if (titleFilter !== 'ALL') {
      result = result.filter(p => p.titles.includes(titleFilter));
    }

    result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [search, membersOnly, titleFilter, sortConfig]);

  const handleSort = (key: keyof Player) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const MAX_RATING = 2500;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8 selection:bg-cyan-900/50">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Stats Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-lg border border-cyan-500/20">
                <Trophy className="w-6 h-6 text-cyan-400" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">Racing Kings</h1>
            </div>
            <p className="text-slate-400 text-sm">Official competitive leaderboard and player statistics.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
              <Users className="w-5 h-5 text-slate-500" />
              <div>
                <div className="text-xl font-bold text-slate-100">1,492</div>
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Active Players</div>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
              <Swords className="w-5 h-5 text-slate-500" />
              <div>
                <div className="text-xl font-bold text-slate-100">1945</div>
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Top 100 Avg</div>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex items-center gap-3 col-span-2 md:col-span-1">
              <Award className="w-5 h-5 text-yellow-500/50" />
              <div>
                <div className="text-xl font-bold text-slate-100">12</div>
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Active RKGMs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar Section */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="flex w-full md:w-auto items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
              <select 
                value={titleFilter}
                onChange={(e) => setTitleFilter(e.target.value as Title | 'ALL')}
                className="bg-transparent text-sm text-slate-300 py-1 pr-8 pl-2 outline-none appearance-none cursor-pointer"
              >
                <option value="ALL">All Titles</option>
                <option value="RKGM">RKGM Only</option>
                <option value="RKIM">RKIM Only</option>
                <option value="RKM">RKM Only</option>
                <option value="RKHM">RKHM Only</option>
              </select>
            </div>

            <button 
              onClick={() => setMembersOnly(!membersOnly)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 border",
                membersOnly 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
              )}
            >
              <ShieldCheck className={cn("w-4 h-4", membersOnly ? "text-emerald-400" : "text-slate-500")} />
              Members Only
            </button>
          </div>
        </div>

        {/* Table / List Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
          
          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-[60px_3fr_2fr_1fr_100px_40px] gap-4 p-4 border-b border-slate-800 bg-slate-900/80 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
            <div className="cursor-pointer hover:text-slate-300 flex items-center gap-1" onClick={() => handleSort('rank')}>
              Rank {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
            </div>
            <div className="cursor-pointer hover:text-slate-300 flex items-center gap-1" onClick={() => handleSort('username')}>
              Player {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
            </div>
            <div className="cursor-pointer hover:text-slate-300 flex items-center gap-1" onClick={() => handleSort('rating')}>
              Rating {sortConfig.key === 'rating' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
            </div>
            <div className="cursor-pointer hover:text-slate-300 flex items-center gap-1" onClick={() => handleSort('winRate')}>
              Win Rate {sortConfig.key === 'winRate' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
            </div>
            <div className="text-center">Status</div>
            <div></div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-800/50">
            {filteredAndSortedPlayers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>No players found matching your criteria.</p>
              </div>
            ) : (
              filteredAndSortedPlayers.map((player) => (
                <React.Fragment key={player.id}>
                  {/* Row (Grid for Desktop, Flex for Mobile) */}
                  <div 
                    onClick={() => setExpandedRow(expandedRow === player.id ? null : player.id)}
                    className={cn(
                      "group relative flex flex-col md:grid md:grid-cols-[60px_3fr_2fr_1fr_100px_40px] gap-3 md:gap-4 p-4 items-center cursor-pointer transition-colors",
                      expandedRow === player.id ? "bg-slate-800/40" : "hover:bg-slate-800/20"
                    )}
                  >
                    
                    {/* 1. Rank & Trend */}
                    <div className="flex md:flex-col items-center justify-between md:justify-center w-full md:w-auto">
                      <div className="flex items-center gap-3 md:hidden">
                        <span className="text-xl font-black text-slate-300">#{player.rank}</span>
                        <RankTrend current={player.rank} previous={player.previousRank} />
                      </div>
                      
                      <div className="hidden md:flex flex-col items-center">
                        <span className="text-lg font-bold text-slate-200">{player.rank}</span>
                        <RankTrend current={player.rank} previous={player.previousRank} />
                      </div>

                      {/* Mobile Expand chevron moved to top right on mobile */}
                      <div className="md:hidden">
                        {expandedRow === player.id ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                      </div>
                    </div>

                    {/* 2. Player Info */}
                    <div className="flex items-center gap-3 w-full">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-slate-300 shrink-0 border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                        {player.username.substring(0,2).toUpperCase()}
                      </div>
                      
                      <div className="flex flex-col w-full">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="font-semibold text-slate-100 text-base">{player.username}</span>
                          {player.titles.map(title => (
                            <TitlePill key={title} title={title} />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          {player.isMember && <span className="flex items-center text-emerald-400/80"><ShieldCheck className="w-3 h-3 mr-0.5" /> Member</span>}
                          {!player.isMember && <span>Registered</span>}
                          <span className="w-1 h-1 rounded-full bg-slate-700" />
                          <span>{player.gamesPlayed.toLocaleString()} games</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Rating & Bar */}
                    <div className="w-full">
                      <div className="flex items-end justify-between md:justify-start gap-2 mb-1">
                        <span className="text-xl font-black text-white">{player.rating}</span>
                        <span className="text-xs font-medium text-slate-500 mb-1">RK</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-1000 ease-out relative"
                          style={{ width: `${(player.rating / MAX_RATING) * 100}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 w-full h-full transform -skew-x-12 animate-[shimmer_2s_infinite]" />
                        </div>
                      </div>
                    </div>

                    {/* 4. Win Rate (Hidden on mobile unless expanded) */}
                    <div className="hidden md:flex flex-col justify-center">
                      <span className={cn(
                        "text-sm font-bold", 
                        player.winRate >= 60 ? "text-emerald-400" : (player.winRate >= 50 ? "text-slate-300" : "text-rose-400")
                      )}>
                        {player.winRate}%
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">Win Rate</span>
                    </div>

                    {/* 5. Status Badge (Hidden on mobile) */}
                    <div className="hidden md:flex justify-center">
                      {player.isMember ? (
                        <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-1.5 rounded-md flex items-center justify-center" title="Verified Member">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="bg-slate-800 border border-slate-700 p-1.5 rounded-md flex items-center justify-center text-slate-500" title="Registered User">
                          <Minus className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* 6. Expand Action (Desktop) */}
                    <div className="hidden md:flex justify-end text-slate-500 group-hover:text-slate-300">
                      {expandedRow === player.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {expandedRow === player.id && (
                    <div className="bg-slate-950/50 border-y border-slate-800/50 px-4 py-6 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
                      
                      {/* Form & Stats */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Recent Form (Last 5)</h4>
                          <div className="flex gap-1.5">
                            {player.recentForm.map((res, i) => <FormBadge key={i} result={res} />)}
                          </div>
                        </div>
                        
                        <div className="md:hidden">
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Win Rate</h4>
                          <span className={cn("text-lg font-bold", player.winRate >= 50 ? "text-emerald-400" : "text-rose-400")}>
                            {player.winRate}%
                          </span>
                        </div>
                      </div>

                      {/* Other Ratings */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Other Variants</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-900 rounded border border-slate-800 p-2">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Blitz</div>
                            <div className="text-lg font-bold text-slate-300">{player.blitzRating || 'N/A'}</div>
                          </div>
                          <div className="bg-slate-900 rounded border border-slate-800 p-2">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Bullet</div>
                            <div className="text-lg font-bold text-slate-300">{player.bulletRating || 'N/A'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col justify-end items-start md:items-end gap-3">
                        <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700">
                          <Medal className="w-4 h-4" />
                          View Full Stats
                        </button>
                        <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-cyan-900/20">
                          Lichess Profile
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  )}
                </React.Fragment>
              ))
            )}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%) skewX(-12deg);
          }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}

export default CompetitiveTable;