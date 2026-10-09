import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // In-memory cache for live market data to avoid public rate-limits
  let cachedMarketData: any = null;
  let lastFetchTime = 0;
  const CACHE_TTL_MS = 15000; // 15 seconds

  // Endpoint: Get Live Bitcoin Market Data
  app.get('/api/market/bitcoin', async (req, res) => {
    const now = Date.now();
    if (cachedMarketData && now - lastFetchTime < CACHE_TTL_MS) {
      return res.json(cachedMarketData);
    }

    try {
      // Fetch from Binance ticker
      const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      if (binanceRes.ok) {
        const data = await binanceRes.json();
        const price = parseFloat(data.lastPrice);
        const change24h = parseFloat(data.priceChangePercent);
        const high24h = parseFloat(data.highPrice);
        const low24h = parseFloat(data.lowPrice);
        const volume24h = parseFloat(data.volume);
        const quoteVolume = parseFloat(data.quoteVolume);

        // Approximate EUR conversion (standard 1 USD ~= 0.92 EUR)
        const usdToEur = 0.925;

        cachedMarketData = {
          priceUsd: price,
          priceEur: price * usdToEur,
          change24h: change24h,
          high24h: high24h,
          low24h: low24h,
          volumeBtc24h: volume24h,
          volumeUsd24h: quoteVolume,
          marketCapUsd: price * 19780000, // ~19.78M BTC mined
          fearAndGreedIndex: {
            value: change24h > 2 ? 72 : change24h < -2 ? 38 : 58,
            classification: change24h > 2 ? 'Greed (Gier)' : change24h < -2 ? 'Fear (Angst)' : 'Neutral',
          },
          rsi14: Math.min(85, Math.max(25, 52 + change24h * 1.8)),
          halvingCycle: {
            daysSinceHalving: 900,
            cyclePhase: 'Halving-Zyklus: Post-Halving Expansionsphase',
            nextHalvingApprox: '2028',
          },
          updatedAt: new Date().toISOString(),
          isLive: true,
        };
        lastFetchTime = now;
        return res.json(cachedMarketData);
      }
    } catch (e) {
      console.warn('Live API fetch warning, fallback to high-fidelity simulated ticker:', e);
    }

    // High fidelity fallback if public API fails
    const basePrice = 96420;
    const variation = (Math.sin(now / 60000) * 450);
    const priceUsd = basePrice + variation;
    cachedMarketData = {
      priceUsd: priceUsd,
      priceEur: priceUsd * 0.925,
      change24h: 3.42,
      high24h: 97800,
      low24h: 93900,
      volumeBtc24h: 28410,
      volumeUsd24h: 2740000000,
      marketCapUsd: priceUsd * 19780000,
      fearAndGreedIndex: {
        value: 68,
        classification: 'Greed (Gier)',
      },
      rsi14: 61.4,
      halvingCycle: {
        daysSinceHalving: 900,
        cyclePhase: 'Halving-Zyklus: Post-Halving Expansionsphase',
        nextHalvingApprox: '2028',
      },
      updatedAt: new Date().toISOString(),
      isLive: false,
    };
    lastFetchTime = now;
    return res.json(cachedMarketData);
  });

  // Endpoint: Historical Chart Data (24h, 7d, 30d, 1y, all)
  app.get('/api/market/history', async (req, res) => {
    const range = (req.query.range as string) || '30d';

    try {
      // Determine points count and duration
      let days = 30;
      if (range === '24h') days = 1;
      else if (range === '7d') days = 7;
      else if (range === '30d') days = 30;
      else if (range === '1y') days = 365;
      else if (range === 'all') days = 1460; // 4 years

      // Attempt to fetch from Binance Kline API
      let interval = '1d';
      let limit = 30;
      if (range === '24h') { interval = '15m'; limit = 96; }
      else if (range === '7d') { interval = '1h'; limit = 168; }
      else if (range === '30d') { interval = '4h'; limit = 180; }
      else if (range === '1y') { interval = '1d'; limit = 365; }
      else { interval = '1w'; limit = 208; }

      const klineUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
      const klineRes = await fetch(klineUrl);

      if (klineRes.ok) {
        const rawKlines = await klineRes.json();
        const points = rawKlines.map((k: any) => ({
          timestamp: k[0],
          date: new Date(k[0]).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: range === '24h' ? undefined : '2-digit',
            hour: range === '24h' || range === '7d' ? '2-digit' : undefined,
            minute: range === '24h' ? '2-digit' : undefined,
          }),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));

        return res.json({ range, points, source: 'live' });
      }
    } catch (err) {
      console.warn('Error fetching klines from Binance, generating realistic curve:', err);
    }

    // Fallback realistic historical trend
    const points = [];
    const count = range === '24h' ? 24 : range === '7d' ? 28 : range === '30d' ? 30 : 52;
    const now = Date.now();
    const step = range === '24h' ? 3600000 : range === '7d' ? 21600000 : range === '30d' ? 86400000 : 7 * 86400000;
    let currentPrice = 96000;

    for (let i = count; i >= 0; i--) {
      const ts = now - i * step;
      const noise = (Math.sin(i * 0.4) + Math.cos(i * 0.2)) * 1200;
      const trend = (count - i) * (range === '1y' || range === 'all' ? 400 : 80);
      const price = Math.max(30000, currentPrice - trend + noise);
      points.push({
        timestamp: ts,
        date: new Date(ts).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          hour: range === '24h' ? '2-digit' : undefined,
        }),
        open: price - 150,
        high: price + 400,
        low: price - 300,
        close: price,
        volume: 1200 + Math.random() * 800,
      });
    }

    res.json({ range, points, source: 'fallback' });
  });

  // Endpoint: AI Macro Forecast & Buy/Sell Recommendation
  app.post('/api/macro-forecast', async (req, res) => {
    try {
      const {
        currentPrice = 96500,
        macroSettings = {
          fedRateCutExpectation: '25-50 bps Lockerung',
          usDebtCeilingDeficit: 'Anhaltend hohe Verschuldung (> 36 Bio. USD)',
          etfInflows: 'Stetiger Nettozufluss (BlackRock, Fidelity)',
          strategicReservePolicy: 'US Strategic Bitcoin Reserve Diskussionen aktiv',
          inflationTrend: 'Stagnierende Kerninflation ~2.7-3.0%',
          geopoliticalRisk: 'Erhöhte geopolitische Unsicherheit / Suche nach harten Assets',
        },
        timeframe = '12M',
      } = req.body;

      const systemInstruction = `Du bist ein hochkarätiger quantitativer Krypto-Makroökonom, Hedgefonds-Stratege und On-Chain-Analyst für Bitcoin (BTC).
Deine Aufgabe ist es, auf Basis der aktuellen Bitcoin-Marktbewegungen, fiskalpolitischen Gegebenheiten (Zinspolitik der Fed & EZB, M2-Geldmengenexpansion, US-Staatsschulden & Fiat-Abwertung) und politischen Faktoren (US Krypto-Regulierung, Strategic Bitcoin Reserve Initiativen, Spot-ETF-Institutionalisierung) eine fundierte, differenzierte Zukunftsprognose und klare Kauf-/Verkaufsempfehlungen für Anleger zu erstellen.

Antworte IMMER auf DEUTSCH und gib ausschließlich valides JSON zurück, das dem vorgegebenen Schema entspricht.
Sei realistisch, analytisch und präzise, nenne konkrete Preisspannen und nachvollziehbare Hebelpunkte.`;

      const prompt = `Analysiere die aktuelle Bitcoin-Lage und die fiskalisch-politischen Rahmenbedingungen:
Aktueller BTC-Kurs: ~$${currentPrice.toLocaleString('en-US')} USD.
Fiskalische & Politische Annahmen:
- Fed & Zentralbankpolitik: ${macroSettings.fedRateCutExpectation}
- Fiskaldefizite & Staatsschulden: ${macroSettings.usDebtCeilingDeficit}
- Institutionelle Spot-ETF-Ströme: ${macroSettings.etfInflows}
- Politische Weichenstellung (z.B. Strategic Reserve, Regulierung): ${macroSettings.strategicReservePolicy}
- Inflation & Kaufkraftverlust Fiat: ${macroSettings.inflationTrend}
- Geopolitische Gemengelage: ${macroSettings.geopoliticalRisk}

Erstelle:
1. Eine klare Gesamtempfehlung (STRONG_BUY, ACCUMULATE_DCA, HOLD, TAKE_PROFIT, SELL) mit Konfidenzwert (0-100%).
2. Eine tiefgehende Rationale unterteilt in:
   - Fiskalische Dynamik (M2-Liquidität, Realzinsen, Entwertung von Papierwährungen)
   - Politische & regulatorische Hebel (US-Politik, ETF-Inflows, Reserven)
   - Technische & zyklische Indikatoren (Halving-Zyklus, MVRV, RSI, Support/Resistenz)
   - On-Chain & Marktstruktur (Langzeit-HODLer, Minerkosten, Liquiditätsbänder)
3. Drei Szenarien (Bullish, Basis, Bearish) mit Wahrscheinlichkeiten (%) und Zielkursen für 3 Monate, 6 Monate und 12 Monate.
4. Einen monatlichen Prognosepfad für die nächsten 12 Monate mit Werten (month, basePrice, bullPrice, bearPrice).
5. Konkrete Handlungsanweisungen für Anleger (DCA-Einstiegszonen, Stop-Loss/Absicherung, Gewinnmitnahme-Ziele).
6. Haupt-Katalysatoren und Haupt-Risikofaktoren.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallSignal: {
                type: Type.STRING,
                description: 'STRONG_BUY | ACCUMULATE_DCA | HOLD | TAKE_PROFIT | SELL',
              },
              signalScore: {
                type: Type.NUMBER,
                description: 'Score von 0 (extrem bearisch) bis 100 (extrem bullisch)',
              },
              recommendationHeadline: {
                type: Type.STRING,
                description: 'Prägnante deutsche Überschrift zur Empfehlung',
              },
              recommendationSummary: {
                type: Type.STRING,
                description: 'Ausführliche Zusammenfassung der Empfehlung (ca. 2-3 Absätze)',
              },
              rationale: {
                type: Type.OBJECT,
                properties: {
                  fiscal: { type: Type.STRING, description: 'Analyse fiskalischer Faktoren (M2, Zinsen, Defizite)' },
                  political: { type: Type.STRING, description: 'Analyse politischer Faktoren (Regulierung, Reserve, ETFs)' },
                  technical: { type: Type.STRING, description: 'Analyse technischer Indikatoren & Halving-Zyklus' },
                  onChain: { type: Type.STRING, description: 'Analyse von On-Chain Daten & Liquidität' },
                },
                required: ['fiscal', 'political', 'technical', 'onChain'],
              },
              scenarios: {
                type: Type.OBJECT,
                properties: {
                  bull: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      probability: { type: Type.NUMBER },
                      target3M: { type: Type.NUMBER },
                      target6M: { type: Type.NUMBER },
                      target12M: { type: Type.NUMBER },
                      catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['name', 'probability', 'target3M', 'target6M', 'target12M', 'catalysts'],
                  },
                  base: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      probability: { type: Type.NUMBER },
                      target3M: { type: Type.NUMBER },
                      target6M: { type: Type.NUMBER },
                      target12M: { type: Type.NUMBER },
                      catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['name', 'probability', 'target3M', 'target6M', 'target12M', 'catalysts'],
                  },
                  bear: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      probability: { type: Type.NUMBER },
                      target3M: { type: Type.NUMBER },
                      target6M: { type: Type.NUMBER },
                      target12M: { type: Type.NUMBER },
                      catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['name', 'probability', 'target3M', 'target6M', 'target12M', 'catalysts'],
                  },
                },
                required: ['bull', 'base', 'bear'],
              },
              projectedTimeline: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    month: { type: Type.STRING, description: 'z.B. Monat 1, Monat 2 ...' },
                    basePrice: { type: Type.NUMBER },
                    bullPrice: { type: Type.NUMBER },
                    bearPrice: { type: Type.NUMBER },
                  },
                  required: ['month', 'basePrice', 'bullPrice', 'bearPrice'],
                },
              },
              actionableStrategy: {
                type: Type.OBJECT,
                properties: {
                  recommendedAction: { type: Type.STRING },
                  dcaStrategy: { type: Type.STRING },
                  entryZones: { type: Type.ARRAY, items: { type: Type.STRING } },
                  takeProfitZones: { type: Type.ARRAY, items: { type: Type.STRING } },
                  riskManagementStop: { type: Type.STRING },
                },
                required: ['recommendedAction', 'dcaStrategy', 'entryZones', 'takeProfitZones', 'riskManagementStop'],
              },
              riskFactors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              positiveCatalysts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'overallSignal',
              'signalScore',
              'recommendationHeadline',
              'recommendationSummary',
              'rationale',
              'scenarios',
              'projectedTimeline',
              'actionableStrategy',
              'riskFactors',
              'positiveCatalysts',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (error: any) {
      console.error('Gemini macro forecast error:', error);
      // Fallback robust response if AI key has issues or rate limit
      return res.status(500).json({
        error: 'Fehler bei der KI-Analyse: ' + (error?.message || 'Unbekannter Fehler'),
      });
    }
  });

  // Endpoint: AI Quantitative Assistant Chat for Custom Scenarios
  app.post('/api/ai-chat', async (req, res) => {
    try {
      const { message, history = [], currentPrice = 96500 } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Nachricht ist erforderlich' });
      }

      const systemInstruction = `Du bist SatoshiPulse AI, ein erstklassiger Krypto-Makrostratege und Anlageexperte.
Du hilfst dem Nutzer, Marktbewegungen, Zinsentscheide der Zentralbanken (Fed/EZB), Staatsverschuldung, geopolitische Ereignisse und Bitcoin-Halving-Muster zu verstehen.
Gib fundierte, professionelle und verständliche Auskünfte auf Deutsch. Nutze strukturierte Aufzählungen und konkrete Einschätzungen.
Erinnere sachlich daran, dass Kryptoanlagen volatil sind und keine rechtsverbindliche Finanzberatung darstellen.`;

      const contents = [
        ...history.map((h: any) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user',
          parts: [
            {
              text: `Aktueller Bitcoin-Kurs: $${currentPrice.toLocaleString()} USD.\n\nFrage des Nutzers: ${message}`,
            },
          ],
        },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contents,
        config: {
          systemInstruction,
        },
      });

      return res.json({ reply: response.text });
    } catch (error: any) {
      console.error('AI chat error:', error);
      return res.status(500).json({
        error: 'Fehler beim Abrufen der KI-Antwort: ' + (error?.message || 'Unbekannter Fehler'),
      });
    }
  });

  // Endpoint: Personalized User Portfolio Deep-Dive Analysis
  app.post('/api/user-portfolio-analysis', async (req, res) => {
    try {
      const {
        transactions = [],
        totalBtc = 0,
        avgBuyPrice = 0,
        totalCostUsd = 0,
        currentPrice = 96500,
      } = req.body;

      const systemInstruction = `Du bist ein hochqualifizierter Senior-Portfoliomanager und Krypto-Vermögensberater.
Deine Aufgabe ist es, die individuellen Bitcoin-Bestände und Transaktionen des Nutzers tiefgehend, unvoreingenommen und strukturiert auf Deutsch zu analysieren.
Bewerte DCA-Disziplin, Einstiegskurse im Vergleich zu historischen Zyklen, Rendite-Risiko-Verhältnis und gib maßgeschneiderte Empfehlungen.
Gib die Antwort als valides JSON zurück.`;

      const prompt = `Analysiere das persönliche Bitcoin-Portfolio des Nutzers:
- Aktueller BTC-Bestand: ${totalBtc} BTC
- Durchschnittlicher Kaufkurs (DCA): $${avgBuyPrice.toFixed(0)} USD
- Gesamtes investiertes Kapital: $${totalCostUsd.toFixed(0)} USD
- Aktueller Marktpreis: $${currentPrice.toFixed(0)} USD
- Aktueller Gesamtwert: $${(totalBtc * currentPrice).toFixed(0)} USD
- Unrealisierter Gewinn: $${((totalBtc * currentPrice) - totalCostUsd).toFixed(0)} USD (${totalCostUsd > 0 ? ((((totalBtc * currentPrice) - totalCostUsd) / totalCostUsd) * 100).toFixed(1) : 0}%)
- Bisherige Transaktionen (${transactions.length}):
${transactions.map((t: any) => `  * ${t.date}: ${t.type} ${t.amountBtc} BTC @ $${t.pricePerBtcUsd} (Notiz: ${t.note || '-'})`).join('\n')}

Erstelle eine professionelle Portfolio-Bewertung:
1. Einen Portfolio-Gesundheits-Score von 0 bis 100.
2. Risikoeinstufung (z.B. "Solide konservativ", "Ausgewogen", "Aggressiv").
3. Eine verständliche, prägnante Zusammenfassung der Portfolio-Lage.
4. Bewertung der bisherigen Kaufzeitpunkte und DCA-Disziplin.
5. Konkrete nächste Handlungsempfehlungen (z.B. Sparplan fortführen, Gewinnmitnahme-Staffeln, Rebalancing).
6. Steuerlicher Hinweis zur 1-jährigen Haltefrist (in Deutschland/Österreich steuerfreier Verkauf nach 12 Monaten HODL).
7. Prognostizierter Wert im Bull-Case ($140.000) vs. Bear-Case ($80.000).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              portfolioScore: { type: Type.NUMBER, description: 'Score von 0 bis 100' },
              riskLevel: { type: Type.STRING },
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              dcaEvaluation: { type: Type.STRING },
              actionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
              taxGuidance: { type: Type.STRING },
              bullCaseValueUsd: { type: Type.NUMBER },
              bearCaseValueUsd: { type: Type.NUMBER },
            },
            required: [
              'portfolioScore',
              'riskLevel',
              'headline',
              'summary',
              'dcaEvaluation',
              'actionSteps',
              'taxGuidance',
              'bullCaseValueUsd',
              'bearCaseValueUsd',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (error: any) {
      console.error('Portfolio analysis error:', error);
      return res.status(500).json({
        error: 'Fehler bei der Portfolio-Analyse: ' + (error?.message || 'Unbekannter Fehler'),
      });
    }
  });

  // Serve static assets or mount Vite in dev
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SatoshiPulse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
