import React, { useState, useEffect } from 'react';
import { MarketData, MarketAlertRule, TriggeredAlertNotification } from '../types';
import { 
  Bell, 
  BellRing, 
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  RotateCcw,
  Sparkles,
  Play
} from 'lucide-react';

interface AlertsManagerViewProps {
  marketData: MarketData | null;
  notifications: TriggeredAlertNotification[];
  onAddNotification: (notif: TriggeredAlertNotification) => void;
  onClearNotifications: () => void;
}

const DEFAULT_RULES: MarketAlertRule[] = [
  {
    id: 'rule-1',
    title: 'Psychologische $100k Schallmauer',
    condition: 'ABOVE',
    targetValue: 100000,
    active: true,
    triggered: false,
  },
  {
    id: 'rule-2',
    title: 'Makro-Support Bruch ($92.000)',
    condition: 'BELOW',
    targetValue: 92000,
    active: true,
    triggered: false,
  },
  {
    id: 'rule-3',
    title: 'Starke Aufwärtsbewegung (> +4% 24h)',
    condition: 'PERCENT_RISE',
    targetValue: 4.0,
    active: true,
    triggered: false,
  },
  {
    id: 'rule-4',
    title: 'Markt-Korrektur (> -3% 24h)',
    condition: 'PERCENT_DROP',
    targetValue: 3.0,
    active: true,
    triggered: false,
  },
];

// Helper to play subtle high-tech synthesizer notification chime
function playChime(isBullish = true) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const freq = isBullish ? 880 : 440;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isBullish ? 1320 : 330, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn('AudioContext playback error:', e);
  }
}

export const AlertsManagerView: React.FC<AlertsManagerViewProps> = ({
  marketData,
  notifications,
  onAddNotification,
  onClearNotifications,
}) => {
  const [rules, setRules] = useState<MarketAlertRule[]>(() => {
    try {
      const saved = localStorage.getItem('sat_market_rules');
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch {
      return DEFAULT_RULES;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotificationAllowed, setBrowserNotificationAllowed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({
    title: '',
    condition: 'ABOVE' as 'ABOVE' | 'BELOW' | 'PERCENT_DROP' | 'PERCENT_RISE',
    targetValue: '',
  });

  useEffect(() => {
    localStorage.setItem('sat_market_rules', JSON.stringify(rules));
  }, [rules]);

  // Check browser notification permission state
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserNotificationAllowed(Notification.permission === 'granted');
    }
  }, []);

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserNotificationAllowed(perm === 'granted');
      if (perm === 'granted') {
        new Notification('SatoshiPulse Marktalarme aktiviert', {
          body: 'Du erhältst nun automatische Warnungen bei signifikanten Bitcoin-Marktbewegungen.',
        });
      }
    }
  };

  // Automated rule evaluator whenever marketData updates
  useEffect(() => {
    if (!marketData) return;
    const currentPrice = marketData.priceUsd;
    const change24h = marketData.change24h;

    rules.forEach((rule) => {
      if (!rule.active) return;

      let triggeredNow = false;
      let msg = '';
      let type: 'bullish' | 'bearish' | 'warning' | 'info' = 'info';

      if (rule.condition === 'ABOVE' && currentPrice >= rule.targetValue && !rule.triggered) {
        triggeredNow = true;
        msg = `Bitcoin hat das Ziel von $${rule.targetValue.toLocaleString()} überschritten! Aktuell: $${currentPrice.toLocaleString()}`;
        type = 'bullish';
      } else if (rule.condition === 'BELOW' && currentPrice <= rule.targetValue && !rule.triggered) {
        triggeredNow = true;
        msg = `Bitcoin ist unter $${rule.targetValue.toLocaleString()} gefallen! Aktuell: $${currentPrice.toLocaleString()}`;
        type = 'bearish';
      } else if (rule.condition === 'PERCENT_RISE' && change24h >= rule.targetValue && !rule.triggered) {
        triggeredNow = true;
        msg = `Starker Preisanstieg: 24h-Gewinn liegt bei +${change24h.toFixed(2)}%!`;
        type = 'bullish';
      } else if (rule.condition === 'PERCENT_DROP' && change24h <= -rule.targetValue && !rule.triggered) {
        triggeredNow = true;
        msg = `Marktkorrektur: 24h-Verlust beträgt ${change24h.toFixed(2)}%!`;
        type = 'bearish';
      }

      if (triggeredNow) {
        // Trigger notification
        onAddNotification({
          id: 'notif-' + Date.now() + Math.random(),
          ruleTitle: rule.title,
          message: msg,
          timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type,
        });

        if (soundEnabled) {
          playChime(type === 'bullish');
        }

        if (browserNotificationAllowed && 'Notification' in window) {
          new Notification(rule.title, { body: msg });
        }

        // Mark rule as triggered
        setRules((prev) =>
          prev.map((r) =>
            r.id === rule.id
              ? { ...r, triggered: true, lastTriggeredAt: new Date().toISOString() }
              : r
          )
        );
      }
    });
  }, [marketData, rules, soundEnabled, browserNotificationAllowed]);

  const handleToggleRule = (id: string) => {
    setRules(
      rules.map((r) =>
        r.id === id ? { ...r, active: !r.active, triggered: false } : r
      )
    );
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  const handleTestTrigger = () => {
    const isBull = Math.random() > 0.5;
    const testNotif: TriggeredAlertNotification = {
      id: 'test-' + Date.now(),
      ruleTitle: '🔔 Test-Marktalarm (Simulation)',
      message: isBull
        ? `Bullisches Momentum: Spot-ETF Zuflüsse übertreffen $600M. BTC bei $${(marketData?.priceUsd || 96500).toLocaleString()}`
        : `Volatilitäts-Warnung: Liquiditätscluster bei $${((marketData?.priceUsd || 96500) - 2000).toLocaleString()} angetestet.`,
      timestamp: new Date().toLocaleTimeString('de-DE'),
      type: isBull ? 'bullish' : 'warning',
    };
    onAddNotification(testNotif);
    if (soundEnabled) playChime(isBull);
    if (browserNotificationAllowed && 'Notification' in window) {
      new Notification(testNotif.ruleTitle, { body: testNotif.message });
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newRule.targetValue);
    if (!newRule.title || isNaN(val)) return;

    const rule: MarketAlertRule = {
      id: 'rule-' + Date.now(),
      title: newRule.title,
      condition: newRule.condition,
      targetValue: val,
      active: true,
      triggered: false,
    };

    setRules([...rules, rule]);
    setShowAddModal(false);
    setNewRule({
      title: '',
      condition: 'ABOVE',
      targetValue: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Notification Permissions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Automatisierte Marktwächter-Alarme
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Permanente Überwachung von Schwellenwerten, Flash-Dumps und makroökonomischen Ausbrüchen
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playChime(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                soundEnabled
                  ? 'bg-slate-800 text-amber-400 border-amber-500/30'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>Ton: {soundEnabled ? 'Aktiv' : 'Stumm'}</span>
            </button>

            {/* Browser Push Permission Button */}
            <button
              onClick={requestBrowserPermission}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                browserNotificationAllowed
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{browserNotificationAllowed ? 'Push-Alarme aktiv' : 'Browser-Push erlauben'}</span>
            </button>

            {/* Test Trigger */}
            <button
              onClick={handleTestTrigger}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span>Alarm testen</span>
            </button>

            {/* Add Rule Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Neuen Alarm anlegen</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Rules Table */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Konfigurierte Alarmregeln ({rules.length})
            </h4>
            <span className="text-xs text-slate-400">
              Sekündlicher Check gegen Live-Kurs
            </span>
          </div>

          <div className="space-y-3">
            {rules.map((rule) => {
              const currentPrice = marketData?.priceUsd || 96500;
              const change24h = marketData?.change24h || 0;
              let diffText = '';

              if (rule.condition === 'ABOVE') {
                const diff = rule.targetValue - currentPrice;
                diffText = diff > 0 ? `Noch +$${diff.toLocaleString()} (${((diff / currentPrice) * 100).toFixed(1)}%)` : 'Schwellenwert erreicht!';
              } else if (rule.condition === 'BELOW') {
                const diff = currentPrice - rule.targetValue;
                diffText = diff > 0 ? `Noch -$${diff.toLocaleString()} (${((diff / currentPrice) * 100).toFixed(1)}%)` : 'Schwellenwert erreicht!';
              } else if (rule.condition === 'PERCENT_RISE') {
                diffText = `Aktuell: +${change24h.toFixed(2)}% (Ziel: +${rule.targetValue}%)`;
              } else if (rule.condition === 'PERCENT_DROP') {
                diffText = `Aktuell: ${change24h.toFixed(2)}% (Ziel: -${rule.targetValue}%)`;
              }

              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                    rule.triggered
                      ? 'bg-amber-500/10 border-amber-500/40 text-slate-200'
                      : rule.active
                      ? 'bg-slate-950/70 border-slate-800 text-slate-300'
                      : 'bg-slate-950/30 border-slate-900 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{rule.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                        rule.condition.includes('RISE') || rule.condition === 'ABOVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {rule.condition === 'ABOVE' && `Kurs > $${rule.targetValue.toLocaleString()}`}
                        {rule.condition === 'BELOW' && `Kurs < $${rule.targetValue.toLocaleString()}`}
                        {rule.condition === 'PERCENT_RISE' && `24h Gewinn >= +${rule.targetValue}%`}
                        {rule.condition === 'PERCENT_DROP' && `24h Verlust >= -${rule.targetValue}%`}
                      </span>
                      {rule.triggered && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold animate-pulse">
                          AUSGELÖST
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {diffText}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        rule.active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rule.active ? 'Aktiviert' : 'Pausiert'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Live Triggered Notifications Feed */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              Alarm-Verlauf ({notifications.length})
            </h4>
            {notifications.length > 0 && (
              <button
                onClick={onClearNotifications}
                className="text-xs text-slate-400 hover:text-rose-400 transition"
              >
                Leeren
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <BellRing className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
                <p className="text-xs">Noch keine Alarme ausgelöst.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Sobald ein Schwellenwert erreicht wird, erscheint er hier in Echtzeit.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    notif.type === 'bullish'
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-slate-200'
                      : notif.type === 'bearish'
                      ? 'bg-rose-950/40 border-rose-500/30 text-slate-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-amber-400 flex items-center gap-1">
                      {notif.ruleTitle}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{notif.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Alert Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h4 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              Neuen Marktalarm erstellen
            </h4>

            <form onSubmit={handleAddRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Bezeichnung des Alarms</label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Ausbruch über Vorwochenhoch"
                  value={newRule.title}
                  onChange={(e) => setNewRule({ ...newRule, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Bedingung</label>
                <select
                  value={newRule.condition}
                  onChange={(e) => setNewRule({ ...newRule, condition: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="ABOVE">Kurs steigt ÜBER Zielwert ($)</option>
                  <option value="BELOW">Kurs fällt UNTER Zielwert ($)</option>
                  <option value="PERCENT_RISE">24h Kursanstieg übersteigt Prozent (%)</option>
                  <option value="PERCENT_DROP">24h Kursverlust übersteigt Prozent (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Zielwert ({newRule.condition.includes('PERCENT') ? '%' : 'USD $'})
                </label>
                <input
                  type="number"
                  step={newRule.condition.includes('PERCENT') ? '0.5' : '100'}
                  required
                  placeholder={newRule.condition.includes('PERCENT') ? 'z.B. 5' : 'z.B. 105000'}
                  value={newRule.targetValue}
                  onChange={(e) => setNewRule({ ...newRule, targetValue: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Alarm aktivieren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
