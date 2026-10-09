import React, { useState } from 'react';
import { TimelinePoint } from '../types';

interface ScenarioChartProps {
  timeline: TimelinePoint[];
  currentPrice: number;
}

export const ScenarioChart: React.FC<ScenarioChartProps> = ({ timeline, currentPrice }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        Keine Projektionsdaten verfügbar.
      </div>
    );
  }

  // Prepend current price as Month 0
  const points = [
    {
      month: 'Heute',
      basePrice: currentPrice,
      bullPrice: currentPrice,
      bearPrice: currentPrice,
    },
    ...timeline,
  ];

  // Calculate scales
  const allPrices = points.flatMap((p) => [p.basePrice, p.bullPrice, p.bearPrice]);
  const minPrice = Math.floor(Math.min(...allPrices) * 0.92);
  const maxPrice = Math.ceil(Math.max(...allPrices) * 1.08);
  const priceRange = maxPrice - minPrice || 1;

  const width = 800;
  const height = 300;
  const paddingX = 50;
  const paddingY = 40;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  const getX = (index: number) => paddingX + (index / (points.length - 1)) * plotWidth;
  const getY = (price: number) => paddingY + plotHeight - ((price - minPrice) / priceRange) * plotHeight;

  // Build SVG Paths
  const bullPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.bullPrice).toFixed(1)}`)
    .join(' ');

  const basePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.basePrice).toFixed(1)}`)
    .join(' ');

  const bearPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.bearPrice).toFixed(1)}`)
    .join(' ');

  // Area between Bull and Bear
  const areaPath = [
    ...points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.bullPrice).toFixed(1)}`),
    ...points.slice().reverse().map((p, i) => `L ${getX(points.length - 1 - i).toFixed(1)} ${getY(p.bearPrice).toFixed(1)}`),
    'Z',
  ].join(' ');

  // Grid lines
  const gridSteps = 4;
  const gridPrices = Array.from({ length: gridSteps + 1 }, (_, i) => minPrice + (priceRange / gridSteps) * i);

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="relative w-full bg-slate-900/80 rounded-2xl p-5 border border-slate-800 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            12-Monats-Szenarien-Projektionspfad (KI-Modell)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Mögliche Entwicklungskorridore unter Berücksichtigung von Liquidität, Zinsen & Halving-Zyklen
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-3 h-1 rounded bg-emerald-500"></span>
            Bull-Case
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-3 h-1 rounded bg-cyan-500"></span>
            Basis-Szenario
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-3 h-1 rounded bg-rose-500"></span>
            Bear-Case
          </span>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64 select-none touch-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="coneGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
            </linearGradient>
            <filter id="glowBull" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.6" />
            </filter>
            <filter id="glowBase" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Grid lines */}
          {gridPrices.map((p, i) => {
            const y = getY(p);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="4 4"
                  strokeOpacity="0.5"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  ${Math.round(p / 1000)}k
                </text>
              </g>
            );
          })}

          {/* X Axis labels */}
          {points.map((p, i) => {
            const x = getX(i);
            return (
              <text
                key={i}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill={hoveredIdx === i ? '#38bdf8' : '#64748b'}
                fontSize="10"
                fontWeight={hoveredIdx === i ? '600' : 'normal'}
              >
                {p.month}
              </text>
            );
          })}

          {/* Shaded Corridor Area */}
          <path d={areaPath} fill="url(#coneGradient)" />

          {/* Lines */}
          <path
            d={bullPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#glowBull)"
          />
          <path
            d={basePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#glowBase)"
          />
          <path
            d={bearPath}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />

          {/* Interactive vertical crosshair */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={paddingY}
              x2={getX(hoveredIdx)}
              y2={height - paddingY}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Interactive Point circles & Hover columns */}
          {points.map((p, i) => {
            const x = getX(i);
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
              >
                {/* Transparent hit area */}
                <rect
                  x={x - plotWidth / (points.length * 2)}
                  y={paddingY}
                  width={plotWidth / points.length}
                  height={plotHeight}
                  fill="transparent"
                />

                {/* Point nodes */}
                <circle cx={x} cy={getY(p.bullPrice)} r={isHovered ? 5 : 3} fill="#10b981" stroke="#0f172a" strokeWidth="2" />
                <circle cx={x} cy={getY(p.basePrice)} r={isHovered ? 5 : 3.5} fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
                <circle cx={x} cy={getY(p.bearPrice)} r={isHovered ? 5 : 3} fill="#f43f5e" stroke="#0f172a" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Dynamic Summary Card for selected period */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
        <div className="flex flex-col justify-center">
          <span className="text-slate-400">Fokus-Zeitpunkt</span>
          <span className="text-slate-200 font-semibold text-sm">{activePoint.month}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-emerald-400 font-medium">Bull-Ziel</span>
          <span className="text-emerald-300 font-mono text-sm font-semibold">
            ${Math.round(activePoint.bullPrice).toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-500">
            {(((activePoint.bullPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% vs. Heute
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-cyan-400 font-medium">Basis-Ziel</span>
          <span className="text-cyan-300 font-mono text-sm font-semibold">
            ${Math.round(activePoint.basePrice).toLocaleString()}
          </span>
          <span className="text-[10px] text-cyan-500">
            {(((activePoint.basePrice - currentPrice) / currentPrice) * 100).toFixed(1)}% vs. Heute
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-rose-400 font-medium">Bear-Risikoziel</span>
          <span className="text-rose-300 font-mono text-sm font-semibold">
            ${Math.round(activePoint.bearPrice).toLocaleString()}
          </span>
          <span className="text-[10px] text-rose-500">
            {(((activePoint.bearPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% vs. Heute
          </span>
        </div>
      </div>
    </div>
  );
};
