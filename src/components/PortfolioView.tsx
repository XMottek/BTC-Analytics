import React, { useState, useEffect } from 'react';
import { MarketData, PortfolioTransaction } from '../types';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  addDoc
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Wallet, 
  Coins, 
  Calculator, 
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  DollarSign,
  LogIn,
  CloudCheck,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  BrainCircuit,
  Award,
  RefreshCw,
  Clock
} from 'lucide-react';

interface PortfolioViewProps {
  marketData: MarketData | null;
}

const DEFAULT_LOCAL_TRANSACTIONS: PortfolioTransaction[] = [
  {
    id: 'tx-1',
    type: 'BUY',
    amountBtc: 0.35,
    pricePerBtcUsd: 59200,
    feeUsd: 12,
    date: '2024-08-15',
    note: 'DCA Nachkauf während Sommer-Korrektur',
  },
  {
    id: 'tx-2',
    type: 'BUY',
    amountBtc: 0.25,
    pricePerBtcUsd: 64100,
    feeUsd: 8,
    date: '2024-09-22',
    note: 'Akkumulation vor US-Zinssenkung',
  },
  {
    id: 'tx-3',
    type: 'BUY',
    amountBtc: 0.20,
    pricePerBtcUsd: 73500,
    feeUsd: 10,
    date: '2024-11-06',
    note: 'Ausbruch nach US-Wahlen',
  },
];

interface AiPortfolioAnalysis {
  portfolioScore: number;
  riskLevel: string;
  headline: string;
  summary: string;
  dcaEvaluation: string;
  actionSteps: string[];
  taxGuidance: string;
  bullCaseValueUsd: number;
  bearCaseValueUsd: number;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ marketData }) => {
  const { currentUser, login, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiPortfolioAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // Transaction form modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTx, setNewTx] = useState({
    type: 'BUY' as 'BUY' | 'SELL',
    amountBtc: '',
    pricePerBtcUsd: marketData?.priceUsd?.toString() || '96500',
    feeUsd: '5',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });

  const [targetBtcPrice, setTargetBtcPrice] = useState(130000);

  // Firestore or LocalStorage sync
  useEffect(() => {
    if (currentUser) {
      setIsSyncing(true);
      const txsRef = collection(db, 'users', currentUser.uid, 'transactions');
      const q = query(txsRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: PortfolioTransaction[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              type: data.type,
              amountBtc: data.amountBtc,
              pricePerBtcUsd: data.pricePerBtcUsd,
              feeUsd: data.feeUsd || 0,
              date: data.date,
              note: data.note || '',
            });
          });

          // Sort by date descending
          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(list);
          setIsSyncing(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/transactions`);
          setIsSyncing(false);
        }
      );

      return () => unsubscribe();
    } else {
      // Local storage fallback
      try {
        const saved = localStorage.getItem('sat_portfolio_txs');
        setTransactions(saved ? JSON.parse(saved) : DEFAULT_LOCAL_TRANSACTIONS);
      } catch {
        setTransactions(DEFAULT_LOCAL_TRANSACTIONS);
      }
    }
  }, [currentUser]);

  // Save to local storage when not authenticated
  useEffect(() => {
    if (!currentUser && transactions.length > 0) {
      localStorage.setItem('sat_portfolio_txs', JSON.stringify(transactions));
    }
  }, [currentUser, transactions]);

  const currentPrice = marketData?.priceUsd || 96500;
  const eurRate = 0.925;

  // Calculate portfolio totals
  let totalBtc = 0;
  let totalCostUsd = 0;

  transactions.forEach((tx) => {
    if (tx.type === 'BUY') {
      totalBtc += tx.amountBtc;
      totalCostUsd += tx.amountBtc * tx.pricePerBtcUsd + (tx.feeUsd || 0);
    } else {
      totalBtc -= tx.amountBtc;
      totalCostUsd -= tx.amountBtc * tx.pricePerBtcUsd;
    }
  });

  const safeTotalBtc = Math.max(0, totalBtc);
  const totalValueUsd = safeTotalBtc * currentPrice;
  const totalValueEur = totalValueUsd * eurRate;
  const avgBuyPrice = safeTotalBtc > 0 ? totalCostUsd / safeTotalBtc : 0;
  const totalPnlUsd = totalValueUsd - totalCostUsd;
  const totalPnlEur = totalPnlUsd * eurRate;
  const totalPnlPercent = totalCostUsd > 0 ? (totalPnlUsd / totalCostUsd) * 100 : 0;
  const totalSatoshis = Math.round(safeTotalBtc * 100000000);

  // Add Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newTx.amountBtc);
    const price = parseFloat(newTx.pricePerBtcUsd);
    if (!amount || isNaN(amount) || !price || isNaN(price)) return;

    const txId = 'tx-' + Date.now();
    const txData: PortfolioTransaction = {
      id: txId,
      type: newTx.type,
      amountBtc: amount,
      pricePerBtcUsd: price,
      feeUsd: parseFloat(newTx.feeUsd) || 0,
      date: newTx.date,
      note: newTx.note || (newTx.type === 'BUY' ? 'Bitcoin Kauf' : 'Bitcoin Verkauf'),
    };

    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'transactions', txId);
        await setDoc(docRef, {
          id: txId,
          userId: currentUser.uid,
          type: txData.type,
          amountBtc: txData.amountBtc,
          pricePerBtcUsd: txData.pricePerBtcUsd,
          feeUsd: txData.feeUsd,
          date: txData.date,
          note: txData.note,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}/transactions/${txId}`);
      }
    } else {
      setTransactions([txData, ...transactions]);
    }

    setShowAddModal(false);
    setNewTx({
      type: 'BUY',
      amountBtc: '',
      pricePerBtcUsd: currentPrice.toString(),
      feeUsd: '5',
      date: new Date().toISOString().split('T')[0],
      note: '',
    });
  };

  // Delete Transaction
  const handleDeleteTx = async (id: string) => {
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'transactions', id);
        await deleteDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${currentUser.uid}/transactions/${id}`);
      }
    } else {
      setTransactions(transactions.filter((t) => t.id !== id));
    }
  };

  // Import demo transactions into user account
  const handleImportDemo = async () => {
    if (!currentUser) return;
    try {
      for (const t of DEFAULT_LOCAL_TRANSACTIONS) {
        const id = 'demo-' + Date.now() + Math.random().toString(36).substring(2, 6);
        const docRef = doc(db, 'users', currentUser.uid, 'transactions', id);
        await setDoc(docRef, {
          id,
          userId: currentUser.uid,
          type: t.type,
          amountBtc: t.amountBtc,
          pricePerBtcUsd: t.pricePerBtcUsd,
          feeUsd: t.feeUsd,
          date: t.date,
          note: t.note,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/transactions`);
    }
  };

  // Request Personal AI Portfolio Analysis
  const handleRequestAiAnalysis = async () => {
    if (safeTotalBtc === 0) {
      alert('Bitte erfasse zuerst mindestens eine Transaktion, um eine Portfolio-Analyse durchführen zu lassen.');
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysisModal(true);

    try {
      const res = await fetch('/api/user-portfolio-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          totalBtc: safeTotalBtc,
          avgBuyPrice,
          totalCostUsd,
          currentPrice,
        }),
      });

      if (!res.ok) {
        throw new Error('Fehler bei der Analyseanfrage');
      }

      const data: AiPortfolioAnalysis = await res.json();
      setAiAnalysis(data);

      // Persist in Firestore if logged in
      if (currentUser) {
        try {
          const analysisId = 'audit-' + Date.now();
          const auditRef = doc(db, 'users', currentUser.uid, 'analyses', analysisId);
          await setDoc(auditRef, {
            userId: currentUser.uid,
            totalBtc: safeTotalBtc,
            avgBuyPrice,
            analysisText: data.summary,
            riskLevel: data.riskLevel,
            portfolioScore: data.portfolioScore,
            recommendation: data.actionSteps.join('; '),
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Could not save audit to firestore:', e);
        }
      }
    } catch (err: any) {
      console.error('Portfolio AI analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User Management & Cloud Status Banner */}
      {currentUser ? (
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4.5 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100">
                  Benutzerkonto verbunden: {currentUser.displayName || currentUser.email}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Cloud Firestore Synchronisiert
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deine Bitcoin-Bestände werden sicher unter deiner Benutzer-ID verwaltet und in Echtzeit synchronisiert.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestAiAnalysis}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Eigene Bestände analysieren</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4.5 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100">
                  Möchtest du deine eigenen Bitcoin-Bestände dauerhaft verwalten?
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Lokaler Modus
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Melde dich an, um dein Portfolio in der Firebase Cloud zu sichern und geräteübergreifend abzurufen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => login()}
              disabled={authLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Mit Google anmelden</span>
            </button>
          </div>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Value */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-amber-400" />
              Gesamtwert Portfolio
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
              Live
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            ${totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            ≈ €{totalValueEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Card 2: Bitcoin Holdings */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              Bitcoin Bestand
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              HODL
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {safeTotalBtc.toFixed(4)} <span className="text-sm font-semibold text-amber-400">BTC</span>
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            {totalSatoshis.toLocaleString()} Satoshis
          </div>
        </div>

        {/* Card 3: Unrealized Profit / Loss */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Unrealisierter Gewinn / PnL
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              totalPnlUsd >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
            }`}>
              {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
            </span>
          </div>
          <div className={`text-2xl font-bold font-mono ${totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalPnlUsd >= 0 ? '+' : ''}${totalPnlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            ≈ {totalPnlEur >= 0 ? '+' : ''}€{totalPnlEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Card 4: Average Buy Price (DCA) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-cyan-400" />
              DCA-Durchschnittskurs
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
              Investiert
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            ${Math.round(avgBuyPrice).toLocaleString()}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            Gesamtinvestition: ${Math.round(totalCostUsd).toLocaleString()}
          </div>
        </div>
      </div>

      {/* AI Portfolio Audit Action Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-cyan-400 animate-pulse" />
              KI-gestützte Bestandsanalyse für dein persönliches Portfolio
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">
              Gemini 3.8
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Lass deine tatsächlichen Bitcoin-Kaufkurse, Tranchen und Haltefristen durch die KI analysieren und erhalte konkrete Handlungsempfehlungen.
          </p>
        </div>

        <button
          onClick={handleRequestAiAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isAnalyzing ? (
            <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
          ) : (
            <Sparkles className="w-4 h-4 text-slate-950" />
          )}
          <span>{isAnalyzing ? 'Analysiere Portfolio...' : 'Jetzt analysieren lassen'}</span>
        </button>
      </div>

      {/* Interactive Target Scenario & Return Simulator */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              Portfolio-Szenario & Zielkurs-Simulator
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Simuliere den zukünftigen Wert deines Portfolios basierend auf Makro-Zielkursen
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[110000, 130000, 150000, 200000].map((preset) => (
              <button
                key={preset}
                onClick={() => setTargetBtcPrice(preset)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg transition ${
                  targetBtcPrice === preset
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ${preset / 1000}k
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Angenommener Bitcoin-Zielkurs ($)
            </label>
            <div className="relative">
              <input
                type="number"
                value={targetBtcPrice}
                onChange={(e) => setTargetBtcPrice(Number(e.target.value))}
                step="5000"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-400"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">USD</span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium">Projizierter Portfoliowert</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              ${(safeTotalBtc * targetBtcPrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              ≈ €{(safeTotalBtc * targetBtcPrice * eurRate).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium">Zusätzlicher Gewinn zum heutigen Kurs</span>
            <span className="text-xl font-bold font-mono text-cyan-400">
              +${(safeTotalBtc * (targetBtcPrice - currentPrice)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              +{(((targetBtcPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% Kursanstieg
            </span>
          </div>
        </div>
      </div>

      {/* Transactions History & Manager */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Meine Bitcoin-Transaktionen</span>
              {currentUser && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CloudCheck className="w-3 h-3" />
                  Cloud Gespeichert ({transactions.length})
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Erfasse deine realen Bitcoin-Käufe und Verkäufe zur genauen Analyse und Steuerdokumentation
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentUser && transactions.length === 0 && (
              <button
                onClick={handleImportDemo}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Demo-Vorlage importieren
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Transaktion erfassen</span>
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <Coins className="w-10 h-10 text-slate-600 mb-1" />
              <p className="text-sm font-semibold text-slate-300">Noch keine Transaktionen vorhanden</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Füge deine erste Bitcoin-Transaktion hinzu, um dein persönliches Depot zu verwalten und von der KI analysieren zu lassen.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Typ</th>
                  <th className="py-3 px-3">Datum</th>
                  <th className="py-3 px-3">Menge BTC</th>
                  <th className="py-3 px-3">Kaufkurs ($)</th>
                  <th className="py-3 px-3">Gesamtbetrag</th>
                  <th className="py-3 px-3">Notiz</th>
                  <th className="py-3 px-3 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {transactions.map((tx) => {
                  const totalCost = tx.amountBtc * tx.pricePerBtcUsd;
                  const curVal = tx.amountBtc * currentPrice;
                  const gain = curVal - totalCost;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          tx.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {tx.type === 'BUY' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {tx.type === 'BUY' ? 'KAUF' : 'VERKAUF'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans">{tx.date}</td>
                      <td className="py-3 px-3 text-slate-100 font-semibold">{tx.amountBtc.toFixed(4)} BTC</td>
                      <td className="py-3 px-3 text-slate-300">${tx.pricePerBtcUsd.toLocaleString()}</td>
                      <td className="py-3 px-3 text-slate-200">
                        ${totalCost.toLocaleString()}
                        {tx.type === 'BUY' && (
                          <span className={`block text-[10px] ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {gain >= 0 ? '+' : ''}${gain.toFixed(0)} ({(((curVal - totalCost) / totalCost) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-sans text-[11px]">{tx.note || '—'}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeleteTx(tx.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Personal AI Portfolio Analysis Modal */}
      {showAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
                  <BrainCircuit className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    Persönliche KI-Portfolioanalyse
                  </h3>
                  <p className="text-xs text-slate-400">
                    Individuelle Audit-Auswertung deiner {safeTotalBtc} BTC
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAnalysisModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {isAnalyzing ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
                <p className="text-sm font-semibold text-slate-200">
                  Analysiere DCA-Effizienz, Zyklus-Timing & Risikobasis...
                </p>
                <p className="text-xs text-slate-500 max-w-md">
                  Gemini berechnet die Korrelation deiner Kaufpreise mit dem Allzeithoch und den Halving-Phasen.
                </p>
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-5 text-xs">
                {/* Score & Risk Badge Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold font-mono text-cyan-400">
                        {aiAnalysis.portfolioScore}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">/ 100</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                        Portfolio-Gesundheits-Score
                      </span>
                      <span className="text-sm font-bold text-slate-100">
                        {aiAnalysis.riskLevel}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">DCA-Durchschnitt</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      ${Math.round(avgBuyPrice).toLocaleString()} USD
                    </span>
                  </div>
                </div>

                {/* Headline & Summary */}
                <div className="space-y-2">
                  <h4 className="text-base font-bold text-slate-100">
                    {aiAnalysis.headline}
                  </h4>
                  <p className="text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                    {aiAnalysis.summary}
                  </p>
                </div>

                {/* DCA Evaluation */}
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Bewertung der Einstiegszeitpunkte & DCA-Disziplin:
                  </span>
                  <p className="text-slate-300 leading-relaxed">{aiAnalysis.dcaEvaluation}</p>
                </div>

                {/* Actionable Recommendations */}
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Konkrete Handlungsschritte für dein Depot:
                  </span>
                  <ul className="space-y-1.5 pl-1">
                    {aiAnalysis.actionSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-200">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tax Guidance (§23 EStG) */}
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Steuerlicher Status & Haltefrist:
                  </span>
                  <p className="text-slate-300 leading-relaxed">{aiAnalysis.taxGuidance}</p>
                </div>

                {/* Bull vs Bear Case Projection for User's Holdings */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-1">
                      Bull-Case Wert ($140k BTC)
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-300">
                      ${Math.round(aiAnalysis.bullCaseValueUsd).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30">
                    <span className="text-[10px] text-rose-400 font-bold uppercase block mb-1">
                      Bear-Case Puffer ($80k BTC)
                    </span>
                    <span className="text-base font-bold font-mono text-rose-300">
                      ${Math.round(aiAnalysis.bearCaseValueUsd).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setShowAnalysisModal(false)}
                    className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                  >
                    Verstanden & Schließen
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h4 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              Bitcoin Transaktion erfassen
            </h4>

            <form onSubmit={handleAddTransaction} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Art</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTx({ ...newTx, type: 'BUY' })}
                    className={`py-2 rounded-lg font-bold transition ${
                      newTx.type === 'BUY'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Kauf (Buy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTx({ ...newTx, type: 'SELL' })}
                    className={`py-2 rounded-lg font-bold transition ${
                      newTx.type === 'SELL'
                        ? 'bg-rose-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Verkauf (Sell)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Menge (BTC)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="z.B. 0.05"
                  value={newTx.amountBtc}
                  onChange={(e) => setNewTx({ ...newTx, amountBtc: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Kurs pro BTC ($ USD)</label>
                <input
                  type="number"
                  step="100"
                  required
                  value={newTx.pricePerBtcUsd}
                  onChange={(e) => setNewTx({ ...newTx, pricePerBtcUsd: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Datum</label>
                <input
                  type="date"
                  required
                  value={newTx.date}
                  onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Notiz / Wallet / Börse (optional)</label>
                <input
                  type="text"
                  placeholder="z.B. Coldcard / Bitbox / Sparplan"
                  value={newTx.note}
                  onChange={(e) => setNewTx({ ...newTx, note: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
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
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
