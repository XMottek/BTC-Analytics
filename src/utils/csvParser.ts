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
  totalBtcSum: number; // Sum of all BTC amounts parsed
  totalCostOriginalSum: number;
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

export interface ColumnPreview {
  header: string;
  index: number;
  sampleValues: string[];
  isLikelyBtcAmount: boolean;
  isLikelyCounter: boolean; // e.g. "Anzahl = 1" or "Nr"
  isLikelyDate: boolean;
  isLikelyPrice: boolean;
}

export interface ColumnMapping {
  colAmount: string; // Header name or '__calc__'
  colDate: string; // Header name
  colTime: string; // Header name or '__none__'
  colType: string; // Header name or '__fixed_buy__' | '__fixed_sell__'
  colPrice: string; // Header name or '__none__'
  colTotal: string; // Header name or '__none__'
  colFee: string; // Header name or '__none__'
  colCurrency: string; // Header name or '__eur__' | '__usd__'
  colMarket: string; // Header name or '__none__'
  colId: string; // Header name or '__none__'
  fallbackType: 'BUY' | 'SELL';
  currencyMode: 'AUTO' | 'EUR' | 'USD';
}

export interface RawCsvInfo {
  headers: string[];
  columnPreviews: ColumnPreview[];
  sampleRows: string[][];
  totalRowsCount: number;
  delimiter: string;
  suggestedMapping: ColumnMapping;
}

/**
 * Normalizes numbers from either German (1.234,56 / 0,01306) or English (1,234.56 / 0.01306) formatting.
 * Never treats values starting with "0," or small decimals as thousands separators.
 */
export function parseFlexibleNumber(raw: string | undefined): number {
  if (!raw) return 0;
  let str = raw.trim().replace(/[$€£\s]/g, '').replace(/(?:btc|xbt|eur|usd)/gi, '').trim();

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
    // Only comma:
    // In German crypto CSVs/Excel, commas are decimal separators (e.g. 0,01306 or 0,3136 or 64500,50)
    // A thousands separator NEVER has a leading 0 (like 0,123)
    const parts = str.split(',');
    if (parts[0] === '0' || parts[0] === '-0' || parts[0] === '+0') {
      str = str.replace(',', '.');
    } else if (parts.length === 2) {
      // If 2 parts and second part is not 3 digits, or if value is a typical crypto decimal
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
 * Splits a single CSV row safely respecting quotation marks.
 */
function splitCsvRow(line: string, delimiter: string): string[] {
  const tokens: string[] = [];
  let insideQuote = false;
  let currentToken = '';

  for (let c = 0; c < line.length; c++) {
    const char = line[c];
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
  return tokens;
}

/**
 * Analyzes raw CSV text and extracts headers, sample rows, and intelligent initial column mapping.
 * Protects against selecting integer counter columns (e.g. "Anzahl = 1") over actual BTC amounts.
 */
export function analyzeCsvRaw(csvContent: string): RawCsvInfo {
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const lines = cleanContent
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      columnPreviews: [],
      sampleRows: [],
      totalRowsCount: 0,
      delimiter: ',',
      suggestedMapping: {
        colAmount: '',
        colDate: '',
        colTime: '__none__',
        colType: '__fixed_buy__',
        colPrice: '',
        colTotal: '',
        colFee: '__none__',
        colCurrency: '__eur__',
        colMarket: '__none__',
        colId: '__none__',
        fallbackType: 'BUY',
        currencyMode: 'AUTO',
      },
    };
  }

  // Detect delimiter
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : tabCount > commaCount ? '\t' : ',';

  const rawHeaders = splitCsvRow(headerLine, delimiter).map((h) => h.replace(/['"\uFEFF]/g, '').trim());

  // Collect sample rows (up to 5 data rows)
  const sampleRows: string[][] = [];
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    sampleRows.push(splitCsvRow(lines[i], delimiter));
  }

  // Analyze each column
  const columnPreviews: ColumnPreview[] = rawHeaders.map((header, idx) => {
    const sampleValues = sampleRows.map((row) => (row[idx] !== undefined ? row[idx] : '')).filter((v) => v !== '');
    const lowerHeader = header.toLowerCase();

    // Check if values in this column look like integers only (e.g. 1, 1, 1 or 1, 2, 3)
    const isAllInts = sampleValues.length > 0 && sampleValues.every((v) => /^-?\d+$/.test(v.trim()));
    const isAllOnes = sampleValues.length > 0 && sampleValues.every((v) => v.trim() === '1');
    const hasDecimalPointOrComma = sampleValues.some((v) => v.includes('.') || v.includes(','));
    const isLikelyCounter = (lowerHeader.includes('anzahl') || lowerHeader.includes('stk') || lowerHeader === 'nr' || lowerHeader.includes('pos')) && (isAllInts || isAllOnes);

    // Check if values look like small decimals (< 10) typical for BTC purchases
    const hasSmallDecimals = sampleValues.some((v) => {
      const num = parseFlexibleNumber(v);
      return num > 0 && num < 10;
    });

    const isLikelyBtcAmount = 
      (lowerHeader.includes('btc') || lowerHeader.includes('menge') || lowerHeader.includes('amount') || lowerHeader.includes('aantal') || lowerHeader.includes('filled')) &&
      !isLikelyCounter;

    const isLikelyDate = lowerHeader.includes('datum') || lowerHeader.includes('date') || lowerHeader.includes('zeit') || lowerHeader.includes('time') || lowerHeader.includes('created');
    const isLikelyPrice = lowerHeader.includes('kurs') || lowerHeader.includes('preis') || lowerHeader.includes('price') || lowerHeader.includes('prijs') || lowerHeader.includes('rate');

    return {
      header,
      index: idx,
      sampleValues,
      isLikelyBtcAmount: isLikelyBtcAmount || (hasDecimalPointOrComma && hasSmallDecimals && !isLikelyPrice && !isLikelyDate),
      isLikelyCounter,
      isLikelyDate,
      isLikelyPrice,
    };
  });

  // Helper to find best matching header
  const findBestHeader = (...keywords: string[]): string => {
    const match = rawHeaders.find((h) => {
      const lh = h.toLowerCase();
      return keywords.some((k) => lh === k || lh.includes(k));
    });
    return match || '';
  };

  // Special amount picker: prioritize columns with 'btc' or decimal values over counters like 'anzahl'
  let bestAmountHeader = '';
  // 1. Column with both 'btc' in name and not counter
  const btcHeader = rawHeaders.find((h) => {
    const lh = h.toLowerCase();
    return (lh.includes('btc') || lh.includes('xbt')) && !lh.includes('kurs') && !lh.includes('preis') && !lh.includes('fee');
  });
  if (btcHeader) {
    bestAmountHeader = btcHeader;
  } else {
    // 2. Column identified as isLikelyBtcAmount
    const likelyCol = columnPreviews.find((p) => p.isLikelyBtcAmount && !p.isLikelyCounter);
    if (likelyCol) {
      bestAmountHeader = likelyCol.header;
    } else {
      // 3. Fallback to keyword matching, excluding 'anzahl'
      bestAmountHeader = findBestHeader('amount', 'menge', 'aantal', 'filled', 'quantity', 'volume', 'size');
      if (!bestAmountHeader) {
        bestAmountHeader = findBestHeader('anzahl');
      }
    }
  }

  // Date column
  const bestDateHeader = findBestHeader('datum', 'date', 'transactiedatum', 'trade date', 'order date', 'kaufdatum', 'ausführung', 'zeitstempel', 'timestamp', 'datetime', 'created');
  const bestTimeHeader = findBestHeader('time', 'tijd', 'uhrzeit', 'time_utc', 'zeit');
  const bestTypeHeader = findBestHeader('type', 'typ', 'side', 'zijde', 'action', 'art', 'transaktion');
  const bestPriceHeader = findBestHeader('kurs', 'preis', 'price', 'prijs', 'rate', 'unit price', 'kaufkurs');
  const bestTotalHeader = findBestHeader('gesamt', 'total', 'totaal', 'wert', 'cost', 'kosten', 'subtotal', 'betrag');
  const bestFeeHeader = findBestHeader('fee', 'gebühr', 'gebuehr', 'kosten', 'commission');
  const bestMarketHeader = findBestHeader('market', 'markt', 'pair', 'handelspaar', 'symbol');
  const bestIdHeader = findBestHeader('id', 'order id', 'order_id', 'tx id', 'transaction id', 'transaktions-id', 'external id');
  const bestCurrencyHeader = findBestHeader('currency', 'valuta', 'währung', 'fiat');

  return {
    headers: rawHeaders,
    columnPreviews,
    sampleRows,
    totalRowsCount: lines.length - 1,
    delimiter,
    suggestedMapping: {
      colAmount: bestAmountHeader,
      colDate: bestDateHeader,
      colTime: bestTimeHeader && bestTimeHeader !== bestDateHeader ? bestTimeHeader : '__none__',
      colType: bestTypeHeader ? bestTypeHeader : '__fixed_buy__',
      colPrice: bestPriceHeader,
      colTotal: bestTotalHeader,
      colFee: bestFeeHeader ? bestFeeHeader : '__none__',
      colCurrency: bestCurrencyHeader ? bestCurrencyHeader : '__eur__',
      colMarket: bestMarketHeader ? bestMarketHeader : '__none__',
      colId: bestIdHeader ? bestIdHeader : '__none__',
      fallbackType: 'BUY',
      currencyMode: 'AUTO',
    },
  };
}

/**
 * Parses CSV rows using user-specified column mappings.
 * Computes exact total BTC sum and provides duplicate and date mismatch detection.
 */
export function parseBitcoinCsvWithMapping(
  csvContent: string,
  mapping: ColumnMapping,
  existingTransactions: PortfolioTransaction[],
  eurToUsdRate: number = 1.08
): CsvParseResult {
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
      totalBtcSum: 0,
      totalCostOriginalSum: 0,
      duplicateCount: 0,
      newCount: 0,
      matchedCount: 0,
      dateMismatchCount: 0,
      detectedFormat: 'Unbekannt',
      errors: ['Die Datei enthält keine Datenzeilen.'],
    };
  }

  // Detect delimiter
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : tabCount > commaCount ? '\t' : ',';

  const headers = splitCsvRow(headerLine, delimiter).map((h) => h.replace(/['"\uFEFF]/g, '').trim());

  const getIdx = (headerName: string | undefined): number => {
    if (!headerName || headerName.startsWith('__')) return -1;
    return headers.findIndex((h) => h.toLowerCase() === headerName.toLowerCase());
  };

  const colDateIdx = getIdx(mapping.colDate);
  const colTimeIdx = getIdx(mapping.colTime);
  const colTypeIdx = getIdx(mapping.colType);
  const colAmountIdx = getIdx(mapping.colAmount);
  const colPriceIdx = getIdx(mapping.colPrice);
  const colTotalIdx = getIdx(mapping.colTotal);
  const colFeeIdx = getIdx(mapping.colFee);
  const colCurrencyIdx = getIdx(mapping.colCurrency);
  const colMarketIdx = getIdx(mapping.colMarket);
  const colIdIdx = getIdx(mapping.colId);

  if (colAmountIdx === -1 && colTotalIdx === -1) {
    errors.push('Bitte wähle eine Spalte für die BTC-Menge oder den Gesamtbetrag aus.');
    return {
      rows: [],
      totalRows: 0,
      totalBtcSum: 0,
      totalCostOriginalSum: 0,
      duplicateCount: 0,
      newCount: 0,
      matchedCount: 0,
      dateMismatchCount: 0,
      detectedFormat: 'Fehler',
      errors,
    };
  }

  // Format label
  let detectedFormat = 'Benutzerdefinierter CSV-Import';
  const headersJoined = headers.join(' ').toLowerCase();
  if (headersJoined.includes('bitvavo') || (headersJoined.includes('market') && headersJoined.includes('side'))) {
    detectedFormat = 'Bitvavo Trade-Export';
  } else if (headersJoined.includes('datum') && headersJoined.includes('kurs')) {
    detectedFormat = 'Excel-Krypto-Portfolio';
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
  let totalBtcSum = 0;
  let totalCostOriginalSum = 0;

  for (let i = 1; i < lines.length; i++) {
    const tokens = splitCsvRow(lines[i], delimiter);
    if (tokens.length < 2) continue;

    // Filter by Market if present
    if (colMarketIdx !== -1) {
      const marketVal = (tokens[colMarketIdx] || '').toUpperCase();
      if (marketVal && !marketVal.includes('BTC') && !marketVal.includes('XBT')) {
        continue;
      }
    }

    // Parse date and time
    const rawDate = colDateIdx !== -1 ? tokens[colDateIdx] : new Date().toISOString().split('T')[0];
    const rawTime = colTimeIdx !== -1 && colTimeIdx !== colDateIdx ? tokens[colTimeIdx] : undefined;
    const { dateStr, timeStr, germanFormatted, timestamp } = parseFlexibleDate(rawDate, rawTime);

    // Type
    let type: 'BUY' | 'SELL' = mapping.fallbackType;
    if (mapping.colType === '__fixed_buy__') {
      type = 'BUY';
    } else if (mapping.colType === '__fixed_sell__') {
      type = 'SELL';
    } else if (colTypeIdx !== -1) {
      const typeStr = (tokens[colTypeIdx] || '').toLowerCase();
      if (typeStr.includes('sell') || typeStr.includes('verkauf') || typeStr.includes('verkauft') || typeStr.includes('sold') || typeStr.includes('verkoop')) {
        type = 'SELL';
      } else {
        type = 'BUY';
      }
    }

    // Amount BTC
    let amountBtc = colAmountIdx !== -1 ? Math.abs(parseFlexibleNumber(tokens[colAmountIdx])) : 0;

    // Price & Total
    let rawPrice = colPriceIdx !== -1 ? parseFlexibleNumber(tokens[colPriceIdx]) : 0;
    const rawTotal = colTotalIdx !== -1 ? parseFlexibleNumber(tokens[colTotalIdx]) : 0;

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
    let isEur = true;
    if (mapping.currencyMode === 'EUR') {
      isEur = true;
    } else if (mapping.currencyMode === 'USD') {
      isEur = false;
    } else {
      const currToken = colCurrencyIdx !== -1 ? (tokens[colCurrencyIdx] || '').toUpperCase() : '';
      const marketToken = colMarketIdx !== -1 ? (tokens[colMarketIdx] || '').toUpperCase() : '';
      isEur = currToken.includes('EUR') || marketToken.includes('EUR') || mapping.colCurrency === '__eur__' || detectedFormat.includes('Excel') || detectedFormat.includes('Bitvavo');
    }

    const currency: 'EUR' | 'USD' = isEur ? 'EUR' : 'USD';
    const pricePerBtcUsd = isEur ? rawPrice * eurToUsdRate : rawPrice;

    // Fee
    let feeUsd = colFeeIdx !== -1 ? parseFlexibleNumber(tokens[colFeeIdx]) : 0;
    if (isEur) feeUsd = feeUsd * eurToUsdRate;

    // External ID
    const extId = colIdIdx !== -1 ? tokens[colIdIdx]?.replace(/['"]/g, '').trim() : undefined;

    // Fingerprint
    const fp = generateFingerprint(dateStr, type, amountBtc, pricePerBtcUsd, extId);
    const fuzzyFp = `fp-${dateStr}_${type}_${amountBtc.toFixed(6)}_${Math.round(pricePerBtcUsd)}`;
    const isExactDuplicate = existingFingerprints.has(fp) || existingFingerprints.has(fuzzyFp);

    // Smart matching against existing transactions
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

    totalBtcSum += (type === 'BUY' ? amountBtc : -amountBtc);
    totalCostOriginalSum += amountBtc * rawPrice;

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
    totalBtcSum,
    totalCostOriginalSum,
    duplicateCount,
    newCount,
    matchedCount,
    dateMismatchCount,
    detectedFormat,
    errors,
  };
}

/**
 * Backward-compatible helper that automatically analyzes CSV and parses with suggested mapping.
 */
export function parseBitcoinCsv(
  csvContent: string,
  existingTransactions: PortfolioTransaction[],
  eurToUsdRate: number = 1.08
): CsvParseResult {
  const analysis = analyzeCsvRaw(csvContent);
  return parseBitcoinCsvWithMapping(csvContent, analysis.suggestedMapping, existingTransactions, eurToUsdRate);
}
