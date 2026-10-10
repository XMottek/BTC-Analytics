export interface MarketData {
  priceUsd: number;
  priceEur: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volumeBtc24h: number;
  volumeUsd24h: number;
  marketCapUsd: number;
  fearAndGreedIndex: {
    value: number;
    classification: string;
  };
  rsi14: number;
  halvingCycle: {
    daysSinceHalving: number;
    cyclePhase: string;
    nextHalvingApprox: string;
  };
  updatedAt: string;
  isLive: boolean;
}

export interface MacroSettings {
  fedRateCutExpectation: string;
  usDebtCeilingDeficit: string;
  etfInflows: string;
  strategicReservePolicy: string;
  inflationTrend: string;
  geopoliticalRisk: string;
}

export interface ForecastScenario {
  name: string;
  probability: number;
  target3M: number;
  target6M: number;
  target12M: number;
  catalysts: string[];
}

export interface TimelinePoint {
  month: string;
  basePrice: number;
  bullPrice: number;
  bearPrice: number;
}

export interface ActionableStrategy {
  recommendedAction: string;
  dcaStrategy: string;
  entryZones: string[];
  takeProfitZones: string[];
  riskManagementStop: string;
}

export interface MacroForecastResult {
  overallSignal: 'STRONG_BUY' | 'ACCUMULATE_DCA' | 'HOLD' | 'TAKE_PROFIT' | 'SELL';
  signalScore: number; // 0 to 100
  recommendationHeadline: string;
  recommendationSummary: string;
  rationale: {
    fiscal: string;
    political: string;
    technical: string;
    onChain: string;
  };
  scenarios: {
    bull: ForecastScenario;
    base: ForecastScenario;
    bear: ForecastScenario;
  };
  projectedTimeline: TimelinePoint[];
  actionableStrategy: ActionableStrategy;
  riskFactors: string[];
  positiveCatalysts: string[];
}

export interface PortfolioTransaction {
  id: string;
  type: 'BUY' | 'SELL';
  amountBtc: number;
  pricePerBtcUsd: number;
  feeUsd: number;
  date: string;
  time?: string;
  timestamp?: number;
  note?: string;
}

export interface MarketAlertRule {
  id: string;
  title: string;
  condition: 'ABOVE' | 'BELOW' | 'PERCENT_DROP' | 'PERCENT_RISE';
  targetValue: number;
  active: boolean;
  triggered: boolean;
  lastTriggeredAt?: string;
}

export interface TriggeredAlertNotification {
  id: string;
  ruleTitle: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'bullish' | 'bearish';
}

export interface UserPortfolioMetrics {
  totalBtc: number;
  totalCostUsd: number;
  totalCostEur: number;
  avgBuyPrice: number;
  avgBuyPriceEur: number;
  totalValueUsd: number;
  totalValueEur: number;
  totalPnlUsd: number;
  totalPnlEur: number;
  totalPnlPercent: number;
  realizedPnlUsd: number;
  transactionCount: number;
  hasDemoData: boolean;
}

export interface PersonalPortfolioAnalysis {
  portfolioScore: number;
  riskLevel: string;
  headline: string;
  summary: string;
  dcaEvaluation: string;
  actionSteps: string[];
  taxGuidance: string;
  bullCaseValueUsd: number;
  bearCaseValueUsd: number;
  updatedAt?: string;
}
