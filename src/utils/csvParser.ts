import { PortfolioTransaction } from '../types';

export interface ParsedCsvRow {
  date: string; // ISO format: YYYY-MM-DD or YYYY-MM-DD HH:mm
  timestamp: number; // unix ms for exact sorting
  type: 'BUY' | 'SELL';
  amountBtc: number;
  pricePerBtcUsd: number;
  pricePerBtcOriginal: number;
  currency: 'EUR' | 'USD';
  feeUsd: number;
  note: string;
  externalId?: string;
  fingerprint: string;
  isDuplicate?: boolean;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  totalRows: number;
  duplicateCount: number;
  newCount: number;
  detectedFormat: string;
  errors: string[];
}

/**
 * Normalizes numbers from either German (1.234,56) or English (1,234.56) formatting.
 */
export function parseFlexibleNumber(raw: string | undefined): number {
  if (!raw) return 0;
  let str = raw.trim().replace(/[$€£\s]/g, '');

  if (!str) return 0;

  // If both dot and comma exist:
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // German format: 1.234,56 -> remove dots, replace comma with dot
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // English format: 1,234.56 -> remove commas
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma: could be decimal (0,05) or thousands (1,000)
    // If comma is 3 digits from the end and no decimal afterwards, but in crypto 0,05 is very common
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      str = str.replace(',', '.');
    } else if (parts.length === 2 && parts[1].length === 3 && parseFloat(parts[0]) > 0) {
      // Ambiguous: 1,234 could be 1234 or 1.234. If value < 1000 in BTC context, 1,234 might be 1.234
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }

  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/**
 * Normalizes date/time into standard string and timestamp.
 */
export function parseFlexibleDate(dateRaw: string, timeRaw?: string): { dateStr: string; timestamp: number } {
  let combined = (dateRaw || '').trim();
  if (timeRaw && timeRaw.trim()) {
    combined += ' ' + timeRaw.trim();
  }

  // Remove quotes
  combined = combined.replace(/['"]/g, '').trim();

  // Handle German date DD.MM.YYYY
  const deMatch = combined.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (deMatch) {
    const day = deMatch[1].padStart(2, '0');
    const month = deMatch[2].padStart(2, '0');
    const year = deMatch[3];
    const hour = deMatch[4] ? deMatch[4].padStart(2, '0') : '12';
    const min = deMatch[5] ? deMatch[5] : '00';
    const sec = deMatch[6] ? deMatch[6] : '00';
    const iso = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
    const ts = new Date(iso).getTime();
    return {
      dateStr: `${year}-${month}-${day}`,
      timestamp: isNaN(ts) ? Date.now() : ts,
    };
  }

  // Handle standard ISO or YYYY-MM-DD
  const ts = new Date(combined).getTime();
  if (!isNaN(ts)) {
    const d = new Date(ts);
    const dateStr = d.toISOString().split('T')[0];
    return { dateStr, timestamp: ts };
  }

  // Fallback to today
  return {
    dateStr: new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
  };
}

/**
 * Generates an idempotent fingerprint for duplicate detection.
 */
export function generateFingerprint(dateStr: string, type: string, amountBtc: number, priceUsd: number, extId?: string): string {
  if (extId && extId.trim()) {
    return `ext-${extId.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }
  // Deterministic hash based on date, type, precise amount, and rounded price
  const amtFixed = amountBtc.toFixed(6);
  const priceRounded = Math.round(priceUsd);
  return `fp-${dateStr}_${type}_${amtFixed}_${priceRounded}`;
}

/**
 * Parses Bitvavo and generic Crypto CSV data.
 */
export function parseBitcoinCsv(
  csvContent: string,
  existingTransactions: PortfolioTransaction[],
  eurToUsdRate: number = 1.08
): CsvParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const errors: string[] = [];

  if (lines.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      duplicateCount: 0,
      newCount: 0,
      detectedFormat: 'Unbekannt',
      errors: ['Die Datei enthält keine Datenzeilen.'],
    };
  }

  // Detect delimiter: semicolon or comma
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : tabCount > commaCount ? '\t' : ',';

  // Parse header
  const headers = headerLine
    .split(delimiter)
    .map((h) => h.replace(/['"]/g, '').trim().toLowerCase());

  // Helper to find column index
  const findCol = (...keywords: string[]): number => {
    return headers.findIndex((h) => keywords.some((k) => h === k || h.includes(k)));
  };

  const colDate = findCol('date', 'datum', 'timestamp', 'zeit', 'created', 'time', 'datetime');
  const colTime = findCol('time', 'uhrzeit', 'time_utc');
  const colType = findCol('type', 'typ', 'side', 'action', 'art', 'transaktion');
  const colMarket = findCol('market', 'markt', 'pair', 'handelspaar', 'symbol');
  const colAmount = findCol('amount', 'menge', 'filled', 'quantity', 'btc', 'volume', 'size', 'anzahl');
  const colPrice = findCol('price', 'preis', 'kurs', 'rate', 'unit price');
  const colTotal = findCol('total', 'gesamt', 'wert', 'cost', 'kosten', 'subtotal');
  const colFee = findCol('fee', 'gebühr', 'gebuehr', 'kosten', 'commission');
  const colFeeCurrency = findCol('fee currency', 'gebührenwährung');
  const colCurrency = findCol('currency', 'währung', 'fiat');
  const colId = findCol('id', 'order id', 'order_id', 'tx id', 'transaction id', 'transaktions-id', 'external id');

  if (colAmount === -1 && colTotal === -1) {
    errors.push('Keine Spalte für Betrag/Menge gefunden (z.B. Amount, Menge).');
    return {
      rows: [],
      totalRows: 0,
      duplicateCount: 0,
      newCount: 0,
      detectedFormat: 'Fehler',
      errors,
    };
  }

  // Detect format name
  let detectedFormat = 'Generisches Krypto-CSV';
  if (headers.includes('market') && headers.includes('side') && headers.includes('fee')) {
    detectedFormat = 'Bitvavo Trade-Export (CSV)';
  } else if (headers.includes('datum') && headers.includes('menge')) {
    detectedFormat = 'Deutscher Börsen-Export';
  } else if (headers.includes('order id') || headers.includes('txid')) {
    detectedFormat = 'Exchange Transaktions-Export';
  }

  // Build existing fingerprints map
  const existingFingerprints = new Set<string>();
  existingTransactions.forEach((tx) => {
    // Generate identical fingerprint for existing tx
    const fp = generateFingerprint(tx.date, tx.type, tx.amountBtc, tx.pricePerBtcUsd, tx.id);
    existingFingerprints.add(fp);

    // Also fuzzy fingerprint without extId in case extId differed
    const fuzzyFp = `fp-${tx.date}_${tx.type}_${tx.amountBtc.toFixed(6)}_${Math.round(tx.pricePerBtcUsd)}`;
    existingFingerprints.add(fuzzyFp);
  });

  const parsedRows: ParsedCsvRow[] = [];
  let duplicateCount = 0;

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Split taking quotes into account
    const tokens: string[] = [];
    let insideQuote = false;
    let currentToken = '';

    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c];
      if (char === '"' || char === "'") {
        insideQuote = !insideQuote;
      } else if (char === delimiter && !insideQuote) {
        tokens.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    tokens.push(currentToken.trim());

    if (tokens.length < 2) continue;

    // Filter for Bitcoin if Market column specifies asset (e.g. BTC-EUR, BTC/EUR, BTC-USDT)
    if (colMarket !== -1) {
      const marketVal = (tokens[colMarket] || '').toUpperCase();
      if (marketVal && !marketVal.includes('BTC') && !marketVal.includes('XBT')) {
        // Skip non-bitcoin trades in mixed exchange exports (e.g. ETH-EUR)
        continue;
      }
    }

    // Date
    const rawDate = colDate !== -1 ? tokens[colDate] : new Date().toISOString().split('T')[0];
    const rawTime = (colTime !== -1 && colTime !== colDate) ? tokens[colTime] : undefined;
    const { dateStr, timestamp } = parseFlexibleDate(rawDate, rawTime);

    // Type
    let typeStr = colType !== -1 ? (tokens[colType] || '').toLowerCase() : 'buy';
    let type: 'BUY' | 'SELL' = 'BUY';
    if (typeStr.includes('sell') || typeStr.includes('verkauf') || typeStr.includes('verkauft') || typeStr.includes('sold')) {
      type = 'SELL';
    } else {
      type = 'BUY';
    }

    // Amount BTC
    let amountBtc = colAmount !== -1 ? Math.abs(parseFlexibleNumber(tokens[colAmount])) : 0;

    // Price
    let rawPrice = colPrice !== -1 ? parseFlexibleNumber(tokens[colPrice]) : 0;
    const rawTotal = colTotal !== -1 ? parseFlexibleNumber(tokens[colTotal]) : 0;

    // If price is missing but total and amount exist
    if (rawPrice === 0 && rawTotal > 0 && amountBtc > 0) {
      rawPrice = rawTotal / amountBtc;
    } else if (amountBtc === 0 && rawTotal > 0 && rawPrice > 0) {
      amountBtc = rawTotal / rawPrice;
    }

    if (amountBtc <= 0 || rawPrice <= 0) {
      continue;
    }

    // Currency & USD conversion
    const currToken = colCurrency !== -1 ? (tokens[colCurrency] || '').toUpperCase() : '';
    const marketToken = colMarket !== -1 ? (tokens[colMarket] || '').toUpperCase() : '';
    const isEur = currToken.includes('EUR') || marketToken.includes('EUR') || detectedFormat.includes('Bitvavo') || detectedFormat.includes('Deutsch');
    const currency: 'EUR' | 'USD' = isEur ? 'EUR' : 'USD';

    // Convert to USD for internal accounting if in EUR
    const pricePerBtcUsd = isEur ? rawPrice * eurToUsdRate : rawPrice;

    // Fee
    let feeUsd = colFee !== -1 ? parseFlexibleNumber(tokens[colFee]) : 0;
    if (isEur) feeUsd = feeUsd * eurToUsdRate;

    // External ID / ID
    const extId = colId !== -1 ? tokens[colId]?.replace(/['"]/g, '').trim() : undefined;

    // Fingerprint
    const fp = generateFingerprint(dateStr, type, amountBtc, pricePerBtcUsd, extId);
    const fuzzyFp = `fp-${dateStr}_${type}_${amountBtc.toFixed(6)}_${Math.round(pricePerBtcUsd)}`;

    const isDuplicate = existingFingerprints.has(fp) || existingFingerprints.has(fuzzyFp);
    if (isDuplicate) {
      duplicateCount++;
    }

    parsedRows.push({
      date: dateStr,
      timestamp,
      type,
      amountBtc,
      pricePerBtcUsd,
      pricePerBtcOriginal: rawPrice,
      currency,
      feeUsd,
      note: `Importiert (${detectedFormat})${extId ? ` • ID: ${extId}` : ''}`,
      externalId: extId,
      fingerprint: fp,
      isDuplicate,
    });
  }

  // Sort rows chronologically by timestamp (newest first or oldest first)
  parsedRows.sort((a, b) => b.timestamp - a.timestamp);

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    duplicateCount,
    newCount: parsedRows.length - duplicateCount,
    detectedFormat,
    errors,
  };
}
