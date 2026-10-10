import React, { useState, useEffect, useMemo } from 'react';
import { MarketData, PortfolioTransaction, UserPortfolioMetrics, PersonalPortfolioAnalysis } from '../types';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CsvImportModal } from './CsvImportModal';
import { formatGermanDate } from '../utils/csvParser';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
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
  DollarSign,
  LogIn,
  CloudCheck,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  BrainCircuit,
  RefreshCw,
  Clock,
  Upload,
  Zap,
  Check,
  Calendar,
  Pencil,
  AlertTriangle,
  SlidersHorizontal
} from 'lucide-react';

interface PortfolioViewProps {
  marketData: MarketData | null;
  onMetricsChange?: (metrics: UserPortfolioMetrics) => void;
  onPersonalAnalysisChange?: (analysis: PersonalPortfolioAnalysis | null) => void;
}

const DEFAULT_LOCAL_TRANSACTIONS: PortfolioTransaction[] = [
  {
    id: 'tx-1',
    type: 'BUY',
    amountBtc: 0.35,
    pricePerBtcUsd: 59200,
    feeUsd: 12,
    date: '2024-08-15',
    note: 'DCA Nachkauf während Sommer-Korrektur (Demo)',
  },
  {
    id: 'tx-2',
    type: 'BUY',
    amountBtc: 0.25,
    pricePerBtcUsd: 64100,
    feeUsd: 8,
    date: '2024-09-22',
    note: 'Akkumulation vor US-Zinssenkung (Demo)',
  },
  {
    id: 'tx-3',
    type: 'BUY',
    amountBtc: 0.20,
    pricePerBtcUsd: 73500,
    feeUsd: 10,
    date: '2024-11-06',
    note: 'Ausbruch nach US-Wahlen (Demo)',
  },
];

const isDemoTx = (tx: PortfolioTransaction) =>
  tx.id === 'tx-1' || tx.id === 'tx-2' || tx.id === 'tx-3' ||
  (tx.note && (tx.note.includes('Sommer-Korrektur') || tx.note.includes('Ausbruch nach US-Wahlen') || tx.note.includes('(Demo)')));

export const PortfolioView: React.FC<PortfolioViewProps> = ({ 
  marketData,
  onMetricsChange,
  onPersonalAnalysisChange,
}) => {
  const { currentUser, login, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Personal AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<PersonalPortfolioAnalysis | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [editingTx, setEditingTx] = useState<{ id: string; date: string; time: string } | null>(null);
  const [newTx, setNewTx] = useState({
    type: 'BUY' as 'BUY' | 'SELL',
    amountBtc: '',
    pricePerBtcUsd: marketData?.priceUsd?.toString() || '96500',
    feeUsd: '5',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });

  const [targetBtcPrice, setTargetBtcPrice] = useState(130000);

  // Load from Firestore or LocalStorage
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
              time: data.time || undefined,
              timestamp: data.timestamp || new Date(data.date).getTime(),
              note: data.note || '',
            });
          });

          // Sort by timestamp or date descending
          list.sort((a, b) => {
            const tA = a.timestamp || new Date(a.date).getTime();
            const tB = b.timestamp || new Date(b.date).getTime();
            return tB - tA;
          });
          
          // Auto-clean demo transactions if user has real/imported transactions or requested demo purge
          const isCleared = localStorage.getItem('sat_demo_cleared') === 'true';
          const hasRealTxs = list.some((t) => !isDemoTx(t));
          const cleaned = (hasRealTxs || isCleared) ? list.filter((t) => !isDemoTx(t)) : list;
          
          setTransactions(cleaned);
          setIsSyncing(false);

          // Proactively delete any leftover demo documents from Firestore if user has real txs or cleared
          if ((hasRealTxs || isCleared) && list.some(isDemoTx)) {
            list.filter(isDemoTx).forEach(async (dt) => {
              try {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', dt.id));
              } catch (e) {
                // ignore
              }
            });
          }
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
        const isCleared = localStorage.getItem('sat_demo_cleared') === 'true';
        const saved = localStorage.getItem('sat_portfolio_txs');
        if (saved) {
          const parsed: PortfolioTransaction[] = JSON.parse(saved);
          const hasReal = parsed.some((t) => !isDemoTx(t));
          // If user cleared demo data or has real transactions, strictly filter out demo data
          const cleaned = (hasReal || isCleared) ? parsed.filter((t) => !isDemoTx(t)) : parsed;
          setTransactions(cleaned);
        } else if (isCleared) {
          setTransactions([]);
        } else {
          // No previous transactions and not cleared yet -> start with clean empty list to avoid inflating portfolio
          setTransactions([]);
        }
      } catch {
        setTransactions([]);
      }
    }
  }, [currentUser]);

  // Save to local storage when not authenticated
  useEffect(() => {
    if (!currentUser) {
      localStorage.setItem('sat_portfolio_txs', JSON.stringify(transactions));
    }
  }, [currentUser, transactions]);

  const currentPrice = marketData?.priceUsd || 96500;
  const eurRate = 0.925;

  // Demo status detection
  const demoTransactions = transactions.filter(isDemoTx);
  const nonDemoTransactions = transactions.filter((t) => !isDemoTx(t));
  const hasDemoData = demoTransactions.length > 0;

  // Accurate weighted cost basis and PnL calculation (chronological pass)
  const portfolioMetrics: UserPortfolioMetrics = useMemo(() => {
    const chrono = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBtc = 0;
    let runningCostUsd = 0;
    let realizedPnlUsd = 0;

    chrono.forEach((tx) => {
      if (tx.type === 'BUY') {
        runningBtc += tx.amountBtc;
        runningCostUsd += (tx.amountBtc * tx.pricePerBtcUsd) + (tx.feeUsd || 0);
      } else if (tx.type === 'SELL') {
        const avgPriceBeforeSell = runningBtc > 0 ? (runningCostUsd / runningBtc) : tx.pricePerBtcUsd;
        const soldAmount = Math.min(runningBtc, tx.amountBtc);
        const costOfSold = soldAmount * avgPriceBeforeSell;
        const proceeds = (tx.amountBtc * tx.pricePerBtcUsd) - (tx.feeUsd || 0);
        realizedPnlUsd += (proceeds - costOfSold);
        runningCostUsd = Math.max(0, runningCostUsd - costOfSold);
        runningBtc = Math.max(0, runningBtc - tx.amountBtc);
      }
    });

    const safeTotalBtc = runningBtc;
    const totalCostUsd = runningCostUsd;
    const totalCostEur = totalCostUsd * eurRate;
    const avgBuyPrice = safeTotalBtc > 0 ? (totalCostUsd / safeTotalBtc) : 0;
    const avgBuyPriceEur = avgBuyPrice * eurRate;
    const totalValueUsd = safeTotalBtc * currentPrice;
    const totalValueEur = totalValueUsd * eurRate;
    const totalPnlUsd = totalValueUsd - totalCostUsd;
    const totalPnlEur = totalValueEur - totalCostEur;
    const totalPnlPercent = totalCostUsd > 0 ? (totalPnlUsd / totalCostUsd) * 100 : 0;
    const realizedPnlEur = realizedPnlUsd * eurRate;

    return {
      totalBtc: safeTotalBtc,
      totalCostUsd,
      totalCostEur,
      avgBuyPrice,
      avgBuyPriceEur,
      totalValueUsd,
      totalValueEur,
      totalPnlUsd,
      totalPnlEur,
      totalPnlPercent,
      realizedPnlUsd,
      transactionCount: transactions.length,
      hasDemoData,
    };
  }, [transactions, currentPrice, eurRate, hasDemoData]);

  // Sync metrics to parent for MacroForecastView
  useEffect(() => {
    onMetricsChange?.(portfolioMetrics);
  }, [portfolioMetrics, onMetricsChange]);

  const totalSatoshis = Math.round(portfolioMetrics.totalBtc * 100000000);

  // Clear demo transactions so only imported/real transactions remain
  const handleClearDemoTransactions = async () => {
    localStorage.setItem('sat_demo_cleared', 'true');
    const cleaned = transactions.filter((t) => !isDemoTx(t));
    setTransactions(cleaned);
    localStorage.setItem('sat_portfolio_txs', JSON.stringify(cleaned));

    if (currentUser) {
      for (const dt of demoTransactions) {
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', dt.id));
        } catch (e) {
          console.warn('Could not delete demo tx from Firestore:', e);
        }
      }
    }
  };

  // Completely wipe all transactions (e.g. to reset mistaken 24 BTC before re-importing)
  const handleClearAllTransactions = async () => {
    localStorage.setItem('sat_demo_cleared', 'true');
    setTransactions([]);
    localStorage.setItem('sat_portfolio_txs', JSON.stringify([]));

    if (currentUser) {
      for (const t of transactions) {
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', t.id));
        } catch (e) {
          console.warn('Could not delete tx from Firestore:', e);
        }
      }
    }
    setShowClearConfirmModal(false);
  };

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
      // Auto-remove demo data when user enters their first real transaction!
      const base = transactions.some((t) => !isDemoTx(t)) ? transactions : [];
      const updated = [txData, ...base];
      updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(updated);
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
      const updated = transactions.filter((t) => t.id !== id);
      setTransactions(updated);
      localStorage.setItem('sat_portfolio_txs', JSON.stringify(updated));
    }
  };

  // Import CSV Confirmation Handler
  const handleConfirmImport = async (
    submittedTxs: PortfolioTransaction[],
    mode: 'update_dates' | 'add_new' | 'replace_all' = 'update_dates'
  ) => {
    localStorage.setItem('sat_demo_cleared', 'true');
    const baseTransactions = transactions.filter((t) => !isDemoTx(t));

    if (currentUser) {
      // Clean any existing demo docs in Firestore
      for (const dt of demoTransactions) {
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', dt.id));
        } catch (e) {
          // ignore
        }
      }

      if (mode === 'replace_all') {
        for (const oldTx of baseTransactions) {
          try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', oldTx.id));
          } catch (e) {
            // ignore
          }
        }
      }

      for (const tx of submittedTxs) {
        try {
          const docRef = doc(db, 'users', currentUser.uid, 'transactions', tx.id);
          await setDoc(
            docRef,
            {
              id: tx.id,
              userId: currentUser.uid,
              type: tx.type,
              amountBtc: tx.amountBtc,
              pricePerBtcUsd: tx.pricePerBtcUsd,
              feeUsd: tx.feeUsd || 0,
              date: tx.date,
              time: tx.time || null,
              timestamp: tx.timestamp || new Date(tx.date).getTime(),
              note: tx.note || 'CSV Import',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}/transactions/${tx.id}`);
        }
      }

      if (mode === 'replace_all') {
        const sorted = [...submittedTxs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setTransactions(sorted);
        localStorage.setItem('sat_portfolio_txs', JSON.stringify(sorted));
      }
    } else {
      // Local mode
      let merged: PortfolioTransaction[] = [];
      if (mode === 'replace_all') {
        merged = [...submittedTxs];
      } else if (mode === 'update_dates') {
        const updateMap = new Map(submittedTxs.map((t) => [t.id, t]));
        merged = baseTransactions.map((ex) => {
          if (updateMap.has(ex.id)) {
            const up = updateMap.get(ex.id)!;
            updateMap.delete(ex.id);
            return {
              ...ex,
              date: up.date,
              time: up.time,
              timestamp: up.timestamp,
              note: up.note || ex.note,
            };
          }
          return ex;
        });
        updateMap.forEach((newTx) => merged.push(newTx));
      } else {
        merged = [...submittedTxs, ...baseTransactions];
      }

      merged.sort((a, b) => {
        const tA = a.timestamp || new Date(a.date).getTime();
        const tB = b.timestamp || new Date(b.date).getTime();
        return tB - tA;
      });

      setTransactions(merged);
      localStorage.setItem('sat_portfolio_txs', JSON.stringify(merged));
    }

    // Auto-trigger analysis for the newly imported holdings
    setTimeout(() => {
      runPersonalAiAnalysis();
    }, 500);
  };

  // Save manually edited transaction date
  const handleSaveEditedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const { id, date, time } = editingTx;
    const ts = new Date(time ? `${date}T${time}` : date).getTime();
    const finalTs = isNaN(ts) ? Date.now() : ts;

    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'transactions', id);
        await setDoc(
          docRef,
          {
            date,
            time: time || null,
            timestamp: finalTs,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}/transactions/${id}`);
      }
    } else {
      const updated = transactions.map((t) =>
        t.id === id ? { ...t, date, time: time || undefined, timestamp: finalTs } : t
      );
      updated.sort((a, b) => {
        const tA = a.timestamp || new Date(a.date).getTime();
        const tB = b.timestamp || new Date(b.date).getTime();
        return tB - tA;
      });
      setTransactions(updated);
      localStorage.setItem('sat_portfolio_txs', JSON.stringify(updated));
    }

    setEditingTx(null);
  };

  // Request Personal AI Portfolio Analysis
  const runPersonalAiAnalysis = async () => {
    if (portfolioMetrics.totalBtc <= 0) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/user-portfolio-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          totalBtc: portfolioMetrics.totalBtc,
          avgBuyPrice: portfolioMetrics.avgBuyPrice,
          totalCostUsd: portfolioMetrics.totalCostUsd,
          currentPrice,
        }),
      });

      if (!res.ok) {
        throw new Error('Fehler bei der Analyseanfrage');
      }

      const data: PersonalPortfolioAnalysis = await res.json();
      data.updatedAt = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      setAiAnalysis(data);
      onPersonalAnalysisChange?.(data);

      // Persist in Firestore if logged in
      if (currentUser) {
        try {
          const auditRef = doc(db, 'users', currentUser.uid, 'analyses', 'latest');
          await setDoc(auditRef, {
            userId: currentUser.uid,
            totalBtc: portfolioMetrics.totalBtc,
            avgBuyPrice: portfolioMetrics.avgBuyPrice,
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

  // Auto-run analysis when transactions are loaded and no analysis is present
  useEffect(() => {
    if (!aiAnalysis && portfolioMetrics.totalBtc > 0 && !isAnalyzing) {
      runPersonalAiAnalysis();
    }
  }, [portfolioMetrics.totalBtc]);

  return (
    <div className="space-y-6">
      {/* Demo Cleanup Notification Bar if demo data is detected */}
      {hasDemoData && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-100">
                Demo-Daten entdeckt (0.80 BTC aus früheren Beispieldaten).
              </span>
              <p className="text-slate-400 mt-0.5 text-[11px]">
                {nonDemoTransactions.length > 0 
                  ? `Entferne die Demo-Daten, damit ausschließlich deine ${nonDemoTransactions.length} importierten Transaktionen gezählt werden.` 
                  : 'Entferne die Demo-Daten, um mit einem leeren Portfolio für deine eigenen Transaktionen zu starten.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearDemoTransactions}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow"
          >
            Demo-Daten jetzt entfernen
          </button>
        </div>
      )}

      {/* Cloud Status Banner */}
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
              onClick={() => runPersonalAiAnalysis()}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Berechne...' : 'KI-Analyse aktualisieren'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200">
                Lokaler Modus: Deine Transaktionen werden sicher im Browser gespeichert.
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Für geräteübergreifenden Zugriff kannst du dich jederzeit mit Google verbinden.
              </p>
            </div>
          </div>

          <button
            onClick={() => login()}
            disabled={authLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-amber-400" />
            <span>Mit Google anmelden</span>
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Market Value */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-amber-400" />
              Aktueller Depot-Marktwert
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
              Live-Kurs
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            ${portfolioMetrics.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            ≈ €{portfolioMetrics.totalValueEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-800/80">
            {portfolioMetrics.totalBtc.toFixed(4)} BTC × ${Math.round(currentPrice).toLocaleString()}
          </div>
        </div>

        {/* Card 2: Invested Capital / Purchase Costs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              Investiertes Kapital (Kaufkosten)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
              Anschaffung
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            €{portfolioMetrics.totalCostEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            ≈ ${portfolioMetrics.totalCostUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-800/80">
            Tatsächlich aufgewendete Kaufsumme
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
              portfolioMetrics.totalPnlUsd >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
            }`}>
              {portfolioMetrics.totalPnlPercent >= 0 ? '+' : ''}{portfolioMetrics.totalPnlPercent.toFixed(2)}%
            </span>
          </div>
          <div className={`text-2xl font-bold font-mono ${portfolioMetrics.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {portfolioMetrics.totalPnlUsd >= 0 ? '+' : ''}${portfolioMetrics.totalPnlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            ≈ {portfolioMetrics.totalPnlEur >= 0 ? '+' : ''}€{portfolioMetrics.totalPnlEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-800/80">
            Marktwert minus Kaufkosten
          </div>
        </div>

        {/* Card 4: Bitcoin Holdings & Avg Buy Price */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              Bestand & Ø-Kaufkurs
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {portfolioMetrics.transactionCount} Buchungen
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {portfolioMetrics.totalBtc.toFixed(4)} <span className="text-sm font-semibold text-amber-400">BTC</span>
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            Ø ${Math.round(portfolioMetrics.avgBuyPrice).toLocaleString()} (≈ €{Math.round(portfolioMetrics.avgBuyPriceEur).toLocaleString()})
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-800/80">
            {totalSatoshis.toLocaleString()} Satoshis
          </div>
        </div>
      </div>

      {/* PERMANENT INTEGRATED PERSONAL AI PORTFOLIO ANALYSIS SECTION */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  KI-Analyse deiner aktuellen Bitcoin-Bestände
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                  Live-Berechnung
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Maßgeschneiderte Audit-Auswertung deiner {portfolioMetrics.totalBtc.toFixed(4)} BTC (Kaufkurs: ${Math.round(portfolioMetrics.avgBuyPrice).toLocaleString()})
              </p>
            </div>
          </div>

          <button
            onClick={() => runPersonalAiAnalysis()}
            disabled={isAnalyzing || portfolioMetrics.totalBtc <= 0}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Berechne...' : 'Neu analysieren'}</span>
          </button>
        </div>

        {isAnalyzing && !aiAnalysis ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-200">
              Analysiere deine tatsächlichen Bestände, DCA-Tranchen & Rendite...
            </p>
          </div>
        ) : aiAnalysis ? (
          <div className="space-y-4 text-xs">
            {/* Score & Risk Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold font-mono text-cyan-400">
                    {aiAnalysis.portfolioScore}
                  </span>
                  <span className="text-[8px] text-slate-400">/ 100</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    Depot-Score
                  </span>
                  <span className="text-xs font-bold text-slate-100">
                    {aiAnalysis.riskLevel}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center sm:border-x sm:border-slate-800/80 sm:px-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Aktuelle Rendite (Unrealisiert)
                </span>
                <span className={`text-sm font-bold font-mono ${portfolioMetrics.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {portfolioMetrics.totalPnlPercent >= 0 ? '+' : ''}{portfolioMetrics.totalPnlPercent.toFixed(1)}% (${Math.round(portfolioMetrics.totalPnlUsd).toLocaleString()})
                </span>
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Haltefristen-Status
                </span>
                <span className="text-xs font-semibold text-purple-300">
                  {aiAnalysis.taxGuidance.split('.')[0] || '1-Jahres-Frist beachten'}
                </span>
              </div>
            </div>

            {/* Headline & Summary */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <h4 className="text-sm font-bold text-slate-100">
                {aiAnalysis.headline}
              </h4>
              <p className="text-slate-300 leading-relaxed text-xs">
                {aiAnalysis.summary}
              </p>
            </div>

            {/* DCA & Action Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  Einstiegs- & DCA-Qualität
                </span>
                <p className="text-slate-300 leading-relaxed text-xs">
                  {aiAnalysis.dcaEvaluation}
                </p>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Empfohlene nächste Schritte
                </span>
                <ul className="space-y-1 text-slate-300 text-xs">
                  {aiAnalysis.actionSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Scenario Impact on user's exact holdings */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-1">
                  Wert deiner Bestände im Bull-Case ($140.000 BTC)
                </span>
                <span className="text-base font-bold font-mono text-emerald-300">
                  ${Math.round(portfolioMetrics.totalBtc * 140000).toLocaleString()} USD
                </span>
                <span className="text-[10px] text-emerald-500 block mt-0.5 font-mono">
                  +${Math.round((portfolioMetrics.totalBtc * 140000) - portfolioMetrics.totalCostUsd).toLocaleString()} Gewinn
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30">
                <span className="text-[10px] text-rose-400 font-bold uppercase block mb-1">
                  Puffer deiner Bestände im Bear-Case ($80.000 BTC)
                </span>
                <span className="text-base font-bold font-mono text-rose-300">
                  ${Math.round(portfolioMetrics.totalBtc * 80000).toLocaleString()} USD
                </span>
                <span className="text-[10px] text-rose-400/80 block mt-0.5 font-mono">
                  {((80000 - portfolioMetrics.avgBuyPrice) / (portfolioMetrics.avgBuyPrice || 1) * 100).toFixed(1)}% vs. dein Einstand
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
            <Coins className="w-8 h-8 text-slate-600 mb-2" />
            <span>Klicke auf „Jetzt analysieren“, um eine detaillierte KI-Bewertung deiner Bestände zu generieren.</span>
          </div>
        )}
      </div>

      {/* Interactive Target Scenario & Return Simulator */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              Depotwert-Simulator für deine {portfolioMetrics.totalBtc.toFixed(4)} BTC
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Simuliere den genauen Gesamtwert deiner realen Bestände bei verschiedenen Bitcoin-Preiszielen
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
              ${(portfolioMetrics.totalBtc * targetBtcPrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              ≈ €{(portfolioMetrics.totalBtc * targetBtcPrice * eurRate).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium">Zusätzlicher Gewinn zum heutigen Kurs</span>
            <span className="text-xl font-bold font-mono text-cyan-400">
              +${(portfolioMetrics.totalBtc * (targetBtcPrice - currentPrice)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              +{(((targetBtcPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% Kursanstieg
            </span>
          </div>
        </div>
      </div>

      {/* Transactions History & Manager */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        {/* Transactions Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Meine Bitcoin-Transaktionen ({transactions.length})</span>
              {hasDemoData ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Enthält Demo-Daten
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Echte Bestände
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Transaktionen werden chronologisch nach Datum/Uhrzeit sortiert und exakt bilanziert
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasDemoData && (
              <button
                onClick={handleClearDemoTransactions}
                className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                title="Demo-Transaktionen entfernen"
              >
                Demo-Daten entfernen
              </button>
            )}

            {transactions.length > 0 && !hasDemoData && (
              <button
                onClick={() => setShowClearConfirmModal(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                title="Alle Transaktionen löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Leeren</span>
              </button>
            )}

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-500/40 text-xs font-semibold transition cursor-pointer"
              title="Transaktionen aus CSV importieren mit Spaltenprüfung"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>CSV-Import</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Transaktion erfassen</span>
            </button>
          </div>
        </div>

        {/* Warning & Guidance Banner if BTC holding is unexpectedly high (e.g. 24 BTC instead of 0.3136 BTC) */}
        {portfolioMetrics.totalBtc > 5 && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-semibold block text-sm">
                  Aktueller Bestand: {portfolioMetrics.totalBtc.toFixed(4)} BTC (zu hoch berechnet?)
                </strong>
                <p className="text-slate-300 mt-0.5 text-[11px] leading-relaxed">
                  Falls dein tatsächlicher Gesamtbestand bei <strong>0.3136 BTC</strong> liegt (und nicht bei ~24 BTC), wurde beim früheren Import eine Spalte wie „Anzahl“ mit Wert 1 als BTC-Menge gewertet. Öffne den CSV-Import, um über die neue <strong>manuelle Spaltenprüfung</strong> deine Mengenspalte zu prüfen und den Bestand mit <strong>„Komplett ersetzen“</strong> auf deine echten 0.3136 BTC zu korrigieren.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition cursor-pointer shadow-lg shadow-amber-500/20"
            >
              Spalten prüfen & korrigieren
            </button>
          </div>
        )}

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <Coins className="w-10 h-10 text-slate-600 mb-1" />
              <p className="text-sm font-semibold text-slate-300">Noch keine Transaktionen vorhanden</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Importiere deine Bitvavo CSV-Datei oder trage deine ersten Käufe ein, um dein persönliches Depot zu analysieren.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Typ</th>
                  <th className="py-3 px-3">Kaufdatum</th>
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
                      <td className="py-3 px-3 text-slate-200 font-sans whitespace-nowrap">
                        <div className="font-medium text-slate-100">{formatGermanDate(tx.date, tx.time)}</div>
                        {tx.time && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                            <span>{tx.time.substring(0, 5)} Uhr</span>
                          </div>
                        )}
                      </td>
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingTx({ id: tx.id, date: tx.date, time: tx.time || '' })}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-amber-500/10 transition cursor-pointer"
                            title="Kaufdatum anpassen"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

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

      {/* Edit Date Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>Kaufdatum anpassen</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Passe das Kaufdatum und optional die Uhrzeit an. Die Chronologie und Steuerfristen werden automatisch neu berechnet.
            </p>

            <form onSubmit={handleSaveEditedDate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Kaufdatum</label>
                <input
                  type="date"
                  required
                  value={editingTx.date}
                  onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Uhrzeit (optional)</label>
                <input
                  type="time"
                  step="1"
                  value={editingTx.time}
                  onChange={(e) => setEditingTx({ ...editingTx, time: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold cursor-pointer"
                >
                  Datum speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-100">Transaktionen leeren?</h4>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Möchtest du wirklich alle <strong>{transactions.length} Transaktionen</strong> aus deinem Portfolio entfernen? 
              Dies setzt den Bestand auf 0 zurück, damit du anschließend deine CSV-Datei mit der richtigen Mengenspalte sauber neu importieren kannst.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleClearAllTransactions}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Ja, alle löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal (Bitvavo & Exchanges) */}
      <CsvImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        existingTransactions={transactions}
        onImportConfirmed={handleConfirmImport}
        eurToUsdRate={1 / eurRate}
      />
    </div>
  );
};
