import React, { useState } from 'react';
import { MarketData, MacroSettings, MacroForecastResult, UserPortfolioMetrics, PersonalPortfolioAnalysis } from '../types';
import { ScenarioChart } from './ScenarioChart';
import { 
  Sparkles, 
  RefreshCw, 
  SlidersHorizontal, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Globe2, 
  Landmark, 
  Coins, 
  ShieldAlert, 
  Target,
  ArrowRight,
  Info,
  Wallet,
  BrainCircuit,
  ArrowUpRight,
  PieChart
} from 'lucide-react';

interface MacroForecastViewProps {
  marketData: MarketData | null;
  forecast: MacroForecastResult | null;
  isLoadingForecast: boolean;
  onRefreshForecast: (customSettings?: MacroSettings) => void;
  userPortfolioMetrics?: UserPortfolioMetrics | null;
  personalAnalysis?: PersonalPortfolioAnalysis | null;
  onNavigateToPortfolio?: () => void;
}

export const MacroForecastView: React.FC<MacroForecastViewProps> = ({
  marketData,
  forecast,
  isLoadingForecast,
  onRefreshForecast,
  userPortfolioMetrics,
  personalAnalysis,
  onNavigateToPortfolio,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [customMacro, setCustomMacro] = useState<MacroSettings>({
    fedRateCutExpectation: '25-50 bps Lockerungszyklus (Geldpolitische Entspannung)',
    usDebtCeilingDeficit: 'Aggressive US-Fiskaldefizite & Fiat-Geldentwertung (> 36 Bio. $)',
    etfInflows: 'Stetiger institutioneller Nettozufluss (BlackRock, Fidelity)',
    strategicReservePolicy: 'US Strategic Bitcoin Reserve Initiative wird aktiv diskutiert',
    inflationTrend: 'Hartnäckige Kerninflation ~2.8% treibt Flucht in harte Werte',
    geopoliticalRisk: 'Geopolitische Spannungen stärken De-Dollarisierung & BTC',
  });

  const currentPrice = marketData?.priceUsd || 96500;

  const handleApplyConfig = () => {
    onRefreshForecast(customMacro);
    setShowConfig(false);
  };

  const getSignalBadge = (signal?: string) => {
    switch (signal) {
      case 'STRONG_BUY':
        return {
          label: 'STARKER KAUF (STRONG BUY)',
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          dot: 'bg-emerald-400',
        };
      case 'ACCUMULATE_DCA':
        return {
          label: 'AKKUMULIEREN / DCA (SPARPLAN-KAUF)',
          color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
          dot: 'bg-teal-400',
        };
      case 'HOLD':
        return {
          label: 'HALTEN (HOLD / BEOBACHTEN)',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
        };
      case 'TAKE_PROFIT':
        return {
          label: 'GEWINNMITNAHME (TAKE PROFIT)',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          dot: 'bg-indigo-400',
        };
      case 'SELL':
        return {
          label: 'VERKAUFEN / RISIKO REDUZIEREN (SELL)',
          color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
          dot: 'bg-rose-400',
        };
      default:
        return {
          label: 'AKKUMULIEREN / DCA',
          color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
          dot: 'bg-teal-400',
        };
    }
  };

  const signalBadge = getSignalBadge(forecast?.overallSignal);

  return (
    <div className="space-y-6">
      {/* Macro Indicators Cockpit Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Fiscal / Fed */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-cyan-400" />
              Fiskal- & Geldpolitik (Fed/EZB)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono">
              Expansiv
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">4.25% - 4.50%</div>
          <p className="text-xs text-slate-400 mt-1">
            Zinssenkungszyklus läuft. Sinkende Realrenditen stärken knappe Vermögenswerte wie BTC.
          </p>
        </div>

        {/* Card 2: Global M2 Liquidity */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-400" />
              Globale M2-Geldmenge
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
              Allzeithoch
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">$107.4 Bio.</div>
          <p className="text-xs text-slate-400 mt-1">
            Historische Korrelation von 0.84 mit BTC-Anstiegen über 90-Tage-Fenster.
          </p>
        </div>

        {/* Card 3: US Debt & Fiat Debasement */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" />
              US-Staatsschulden & Defizit
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">
              +1 Bio.$ / 100 Tage
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">&gt; $36.2 Bio.</div>
          <p className="text-xs text-slate-400 mt-1">
            Strukturelle Fiat-Entwertung zwingt Institutionen in digitale Wertaufbewahrungsmittel.
          </p>
        </div>

        {/* Card 4: Political & Strategic Reserve */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Globe2 className="w-4 h-4 text-purple-400" />
              Politik & Staatsreserven
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">
              Gamechanger
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">US BITCOIN ACT</div>
          <p className="text-xs text-slate-400 mt-1">
            Gesetzentwürfe für nationale strategische BTC-Reserven erzeugen geopolitisches Wettbieten.
          </p>
        </div>
      </div>

      {/* Primary Recommendation Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  KI-Handlungsempfehlung & Makro-Fazit
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Gemini 3.8 Quant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Fundierte Synthese aus fiskalischer Geldpolitik, geopolitischen Gesetzen & On-Chain Daten
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>{showConfig ? 'Filter schließen' : 'Makro-Parameter anpassen'}</span>
            </button>

            <button
              onClick={() => onRefreshForecast(customMacro)}
              disabled={isLoadingForecast}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingForecast ? 'animate-spin' : ''}`} />
              <span>{isLoadingForecast ? 'Berechne KI-Modell...' : 'Neu prognostizieren'}</span>
            </button>
          </div>
        </div>

        {/* Macro Parameter Configuration Accordion */}
        {showConfig && (
          <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                Fiskalische & Politische Eingabeparameter für das Modell
              </h4>
              <span className="text-[11px] text-slate-400">
                Passe die Annahmen an, um verschiedene Zukunftsszenarien zu simulieren
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Zinspolitik der Federal Reserve (US Fed)</label>
                <select
                  value={customMacro.fedRateCutExpectation}
                  onChange={(e) => setCustomMacro({ ...customMacro, fedRateCutExpectation: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="Aggressive 50-75 bps Zinssenkungen (Starke Liquidität)">Aggressive 50-75 bps Zinssenkungen (Starke Liquidität)</option>
                  <option value="25-50 bps Lockerungszyklus (Geldpolitische Entspannung)">25-50 bps Lockerungszyklus (Standard)</option>
                  <option value="Zinspause / Höhere Zinsen länger (Hawkischer Druck)">Zinspause / Höhere Zinsen länger (Hawkischer Druck)</option>
                  <option value="Notfall-Liquiditätsspritzen (Quantitative Easing)">Notfall-Liquiditätsspritzen (Quantitative Easing)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Politische Weichenstellung (US Strategic Reserve)</label>
                <select
                  value={customMacro.strategicReservePolicy}
                  onChange={(e) => setCustomMacro({ ...customMacro, strategicReservePolicy: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="US Strategic Bitcoin Reserve Initiative wird aktiv diskutiert">US Strategic Bitcoin Reserve Initiative wird aktiv diskutiert</option>
                  <option value="Gesetz verabschiedet: USA kauft offiziell 1 Million BTC über 5 Jahre">Gesetz verabschiedet: USA kauft offiziell 1 Million BTC (Super Bull)</option>
                  <option value="Verzögerungen im Kongress & parteipolitischer Stillstand">Verzögerungen im Kongress & parteipolitischer Stillstand</option>
                  <option value="Verschärfte behördliche Restriktionen & Besteuerung">Verschärfte behördliche Restriktionen & Besteuerung</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Institutionelle Spot-ETF Nachfrage</label>
                <select
                  value={customMacro.etfInflows}
                  onChange={(e) => setCustomMacro({ ...customMacro, etfInflows: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="Stetiger institutioneller Nettozufluss (BlackRock, Fidelity)">Stetiger Zufluss ($200-500 Mio./Tag)</option>
                  <option value="Massiver Zuflussboom durch Pensionskassen & Staatsfonds">Massiver Zuflussboom (&gt; $1 Mrd./Tag)</option>
                  <option value="Abflachung der ETF-Ströme / Konsolidierung">Abflachung der ETF-Ströme / Konsolidierung</option>
                  <option value="Temporäre Nettoabflüsse durch Risikoaversion">Temporäre Nettoabflüsse durch Risikoaversion</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">US-Staatsschulden & Inflationstrend</label>
                <select
                  value={customMacro.usDebtCeilingDeficit}
                  onChange={(e) => setCustomMacro({ ...customMacro, usDebtCeilingDeficit: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="Aggressive US-Fiskaldefizite & Fiat-Geldentwertung (> 36 Bio. $)">Aggressive Defizite & Fiat-Entwertung (&gt; 36 Bio. $)</option>
                  <option value="Defizit-Konsolidierung & Ausgabenkürzungen">Defizit-Konsolidierung & Ausgabenkürzungen</option>
                  <option value="Stagflations-Szenario (Hohe Inflation bei schwachem Wachstum)">Stagflations-Szenario</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleApplyConfig}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
              >
                Simulation mit diesen Parametern starten
              </button>
            </div>
          </div>
        )}

        {/* Signal & Recommendation Summary */}
        {forecast ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-950/70 p-4.5 rounded-xl border border-slate-800/90">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${signalBadge.color}`}>
                    <span className={`w-2 h-2 rounded-full ${signalBadge.dot} animate-pulse`}></span>
                    {signalBadge.label}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    Konfidenz-Score: <span className="text-amber-400 font-mono font-bold text-sm">{forecast.signalScore}%</span>
                  </div>
                </div>
                <h4 className="text-lg font-bold text-slate-100 pt-1">
                  {forecast.recommendationHeadline}
                </h4>
              </div>

              {/* Quick Action Box */}
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80 text-xs w-full md:w-auto md:min-w-[280px]">
                <span className="text-slate-400 font-medium block mb-1">Empfohlene Anleger-Taktik:</span>
                <span className="text-emerald-300 font-semibold block">
                  {forecast.actionableStrategy.recommendedAction}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  DCA-Modell: {forecast.actionableStrategy.dcaStrategy}
                </span>
              </div>
            </div>

            {/* Rationale Paragraphs */}
            <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
              <p>{forecast.recommendationSummary}</p>
            </div>

            {/* The 4 Analytical Pillars (Fiscal, Political, Technical, On-Chain) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 mb-2">
                  <Landmark className="w-4 h-4" />
                  1. Fiskalische Hebel & Liquidität
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {forecast.rationale.fiscal}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-400 mb-2">
                  <Globe2 className="w-4 h-4" />
                  2. Politische & Regulatorische Dynamik
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {forecast.rationale.political}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  3. Technische Chartmuster & Halving-Phase
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {forecast.rationale.technical}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                  <Coins className="w-4 h-4" />
                  4. On-Chain Struktur & Angebotsverknappung
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {forecast.rationale.onChain}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
            <p className="text-sm text-slate-300 font-medium">Analysiere globale Fiskaldaten und generiere Zukunftsprognose...</p>
          </div>
        )}
      </div>

      {/* PERSONAL BITCOIN PORTFOLIO MACRO IMPACT & STRATEGY */}
      {userPortfolioMetrics && userPortfolioMetrics.totalBtc > 0 ? (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 border border-cyan-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Deine Bitcoin-Bestände im Makro-Kontext
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    Reales Portfolio
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-slate-200 font-semibold">{userPortfolioMetrics.totalBtc.toFixed(4)} BTC</span>
                  <span aria-hidden="true">·</span>
                  <span>Ø Einstieg: <span className="font-mono text-slate-200">${Math.round(userPortfolioMetrics.avgBuyPrice).toLocaleString()}</span> (≈ €{Math.round(userPortfolioMetrics.avgBuyPriceEur).toLocaleString()})</span>
                  <span aria-hidden="true">·</span>
                  <span>{userPortfolioMetrics.transactionCount} Buchungen</span>
                </div>
              </div>
            </div>

            {onNavigateToPortfolio && (
              <button
                onClick={onNavigateToPortfolio}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition cursor-pointer"
              >
                <span>Im Portfolio verwalten</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Reale Kaufkosten vs. Marktwert */}
            <div className="bg-slate-950/70 p-4.5 rounded-xl border border-slate-800/80">
              <span className="text-xs font-semibold text-slate-400 block mb-2">
                1. Anschaffungswert vs. Heutiger Marktwert
              </span>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tatsächlich investiert:</span>
                  <span className="text-slate-200 font-semibold">€{userPortfolioMetrics.totalCostEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} (${userPortfolioMetrics.totalCostUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Aktueller Depotwert:</span>
                  <span className="text-amber-400 font-bold">€{userPortfolioMetrics.totalValueEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} (${userPortfolioMetrics.totalValueUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Unrealisierter Gewinn:</span>
                  <span className={`font-bold ${userPortfolioMetrics.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {userPortfolioMetrics.totalPnlPercent >= 0 ? '+' : ''}{userPortfolioMetrics.totalPnlPercent.toFixed(1)}% ({userPortfolioMetrics.totalPnlUsd >= 0 ? '+' : ''}${Math.round(userPortfolioMetrics.totalPnlUsd).toLocaleString()})
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                Dein Break-Even-Preis liegt bei ${Math.round(userPortfolioMetrics.avgBuyPrice).toLocaleString()}. {currentPrice >= userPortfolioMetrics.avgBuyPrice ? `Du bist mit +${((currentPrice - userPortfolioMetrics.avgBuyPrice)/userPortfolioMetrics.avgBuyPrice * 100).toFixed(1)}% in der Gewinnzone.` : 'Aktuell unter deinem Einstiegskurs.'}
              </p>
            </div>

            {/* Card 2: Persönliche Szenario-Projektion */}
            <div className="bg-slate-950/70 p-4.5 rounded-xl border border-slate-800/80">
              <span className="text-xs font-semibold text-slate-400 block mb-2">
                2. Szenario-Auswirkung auf deine Bestände (12M)
              </span>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-emerald-400 flex items-center gap-1">🟢 Bull-Case (${((forecast?.scenarios.bull.target12M || 168000)/1000).toFixed(0)}k):</span>
                  <span className="text-emerald-300 font-bold">${Math.round(userPortfolioMetrics.totalBtc * (forecast?.scenarios.bull.target12M || 168000)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyan-400 flex items-center gap-1">🔵 Base-Case (${((forecast?.scenarios.base.target12M || 138000)/1000).toFixed(0)}k):</span>
                  <span className="text-cyan-300 font-bold">${Math.round(userPortfolioMetrics.totalBtc * (forecast?.scenarios.base.target12M || 138000)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-400 flex items-center gap-1">🔴 Bear-Case (${((forecast?.scenarios.bear.target12M || 92000)/1000).toFixed(0)}k):</span>
                  <span className="text-rose-300 font-semibold">${Math.round(userPortfolioMetrics.totalBtc * (forecast?.scenarios.bear.target12M || 92000)).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                Im Bull-Szenario würde dein Depot um weitere +${Math.round(userPortfolioMetrics.totalBtc * ((forecast?.scenarios.bull.target12M || 168000) - currentPrice)).toLocaleString()} anwachsen.
              </p>
            </div>

            {/* Card 3: Personalisierte KI-Taktik */}
            <div className="bg-slate-950/70 p-4.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">
                  3. Maßgeschneiderte Anleger-Taktik
                </span>
                {personalAnalysis && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
                    Score {personalAnalysis.portfolioScore}/100
                  </span>
                )}
              </div>
              {personalAnalysis ? (
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="font-semibold text-slate-100">{personalAnalysis.headline}</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                    {personalAnalysis.summary}
                  </p>
                  <div className="text-[11px] text-emerald-400 pt-1 font-medium">
                    🛡️ {personalAnalysis.taxGuidance}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 space-y-2">
                  <p className="text-[11px]">
                    Berechne deine persönliche DCA-Qualität und Steuervorteile direkt über das KI-Audit im Portfolio-Tab.
                  </p>
                  {onNavigateToPortfolio && (
                    <button
                      onClick={onNavigateToPortfolio}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      KI-Audit starten <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/40 p-5 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-slate-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">
                Möchtest du diese Makro-Prognose auf deine eigenen Bitcoin-Bestände anwenden?
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Importiere deine getätigten Käufe im Portfolio-Tab, um hier deinen individuellen Break-Even-Kurs und persönliche Szenarien zu sehen.
              </p>
            </div>
          </div>
          {onNavigateToPortfolio && (
            <button
              onClick={onNavigateToPortfolio}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow"
            >
              Transaktionen importieren / verwalten
            </button>
          )}
        </div>
      )}

      {/* 12-Month Projected Path Chart */}
      {forecast && (
        <ScenarioChart
          timeline={forecast.projectedTimeline}
          currentPrice={currentPrice}
        />
      )}

      {/* Scenarios Breakdown (Bull, Base, Bear) */}
      {forecast && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bull Case */}
          <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {forecast.scenarios.bull.name}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                {forecast.scenarios.bull.probability}% Wahrscheinlichkeit
              </span>
            </div>

            <div className="space-y-2 py-2 border-y border-slate-800/80 my-3 font-mono">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 3 Monate:</span>
                <span className="text-emerald-400 font-semibold">${forecast.scenarios.bull.target3M.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 6 Monate:</span>
                <span className="text-emerald-400 font-semibold">${forecast.scenarios.bull.target6M.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 12 Monate:</span>
                <span className="text-emerald-300 font-bold text-sm">${forecast.scenarios.bull.target12M.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Treiber & Katalysatoren:</span>
              {forecast.scenarios.bull.catalysts.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 text-slate-300 text-[11px]">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Base Case */}
          <div className="bg-slate-900/60 border border-cyan-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                {forecast.scenarios.base.name}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                {forecast.scenarios.base.probability}% Wahrscheinlichkeit
              </span>
            </div>

            <div className="space-y-2 py-2 border-y border-slate-800/80 my-3 font-mono">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 3 Monate:</span>
                <span className="text-cyan-400 font-semibold">${forecast.scenarios.base.target3M.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 6 Monate:</span>
                <span className="text-cyan-400 font-semibold">${forecast.scenarios.base.target6M.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 12 Monate:</span>
                <span className="text-cyan-300 font-bold text-sm">${forecast.scenarios.base.target12M.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Treiber & Katalysatoren:</span>
              {forecast.scenarios.base.catalysts.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 text-slate-300 text-[11px]">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bear Case */}
          <div className="bg-slate-900/60 border border-rose-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {forecast.scenarios.bear.name}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                {forecast.scenarios.bear.probability}% Wahrscheinlichkeit
              </span>
            </div>

            <div className="space-y-2 py-2 border-y border-slate-800/80 my-3 font-mono">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 3 Monate:</span>
                <span className="text-rose-400 font-semibold">${forecast.scenarios.bear.target3M.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 6 Monate:</span>
                <span className="text-rose-400 font-semibold">${forecast.scenarios.bear.target6M.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Ziel 12 Monate:</span>
                <span className="text-rose-300 font-bold text-sm">${forecast.scenarios.bear.target12M.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Risikofaktoren:</span>
              {forecast.scenarios.bear.catalysts.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 text-slate-300 text-[11px]">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actionable Strategy & Entry/Exit Zones */}
      {forecast && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h4 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-amber-400" />
            Konkreter Strategieplan & Preiszonen für Anleger
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide block mb-2">
                🟢 Ideale Einstiegs- & DCA-Zonen
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {forecast.actionableStrategy.entryZones.map((zone, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{zone}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide block mb-2">
                🔵 Stufenweise Gewinnmitnahme-Ziele
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {forecast.actionableStrategy.takeProfitZones.map((zone, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>{zone}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wide block mb-2">
                🔴 Risikomanagement & Absicherung
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {forecast.actionableStrategy.riskManagementStop}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
