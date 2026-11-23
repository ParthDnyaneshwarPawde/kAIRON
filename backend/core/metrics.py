from typing import List, Dict, Any
import numpy as np

def calculate_metrics(trades: List[Dict[str, Any]], initial_balance: float = 100000.0) -> Dict[str, Any]:
    """
    Computes professional quantitative performance metrics from a trade log.
    Handles zero trades and single-direction edge cases gracefully.
    """
    if not trades:
        return {
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0.0,
            "net_profit": 0.0,
            "profit_factor": 0.0,
            "max_drawdown": 0.0,
            "max_drawdown_usd": 0.0,
            "avg_trade": 0.0,
            "gross_profit": 0.0,
            "gross_loss": 0.0,
            "initial_balance": initial_balance,
            "final_balance": initial_balance
        }
        
    pnl_list = [float(t.get("pnl_usd", 0.0)) for t in trades]
    total_trades = len(trades)
    
    wins_list = [p for p in pnl_list if p > 0]
    losses_list = [p for p in pnl_list if p <= 0]
    
    wins = len(wins_list)
    losses = len(losses_list)
    win_rate = round((wins / total_trades) * 100.0, 2) if total_trades > 0 else 0.0
    
    gross_profit = round(float(sum(wins_list)), 2)
    gross_loss = round(float(abs(sum(losses_list))), 2)
    net_profit = round(gross_profit - gross_loss, 2)
    
    if gross_loss > 0:
        profit_factor = round(gross_profit / gross_loss, 2)
    elif gross_profit > 0:
        profit_factor = 99.99
    else:
        profit_factor = 0.0
        
    avg_trade = round(net_profit / total_trades, 2) if total_trades > 0 else 0.0
    
    # Cumulative PnL & Maximum Drawdown calculation
    equity_curve = [initial_balance]
    current = initial_balance
    for p in pnl_list:
        current += p
        equity_curve.append(current)
        
    equity_arr = np.array(equity_curve)
    peaks = np.maximum.accumulate(equity_arr)
    dollar_drawdowns = peaks - equity_arr
    max_dd_usd = round(float(np.max(dollar_drawdowns)), 2)
    
    pct_drawdowns = (dollar_drawdowns / peaks) * 100.0
    max_dd_pct = round(float(np.max(pct_drawdowns)), 2)
    
    final_balance = round(float(equity_arr[-1]), 2)
    
    return {
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "net_profit": net_profit,
        "profit_factor": profit_factor,
        "max_drawdown": max_dd_pct,
        "max_drawdown_usd": max_dd_usd,
        "avg_trade": avg_trade,
        "gross_profit": gross_profit,
        "gross_loss": gross_loss,
        "initial_balance": initial_balance,
        "final_balance": final_balance
    }
