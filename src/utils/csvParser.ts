import { PortfolioTransaction } from '../types';

export interface ParsedCsvRow {
  date: string; // ISO format: YYYY-MM-DD
  time?: string; // HH:mm:ss or HH:mm
  germanDate: string; // Formatted: DD.MM.YYYY, HH:mm Uhr
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
  matchedExistingTxId?: string;
  existingDate?: string;
  hasDateMismatch?: boolean;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  totalRows: number;
  duplicateCount: number;
  newCount: number;
  matchedCount: number;
  dateMismatchCount: number;
  detectedFormat: string;
  errors: string[];
}

export interface FlexibleDateResult {
  dateStr: string; // YYYY-MM-DD
  timeStr?: string; // HH:mm:ss or HH:mm
  germanFormatted: string; // DD.MM.YYYY, HH:mm Uhr or DD.MM.YYYY
  timestamp: number; // Unix ms
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
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      str = str.replace(',', '.');
    } else if (parts.length === 2 && parts[1].length === 3 && parseFloat(parts[0]) > 0) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }

  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/**
 * Robust, cross-browser parser for date and time fields.
 * Explicitly decodes year, month, day, and time components to avoid Safari/WebKit Invalid Date bugs.
 */
export function parseFlexibleDate(dateRaw: string, timeRaw?: string): FlexibleDateResult {
  let cleanDate = (dateRaw || '').replace(/['"]/g, '').trim();
  let cleanTime = (timeRaw || '').replace(/['"]/g, '').trim();

  // If time was embedded in dateRaw (e.g., "2024-03-05 10:14:22" or "2024-03-05T10:14:22")
  if (!cleanTime && (cleanDate.includes(' ') || cleanDate.includes('T'))) {
    const parts = cleanDate.split(/[T\s]+/);
    cleanDate = parts[0];
    cleanTime = parts.slice(1).join(' ');
  }

  // Parse time component
  let hour = 12;
  let min = 0;
  let sec = 0;
  let hasExplicitTime = false;

  if (cleanTime) {
    const timeMatch = cleanTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      min = parseInt(timeMatch[2], 10);
      sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      hasExplicitTime = true;
    }
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  // Check Unix timestamp in seconds (10 digits) or milliseconds (13 digits)
  if (/^\d{10,13}$/.test(cleanDate)) {
    const num = parseInt(cleanDate, 10);
    const ms = cleanDate.length === 10 ? num * 1000 : num;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const h = d.getUTCHours();
    const mi = d.getUTCMinutes();
    const s = d.getUTCSeconds();
    return {
      dateStr: `${y}-${pad(m)}-${pad(day)}`,
      timeStr: `${pad(h)}:${pad(mi)}:${pad(s)}`,
      germanFormatted: `${pad(day)}.${pad(m)}.${y}, ${pad(h)}:${pad(mi)} Uhr`,
      timestamp: ms,
    };
  }

  let year = 0;
  let month = 0;
  let day = 0;

  // Format 1: ISO YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = cleanDate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    // Format 2: European DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const euroMatch = cleanDate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (euroMatch) {
      day = parseInt(euroMatch[1], 10);
      month = parseInt(euroMatch[2], 10);
      let y = parseInt(euroMatch[3], 10);
      if (y < 100) y += 2000;
      year = y;
    }
  }

  // Validate parsed calendar components
  if (year >= 2008 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const ts = Date.UTC(year, month - 1, day, hour, min, sec);
    const timeStr = `${pad(hour)}:${pad(min)}${sec > 0 ? `:${pad(sec)}` : ''}`;
    const germanFormatted = hasExplicitTime
      ? `${pad(day)}.${pad(month)}.${year}, ${pad(hour)}:${pad(min)} Uhr`
      : `${pad(day)}.${pad(month)}.${year}`;

    return {
      dateStr: `${year}-${pad(month)}-${pad(day)}`,
      timeStr: hasExplicitTime ? timeStr : undefined,
      germanFormatted,
      timestamp: ts,
    };
  }

  // Fallback to today if string was completely invalid
  const today = new Date();
  const ty = today.getUTCFullYear();
  const tm = today.getUTCMonth() + 1;
  const td = today.getUTCDate();
  return {
    dateStr: `${ty}-${pad(tm)}-${pad(td)}`,
    timeStr: '12:00',
    germanFormatted: `${pad(td)}.${pad(tm)}.${ty}`,
    timestamp: today.getTime(),
  };
}

/**
 * Formats any stored date/time string into clean German format: TT.MM.JJJJ [, HH:mm Uhr]
 */
export function formatGermanDate(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '—';

  // If already in DD.MM.YYYY format
  if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(dateStr)) {
    return dateStr;
  }

  const clean = dateStr.replace(/['"]/g, '').trim();
  const parts = clean.split(/[T\s]/);
  const datePart = parts[0];
  const inlineTime = parts[1] || timeStr;

  const m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const base = `${m[3].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[1]}`;
    if (inlineTime) {
      const tm = inlineTime.match(/(\d{1,2}):(\d{2})/);
      if (tm) {
        return `${base}, ${tm[1].padStart(2, '0')}:${tm[2]} Uhr`;
      }
    }
    return base;
  }

  return dateStr;
}

/**
 * Generates an idempotent fingerprint for duplicate detection.
 */
export function generateFingerprint(dateStr: string, type: string, amountBtc: number, priceUsd: number, extId?: string): string {
  if (extId && extId.trim()) {
    return `ext-${extId.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }
  const amtFixed = amountBtc.toFixed(6);
  const priceRounded = Math.round(priceUsd);
  return `fp-${dateStr}_${type}_${amtFixed}_${priceRounded}`;
}

/**
 * Parses Bitvavo and generic Crypto CSV data with smart duplicate and date mismatch detection.
 */
export function parseBitcoinCsv(
  csvContent: string,
  existingTransactions: PortfolioTransaction[],
  eurToUsdRate: number = 1.08
): CsvParseResult {
  // Strip BOM if present
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const lines = cleanContent
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trim())
    .filter((l) => l.length > 0);

  const errors: string[] = [];

  if (lines.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      duplicateCount: 0,
      newCount: 0,
      matchedCount: 0,
      dateMismatchCount: 0,
      detectedFormat: 'Unbekannt',
      errors: ['Die Datei enthält keine Datenzeilen.'],
    };
  }

  // Detect delimiter: semicolon, tab or comma
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : tabCount > commaCount ? '\t' : ',';

  // Parse header
  const headers = headerLine
    .split(delimiter)
    .map((h) => h.replace(/['"\uFEFF]/g, '').trim().toLowerCase());

  // Helper to find column index with broad keyword support (German, English, Dutch)
  const findCol = (...keywords: string[]): number => {
    return headers.findIndex((h) => keywords.some((k) => h === k || h.includes(k)));
  };

  const colDate = findCol(
    'date',
    'datum',
    'transactiedatum',
    'trade date',
    'order date',
    'kaufdatum',
    'ausführung',
    'zeitstempel',
    'timestamp',
    'datetime',
    'created'
  );
  const colTime = findCol('time', 'tijd', 'uhrzeit', 'time_utc', 'zeit');
  const colType = findCol('type', 'typ', 'side', 'zijde', 'action', 'art', 'transaktion');
  const colMarket = findCol('market', 'markt', 'pair', 'handelspaar', 'symbol');
  const colAmount = findCol('amount', 'menge', 'aantal', 'filled', 'quantity', 'btc', 'volume', 'size', 'anzahl');
  const colPrice = findCol('price', 'preis', 'prijs', 'kurs', 'rate', 'unit price');
  const colTotal = findCol('total', 'totaal', 'gesamt', 'wert', 'cost', 'kosten', 'subtotal');
  const colFee = findCol('fee', 'gebühr', 'gebuehr', 'kosten', 'commission');
  const colCurrency = findCol('currency', 'valuta', 'währung', 'fiat');
  const colId = findCol('id', 'order id', 'order_id', 'tx id', 'transaction id', 'transaktions-id', 'external id');

  if (colAmount === -1 && colTotal === -1) {
    errors.push('Keine Spalte für Betrag/Menge gefunden (z.B. Amount, Menge).');
    return {
      rows: [],
      totalRows: 0,
      duplicateCount: 0,
      newCount: 0,
      matchedCount: 0,
      dateMismatchCount: 0,
      detectedFormat: 'Fehler',
      errors,
    };
  }

  // Detect format name
  let detectedFormat = 'Generisches Krypto-CSV';
  if ((headers.includes('market') || headers.includes('markt')) && (headers.includes('side') || headers.includes('zijde'))) {
    detectedFormat = 'Bitvavo Trade-Export (CSV)';
  } else if (headers.includes('datum') && headers.includes('menge')) {
    detectedFormat = 'Deutscher Börsen-Export';
  } else if (headers.includes('order id') || headers.includes('txid')) {
    detectedFormat = 'Exchange Transaktions-Export';
  }

  // Build index of existing transactions for duplicate and mismatch detection
  const existingFingerprints = new Set<string>();
  existingTransactions.forEach((tx) => {
    const fp = generateFingerprint(tx.date, tx.type, tx.amountBtc, tx.pricePerBtcUsd, tx.id);
    existingFingerprints.add(fp);
    const fuzzyFp = `fp-${tx.date}_${tx.type}_${tx.amountBtc.toFixed(6)}_${Math.round(tx.pricePerBtcUsd)}`;
    existingFingerprints.add(fuzzyFp);
  });

  const parsedRows: ParsedCsvRow[] = [];
  let duplicateCount = 0;
  let matchedCount = 0;
  let dateMismatchCount = 0;

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
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

    // Filter for Bitcoin if Market column specifies asset
    if (colMarket !== -1) {
      const marketVal = (tokens[colMarket] || '').toUpperCase();
      if (marketVal && !marketVal.includes('BTC') && !marketVal.includes('XBT')) {
        continue;
      }
    }

    // Parse date and time
    const rawDate = colDate !== -1 ? tokens[colDate] : new Date().toISOString().split('T')[0];
    const rawTime = colTime !== -1 && colTime !== colDate ? tokens[colTime] : undefined;
    const { dateStr, timeStr, germanFormatted, timestamp } = parseFlexibleDate(rawDate, rawTime);

    // Type
    const typeStr = colType !== -1 ? (tokens[colType] || '').toLowerCase() : 'buy';
    let type: 'BUY' | 'SELL' = 'BUY';
    if (typeStr.includes('sell') || typeStr.includes('verkauf') || typeStr.includes('verkauft') || typeStr.includes('sold') || typeStr.includes('verkoop')) {
      type = 'SELL';
    } else {
      type = 'BUY';
    }

    // Amount BTC
    let amountBtc = colAmount !== -1 ? Math.abs(parseFlexibleNumber(tokens[colAmount])) : 0;

    // Price
    let rawPrice = colPrice !== -1 ? parseFlexibleNumber(tokens[colPrice]) : 0;
    const rawTotal = colTotal !== -1 ? parseFlexibleNumber(tokens[colTotal]) : 0;

    // Calculate missing price or amount if total exists
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
    const pricePerBtcUsd = isEur ? rawPrice * eurToUsdRate : rawPrice;

    // Fee
    let feeUsd = colFee !== -1 ? parseFlexibleNumber(tokens[colFee]) : 0;
    if (isEur) feeUsd = feeUsd * eurToUsdRate;

    // External ID / ID
    const extId = colId !== -1 ? tokens[colId]?.replace(/['"]/g, '').trim() : undefined;

    // Fingerprint
    const fp = generateFingerprint(dateStr, type, amountBtc, pricePerBtcUsd, extId);
    const fuzzyFp = `fp-${dateStr}_${type}_${amountBtc.toFixed(6)}_${Math.round(pricePerBtcUsd)}`;

    const isExactDuplicate = existingFingerprints.has(fp) || existingFingerprints.has(fuzzyFp);

    // Smart matching against existing transactions (to detect transactions needing date updates)
    let matchedExistingTxId: string | undefined;
    let existingDate: string | undefined;
    let hasDateMismatch = false;

    for (const exTx of existingTransactions) {
      const matchExtId = extId && (exTx.id.includes(extId) || (exTx.note && exTx.note.includes(extId)));
      const matchTrade =
        exTx.type === type &&
        Math.abs(exTx.amountBtc - amountBtc) < 0.000001 &&
        (Math.abs(exTx.pricePerBtcUsd - pricePerBtcUsd) / pricePerBtcUsd < 0.03 || Math.round(exTx.pricePerBtcUsd) === Math.round(pricePerBtcUsd));

      if (matchExtId || matchTrade) {
        matchedExistingTxId = exTx.id;
        existingDate = exTx.date;
        if (exTx.date !== dateStr) {
          hasDateMismatch = true;
          dateMismatchCount++;
        }
        matchedCount++;
        break;
      }
    }

    if (isExactDuplicate && !hasDateMismatch) {
      duplicateCount++;
    }

    parsedRows.push({
      date: dateStr,
      time: timeStr,
      germanDate: germanFormatted,
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
      isDuplicate: isExactDuplicate && !hasDateMismatch,
      matchedExistingTxId,
      existingDate,
      hasDateMismatch,
    });
  }

  // Sort rows chronologically by timestamp (newest first)
  parsedRows.sort((a, b) => b.timestamp - a.timestamp);

  const newCount = parsedRows.filter((r) => !r.isDuplicate && !r.matchedExistingTxId).length;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    duplicateCount,
    newCount,
    matchedCount,
    dateMismatchCount,
    detectedFormat,
    errors,
  };
}
