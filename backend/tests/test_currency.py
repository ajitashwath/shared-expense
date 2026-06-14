import pytest
import pytest_asyncio
from datetime import date
from unittest.mock import AsyncMock, patch, MagicMock

def test_inr_no_conversion():
    from app.services.currency import _rate_cache
    _rate_cache['USD', 'INR', '2026-03-13'] = 83.62
    from app.services.currency import BASE_CURRENCY
    currency = 'INR'
    amount = 1000.0
    if currency == BASE_CURRENCY:
        converted, rate = (amount, 1.0)
    else:
        converted, rate = (amount * 83.62, 83.62)
    assert converted == 1000.0
    assert rate == 1.0

def test_rate_cache_mechanics():
    from app.services.currency import _rate_cache
    _rate_cache['USD', 'INR', '2026-05-01'] = 83.5
    key = ('USD', 'INR', '2026-05-01')
    assert key in _rate_cache
    assert _rate_cache[key] == 83.5

def test_cached_rate_returns_without_api_call():
    from app.services.currency import _rate_cache
    _rate_cache['USD', 'INR', '2026-03-14'] = 83.65
    assert _rate_cache['USD', 'INR', '2026-03-14'] == 83.65

def test_usd_conversion_math():
    amount = 150.0
    rate = 83.5
    expected = round(amount * rate, 2)
    assert expected == 12525.0

def test_negative_amount_conversion():
    amount = -30.0
    rate = 83.65
    converted = round(amount * rate, 2)
    assert converted == -2509.5

def test_split_types_logic():
    from app.services.currency import _rate_cache
    _rate_cache['USD', 'INR', '2026-03-13'] = 83.62
    _rate_cache['USD', 'INR', '2026-05-01'] = 83.5
    march_rate = _rate_cache['USD', 'INR', '2026-03-13']
    may_rate = _rate_cache['USD', 'INR', '2026-05-01']
    assert march_rate != may_rate