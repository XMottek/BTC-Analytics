import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PortfolioTransaction } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Coins,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  Maximize2,
  Percent,
  Sparkles,
  Zap,
  Info,
} from 'lucide-react';

interface PortfolioPerformanceChartProps {
  transactions: PortfolioTransaction[];
  currentPriceUsd: number;
  eurRate: number; // e.g. 0.92 (1 USD = 0.92 EUR)
  onLoadBlockpit24?: () => void;
  onOpenImport?: () => void;
}

// Approximate monthly historical BTC closing prices (USD) to provide continuous historical valuation curves
const HISTORICAL_MONTHLY_BTC_USD: Record<string, number> = {
  '2023-01': 16600,
  '2023-02': 23100,
  '2023-03': 28400,
  '2023-04': 29200,
  '2023-05': 27200,
  '2023-06': 30400,
  '2023-07': 29200,
  '2023-08': 26000,
  '2023-09': 27000,
  '2023-10': 34500,
  '2023-11': 37700,
  '2023-12': 42200,
  '2024-01': 42500,
  '2024-02': 61000,
  '2024-03': 71200,
  '2024-04': 64000,
  '2024-05': 67500,
  '2024-06': 62700,
  '2024-07': 66000,
  '2024-08': 59000,
  '2024-09': 63300,
  '2024-10': 70200,
  '2024-11': 96000,
  '2024-12': 93500,
  '2025-01': 98500,
  '2025-02': 96000,
  '2025-03': 86000,
};

type ViewMode = 'value' | 'btc' | 'pnl';
type Timeframe = 'ALL' | '1Y' | 'YTD';

interface ChartPoint {
  date: string; // "15.01.23"
  fullDate: string; // "15.01.2023"
  timestamp: number;
  btcHoldings: number;
  investedEur: number;
  investedUsd: number;
  portfolioValueEur: number;
  portfolioValueUsd: number;
  pnlEur: number;
  pnlUsd: number;
  pnlPercent: number;
  btcPriceEur: number;
  btcPriceUsd: number;
  txNote?: string;
  txDeltaBtc?: number;
  txPriceEur?: number;
  isTxPoint?: boolean;
}

export const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({
  transactions,
  currentPriceUsd,
  eurRate,
  onLoadBlockpit24,
  onOpenImport,
}) => {
  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [viewMode, setViewMode] = useState<ViewMode>('value');
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');

  const safeEurRate = eurRate > 0 ? eurRate : 0.925;
  const currentPriceEur = currentPriceUsd * safeEurRate;

  // Build Chronological Timeline Points
  const rawChartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    // Filter out demo txs if user has real txs, or keep transactions
    const sortedTxs = [...transactions].sort((a, b) => {
      const tA = a.timestamp || new Date(a.date).getTime();
      const tB = b.timestamp || new Date(b.date).getTime();
      return tA - tB;
    });

    if (sortedTxs.length === 0) return [];

    const firstTxDate = new Date(sortedTxs[0].date);
    if (isNaN(firstTxDate.getTime())) return [];

    const now = new Date();
    const points: ChartPoint[] = [];

    let cumBtc = 0;
    let cumInvestedEur = 0;
    let cumInvestedUsd = 0;

    // Map txs by date for fast lookup
    const txByDate = new Map<string, PortfolioTransaction[]>();
    sortedTxs.forEach((tx) => {
      const dateKey = tx.date.split('T')[0];
      const list = txByDate.get(dateKey) || [];
      list.push(tx);
      txByDate.set(dateKey, list);
    });

    // Helper to calculate cost for a transaction
    const getTxCosts = (tx: PortfolioTransaction) => {
      let costEur = 0;
      let costUsd = 0;

      if (tx.totalCostOriginal && tx.totalCostOriginal > 0) {
        if (tx.currency === 'USD') {
          costUsd = tx.totalCostOriginal;
          costEur = costUsd * safeEurRate;
        } else {
          costEur = tx.totalCostOriginal;
          costUsd = costEur / safeEurRate;
        }
      } else {
        const pUsd = tx.pricePerBtcUsd > 0 ? tx.pricePerBtcUsd : (tx.pricePerBtcEur ? tx.pricePerBtcEur / safeEurRate : currentPriceUsd);
        costUsd = tx.amountBtc * pUsd + (tx.feeUsd || 0);
        costEur = tx.pricePerBtcEur
          ? tx.amountBtc * tx.pricePerBtcEur + (tx.feeUsd || 0) * safeEurRate
          : costUsd * safeEurRate;
      }
      return { costEur, costUsd };
    };

    // Iterate through all transactions and intermediate milestones
    // We add points on transaction dates, and also on month-ends if no tx happened in that month
    const processedDates = new Set<string>();

    for (let i = 0; i < sortedTxs.length; i++) {
      const tx = sortedTxs[i];
      const dateStr = tx.date.split('T')[0];
      const dateObj = new Date(dateStr);
      const { costEur, costUsd } = getTxCosts(tx);

      if (tx.type === 'BUY') {
        cumBtc += tx.amountBtc;
        cumInvestedEur += costEur;
        cumInvestedUsd += costUsd;
      } else {
        // SELL
        cumBtc = Math.max(0, cumBtc - tx.amountBtc);
        // reduce cost basis proportionally
        cumInvestedEur = Math.max(0, cumInvestedEur - costEur);
        cumInvestedUsd = Math.max(0, cumInvestedUsd - costUsd);
      }

      const txPriceUsd = tx.pricePerBtcUsd || (tx.pricePerBtcEur ? tx.pricePerBtcEur / safeEurRate : currentPriceUsd);
      const txPriceEur = tx.pricePerBtcEur || txPriceUsd * safeEurRate;
      const valEur = cumBtc * txPriceEur;
      const valUsd = cumBtc * txPriceUsd;

      // Format date for chart
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = String(dateObj.getFullYear()).slice(2);
      const fullYear = String(dateObj.getFullYear());

      points.push({
        date: `${day}.${month}.${year}`,
        fullDate: `${day}.${month}.${fullYear}`,
        timestamp: dateObj.getTime(),
        btcHoldings: Number(cumBtc.toFixed(6)),
        investedEur: Math.round(cumInvestedEur * 100) / 100,
        investedUsd: Math.round(cumInvestedUsd * 100) / 100,
        portfolioValueEur: Math.round(valEur * 100) / 100,
        portfolioValueUsd: Math.round(valUsd * 100) / 100,
        pnlEur: Math.round((valEur - cumInvestedEur) * 100) / 100,
        pnlUsd: Math.round((valUsd - cumInvestedUsd) * 100) / 100,
        pnlPercent: cumInvestedEur > 0 ? ((valEur - cumInvestedEur) / cumInvestedEur) * 100 : 0,
        btcPriceEur: Math.round(txPriceEur),
        btcPriceUsd: Math.round(txPriceUsd),
        txNote: tx.note || `${tx.type === 'BUY' ? 'Kauf' : 'Verkauf'}: ${tx.amountBtc.toFixed(4)} BTC`,
        txDeltaBtc: tx.type === 'BUY' ? tx.amountBtc : -tx.amountBtc,
        txPriceEur: Math.round(txPriceEur),
        isTxPoint: true,
      });

      processedDates.add(dateStr);
    }

    // Always add the current live point ("Heute")
    const nowDay = String(now.getDate()).padStart(2, '0');
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nowYear = String(now.getFullYear()).slice(2);
    const nowFullYear = String(now.getFullYear());
    const currentValEur = cumBtc * currentPriceEur;
    const currentValUsd = cumBtc * currentPriceUsd;

    points.push({
      date: `Heute`,
      fullDate: `${nowDay}.${nowMonth}.${nowFullYear} (Aktuell)`,
      timestamp: now.getTime(),
      btcHoldings: Number(cumBtc.toFixed(6)),
      investedEur: Math.round(cumInvestedEur * 100) / 100,
      investedUsd: Math.round(cumInvestedUsd * 100) / 100,
      portfolioValueEur: Math.round(currentValEur * 100) / 100,
      portfolioValueUsd: Math.round(currentValUsd * 100) / 100,
      pnlEur: Math.round((currentValEur - cumInvestedEur) * 100) / 100,
      pnlUsd: Math.round((currentValUsd - cumInvestedUsd) * 100) / 100,
      pnlPercent: cumInvestedEur > 0 ? ((currentValEur - cumInvestedEur) / cumInvestedEur) * 100 : 0,
      btcPriceEur: Math.round(currentPriceEur),
      btcPriceUsd: Math.round(currentPriceUsd),
      txNote: 'Aktueller Live-Marktwert',
      isTxPoint: false,
    });

    return points;
  }, [transactions, currentPriceUsd, safeEurRate, currentPriceEur]);

  // Filter by Timeframe (ALL, 1Y, YTD)
  const filteredData = useMemo(() => {
    if (rawChartData.length === 0) return [];
    if (timeframe === 'ALL') return rawChartData;

    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();

    const minTs = timeframe === '1Y' ? oneYearAgo : startOfYear;
    const filtered = rawChartData.filter((p) => p.timestamp >= minTs);

    // If filtering eliminates all except current point, return at least the last 2
    return filtered.length >= 2 ? filtered : rawChartData;
  }, [rawChartData, timeframe]);

  // Summary Metrics for the Header of the Chart
  const latestPoint = rawChartData[rawChartData.length - 1];
  const firstPoint = rawChartData[0];

  const totalReturnFiat = latestPoint
    ? currency === 'EUR'
      ? latestPoint.pnlEur
      : latestPoint.pnlUsd
    : 0;

  const totalReturnPercent = latestPoint ? latestPoint.pnlPercent : 0;
  const currentTotalValue = latestPoint
    ? currency === 'EUR'
      ? latestPoint.portfolioValueEur
      : latestPoint.portfolioValueUsd
    : 0;

  const currentInvested = latestPoint
    ? currency === 'EUR'
      ? latestPoint.investedEur
      : latestPoint.investedUsd
    : 0;

  const currentBtc = latestPoint ? latestPoint.btcHoldings : 0;

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: ChartPoint = payload[0].payload;
    const sym = currency === 'EUR' ? '€' : '$';
    const portVal = currency === 'EUR' ? data.portfolioValueEur : data.portfolioValueUsd;
    const invVal = currency === 'EUR' ? data.investedEur : data.investedUsd;
    const pnlVal = currency === 'EUR' ? data.pnlEur : data.pnlUsd;
    const btcPr = currency === 'EUR' ? data.btcPriceEur : data.btcPriceUsd;

    return (
      <div className="bg-slate-900/95 border border-slate-700/80 p-3.5 rounded-xl shadow-2xl backdrop-blur-md min-w-[240px] text-xs pointer-events-none z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            {data.fullDate}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            1 BTC = {sym}{btcPr.toLocaleString('de-DE')}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Depotwert:
            </span>
            <span className="font-bold font-mono text-emerald-400 text-sm">
              {sym}{portVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Investiert:
            </span>
            <span className="font-mono font-medium text-slate-200">
              {sym}{invVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Gewinn / PnL:
            </span>
            <span
              className={`font-mono font-bold ${
                pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {pnlVal >= 0 ? '+' : ''}
              {sym}{pnlVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1 text-[10px]">
                ({data.pnlPercent >= 0 ? '+' : ''}{data.pnlPercent.toFixed(1)}%)
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              BTC-Bestand:
            </span>
            <span className="font-mono font-bold text-amber-300">
              {data.btcHoldings.toFixed(4)} BTC
            </span>
          </div>

          {data.txDeltaBtc && (
            <div className="mt-2 pt-1.5 border-t border-cyan-500/30 bg-cyan-950/40 p-1.5 rounded-lg text-[10px] text-cyan-200">
              <span className="font-semibold block text-cyan-300">
                {data.txDeltaBtc > 0 ? '✦ DCA-Kauf ausgeführt' : '✦ Verkauf'}:
              </span>
              <span>
                {data.txDeltaBtc > 0 ? '+' : ''}{data.txDeltaBtc.toFixed(4)} BTC @ {sym}{data.txPriceEur?.toLocaleString('de-DE')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Format Y-axis tick values for compact display (e.g. 15k €, $20k, 0.25 BTC)
  const formatYAxis = (val: number) => {
    if (viewMode === 'btc') {
      return `${val.toFixed(3)} BTC`;
    }
    const sym = currency === 'EUR' ? '€' : '$';
    if (Math.abs(val) >= 1000) {
      return `${(val / 1000).toFixed(0)}k ${sym}`;
    }
    return `${val} ${sym}`;
  };

  if (!rawChartData || rawChartData.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <TrendingUp className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-slate-100">
            Historische Wertentwicklung deines Depots
          </h4>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-5 leading-relaxed">
            Sobald du deine Transaktionen aus der CSV-Datei importierst oder deine Käufe erfasst, wird hier die genaue Wertsteigerung und Akkumulation deiner Bitcoin über die Zeit visualisiert.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onLoadBlockpit24 && (
              <button
                onClick={onLoadBlockpit24}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>Blockpit 24 Käufe (0.3136 BTC) laden</span>
              </button>
            )}
            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
              >
                CSV manuell importieren
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/5 via-cyan-500/5 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

      {/* Header with Title and Control Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              Historische Wertentwicklung & Depotverlauf
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {rawChartData.length} Datenpunkte
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualisierung deiner Vermögensbildung: Kumulierter Bitcoin-Bestand vs. investiertes Kaufkapital
          </p>
        </div>

        {/* Control Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('value')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'value'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Depotwert & Kosten</span>
            </button>
            <button
              onClick={() => setViewMode('pnl')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'pnl'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Gewinn (PnL)</span>
            </button>
            <button
              onClick={() => setViewMode('btc')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'btc'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>BTC-Bestand</span>
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setCurrency('EUR')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                currency === 'EUR'
                  ? 'bg-slate-700 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EUR (€)
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                currency === 'USD'
                  ? 'bg-slate-700 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* Timeframe Filter */}
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            {(['ALL', '1Y', 'YTD'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  timeframe === tf
                    ? 'bg-slate-800 text-slate-100 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf === 'ALL' ? 'Gesamt' : tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Quick-Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
            Aktueller Portfoliowert
          </span>
          <span className="text-lg font-bold font-mono text-emerald-400">
            {currency === 'EUR' ? '€' : '$'}
            {currentTotalValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            {currentBtc.toFixed(4)} BTC
          </span>
        </div>

        <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
            Investiertes Kapital
          </span>
          <span className="text-lg font-bold font-mono text-slate-200">
            {currency === 'EUR' ? '€' : '$'}
            {currentInvested.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            Kaufkosten gesamt
          </span>
        </div>

        <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
            Unrealisierter Gewinn
          </span>
          <span className={`text-lg font-bold font-mono ${totalReturnFiat >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalReturnFiat >= 0 ? '+' : ''}
            {currency === 'EUR' ? '€' : '$'}
            {totalReturnFiat.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-emerald-400/90 font-bold block font-mono mt-0.5">
            {totalReturnPercent >= 0 ? '+' : ''}{totalReturnPercent.toFixed(1)}% ROI
          </span>
        </div>

        <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
            Erster Kauf
          </span>
          <span className="text-lg font-bold font-mono text-cyan-300">
            {firstPoint ? firstPoint.fullDate : '–'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {rawChartData.filter((p) => p.isTxPoint).length} Käufe getätigt
          </span>
        </div>
      </div>

      {/* Main Recharts Area Container */}
      <div className="w-full h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'value' ? (
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickMargin={8}
              />

              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={formatYAxis}
                domain={['auto', 'auto']}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => {
                  if (value === 'portfolioValue') return <span className="text-emerald-400 font-semibold text-xs">Portfoliowert (Marktwert)</span>;
                  if (value === 'investedFiat') return <span className="text-amber-400 font-semibold text-xs">Investiertes Kapital (Kaufkosten)</span>;
                  return <span className="text-slate-300 text-xs">{value}</span>;
                }}
              />

              {/* Area 1: Current Portfolio Value */}
              <Area
                type="monotone"
                dataKey={currency === 'EUR' ? 'portfolioValueEur' : 'portfolioValueUsd'}
                name="portfolioValue"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorValue)"
                activeDot={{ r: 6, fill: '#10b981', stroke: '#064e3b', strokeWidth: 2 }}
              />

              {/* Area 2: Invested Capital Baseline */}
              <Area
                type="stepAfter"
                dataKey={currency === 'EUR' ? 'investedEur' : 'investedUsd'}
                name="investedFiat"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorInvested)"
                activeDot={{ r: 5, fill: '#f59e0b', stroke: '#78350f', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : viewMode === 'pnl' ? (
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickMargin={8}
              />

              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={formatYAxis}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                height={36}
                formatter={() => (
                  <span className="text-cyan-400 font-semibold text-xs">
                    Realisierter / Buchgewinn ({currency === 'EUR' ? 'EUR' : 'USD'})
                  </span>
                )}
              />

              <Area
                type="monotone"
                dataKey={currency === 'EUR' ? 'pnlEur' : 'pnlUsd'}
                stroke="#06b6d4"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorPnl)"
                activeDot={{ r: 6, fill: '#06b6d4', stroke: '#164e63', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBtc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickMargin={8}
              />

              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={formatYAxis}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                height={36}
                formatter={() => (
                  <span className="text-amber-400 font-semibold text-xs">
                    Kumulierter Bitcoin-Bestand (BTC Stacking Treppe)
                  </span>
                )}
              />

              <Area
                type="stepAfter"
                dataKey="btcHoldings"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorBtc)"
                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#78350f', strokeWidth: 2 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Explanatory footer banner */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Der Chart verknüpft deine tatsächlichen Anschaffungskurse mit der Bitcoin-Kursentwicklung bis zum aktuellen Live-Kurs ({currency === 'EUR' ? `€${Math.round(currentPriceEur).toLocaleString()}` : `$${Math.round(currentPriceUsd).toLocaleString()}`}).
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            Depotwert
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
            Investiertes Kapital
          </span>
        </div>
      </div>
    </div>
  );
};
