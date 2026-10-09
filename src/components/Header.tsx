import React, { useState } from 'react';
import { MarketData } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  Sparkles, 
  ShieldCheck, 
  Activity,
  Layers,
  PieChart,
  LineChart,
  Sliders,
  LogIn,
  LogOut,
  User,
  CloudCheck,
  CheckCircle2
} from 'lucide-react';

interface HeaderProps {
  marketData: MarketData | null;
  activeTab: 'macro' | 'chart' | 'portfolio' | 'alerts';
  setActiveTab: (tab: 'macro' | 'chart' | 'portfolio' | 'alerts') => void;
  onOpenAiDrawer: () => void;
  unreadAlertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  marketData,
  activeTab,
  setActiveTab,
  onOpenAiDrawer,
  unreadAlertCount,
}) => {
  const { currentUser, login, logout, loading: authLoading } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isPositive = (marketData?.change24h ?? 0) >= 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
      {/* Ticker & Status Bar */}
      <div className="border-b border-slate-900/80 px-4 py-1.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 overflow-x-auto py-0.5">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${marketData?.isLive ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${marketData?.isLive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="font-mono text-slate-200">
              {marketData?.isLive ? 'LIVE FEED (Binance/Global)' : 'DATENSTAND: AKTUELL'}
            </span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">24h Hoch/Tief:</span>
            <span className="font-mono text-slate-300">
              ${marketData?.high24h?.toLocaleString() ?? '—'} / ${marketData?.low24h?.toLocaleString() ?? '—'}
            </span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Halving-Zyklus:</span>
            <span className="text-amber-400 font-medium">Tag {marketData?.halvingCycle.daysSinceHalving ?? 900} (Bull-Fenster)</span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Fear & Greed:</span>
            <span className={`font-semibold ${
              (marketData?.fearAndGreedIndex?.value ?? 50) > 60 ? 'text-emerald-400' :
              (marketData?.fearAndGreedIndex?.value ?? 50) < 40 ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {marketData?.fearAndGreedIndex?.value ?? 60}/100 ({marketData?.fearAndGreedIndex?.classification ?? 'Neutral'})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 hidden md:inline">
            Fiskal- & Makro-Modellierung v3.8 Active
          </span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Price */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-orange-500/20 text-slate-950 font-black text-xl">
              ₿
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-slate-100 tracking-tight">SatoshiPulse</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Macro Terminal
                </span>
              </div>
              <div className="text-[11px] text-slate-400 hidden sm:block">
                Bitcoin KI-Prognose, Fiskalanalyse & Portfoliomanager
              </div>
            </div>
          </div>

          <div className="hidden lg:block h-8 w-[1px] bg-slate-800"></div>

          {/* Quick Price Glance */}
          {marketData && (
            <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-xl">
              <div>
                <div className="text-base font-bold font-mono text-slate-100">
                  ${marketData.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  ≈ €{marketData.priceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-lg ${
                isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                {isPositive ? '+' : ''}{marketData.change24h.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('macro')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'macro'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Makro & Prognose</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'chart'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Chart & Indikatoren</span>
          </button>

          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'portfolio'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Portfolioanalyse</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'alerts'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Marktalarme</span>
            {unreadAlertCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                {unreadAlertCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Actions: AI Strategist & User Management */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={onOpenAiDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 text-xs font-semibold shadow-lg shadow-cyan-500/10 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">KI-Stratege</span>
          </button>

          {/* User Auth Controls */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 pl-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-amber-500/50 text-xs transition cursor-pointer"
              >
                <div className="flex flex-col text-left hidden md:block">
                  <span className="text-[11px] font-bold text-slate-200 truncate max-w-[110px]">
                    {currentUser.displayName || 'Mein Portfolio'}
                  </span>
                  <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-0.5">
                    ● Cloud aktiv
                  </span>
                </div>
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="User"
                    className="w-7 h-7 rounded-lg border border-slate-700 object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center text-xs">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-800/80 mb-1">
                    <p className="text-xs font-bold text-slate-100 truncate">
                      {currentUser.displayName || 'Angemeldet'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {currentUser.email}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Echtzeit-Synchronisierung aktiv</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('portfolio');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                  >
                    <PieChart className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mein Bitcoin-Portfolio</span>
                  </button>

                  <button
                    onClick={async () => {
                      setShowUserMenu(false);
                      await logout();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Abmelden</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => login()}
              disabled={authLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-amber-500/40 text-xs font-medium transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Anmelden</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
