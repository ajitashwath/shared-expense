import pytest
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional

class SplitDetail(BaseModel):
    user_id: str
    amount: Optional[float] = None
    percentage: Optional[float] = None
    shares: Optional[int] = None

def _calculate_splits(split_type: str, splits: list, total_amount: float) -> list:
    results = []
    split_type = split_type.upper()
    if split_type == 'EQUAL':
        n = len(splits)
        per_person = round(total_amount / n, 2)
        remainder = round(total_amount - per_person * n, 2)
        for i, s in enumerate(splits):
            amt = per_person + (remainder if i == 0 else 0)
            results.append((s.user_id, amt, None, None))
    elif split_type == 'PERCENTAGE':
        total_pct = sum((s.percentage or 0 for s in splits))
        if abs(total_pct - 100.0) > 0.01:
            raise HTTPException(400, f'Percentages must sum to 100% (got {total_pct}%)')
        for s in splits:
            amt = round(total_amount * (s.percentage or 0) / 100, 2)
            results.append((s.user_id, amt, s.percentage, None))
    elif split_type == 'EXACT':
        total_exact = sum((s.amount or 0 for s in splits))
        if abs(total_exact - total_amount) > 0.01:
            raise HTTPException(400, f'Exact amounts must sum to {total_amount} (got {total_exact})')
        for s in splits:
            results.append((s.user_id, s.amount or 0, None, None))
    elif split_type == 'SHARES':
        total_shares = sum((s.shares or 0 for s in splits))
        if total_shares == 0:
            raise HTTPException(400, 'Total shares cannot be zero')
        for s in splits:
            amt = round(total_amount * (s.shares or 0) / total_shares, 2)
            results.append((s.user_id, amt, None, s.shares))
    else:
        for s in splits:
            results.append((s.user_id, s.amount or 0, None, None))
    return results

def make_split(user_id: str, **kwargs) -> SplitDetail:
    return SplitDetail(user_id=user_id, **kwargs)

def test_equal_split_4_people():
    splits = [make_split(f'u{i}') for i in range(4)]
    result = _calculate_splits('EQUAL', splits, 1200.0)
    amounts = [r[1] for r in result]
    assert len(amounts) == 4
    assert abs(sum(amounts) - 1200.0) < 0.01
    assert all((abs(a - 300.0) < 1.0 for a in amounts))

def test_equal_split_rounding():
    splits = [make_split(f'u{i}') for i in range(3)]
    result = _calculate_splits('EQUAL', splits, 1000.0)
    amounts = [r[1] for r in result]
    assert abs(sum(amounts) - 1000.0) < 0.01

def test_percentage_split():
    splits = [make_split('u1', percentage=30.0), make_split('u2', percentage=30.0), make_split('u3', percentage=20.0), make_split('u4', percentage=20.0)]
    result = _calculate_splits('PERCENTAGE', splits, 1500.0)
    amounts = [r[1] for r in result]
    assert abs(amounts[0] - 450.0) < 0.01
    assert abs(amounts[2] - 300.0) < 0.01
    assert abs(sum(amounts) - 1500.0) < 0.01

def test_percentage_not_100_raises():
    splits = [make_split('u1', percentage=40.0), make_split('u2', percentage=40.0)]
    with pytest.raises(Exception):
        _calculate_splits('PERCENTAGE', splits, 1000.0)

def test_exact_split():
    splits = [make_split('u1', amount=300.0), make_split('u2', amount=400.0), make_split('u3', amount=300.0)]
    result = _calculate_splits('EXACT', splits, 1000.0)
    amounts = [r[1] for r in result]
    assert amounts == [300.0, 400.0, 300.0]

def test_exact_split_mismatch_raises():
    splits = [make_split('u1', amount=300.0), make_split('u2', amount=400.0)]
    with pytest.raises(Exception):
        _calculate_splits('EXACT', splits, 1000.0)

def test_shares_split():
    splits = [make_split('u1', shares=2), make_split('u2', shares=3), make_split('u3', shares=1), make_split('u4', shares=2)]
    result = _calculate_splits('SHARES', splits, 1600.0)
    amounts = [r[1] for r in result]
    assert abs(amounts[0] - 400.0) < 0.01
    assert abs(amounts[1] - 600.0) < 0.01
    assert abs(sum(amounts) - 1600.0) < 0.01