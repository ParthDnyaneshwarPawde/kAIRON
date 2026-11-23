export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarkerData {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  text: string;
}

export interface ZoneData {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  start_time: number;
  confirmed_time?: number;
  end_time: number;
  active: boolean;
  used?: boolean;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  entry_time: number;
  entry_price: number;
  sl: number;
  tp: number;
  rr: number;
  zone_id?: string;
  status: 'WIN' | 'LOSS' | 'OPEN';
  exit_time: number | null;
  exit_price: number | null;
  pnl_points: number;
  pnl_usd: number;
}

export interface MetricsData {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_profit: number;
  profit_factor: number;
  max_drawdown: number;
  max_drawdown_usd: number;
  avg_trade: number;
  gross_profit: number;
  gross_loss: number;
  initial_balance?: number;
  final_balance?: number;
}

export interface SimulationParams {
  symbol: string;
  timeframe: string;
  lookback: number;
  rr_target: number;
  spread: number;
  days: number;
}

export interface SimulationResponse {
  status: string;
  symbol: string;
  timeframe: string;
  candles: CandleData[];
  markers: MarkerData[];
  zones: ZoneData[];
  metrics: MetricsData;
  trades: Trade[];
}

export interface LiveTick {
  time: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  source: string;
}
