/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { MacroForecastView } from './components/MacroForecastView';
import { ChartAnalysisView } from './components/ChartAnalysisView';
import { PortfolioView } from './components/PortfolioView';
import { AlertsManagerView } from './components/AlertsManagerView';
import { AiChatDrawer } from './components/AiChatDrawer';
import { MarketData, MacroSettings, MacroForecastResult, TriggeredAlertNotification } from './types';
import { Sparkles, Shield, AlertCircle } from 'lucide-react';

const FALLBACK_FORECAST: MacroForecastResult = {
  overallSignal: 'ACCUMULATE_DCA',
  signalScore: 82,
  recommendationHeadline: 'Akkumulationsphase mit asymmetrischem Aufwärtspotenzial',
  recommendationSummary:
    'Die Kombination aus globaler Zinswende der Federal Reserve, historischer M2-Geldmengenexpansion und anhaltenden strukturellen US-Fiskaldefiziten stützt Bitcoins Rolle als rares digitales Gut. Der post-Halving-Zyklus deutet traditionell auf die stärkste Expansionsphase hin. Anlegern wird eine disziplinierte DCA-Strategie (Dollar Cost Averaging) empfohlen.',
  rationale: {
    fiscal:
      'Globale Zentralbanken senken Realzinsen. Die US-Staatsschuld wächst um über $1 Billion alle 100 Tage, was Fiat-Währungen abwertet und institutionelle Kapitalströme in harte Werte leitet.',
    political:
      'Die politische Diskussion um eine offizielle "US Strategic Bitcoin Reserve" sowie die institutionelle Adaption über Spot-ETFs (BlackRock, Fidelity) schaffen eine nie dagewesene Verknappung des liquiden Angebots an Börsen.',
    technical:
      'Bitcoin konsolidiert oberhalb relevanter gleitender Durchschnitte. Der RSI im 14-Tage-Bereich bewegt sich im gesunden Trendbereich ohne Anzeichen von zyklischer Überhitzung.',
    onChain:
      'Über 70% des umlaufenden Bitcoin-Angebots liegen seit mehr als einem Jahr unbewegt in Cold Wallets ("Illiquid Supply"), während Miner-Verkäufe nach dem Halving stark absorbiert wurden.',
  },
  scenarios: {
    bull: {
      name: 'Bull-Case (Hyperliquidität & Staatsreserve)',
      probability: 35,
      target3M: 112000,
      target6M: 135000,
      target12M: 168000,
      catalysts: [
        'Offizielle Verabschiedung der US Strategic Bitcoin Reserve',
        'Aggressive Zinssenkungen der Fed (> 75 bps gesamt)',
        'Institutionelle Nettozuflüsse über $1 Mrd. pro Woche',
      ],
    },
    base: {
      name: 'Basis-Szenario (Zyklischer Aufwärtstrend)',
      probability: 50,
      target3M: 102000,
      target6M: 118000,
      target12M: 138000,
      catalysts: [
        'Moderate Fed-Lockerung im Einklang mit Markterwartungen',
        'Kontinuierliche Akkumulation durch börsennotierte Konzerne',
        'Klassischer parabolischer Halving-Zyklus-Verlauf',
      ],
    },
    bear: {
      name: 'Bear-Case (Makro-Schock & Konsolidierung)',
      probability: 15,
      target3M: 84000,
      target6M: 78000,
      target12M: 92000,
      catalysts: [
        'Wiederaufflammende Kerninflation & Zinspause',
        'Geopolitische Liquiditätsschocks an globalen Aktienmärkten',
        'Unerwartete regulatorische Hürden für Krypto-Intermediäre',
      ],
    },
  },
  projectedTimeline: [
    { month: 'Monat 1', basePrice: 97500, bullPrice: 101000, bearPrice: 92000 },
    { month: 'Monat 2', basePrice: 99800, bullPrice: 106000, bearPrice: 89000 },
    { month: 'Monat 3', basePrice: 102000, bullPrice: 112000, bearPrice: 84000 },
    { month: 'Monat 4', basePrice: 106500, bullPrice: 119000, bearPrice: 82000 },
    { month: 'Monat 5', basePrice: 112000, bullPrice: 126000, bearPrice: 80000 },
    { month: 'Monat 6', basePrice: 118000, bullPrice: 135000, bearPrice: 78000 },
    { month: 'Monat 7', basePrice: 121000, bullPrice: 142000, bearPrice: 80500 },
    { month: 'Monat 8', basePrice: 125000, bullPrice: 148000, bearPrice: 83000 },
    { month: 'Monat 9', basePrice: 129000, bullPrice: 153000, bearPrice: 85500 },
    { month: 'Monat 10', basePrice: 132000, bullPrice: 158000, bearPrice: 88000 },
    { month: 'Monat 11', basePrice: 135000, bullPrice: 163000, bearPrice: 90000 },
    { month: 'Monat 12', basePrice: 138000, bullPrice: 168000, bearPrice: 92000 },
  ],
  actionableStrategy: {
    recommendedAction: 'Tranchenweiser Kauf / Sparplan-Fokus (DCA) bei Rücksetzern',
    dcaStrategy: 'Wöchentlicher fixer Kaufbetrag unabhängig von Tagesvolatilität',
    entryZones: ['$88.000 - $92.000 (Starker Dip-Kauf)', '$93.500 - $96.000 (Standard-Akkumulation)'],
    takeProfitZones: ['$125.000 (15% Rebalancing)', '$145.000 (25% Gewinnmitnahme)'],
    riskManagementStop: 'Mentales Risikolevel bei nachhaltigem Bruch unter $74.000 (200 DMA).',
  },
  riskFactors: [
    'Rückkehr einer hohen US-Inflation zwingt Fed zur Straffung',
    'Massive Liquidationskaskaden auf Derivatemärkten',
  ],
  positiveCatalysts: [
    'Souveräne Staatsfonds kündigen Bitcoin-Allokation an',
    'Beschleunigung von M2 und globaler Geldmenge',
  ],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'macro' | 'chart' | 'portfolio' | 'alerts'>('macro');
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [forecast, setForecast] = useState<MacroForecastResult | null>(FALLBACK_FORECAST);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<TriggeredAlertNotification[]>([]);

  // Fetch live market data
  const fetchMarket = async () => {
    try {
      const res = await fetch('/api/market/bitcoin');
      if (res.ok) {
        const data = await res.json();
        setMarketData(data);
      }
    } catch (e) {
      console.warn('Market fetch error:', e);
    }
  };

  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch AI Macro Forecast
  const fetchForecast = async (settings?: MacroSettings) => {
    setIsLoadingForecast(true);
    try {
      const res = await fetch('/api/macro-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrice: marketData?.priceUsd || 96500,
          macroSettings: settings,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.overallSignal) {
          setForecast(data);
        }
      }
    } catch (e) {
      console.warn('Forecast fetch error, keeping existing:', e);
    } finally {
      setIsLoadingForecast(false);
    }
  };

  useEffect(() => {
    // Initial fetch on mount
    fetchForecast();
  }, []);

  const handleAddNotification = (notif: TriggeredAlertNotification) => {
    setNotifications((prev) => [notif, ...prev]);
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
        {/* Top Header */}
        <Header
          marketData={marketData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenAiDrawer={() => setIsAiDrawerOpen(true)}
          unreadAlertCount={notifications.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          {activeTab === 'macro' && (
            <MacroForecastView
              marketData={marketData}
              forecast={forecast}
              isLoadingForecast={isLoadingForecast}
              onRefreshForecast={fetchForecast}
            />
          )}

          {activeTab === 'chart' && (
            <ChartAnalysisView marketData={marketData} />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView marketData={marketData} />
          )}

          {activeTab === 'alerts' && (
            <AlertsManagerView
              marketData={marketData}
              notifications={notifications}
              onAddNotification={handleAddNotification}
              onClearNotifications={handleClearNotifications}
            />
          )}
        </main>

        {/* Footer & Disclaimer */}
        <footer className="border-t border-slate-900 bg-slate-950/90 py-6 px-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400">SatoshiPulse</span>
              <span>• Bitcoin Macro & Portfolio Intelligence</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Rechtlicher Hinweis: Die KI-Prognosen dienen Informations- & Bildungszwecken und stellen keine Anlageberatung dar.
              </span>
            </div>
          </div>
        </footer>

        {/* AI Strategist Chat Drawer */}
        <AiChatDrawer
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          marketData={marketData}
        />
      </div>
    </AuthProvider>
  );
}
