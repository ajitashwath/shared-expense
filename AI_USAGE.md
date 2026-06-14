# AI_USAGE.md — AI Tool Documentation

## Tools Used

- **Antigravity (Google DeepMind)** — AI coding assistant using Claude Sonnet 4.6 (Thinking)
- Used as primary development pair programmer throughout the project

---

## Role of AI in This Project

The AI generated the initial code structure, event sourcing patterns, and boilerplate. I (the engineer) reviewed every file, caught errors, corrected design decisions, and directed the implementation.

As per the assignment: "You remain responsible for every line you submit."

---

## Key Prompts Used

### Prompt 1: Initial Architecture
> "Design a hybrid event sourcing system for a shared expenses app. Backend: FastAPI + prisma-client-py + PostgreSQL. Explain the tradeoffs between full event sourcing and hybrid event sourcing for this use case."

**Outcome**: The AI correctly identified that pure event sourcing would require replaying all events for every balance query, making it impractical for a UI that needs fast response. The hybrid approach (event store + projection tables) was the right call.

### Prompt 2: Anomaly Detection Rules
> "Write an anomaly detector for a messy expense CSV with 12+ categories. Show me all the edge cases from this actual CSV screenshot."

**Outcome**: The AI wrote the base detector but initially used hardcoded exchange rates. I caught this and directed it to use Frankfurter.app's live historical API instead.

### Prompt 3: Balance Calculator
> "Implement the greedy debt simplification algorithm that tells Aisha who pays whom and how much."

**Outcome**: Good implementation. I verified the algorithm by hand-tracing the Rohan/Aisha/Priya triangle.

### Prompt 4: CSV Split Parsing
> "The actual CSV has split_with (semicolons) and split_details (values). Update the parser to handle 'Aisha 30%; Rohan 40%' format, not just 'Aisha:30' format."

**Outcome**: Required iterating — initial regex was wrong.

---

## Three Cases Where AI Was Wrong

### Case 1: Fixed Exchange Rate Instead of Live API

**What AI initially generated**:
```python
# In currency.py
HISTORICAL_RATES = {
    "USD_INR_2026-05": 83.50,
    "USD_INR_DEFAULT": 83.50,
}

def get_exchange_rate(from_currency, to_currency, expense_date):
    # Just returns hardcoded values
    key = f"{from_currency}_{to_currency}_{year_month}"
    return HISTORICAL_RATES.get(key, 83.50)
```

**What was wrong**: The user specifically said "use a live API for fixed historical rate." Hardcoded rates mean the Goa trip hotel ($540 USD on March 13) would use a generic rate, not the actual rate on that date. This was wrong because:
1. It wasn't the actual rate on March 13, 2026
2. It was literally hardcoded — not "historical" at all

**How I caught it**: The user explicitly corrected the prompt: "Use a live API for fixed historical rate." I recognized this meant the frankfurter.app approach — fetch the historical rate for the actual expense date, then freeze it.

**What I changed**:
```python
# Corrected: Live API call
async def get_historical_rate(from_currency, to_currency, expense_date):
    url = f"https://api.frankfurter.app/{expense_date}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params={"from": from_currency, "to": to_currency})
        data = response.json()
    rate = data["rates"][to_currency]
    _rate_cache[(from_currency, to_currency, str(expense_date))] = rate
    return rate
```

The rate is now: (a) historically accurate for that specific date, (b) cached in memory for the session, (c) frozen in the `CurrencyConversionApplied` event once committed.

---

### Case 2: Wrong CSV Column Names

**What AI initially generated**:
The anomaly detector and import pipeline assumed the CSV had columns: `date, description, amount, currency, paid_by, split_type, split_details`

It used `split_details` as both the participant list AND the value assignments.

**What was wrong**: The actual CSV has TWO separate columns:
- `split_with`: semicolon-separated participant names ("Aisha;Rohan;Priya;Dev")
- `split_details`: the value assignments ("Aisha 30%; Rohan 40%")

And the split_details format uses spaces, not colons ("Aisha 30%" not "Aisha:30").

**How I caught it**: Looking at the actual CSV screenshot, the participant names are in column G (split_with) and the percentage/share values are in column H (split_details). The original code would have tried to extract member names from a string like "Aisha 30%; Rohan 40%" — which would fail.

**What I changed**: Updated `_calculate_splits()` to take both `split_with` and `split_details` separately, and added `_parse_value_parts()` to handle "Name Value%" format instead of "Name:value" format.

---

### Case 3: Incomplete Anomaly Detection for Actual CSV Patterns

**What AI initially generated**: The anomaly detector had 12 categories covering the sample CSV, but missed patterns from the actual CSV:

1. `AMOUNT_FORMAT` — "1,200" with comma (row 7)
2. `NONSTANDARD_SPLIT_TYPE` — "share", "unequal" (rows 12, 22)
3. `MISSING_CURRENCY` — empty currency column (row 28)
4. `NAME_CASE_MISMATCH` — "priya", "rohan" lowercase (rows 9, 27)

**How I caught it**: Analyzing the actual CSV screenshot row-by-row revealed these patterns. The AI's initial prompt didn't account for them because I hadn't shown it the actual data yet.

**What I changed**: Added 4 new anomaly categories with their own detection rules:

```python
def check_amount_format(self, row, row_number):
    raw_amount = str(row.get("amount", "")).strip()
    if "," in raw_amount:  # Detect "1,200"
        ...

def check_nonstandard_split_type(self, row, row_number):
    split_type = str(row.get("split_type", "")).lower()
    if split_type not in CANONICAL_SPLIT_TYPES:  # Detect "share", "unequal"
        ...

def check_missing_currency(self, row, row_number):
    currency = str(row.get("currency", "")).strip()
    if not currency:  # Detect empty currency
        ...

def check_name_case_mismatch(self, row, row_number):
    paid_by = str(row.get("paid_by", "")).strip()
    # Found in system (case-insensitive) but wrong case
    if paid_by.lower() in self.known_members_lower and paid_by not in self.known_members_raw:
        ...
```

Also added `SPLIT_TYPE_ALIASES = {"share": "shares", "unequal": "exact"}` to auto-map during commit.

---

## AI Collaboration Pattern

For each feature, the workflow was:
1. **Direct the AI** with specific requirements (not "build me an app")
2. **Review the output** line by line for correctness
3. **Catch errors** (as documented above)
4. **Correct and iterate** with precise follow-up prompts

The AI is a force multiplier — it writes boilerplate in seconds. But it makes assumptions that need engineering judgment to catch. Every file in this repository has been read and understood by me.

---

## Files Substantially Modified After AI Generation

| File | Problem | My Fix |
|------|---------|--------|
| `services/currency.py` | Hardcoded rates | Frankfurter.app live API |
| `services/anomaly_detector.py` | 12 categories → 16 | Added AMOUNT_FORMAT, NONSTANDARD_SPLIT_TYPE, MISSING_CURRENCY, NAME_CASE_MISMATCH |
| `services/import_pipeline.py` | Wrong column names | Updated for split_with + split_details |
| `expenses_export.csv` | Sample data → actual data | Recreated from screenshot |
| `DECISIONS.md` | Generic decisions | Specific to this CSV's anomalies |
