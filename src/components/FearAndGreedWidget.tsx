import React, { useState } from 'react';
import { MarketData, MacroForecastResult } from '../types';
import { 
  Gauge, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Sparkles, 
  AlertCircle, 
  Compass, 
  BarChart3,
  Flame,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers
} from 'lucide-react';

interface FearAndGreedWidgetProps {
  marketData: MarketData | null;
  forecast?: MacroForecastResult | null;
}

export const FearAndGreedWidget: React.FC<FearAndGreedWidgetProps> = ({
  marketData,
  forecast,
}) => {
  const [showMethodology, setShowMethodology] = useState(false);

  const fng = marketData?.fearAndGreedIndex;
  const value = fng?.value ?? 61;
  const rawClassification = fng?.classification ?? 'Greed (Gier)';
  const yesterdayValue = fng?.yesterdayValue ?? 64;
  const lastWeekValue = fng?.lastWeekValue ?? 70;
  const trend = fng?.historicalTrend ?? [
    { date: '05.10', value: 70, classification: 'Greed' },
    { date: '06.10', value: 73, classification: 'Greed' },
    { date: '07.10', value: 71, classification: 'Greed' },
    { date: '08.10', value: 64, classification: 'Greed' },
    { date: '09.10', value: 59, classification: 'Greed' },
    { date: '10.10', value: 64, classification: 'Greed' },
    { date: '11.10', value: 61, classification: 'Greed' },
  ];

  // Sentiment category configuration
  const getSentimentConfig = (val: number) => {
    if (val <= 24) {
      return {
        label: 'EXTREME ANGST',
        sublabel: 'Extreme Fear (0 - 24)',
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/40',
        bgColor: 'bg-rose-500/10',
        glowColor: 'shadow-rose-500/20',
        accentHex: '#f43f5e',
        tone: 'bearish-oversold',
        tacticalAdvice: 'Historisches Akkumulations-Fenster: Überproportional viele Marktteilnehmer kapitulieren. Für antizyklische Anleger oft die lukrativsten DCA-Kaufgelegenheiten ("Greedy when others are fearful").',
        alignmentNote: 'Stützt antizyklische Zukäufe (DCA) bei technischen Unterstützungen.',
      };
    }
    if (val <= 46) {
      return {
        label: 'ANGST',
        sublabel: 'Fear (25 - 46)',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/40',
        bgColor: 'bg-amber-500/10',
        glowColor: 'shadow-amber-500/20',
        accentHex: '#f59e0b',
        tone: 'cautious',
        tacticalAdvice: 'Skepsis & Zurückhaltung im Markt: Kursrücksetzer werden vorsichtig gehandelt. Ideales Umfeld für planmäßige Tranchenkäufe ohne FOMO-Aufschläge.',
        alignmentNote: 'Harmoniert gut mit stufenweisem Einstieg in etablierten Support-Zonen.',
      };
    }
    if (val <= 54) {
      return {
        label: 'NEUTRAL',
        sublabel: 'Neutral (47 - 54)',
        textColor: 'text-yellow-300',
        borderColor: 'border-yellow-500/40',
        bgColor: 'bg-yellow-500/10',
        glowColor: 'shadow-yellow-500/20',
        accentHex: '#eab308',
        tone: 'balanced',
        tacticalAdvice: 'Gleichgewicht zwischen Käufern & Verkäufern: Markt konsolidiert vor dem nächsten Richtungsentscheid. Technische Trendlinien und On-Chain-Metriken sind entscheidend.',
        alignmentNote: 'Neutrale Ausgangslage: Fokus auf makroökonomische Leitindikatoren (Fed, M2).',
      };
    }
    if (val <= 75) {
      return {
        label: 'GIER',
        sublabel: 'Greed (55 - 75)',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        bgColor: 'bg-emerald-500/10',
        glowColor: 'shadow-emerald-500/20',
        accentHex: '#10b981',
        tone: 'bullish',
        tacticalAdvice: 'Gesunder bullischer Optimismus: Starke ETF-Zuflüsse und Aufwärtstrend. Sparpläne (DCA) diszipliniert fortführen, jedoch von emotional überdimensionierten Spontankäufen absehen.',
        alignmentNote: 'Bestätigt den Aufwärtstrend, mahnt jedoch zur Disziplin bei Tranchen-Größen.',
      };
    }
    return {
      label: 'EXTREME GIER',
      sublabel: 'Extreme Greed (76 - 100)',
      textColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/40',
      bgColor: 'bg-cyan-500/10',
      glowColor: 'shadow-cyan-500/20',
      accentHex: '#06b6d4',
      tone: 'overheated',
      tacticalAdvice: 'Markt-Euphorie & Überhitzung (FOMO): Hohe Hebel auf Derivatemärkten bergen Liquidationsrisiken. Zeit für disziplinierte Teilgewinnmitnahmen (Take-Profit) und Absicherung von Buchgewinnen.',
      alignmentNote: 'Vorsicht vor Volatilitätsspitzen: Technische Widerstandszonen für Gewinnsicherung nutzen.',
    };
  };

  const sentiment = getSentimentConfig(value);

  // SVG Speedometer calculation
  // Angle: 0 = -90deg (far left, 0%), 100 = +90deg (far right, 100%)
  const clampedVal = Math.min(100, Math.max(0, value));
  // Needle angle in radians: from PI to 0 (semi circle top)
  const angleDeg = -180 + (clampedVal / 100) * 180;
  const needleAngleRad = (angleDeg * Math.PI) / 180;
  
  const cx = 150;
  const cy = 135;
  const r = 95;
  const needleLength = 80;
  const needleX = cx + needleLength * Math.cos(needleAngleRad);
  const needleY = cy + needleLength * Math.sin(needleAngleRad);

  // Delta calculations
  const deltaYesterday = value - yesterdayValue;
  const deltaLastWeek = value - lastWeekValue;

  // AI Recommendation correlation text
  const getAiSentimentCorrelation = () => {
    const signal = forecast?.overallSignal || 'ACCUMULATE_DCA';
    switch (signal) {
      case 'STRONG_BUY':
        if (value <= 46) {
          return {
            verdict: 'Optimaler antizyklischer Einklang',
            desc: 'Die KI sieht ein starkes Kaufsignal, während die Marktbreite von Angst geprägt ist. Genau in solchen Phasen überproportionaler Skepsis entstehen historisch die profitabelsten Long-Term Positionen.',
            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          };
        }
        return {
          verdict: 'Starke Dynamik trotz fortgeschrittener Gier',
          desc: 'Die KI empfiehlt offensive Zukäufe getrieben von fundamentalen Makrohebeln (M2-Expansion, ETF-Rekordzuflüsse). Nutze kurzfristige Intraday-Dips für deine Einstiege.',
          badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        };
      case 'ACCUMULATE_DCA':
        if (value > 70) {
          return {
            verdict: 'Disziplinierte Akkumulation bei erhöhter Marktgier',
            desc: `Trotz optimistischer Stimmung (${value}/100) empfiehlt die KI stetiges DCA statt All-in-Käufen. Feste Zeitintervalle glätten das Volatilitätsrisiko bei Zwischenkorrekturen.`,
            badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          };
        }
        return {
          verdict: 'Ideal abgestimmter Sparplan-Korridor',
          desc: `Mit einem Sentiment von ${value}/100 befindet sich der Markt in einer gesunden Zone für kontinuierlichen Vermögensaufbau (DCA) ohne Spekulationsexzesse.`,
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'HOLD':
        return {
          verdict: 'Abwarten & Niveau konsolidieren',
          desc: `Der Sentiment-Score von ${value}/100 spiegelt ein Zwischenstadium wider. Bestehende Bestände halten und auf klare Durchbrüche an Schlüsselwiderständen warten.`,
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'TAKE_PROFIT':
        return {
          verdict: 'Gewinnmitnahme im Einklang mit Euphorie',
          desc: `Die KI rät zur planmäßigen Teilgewinnmitnahme. Das Sentiment zeigt erhöhte Risikobereitschaft – ideal, um Liquidität in die Stärke des Marktes hinein aufzubauen.`,
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        };
      case 'SELL':
        return {
          verdict: 'Risikoabbau & Absicherung',
          desc: `Erhöhte Euphorie oder makroökonomischer Gegenwind mahnen zur defensiven Positionierung und Risikominimierung.`,
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      default:
        return {
          verdict: 'Strategische Ausrichtung',
          desc: `Kombiniere das aktuelle Sentiment (${value}/100) mit den technischen Support- und Resistenz-Zonen der KI-Prognose.`,
          badgeColor: 'bg-slate-700 text-slate-300 border-slate-600',
        };
    }
  };

  const correlation = getAiSentimentCorrelation();

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Background ambient lighting */}
      <div 
        className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: sentiment.accentHex }}
      />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${sentiment.bgColor} ${sentiment.borderColor} ${sentiment.textColor}`}>
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Fear & Greed Index
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Marktpsychologie & Sentiment
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-Faktor Sentiment-Analyse zur Einordnung der technischen KI-Empfehlungen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {fng?.timeUntilUpdate && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Nächstes Update in {fng.timeUntilUpdate}</span>
            </div>
          )}
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1.5 rounded-lg border border-slate-700/80 transition cursor-pointer"
            title="Berechnungsmethodik einsehen"
          >
            <Info className="w-3 h-3 text-cyan-400" />
            <span>Faktoren</span>
            {showMethodology ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Main Grid: Gauge Meter & Sentiment Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Visual Speedometer Gauge */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 relative">
          <div className="w-full max-w-[300px] flex justify-center">
            <svg 
              viewBox="0 0 300 165" 
              className="w-full max-w-[280px] overflow-visible"
              aria-label={`Fear & Greed Index Gauge: ${value} von 100`}
            >
              <defs>
                <linearGradient id="fngGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f43f5e" />     {/* Extreme Fear */}
                  <stop offset="25%" stopColor="#f97316" />    {/* Fear */}
                  <stop offset="50%" stopColor="#eab308" />    {/* Neutral */}
                  <stop offset="75%" stopColor="#10b981" />    {/* Greed */}
                  <stop offset="100%" stopColor="#06b6d4" />   {/* Extreme Greed */}
                </linearGradient>

                <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={sentiment.accentHex} floodOpacity="0.4" />
                </filter>
              </defs>

              {/* Background semi-circle track */}
              <path
                d="M 45 135 A 105 105 0 0 1 255 135"
                fill="none"
                stroke="#1e293b"
                strokeWidth="20"
                strokeLinecap="round"
              />

              {/* Gradient Arc Track */}
              <path
                d="M 45 135 A 105 105 0 0 1 255 135"
                fill="none"
                stroke="url(#fngGaugeGradient)"
                strokeWidth="16"
                strokeLinecap="round"
                opacity="0.85"
              />

              {/* Tick marks on gauge */}
              {/* 0% */}
              <line x1="42" y1="135" x2="32" y2="135" stroke="#64748b" strokeWidth="2" />
              {/* 25% (approx 45 deg) */}
              <line x1="75" y1="62" x2="68" y2="55" stroke="#64748b" strokeWidth="2" />
              {/* 50% (top) */}
              <line x1="150" y1="30" x2="150" y2="20" stroke="#64748b" strokeWidth="2" />
              {/* 75% (approx 135 deg) */}
              <line x1="225" y1="62" x2="232" y2="55" stroke="#64748b" strokeWidth="2" />
              {/* 100% */}
              <line x1="258" y1="135" x2="268" y2="135" stroke="#64748b" strokeWidth="2" />

              {/* Labels below ticks */}
              <text x="32" y="152" fill="#64748b" fontSize="10" fontWeight="600" textAnchor="middle">0</text>
              <text x="64" y="48" fill="#64748b" fontSize="10" fontWeight="600" textAnchor="middle">25</text>
              <text x="150" y="15" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">50</text>
              <text x="236" y="48" fill="#64748b" fontSize="10" fontWeight="600" textAnchor="middle">75</text>
              <text x="268" y="152" fill="#64748b" fontSize="10" fontWeight="600" textAnchor="middle">100</text>

              {/* Animated Needle */}
              <line
                x1={cx}
                y1={cy}
                x2={needleX}
                y2={needleY}
                stroke="#ffffff"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#gaugeGlow)"
                className="transition-all duration-700 ease-out"
              />

              {/* Needle center hub */}
              <circle cx={cx} cy={cy} r="8" fill="#0f172a" stroke={sentiment.accentHex} strokeWidth="3" />
              <circle cx={cx} cy={cy} r="3" fill="#ffffff" />
            </svg>
          </div>

          {/* Central Value Readout */}
          <div className="text-center -mt-3 mb-1">
            <div className="flex items-baseline justify-center gap-1">
              <span className={`text-4xl font-extrabold font-mono tracking-tight ${sentiment.textColor}`}>
                {value}
              </span>
              <span className="text-sm font-semibold text-slate-500 font-mono">/ 100</span>
            </div>

            <div className="mt-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border tracking-wide ${sentiment.bgColor} ${sentiment.borderColor} ${sentiment.textColor}`}>
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: sentiment.accentHex }}></span>
                {sentiment.label}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
              {sentiment.sublabel}
            </p>
          </div>
        </div>

        {/* Right Column: Historical Milestones & 7-Day Trend */}
        <div className="lg:col-span-7 space-y-4">
          {/* Milestone Cards: Heute, Gestern, Vor 7 Tagen, Delta */}
          <div className="grid grid-cols-3 gap-3">
            {/* Heute */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block mb-1">Heute</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xl font-bold font-mono ${sentiment.textColor}`}>{value}</span>
                <span className="text-[10px] text-slate-400 truncate">{sentiment.label.split(' ')[0]}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Live Erhebung</span>
            </div>

            {/* Gestern */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block mb-1">Gestern</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-slate-200">{yesterdayValue}</span>
                {deltaYesterday !== 0 && (
                  <span className={`text-[10px] font-mono font-bold flex items-center ${deltaYesterday > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {deltaYesterday > 0 ? `+${deltaYesterday}` : deltaYesterday}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {deltaYesterday >= 0 ? 'Stimmung stabil/steigend' : 'Leichter Rückgang'}
              </span>
            </div>

            {/* Vor 7 Tagen */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block mb-1">Vor 7 Tagen</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-slate-200">{lastWeekValue}</span>
                {deltaLastWeek !== 0 && (
                  <span className={`text-[10px] font-mono font-bold flex items-center ${deltaLastWeek > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {deltaLastWeek > 0 ? `+${deltaLastWeek}` : deltaLastWeek}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Wochen-Trend</span>
            </div>
          </div>

          {/* 7-Day Trend Bar Chart */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                Sentiment-Verlauf der letzten 7 Tage
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Historie (Alternative.me)
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 pt-2">
              {trend.map((item, idx) => {
                const itemConfig = getSentimentConfig(item.value);
                const isCurrent = idx === trend.length - 1;
                return (
                  <div key={idx} className="flex flex-col items-center group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 bg-slate-800 text-slate-100 text-[10px] font-mono py-1 px-2 rounded border border-slate-700 whitespace-nowrap shadow-lg">
                      {item.date}: {item.value}/100 ({item.classification})
                    </div>

                    {/* Bar visualization */}
                    <div className="w-full h-16 bg-slate-900 rounded-md flex items-end justify-center p-1 border border-slate-800/80">
                      <div 
                        className={`w-full rounded transition-all duration-500 ${isCurrent ? 'ring-1 ring-white/50' : ''}`}
                        style={{ 
                          height: `${Math.max(15, (item.value / 100) * 100)}%`,
                          backgroundColor: itemConfig.accentHex,
                          opacity: isCurrent ? 1 : 0.75,
                        }}
                      />
                    </div>

                    <span className={`text-[10px] font-mono mt-1 font-semibold ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                      {item.value}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {item.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Sentiment vs. Technical AI Recommendation Alignment Box */}
      <div className="mt-5 pt-5 border-t border-slate-800/80">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                Sentiment-Kontext zur KI-Empfehlung ({forecast?.overallSignal?.replace('_', ' ') || 'AKKUMULIEREN'})
              </h4>
            </div>

            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${correlation.badgeColor}`}>
              {correlation.verdict}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Context A: Marktpsychologie */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                Aktuelle Marktpsychologie ({sentiment.label})
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {sentiment.tacticalAdvice}
              </p>
            </div>

            {/* Context B: Strategische Synthese */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/70">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Abgleich mit dem KI-Handlungsplan
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {correlation.desc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Methodology Accordion (Alternative.me Components) */}
      {showMethodology && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Wie setzt sich der Fear & Greed Index zusammen? (Alternative.me)</span>
            </div>
            <span className="text-[11px] text-slate-400">Skala von 0 (Panik) bis 100 (Euphorie)</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Der Krypto Fear & Greed Index analysiert Emotionen und Stimmungen aus verschiedenen Quellen und fasst diese in einer Kennzahl zusammen:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px]">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-medium text-slate-300 mb-1">
                <span>1. Volatilität</span>
                <span className="text-cyan-400 font-mono font-bold">25%</span>
              </div>
              <p className="text-slate-500 text-[10px]">
                Vergleich der aktuellen Bitcoin-Volatilität und maximalen Drawdowns mit den 30- und 90-Tage-Durchschnitten.
              </p>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-medium text-slate-300 mb-1">
                <span>2. Marktdynamik / Volumen</span>
                <span className="text-cyan-400 font-mono font-bold">25%</span>
              </div>
              <p className="text-slate-500 text-[10px]">
                Aktuelles Handelsvolumen und Momentum im Vergleich zu historischen Durchschnittswerten.
              </p>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-medium text-slate-300 mb-1">
                <span>3. Social Media Sentiment</span>
                <span className="text-cyan-400 font-mono font-bold">15%</span>
              </div>
              <p className="text-slate-500 text-[10px]">
                X/Twitter-Hashtags und Sentiment-Analysen zur Messung von Aktivität und Erregungsmustern.
              </p>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-medium text-slate-300 mb-1">
                <span>4. Bitcoin-Dominanz</span>
                <span className="text-cyan-400 font-mono font-bold">10%</span>
              </div>
              <p className="text-slate-500 text-[10px]">
                Steigende BTC-Dominanz deutet auf Flucht in Sicherheit hin; sinkende Dominanz auf Altcoin-Gier.
              </p>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-medium text-slate-300 mb-1">
                <span>5. Google Trends</span>
                <span className="text-cyan-400 font-mono font-bold">10%</span>
              </div>
              <p className="text-slate-500 text-[10px]">
                Suchvolumen nach Begriffen wie &apos;Bitcoin Kaufen&apos; vs. &apos;Bitcoin Crash&apos;.
              </p>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-medium text-slate-300 mb-1">
                <span>6. Umfragen & Resonanz</span>
                <span className="text-cyan-400 font-mono font-bold">15%</span>
              </div>
              <p className="text-slate-500 text-[10px]">
                Wöchentliche Krypto-Community-Umfragen und Stimmungsbarometer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
