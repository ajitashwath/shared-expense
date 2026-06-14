import httpx
from datetime import date
from functools import lru_cache
from typing import Optional
import logging
logger = logging.getLogger(__name__)
SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP']
BASE_CURRENCY = 'INR'
FRANKFURTER_BASE_URL = 'https://api.frankfurter.app'
_rate_cache: dict[tuple, float] = {}

async def get_historical_rate(from_currency: str, to_currency: str, expense_date: date) -> float:
    if from_currency == to_currency:
        return 1.0
    cache_key = (from_currency, to_currency, str(expense_date))
    if cache_key in _rate_cache:
        logger.debug(f'Rate cache hit: {cache_key}')
        return _rate_cache[cache_key]
    date_str = expense_date.strftime('%Y-%m-%d')
    url = f'{FRANKFURTER_BASE_URL}/{date_str}'
    params = {'from': from_currency, 'to': to_currency}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        rate = data['rates'].get(to_currency)
        if rate is None:
            raise ValueError(f'Frankfurter API did not return a rate for {from_currency}→{to_currency} on {date_str}. Response: {data}')
        _rate_cache[cache_key] = float(rate)
        logger.info(f'Fetched rate {from_currency}→{to_currency} on {date_str}: {rate}')
        return float(rate)
    except httpx.TimeoutException:
        logger.error(f'Timeout fetching rate for {from_currency}→{to_currency} on {date_str}')
        raise RuntimeError(f'Exchange rate API timed out. Cannot convert {from_currency}→{to_currency} for date {date_str}. Please retry.')
    except httpx.HTTPStatusError as e:
        logger.error(f'HTTP error fetching rate: {e.response.status_code}')
        raise RuntimeError(f'Exchange rate API returned {e.response.status_code} for {from_currency}→{to_currency} on {date_str}.')

async def convert_to_inr(amount: float, currency: str, expense_date: date) -> tuple[float, float]:
    if currency == BASE_CURRENCY:
        return (amount, 1.0)
    rate = await get_historical_rate(currency, BASE_CURRENCY, expense_date)
    converted = round(amount * rate, 2)
    return (converted, rate)

def get_cached_rates() -> dict:
    return {f'{k[0]}→{k[1]} on {k[2]}': v for k, v in _rate_cache.items()}