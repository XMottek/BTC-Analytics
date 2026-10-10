import React, { useState, useRef, useEffect } from 'react';
import { PortfolioTransaction } from '../types';
import { 
  analyzeCsvRaw,
  parseBitcoinCsvWithMapping,
  RawCsvInfo,
  ColumnMapping,
  CsvParseResult, 
  ParsedCsvRow, 
  formatGermanDate 
} from '../utils/csvParser';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  X,
  FileCheck2,
  Sparkles,
  Calendar,
  RefreshCw,
  SlidersHorizontal,
  Coins,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransactions: PortfolioTransaction[];
  onImportConfirmed: (
    transactions: PortfolioTransaction[],
    mode: 'update_dates' | 'add_new' | 'replace_all'
  ) => Promise<void>;
  eurToUsdRate?: number;
}

const SAMPLE_BITVAVO_CSV = `Date,Time,Market,Side,Price,Amount,Total,Fee,Fee Currency
2023-11-12,10:14:22,BTC-EUR,buy,34500.00,0.15000000,5175.00,7.76,EUR
2024-01-20,16:45:10,BTC-EUR,buy,38900.50,0.10000000,3890.05,5.84,EUR
2024-03-05,09:12:00,BTC-EUR,buy,57800.00,0.08000000,4624.00,6.94,EUR
2024-06-18,14:30:15,BTC-EUR,buy,61200.00,0.05000000,3060.00,4.59,EUR
2024-08-05,18:20:44,BTC-EUR,buy,49500.00,0.12000000,5940.00,8.91,EUR
2024-10-15,11:05:01,BTC-EUR,sell,62800.00,0.04000000,2512.00,3.77,EUR`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  existingTransactions,
  onImportConfirmed,
  eurToUsdRate = 1.08,
}) => {
  const [tab, setTab] = useState<'upload' | 'paste'>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  
  // Column mapping states
  const [rawInfo, setRawInfo] = useState<RawCsvInfo | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [showMappingDetails, setShowMappingDetails] = useState(true);

  // Parse result & modes
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importMode, setImportMode] = useState<'update_dates' | 'add_new' | 'replace_all'>('replace_all');
  const [hideDuplicatesInPreview, setHideDuplicatesInPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleProcessCsv = (text: string, sourceName: string) => {
    setFileName(sourceName);
    setCsvText(text);

    const info = analyzeCsvRaw(text);
    setRawInfo(info);
    setMapping(info.suggestedMapping);

    const result = parseBitcoinCsvWithMapping(text, info.suggestedMapping, existingTransactions, eurToUsdRate);
    setParseResult(result);

    // If existing transactions look suspicious (> 5 BTC or matches), suggest replace_all to cleanly fix the 24 BTC problem
    const totalExistingBtc = existingTransactions.reduce((acc, t) => acc + (t.type === 'BUY' ? t.amountBtc : -t.amountBtc), 0);
    if (totalExistingBtc > 5 || result.dateMismatchCount > 0) {
      setImportMode('replace_all');
    } else if (result.matchedCount > 0) {
      setImportMode('update_dates');
    } else {
      setImportMode('add_new');
    }
  };

  const handleUpdateMapping = (updates: Partial<ColumnMapping>) => {
    if (!mapping || !rawInfo) return;
    const newMapping: ColumnMapping = { ...mapping, ...updates };
    setMapping(newMapping);
    const result = parseBitcoinCsvWithMapping(csvText, newMapping, existingTransactions, eurToUsdRate);
    setParseResult(result);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessCsv(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessCsv(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    handleProcessCsv(SAMPLE_BITVAVO_CSV, 'bitvavo_trades_sample.csv');
  };

  const handleExecuteImport = async () => {
    if (!parseResult) return;

    // Filter rows based on selected mode
    let targetRows: ParsedCsvRow[] = [];
    if (importMode === 'update_dates' || importMode === 'replace_all') {
      targetRows = parseResult.rows;
    } else {
      // add_new
      targetRows = parseResult.rows.filter((r) => !r.isDuplicate && !r.matchedExistingTxId);
    }

    if (targetRows.length === 0) {
      setErrorMessage('Keine Transaktionen zum Importieren ausgewählt.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      // Map to PortfolioTransaction
      const transactionsToSubmit: PortfolioTransaction[] = targetRows.map((row, idx) => ({
        id: row.matchedExistingTxId && importMode === 'update_dates'
          ? row.matchedExistingTxId
          : 'tx-imp-' + Date.now() + '-' + idx + Math.random().toString(36).substring(2, 6),
        type: row.type,
        amountBtc: row.amountBtc,
        pricePerBtcUsd: row.pricePerBtcUsd,
        feeUsd: row.feeUsd,
        date: row.date,
        time: row.time,
        timestamp: row.timestamp,
        note: row.note + ` (Kurs: ${row.currency === 'EUR' ? '€' : '$'}${Math.round(row.pricePerBtcOriginal).toLocaleString()})`,
      }));

      await onImportConfirmed(transactionsToSubmit, importMode);

      let msg = '';
      if (importMode === 'update_dates') {
        msg = `Erfolgreich Kaufdaten für ${transactionsToSubmit.length} Transaktionen aktualisiert & synchronisiert!`;
      } else if (importMode === 'replace_all') {
        msg = `Erfolgreich alle Bestände durch ${transactionsToSubmit.length} Transaktionen (${parseResult.totalBtcSum.toFixed(4)} BTC) ersetzt!`;
      } else {
        msg = `Erfolgreich ${transactionsToSubmit.length} neue Transaktionen hinzugefügt!`;
      }

      setImportSuccessMessage(msg);

      setTimeout(() => {
        setIsSubmitting(false);
        setImportSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Import execution error:', err);
      setErrorMessage('Fehler beim Importieren: ' + (err?.message || 'Unbekannter Fehler'));
      setIsSubmitting(false);
    }
  };

  const displayedRows = parseResult
    ? hideDuplicatesInPreview
      ? parseResult.rows.filter((r) => !r.isDuplicate)
      : parseResult.rows
    : [];

  const canSubmit = parseResult
    ? importMode === 'replace_all' || importMode === 'update_dates'
      ? parseResult.rows.length > 0
      : parseResult.newCount > 0
    : false;

  // Helper to get sample preview values for a column header
  const getColPreview = (headerName: string | undefined): string => {
    if (!rawInfo || !headerName || headerName.startsWith('__')) return '';
    const col = rawInfo.columnPreviews.find((p) => p.header.toLowerCase() === headerName.toLowerCase());
    if (!col || col.sampleValues.length === 0) return '';
    return col.sampleValues.slice(0, 3).join(' | ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Bitcoin CSV- & Excel-Import</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Manuelle Spaltenprüfung
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Prüfe und weise die Spalten für BTC-Menge, Kaufdatum und Kurs vor dem Importieren exakt zu.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {importSuccessMessage && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-3 text-emerald-300 text-xs animate-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{importSuccessMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 flex items-center gap-3 text-rose-300 text-xs animate-in zoom-in-95">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* File Upload / Paste Controls */}
          {!parseResult ? (
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 w-fit">
                <button
                  onClick={() => setTab('upload')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    tab === 'upload' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  CSV-Datei hochladen
                </button>
                <button
                  onClick={() => setTab('paste')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    tab === 'paste' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  CSV-Text einfügen
                </button>
              </div>

              {tab === 'upload' ? (
                /* Drag & Drop Zone */
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/50 hover:bg-slate-950/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-400 flex items-center justify-center mb-3 transition">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Klicke hier oder ziehe deine Excel/Bitvavo-CSV hierher
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Anschließend kannst du jede Spalte manuell prüfen und die berechnete Summe einsehen.
                  </p>
                </div>
              ) : (
                /* Paste Text Area */
                <div className="space-y-2">
                  <label className="block text-slate-400 font-medium">
                    CSV-Inhalt einfügen:
                  </label>
                  <textarea
                    rows={7}
                    placeholder="Datum;Menge BTC;Kurs;Gesamt..."
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => handleProcessCsv(csvText, 'Eingefügter CSV-Text')}
                    disabled={!csvText.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition disabled:opacity-40 cursor-pointer"
                  >
                    CSV analysieren & Spalten prüfen
                  </button>
                </div>
              )}

              {/* Sample loader */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Muster-Bitvavo CSV mit getrennten Spalten für Datum und Zeit testen:
                </span>
                <button
                  onClick={handleLoadSample}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold transition cursor-pointer"
                >
                  Muster-CSV laden
                </button>
              </div>

              {/* Guarantees Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-400 pt-1">
                <div className="flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                  <Coins className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-200 font-semibold block">Präzise BTC-Mengen</span>
                    Wähle die exakte Spalte mit deinen Bitcoin-Kaufmengen (z. B. 0.01306 BTC) ohne Zählfehler.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-200 font-semibold block">Historisches Kaufdatum</span>
                    Die App übernimmt das historische Kaufdatum aus deiner Tabelle im deutschen Format (TT.MM.JJJJ).
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Parse Result, Column Mapping & Preview Area */
            <div className="space-y-4">
              {/* Parse Summary & Switch File Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{fileName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {parseResult.detectedFormat}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/70 text-slate-400">
                      Trennzeichen: <code className="text-amber-400 font-mono font-bold">{rawInfo?.delimiter === '\t' ? 'Tab' : rawInfo?.delimiter}</code>
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                    <span className="text-slate-200 font-semibold">
                      {parseResult.totalRows} Zeilen erkannt
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setParseResult(null);
                      setRawInfo(null);
                      setMapping(null);
                      setCsvText('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                  >
                    Andere Datei wählen
                  </button>
                </div>
              </div>

              {/* REAL-TIME CALCULATED TOTALS BANNER (Directly solves the 24 BTC vs 0.3136 BTC issue) */}
              <div className={`p-4 rounded-2xl border transition-all ${
                parseResult.totalBtcSum > 20
                  ? 'bg-amber-950/30 border-amber-500/50'
                  : 'bg-emerald-950/30 border-emerald-500/40'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Live-Berechnung aus den gewählten Spalten
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
                        {parseResult.totalBtcSum.toFixed(4)} BTC
                      </span>
                      <span className="text-xs text-slate-400">
                        aus {parseResult.totalRows} Transaktionen
                      </span>
                    </div>
                  </div>

                  {parseResult.totalBtcSum > 20 ? (
                    <div className="flex items-start gap-2 bg-amber-500/15 border border-amber-500/30 p-2.5 rounded-xl max-w-md text-amber-300 text-[11px]">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Achtung: Ungewöhnlich hoher Bestand ({parseResult.totalBtcSum.toFixed(2)} BTC)!</strong>
                        Prüfe unten die Spalte <span className="underline font-bold">„Menge / BTC-Betrag“</span>. Oft wurde versehentlich eine Spalte wie „Anzahl“ (Wert 1) gewählt statt der echten BTC-Teilbeträge.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 rounded-xl text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Plausibler Bitcoin-Bestand ({parseResult.totalBtcSum.toFixed(4)} BTC)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* INTERACTIVE COLUMN MAPPING SECTION (Answers user requirement) */}
              {rawInfo && mapping && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-slate-200">
                        Manuelle Spaltenprüfung & Zuordnung
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        (Prüfe hier die Zuordnung deiner Excel-Spalten)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMappingDetails(!showMappingDetails)}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showMappingDetails ? 'Details einklappen' : 'Spalten bearbeiten'}</span>
                      {showMappingDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {showMappingDetails && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* 1. BTC Amount (HIGHLIGHTED & CRITICAL) */}
                        <div className="p-3 rounded-xl bg-slate-900/90 border-2 border-amber-500/60 space-y-1.5 shadow-md">
                          <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Coins className="w-3.5 h-3.5 text-amber-400" />
                              Menge / BTC-Betrag *
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                              WICHTIG
                            </span>
                          </label>
                          <select
                            value={mapping.colAmount}
                            onChange={(e) => handleUpdateMapping({ colAmount: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-amber-400"
                          >
                            <option value="">-- Spalte auswählen --</option>
                            {rawInfo.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          {/* Live Cell Value Preview */}
                          {mapping.colAmount && (
                            <div className="text-[10px] text-slate-400 pt-0.5 flex flex-col">
                              <span className="text-slate-500">Zellvorschau:</span>
                              <span className="font-mono text-amber-300/90 truncate font-semibold bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                                {getColPreview(mapping.colAmount) || 'Keine Werte'}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 leading-tight">
                            Wähle die Spalte mit den Bruchteilen (z. B. 0.01306) – nicht „Anzahl“.
                          </p>
                        </div>

                        {/* 2. Purchase Date */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            Kaufdatum *
                          </label>
                          <select
                            value={mapping.colDate}
                            onChange={(e) => handleUpdateMapping({ colDate: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-400"
                          >
                            <option value="">-- Spalte auswählen --</option>
                            {rawInfo.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          {mapping.colDate && (
                            <div className="text-[10px] text-slate-400 pt-0.5 flex flex-col">
                              <span className="text-slate-500">Zellvorschau:</span>
                              <span className="font-mono text-cyan-300 truncate bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                                {getColPreview(mapping.colDate) || 'Keine Werte'}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 leading-tight">
                            Datum des Kaufs (z. B. TT.MM.JJJJ oder JJJJ-MM-TT).
                          </p>
                        </div>

                        {/* 3. Time (optional) */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Uhrzeit (optional)
                          </label>
                          <select
                            value={mapping.colTime}
                            onChange={(e) => handleUpdateMapping({ colTime: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-400"
                          >
                            <option value="__none__">[Keine separate Uhrzeit-Spalte]</option>
                            {rawInfo.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          {mapping.colTime && mapping.colTime !== '__none__' && (
                            <div className="text-[10px] text-slate-400 pt-0.5 flex flex-col">
                              <span className="text-slate-500">Zellvorschau:</span>
                              <span className="font-mono text-slate-300 truncate bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                                {getColPreview(mapping.colTime)}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 leading-tight">
                            Falls Uhrzeit separat vorliegt (z. B. 14:30:00).
                          </p>
                        </div>

                        {/* 4. Price / Kurs */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <label className="text-xs font-bold text-slate-200">
                            Kaufkurs / Preis pro BTC
                          </label>
                          <select
                            value={mapping.colPrice}
                            onChange={(e) => handleUpdateMapping({ colPrice: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-400"
                          >
                            <option value="">[Aus Gesamtbetrag berechnen]</option>
                            {rawInfo.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          {mapping.colPrice && (
                            <div className="text-[10px] text-slate-400 pt-0.5 flex flex-col">
                              <span className="text-slate-500">Zellvorschau:</span>
                              <span className="font-mono text-slate-300 truncate bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                                {getColPreview(mapping.colPrice)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 5. Total Cost / Gesamtbetrag */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <label className="text-xs font-bold text-slate-200">
                            Gesamtbetrag (EUR/USD)
                          </label>
                          <select
                            value={mapping.colTotal}
                            onChange={(e) => handleUpdateMapping({ colTotal: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-400"
                          >
                            <option value="">[Aus Menge × Kurs berechnen]</option>
                            {rawInfo.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          {mapping.colTotal && (
                            <div className="text-[10px] text-slate-400 pt-0.5 flex flex-col">
                              <span className="text-slate-500">Zellvorschau:</span>
                              <span className="font-mono text-slate-300 truncate bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                                {getColPreview(mapping.colTotal)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 6. Type / Transaktionsart */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <label className="text-xs font-bold text-slate-200">
                            Transaktionstyp
                          </label>
                          <select
                            value={mapping.colType}
                            onChange={(e) => handleUpdateMapping({ colType: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-400"
                          >
                            <option value="__fixed_buy__">Alle als Kauf (BUY) festlegen</option>
                            <option value="__fixed_sell__">Alle als Verkauf (SELL) festlegen</option>
                            {rawInfo.headers.map((h) => (
                              <option key={h} value={h}>
                                Aus Spalte „{h}“ ermitteln
                              </option>
                            ))}
                          </select>
                          {mapping.colType && !mapping.colType.startsWith('__') && (
                            <div className="text-[10px] text-slate-400 pt-0.5 flex flex-col">
                              <span className="text-slate-500">Zellvorschau:</span>
                              <span className="font-mono text-slate-300 truncate bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                                {getColPreview(mapping.colType)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode Selection Options */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Wie sollen die Daten in dein Portfolio übernommen werden?</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('replace_all')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      importMode === 'replace_all'
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 ring-1 ring-amber-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-100 flex items-center justify-between">
                      <span>Komplett ersetzen</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        Empfohlen
                      </span>
                    </span>
                    <span className="block text-[10px] mt-1 text-slate-400">
                      Ersetzt bisherige Transaktionen komplett durch diese korrigierten {parseResult.rows.length} Einträge ({parseResult.totalBtcSum.toFixed(4)} BTC).
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('update_dates')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      importMode === 'update_dates'
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-100 flex items-center justify-between">
                      <span>Kaufdaten überschreiben</span>
                      {importMode === 'update_dates' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                    </span>
                    <span className="block text-[10px] mt-1 text-slate-400">
                      Aktualisiert vorhandene Einträge mit dem Kaufdatum und fügt neue hinzu.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('add_new')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      importMode === 'add_new'
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-100 flex items-center justify-between">
                      <span>Nur Neue hinzufügen</span>
                      {importMode === 'add_new' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                    </span>
                    <span className="block text-[10px] mt-1 text-slate-400">
                      Bestehende Bestände behalten und nur neue Zeilen anfügen.
                    </span>
                  </button>
                </div>
              </div>

              {/* Preview Table Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <span>Tabellen-Vorschau der {displayedRows.length} Transaktionen</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Chronologisch sortiert, deutsches Kaufdatum)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setHideDuplicatesInPreview(!hideDuplicatesInPreview)}
                  className="text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  {hideDuplicatesInPreview ? 'Alle anzeigen' : 'Nur Neue anzeigen'}
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Typ</th>
                        <th className="py-2.5 px-3">Kaufdatum</th>
                        <th className="py-2.5 px-3">Menge BTC</th>
                        <th className="py-2.5 px-3">Kurs (Orig.)</th>
                        <th className="py-2.5 px-3">Kurs ($)</th>
                        <th className="py-2.5 px-3">Notiz</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {displayedRows.map((row, i) => (
                        <tr
                          key={i}
                          className={
                            row.hasDateMismatch
                              ? 'bg-amber-500/5 hover:bg-amber-500/10 text-slate-200'
                              : row.isDuplicate
                              ? 'bg-slate-950/40 text-slate-400'
                              : 'hover:bg-slate-800/30 text-slate-200'
                          }
                        >
                          <td className="py-2 px-3 font-sans">
                            {importMode === 'replace_all' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
                                Wird übernommen
                              </span>
                            ) : row.hasDateMismatch ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                                Datum wird aktualisiert
                              </span>
                            ) : row.matchedExistingTxId ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold">
                                Bereits vorhanden
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
                                Neu
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.type === 'BUY'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {row.type === 'BUY' ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                              {row.type === 'BUY' ? 'KAUF' : 'VERKAUF'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-200 font-medium">
                            <div>{row.germanDate}</div>
                            {row.hasDateMismatch && row.existingDate && (
                              <span className="text-[10px] text-amber-400/80 block">
                                (bisher: {formatGermanDate(row.existingDate)})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-100 font-semibold">
                            {row.amountBtc.toFixed(6)} BTC
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {row.currency === 'EUR' ? '€' : '$'}
                            {Math.round(row.pricePerBtcOriginal).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            ${Math.round(row.pricePerBtcUsd).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-400 text-[10px] truncate max-w-[130px]">
                            {row.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-slate-400 text-[11px]">
                  {importMode === 'replace_all'
                    ? `Setzt das gesamte Portfolio auf diese ${parseResult.rows.length} Transaktionen (${parseResult.totalBtcSum.toFixed(4)} BTC).`
                    : importMode === 'update_dates'
                    ? `Aktualisiert Kaufdaten & fügt neue Transaktionen ein (${parseResult.rows.length} Zeilen).`
                    : `${parseResult.newCount} neue Transaktionen zum Hinzufügen bereit.`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                  >
                    Abbrechen
                  </button>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isSubmitting || !canSubmit}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-40"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'Speichere Daten...'
                        : importMode === 'replace_all'
                        ? `Bestand durch ${parseResult.totalBtcSum.toFixed(4)} BTC ersetzen`
                        : importMode === 'update_dates'
                        ? 'Kaufdaten überschreiben & anwenden'
                        : `${parseResult.newCount} neue Zeilen importieren`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
