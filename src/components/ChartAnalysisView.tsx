import React, { useState, useEffect } from 'react';
import { MarketData } from '../types';
import { 
  LineChart, 
  CandlestickChart, 
  Layers, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Maximize2,
  Calendar,
  Activity
} from 'lucide-react';

interface ChartAnalysisViewProps {
  marketData: MarketData | null;
}

interface PricePoint {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const ChartAnalysisView: React.FC<ChartAnalysisViewProps> = ({ marketData }) => {
  const [range, setRange] = useState<'24h' | '7d' | '30d' | '1y' | 'all'>('30d');
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');
  const [showSMA, setShowSMA] = useState(true);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<PricePoint | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/market/history?range=${range}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.points) {
          setPoints(data.points);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('History fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [range]);

  // Compute stats
  const closes = points.map((p) => p.close);
  const minPrice = points.length ? Math.min(...points.map((p) => p.low)) : 90000;
  const maxPrice = points.length ? Math.max(...points.map((p) => p.high)) : 100000;
  const priceRange = maxPrice - minPrice || 1;
  const firstClose = points.length ? points[0].close : 95000;
  const lastClose = points.length ? points[points.length - 1].close : (marketData?.priceUsd || 96000);
  const periodChange = ((lastClose - firstClose) / firstClose) * 100;
  const isPeriodPositive = periodChange >= 0;

  // Simple Moving Average (7 period)
  const smaPoints = points.map((p, idx, arr) => {
    const windowSize = 5;
    if (idx < windowSize - 1) return p.close;
    const slice = arr.slice(idx - windowSize + 1, idx + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    return sum / windowSize;
  });

  // SVG dimensions
  const svgWidth = 850;
  const svgHeight = 340;
  const padX = 55;
  const padY = 30;
  const plotWidth = svgWidth - padX * 2;
  const plotHeight = svgHeight - padY * 2;

  const getX = (i: number) => padX + (i / Math.max(1, points.length - 1)) * plotWidth;
  const getY = (price: number) => padY + plotHeight - ((price - minPrice) / priceRange) * plotHeight;

  // Paths
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.close).toFixed(1)}`)
    .join(' ');

  const areaPath = points.length
    ? `${linePath} L ${getX(points.length - 1).toFixed(1)} ${padY + plotHeight} L ${getX(0).toFixed(1)} ${padY + plotHeight} Z`
    : '';

  const smaPath = points
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(smaPoints[i]).toFixed(1)}`)
    .join(' ');

  const displayPoint = hoveredPoint || (points.length ? points[points.length - 1] : null);

  // Technical resistance & support estimation
  const supportLevel = Math.round(minPrice * 1.015);
  const resistanceLevel = Math.round(maxPrice * 0.995);

  return (
    <div className="space-y-6">
      {/* Chart Control Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-mono text-slate-100">
                  BTC / USD
                </h3>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  isPeriodPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {isPeriodPositive ? '+' : ''}{periodChange.toFixed(2)}% ({range.toUpperCase()})
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Volumen: ${(points.reduce((a, b) => a + b.volume, 0) * (displayPoint?.close || 96000) / 1000000).toFixed(0)}M gehandelt
              </div>
            </div>
          </div>

          {/* Timeframe & Chart Style Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
              {(['24h', '7d', '30d', '1y', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    range === r
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
              <button
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-lg transition ${chartType === 'line' ? 'bg-slate-800 text-amber-400' : 'text-slate-400'}`}
                title="Flächen-Linienchart"
              >
                <LineChart className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('candle')}
                className={`p-1.5 rounded-lg transition ${chartType === 'candle' ? 'bg-slate-800 text-amber-400' : 'text-slate-400'}`}
                title="Candlestick Chart"
              >
                <CandlestickChart className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowSMA(!showSMA)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                showSMA
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              SMA(5) {showSMA ? 'An' : 'Aus'}
            </button>
          </div>
        </div>

        {/* Selected Data Inspection Row */}
        {displayPoint && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs font-mono mb-3">
            <div>
              <span className="text-slate-500 block text-[10px]">DATUM</span>
              <span className="text-slate-200 font-medium">{displayPoint.date}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">OPEN</span>
              <span className="text-slate-200">${displayPoint.open.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">HIGH</span>
              <span className="text-emerald-400">${displayPoint.high.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">LOW</span>
              <span className="text-rose-400">${displayPoint.low.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">SCHLUSS (CLOSE)</span>
              <span className="text-amber-400 font-bold">${displayPoint.close.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Main Chart Graphic */}
        <div className="relative w-full overflow-hidden">
          {loading ? (
            <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
              Lade Marktdaten...
            </div>
          ) : points.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
              Keine Daten verfügbar
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-80 select-none touch-none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Price Grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const price = minPrice + priceRange * (1 - ratio);
                const y = padY + plotHeight * ratio;
                return (
                  <g key={idx}>
                    <line
                      x1={padX}
                      y1={y}
                      x2={svgWidth - padX}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padX - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      ${Math.round(price).toLocaleString()}
                    </text>
                  </g>
                );
              })}

              {/* Support & Resistance Bands */}
              <line
                x1={padX}
                y1={getY(resistanceLevel)}
                x2={svgWidth - padX}
                y2={getY(resistanceLevel)}
                stroke="#f43f5e"
                strokeWidth="1"
                strokeDasharray="2 2"
                strokeOpacity="0.7"
              />
              <line
                x1={padX}
                y1={getY(supportLevel)}
                x2={svgWidth - padX}
                y2={getY(supportLevel)}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="2 2"
                strokeOpacity="0.7"
              />

              {chartType === 'line' ? (
                <>
                  {/* Area fill */}
                  <path d={areaPath} fill="url(#chartGradient)" />
                  {/* Main Line */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* SMA Line */}
                  {showSMA && (
                    <path
                      d={smaPath}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                    />
                  )}
                </>
              ) : (
                /* Candlestick Render */
                points.map((p, i) => {
                  const x = getX(i);
                  const isGreen = p.close >= p.open;
                  const candleWidth = Math.max(2, Math.min(10, plotWidth / points.length - 2));
                  const top = getY(Math.max(p.open, p.close));
                  const bottom = getY(Math.min(p.open, p.close));
                  const candleHeight = Math.max(2, bottom - top);
                  const highY = getY(p.high);
                  const lowY = getY(p.low);

                  return (
                    <g key={i}>
                      {/* Wick */}
                      <line
                        x1={x}
                        y1={highY}
                        x2={x}
                        y2={lowY}
                        stroke={isGreen ? '#10b981' : '#f43f5e'}
                        strokeWidth="1.2"
                      />
                      {/* Body */}
                      <rect
                        x={x - candleWidth / 2}
                        y={top}
                        width={candleWidth}
                        height={candleHeight}
                        fill={isGreen ? '#10b981' : '#f43f5e'}
                        rx="1"
                      />
                    </g>
                  );
                })
              )}

              {/* Hover Crosshairs & Tracking */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={getX(points.indexOf(hoveredPoint))}
                    y1={padY}
                    x2={getX(points.indexOf(hoveredPoint))}
                    y2={padY + plotHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={getX(points.indexOf(hoveredPoint))}
                    cy={getY(hoveredPoint.close)}
                    r="5"
                    fill="#f59e0b"
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* Interactive Hit Areas */}
              {points.map((p, i) => (
                <rect
                  key={i}
                  x={getX(i) - plotWidth / (points.length * 2)}
                  y={padY}
                  width={plotWidth / points.length}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredPoint(p)}
                />
              ))}
            </svg>
          )}
        </div>
      </div>

      {/* Technical Indicators & On-Chain Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* RSI Meter */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Relative Stärke Index (RSI 14)</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              (marketData?.rsi14 || 60) > 70 ? 'bg-rose-500/20 text-rose-400' :
              (marketData?.rsi14 || 60) < 30 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
            }`}>
              {(marketData?.rsi14 || 61.4).toFixed(1)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-3 relative">
            <div className="absolute left-[30%] top-0 bottom-0 w-[40%] bg-slate-700/60"></div>
            <div
              className={`h-full rounded-full transition-all ${
                (marketData?.rsi14 || 60) > 70 ? 'bg-rose-500' :
                (marketData?.rsi14 || 60) < 30 ? 'bg-emerald-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, marketData?.rsi14 || 61.4))}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0 (Überverkauft)</span>
            <span>50 Neutral</span>
            <span>100 (Überkauft)</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Aktuell im gesunden bullischen Momentum-Bereich ohne extreme Überhitzung.
          </p>
        </div>

        {/* Key Pivot Levels */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 block mb-2">Relevante Chart-Marken</span>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
              <span className="text-rose-400 font-medium">Widerstand R1:</span>
              <span className="text-slate-200 font-bold">${resistanceLevel.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
              <span className="text-emerald-400 font-medium">Unterstützung S1:</span>
              <span className="text-slate-200 font-bold">${supportLevel.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
              <span className="text-cyan-400 font-medium">200-Tage-Linie:</span>
              <span className="text-slate-200 font-bold">~$71.800 (Makro-Boden)</span>
            </div>
          </div>
        </div>

        {/* 4-Year Halving Cycle Position */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 block mb-2">Halving-Zyklus Status</span>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Tage seit Halving:</span>
              <span className="text-amber-400 font-mono font-bold">Tag {marketData?.halvingCycle.daysSinceHalving || 900}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Zyklus-Phase:</span>
              <span className="text-emerald-400 font-medium">Parabolisches Expansionsfenster</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-tight pt-1">
              Historisch erreichten die Zyklen 2012, 2016 und 2020 ihr Hoch zwischen 12 und 18 Monaten nach dem Halving.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
