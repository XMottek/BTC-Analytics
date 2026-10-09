import React, { useState, useRef } from 'react';
import { PortfolioTransaction } from '../types';
import { parseBitcoinCsv, CsvParseResult, ParsedCsvRow } from '../utils/csvParser';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShieldCheck, 
  Clock, 
  X,
  FileCheck2,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransactions: PortfolioTransaction[];
  onImportConfirmed: (newTransactions: PortfolioTransaction[]) => Promise<void>;
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
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [hideDuplicatesInPreview, setHideDuplicatesInPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleParse = (text: string, sourceName: string) => {
    setFileName(sourceName);
    const result = parseBitcoinCsv(text, existingTransactions, eurToUsdRate);
    setParseResult(result);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      handleParse(text, file.name);
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
      setCsvText(text);
      handleParse(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setCsvText(SAMPLE_BITVAVO_CSV);
    handleParse(SAMPLE_BITVAVO_CSV, 'bitvavo_trades_sample.csv');
  };

  const handleExecuteImport = async () => {
    if (!parseResult) return;

    // Filter only new non-duplicate rows
    const nonDuplicates = parseResult.rows.filter((r) => !r.isDuplicate);
    if (nonDuplicates.length === 0) {
      alert('Alle Transaktionen in dieser Datei sind bereits in deinem Portfolio vorhanden.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Map to PortfolioTransaction
      const newTransactions: PortfolioTransaction[] = nonDuplicates.map((row, idx) => ({
        id: 'tx-imp-' + Date.now() + '-' + idx + Math.random().toString(36).substring(2, 6),
        type: row.type,
        amountBtc: row.amountBtc,
        pricePerBtcUsd: row.pricePerBtcUsd,
        feeUsd: row.feeUsd,
        date: row.date,
        note: row.note + ` (Kurs: ${row.currency === 'EUR' ? '€' : '$'}${Math.round(row.pricePerBtcOriginal).toLocaleString()})`,
      }));

      await onImportConfirmed(newTransactions);

      setImportSuccessMessage(
        `Erfolgreich ${newTransactions.length} neue Bitcoin-Transaktionen importiert (${parseResult.duplicateCount} Duplikate übersprungen)!`
      );

      setTimeout(() => {
        setIsSubmitting(false);
        setImportSuccessMessage(null);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Import execution error:', err);
      alert('Fehler beim Importieren: ' + (err?.message || 'Unbekannter Fehler'));
      setIsSubmitting(false);
    }
  };

  const displayedRows = parseResult
    ? hideDuplicatesInPreview
      ? parseResult.rows.filter((r) => !r.isDuplicate)
      : parseResult.rows
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Bitcoin CSV-Import</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Exchanges & Wallets
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Importiere deine getätigten BTC-Käufe und Verkäufe mit automatischer Duplikate-Erkennung
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
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

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* File Upload / Paste Controls */}
          {!parseResult ? (
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 w-fit">
                <button
                  onClick={() => setTab('upload')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    tab === 'upload' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  CSV-Datei hochladen
                </button>
                <button
                  onClick={() => setTab('paste')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
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
                    Klicke hier oder ziehe deine Bitvavo-CSV hierher
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Unterstützt .csv Exporte von Bitvavo, Kraken, Binance, Relai, Bison und Excel
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
                    placeholder="Date,Time,Market,Side,Price,Amount,Total..."
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => handleParse(csvText, 'Eingefügter CSV-Text')}
                    disabled={!csvText.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition disabled:opacity-40"
                  >
                    CSV analysieren & Vorschau anzeigen
                  </button>
                </div>
              )}

              {/* Sample loader */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Keine Bitvavo-Datei zur Hand? Teste mit einer realistischen Muster-Datei:
                </span>
                <button
                  onClick={handleLoadSample}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold transition"
                >
                  Muster-Bitvavo CSV testen
                </button>
              </div>

              {/* Guarantees Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-400 pt-1">
                <div className="flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-200 font-semibold block">Duplikat-Schutz garantiert</span>
                    Bereits im Portfolio vorhandene Transaktionen werden automatisch erkannt und nicht doppelt angelegt.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                  <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-200 font-semibold block">Chronologische Einsortierung</span>
                    Neue Transaktionen werden exakt nach Datum und Uhrzeit in deine Transaktionshistorie eingereiht.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Parse Result & Preview Area */
            <div className="space-y-4">
              {/* Parse Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{fileName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {parseResult.detectedFormat}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span className="text-emerald-400 font-semibold">
                      +{parseResult.newCount} neue Transaktionen
                    </span>
                    <span>•</span>
                    <span className="text-amber-400">
                      {parseResult.duplicateCount} Duplikate (werden übersprungen)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHideDuplicatesInPreview(!hideDuplicatesInPreview)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    {hideDuplicatesInPreview ? 'Alle anzeigen' : 'Nur Neue anzeigen'}
                  </button>

                  <button
                    onClick={() => {
                      setParseResult(null);
                      setCsvText('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    Andere Datei wählen
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Typ</th>
                        <th className="py-2.5 px-3">Datum</th>
                        <th className="py-2.5 px-3">Menge BTC</th>
                        <th className="py-2.5 px-3">Kurs (Orig.)</th>
                        <th className="py-2.5 px-3">Kurs (USD)</th>
                        <th className="py-2.5 px-3">Notiz</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {displayedRows.map((row, i) => (
                        <tr
                          key={i}
                          className={
                            row.isDuplicate
                              ? 'bg-amber-950/15 text-slate-500'
                              : 'hover:bg-slate-800/30 text-slate-200'
                          }
                        >
                          <td className="py-2 px-3 font-sans">
                            {row.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                                Vorhanden
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
                          <td className="py-2 px-3 font-sans text-slate-300">{row.date}</td>
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
                          <td className="py-2 px-3 font-sans text-slate-400 text-[10px] truncate max-w-[120px]">
                            {row.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-400 text-[11px]">
                  {parseResult.newCount > 0
                    ? `Bereit zum Einfügen von ${parseResult.newCount} Transaktionen.`
                    : 'Keine neuen Transaktionen zum Importieren.'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                  >
                    Abbrechen
                  </button>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isSubmitting || parseResult.newCount === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-40"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'Importiere...'
                        : `${parseResult.newCount} Transaktionen einsortieren`}
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
