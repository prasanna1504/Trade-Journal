import asyncio
from datetime import datetime, timezone
from django.conf import settings


async def fetch_trades_from_metaapi(mt_login: str, mt_password: str, mt_server: str) -> list[dict]:
    from metaapi_cloud_sdk import MetaApi

    api = MetaApi(settings.METAAPI_TOKEN)

    try:
        # v29 API: use get_accounts_with_infinite_scroll_pagination
        accounts = await api.metatrader_account_api.get_accounts_with_infinite_scroll_pagination()

        account = next(
            (a for a in accounts if a.login == str(mt_login) and a.server == mt_server),
            None
        )

        if account is None:
            account = await api.metatrader_account_api.create_account({
                'name': f'Trade Journal - {mt_login}',
                'type': 'cloud',
                'login': str(mt_login),
                'password': mt_password,
                'server': mt_server,
                'platform': 'mt5',
                'magic': 0,
            })

        # Deploy and wait for broker connection
        await account.deploy()
        await account.wait_connected()

        # Get RPC connection and synchronise
        connection = account.get_rpc_connection()
        await connection.connect()
        await connection.wait_synchronized()

        start_time = datetime(2020, 1, 1, tzinfo=timezone.utc)
        end_time = datetime.now(timezone.utc)

        result = await connection.get_deals_by_time_range(start_time, end_time)
        deals = result.get('deals', [])

        await connection.close()

        # Pair IN deals with OUT deals by positionId
        trades = []
        open_deals = {}

        for deal in deals:
            entry = deal.get('entryType', '')
            if entry == 'DEAL_ENTRY_IN':
                open_deals[deal.get('positionId')] = deal
            elif entry == 'DEAL_ENTRY_OUT':
                open_deal = open_deals.get(deal.get('positionId'))
                if open_deal:
                    trade_type = 'BUY' if open_deal.get('type') == 'DEAL_TYPE_BUY' else 'SELL'
                    trades.append({
                        'ticket': str(deal.get('positionId', '')),
                        'symbol': deal.get('symbol', ''),
                        'trade_type': trade_type,
                        'volume': open_deal.get('volume', 0),
                        'open_price': open_deal.get('price', 0),
                        'close_price': deal.get('price', 0),
                        'open_time': open_deal.get('time'),
                        'close_time': deal.get('time'),
                        'profit': deal.get('profit', 0),
                        'commission': deal.get('commission', 0),
                        'swap': deal.get('swap', 0),
                    })

        return trades

    finally:
        api.close()


def sync_fetch_trades(mt_login: str, mt_password: str, mt_server: str) -> list[dict]:
    return asyncio.run(fetch_trades_from_metaapi(mt_login, mt_password, mt_server))
