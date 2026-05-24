import pandas as pd
from datetime import datetime
from io import StringIO


MT5_COLUMN_MAP = {
    'Time': 'open_time',
    'Position': 'ticket',
    'Symbol': 'symbol',
    'Type': 'trade_type',
    'Volume': 'volume',
    'Price': 'open_price',
    'S / L': 'stop_loss',
    'T / P': 'take_profit',
    'Time.1': 'close_time',
    'Price.1': 'close_price',
    'Commission': 'commission',
    'Swap': 'swap',
    'Profit': 'profit',
}


def parse_mt5_csv(file) -> list[dict]:
    content = file.read().decode('utf-8')
    df = pd.read_csv(StringIO(content))

    df.rename(columns=MT5_COLUMN_MAP, inplace=True)

    trades = []
    for _, row in df.iterrows():
        try:
            trade_type_raw = str(row.get('trade_type', '')).lower()
            if 'buy' in trade_type_raw:
                trade_type = 'BUY'
            elif 'sell' in trade_type_raw:
                trade_type = 'SELL'
            else:
                continue

            def parse_dt(val):
                if pd.isna(val):
                    return None
                try:
                    return pd.to_datetime(val).to_pydatetime()
                except Exception:
                    return None

            def safe_float(val):
                try:
                    return float(val) if not pd.isna(val) else None
                except Exception:
                    return None

            trades.append({
                'ticket': str(row.get('ticket', '')),
                'symbol': str(row.get('symbol', '')),
                'trade_type': trade_type,
                'volume': safe_float(row.get('volume')) or 0,
                'open_price': safe_float(row.get('open_price')) or 0,
                'close_price': safe_float(row.get('close_price')),
                'stop_loss': safe_float(row.get('stop_loss')),
                'take_profit': safe_float(row.get('take_profit')),
                'open_time': parse_dt(row.get('open_time')),
                'close_time': parse_dt(row.get('close_time')),
                'profit': safe_float(row.get('profit')),
                'commission': safe_float(row.get('commission')) or 0,
                'swap': safe_float(row.get('swap')) or 0,
            })
        except Exception:
            continue

    return trades
