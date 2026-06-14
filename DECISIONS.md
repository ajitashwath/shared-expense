# DECISIONS.md
Each decision, the alternatives considered, and the rationale.

---

## D1: Event Sourcing vs. Traditional CRUD

**Decision**: Hybrid Event Sourcing — append-only `event_store` table, with derived projection tables for read performance.

**Alternatives**:
- **Pure CRUD**: Update rows in place. Simple, fast. But loses history — cannot explain "why is Rohan's balance ₹2,300?"
- **Pure Event Sourcing**: No projection tables. Rebuild state from events every query. Correct but slow for dashboards.
- **Hybrid**: Append events for writes, maintain projection tables for fast reads. Projections can be rebuilt from events at any time.

**Why**: The assignment explicitly requires explainability ("I want to see exactly which expenses make up ₹2,300"). This requires an audit trail. Event sourcing is the only architecture that guarantees this without storing computed intermediates.

---

## D2: Prisma Client Python vs. SQLAlchemy

**Decision**: Use `prisma-client-py` — the Python port of Prisma using the same `schema.prisma` file.

**Alternatives**:
- **SQLAlchemy + Alembic** (industry standard): Battle-tested, async support, mature migration tooling. More verbose but extremely reliable.
- **prisma-client-py**: Same `schema.prisma` DX as the TypeScript Prisma. Newer, community-maintained.
- **Raw asyncpg**: Maximum performance, minimum abstraction.

**Why**: The assignment specifies "Prisma" as the ORM. `prisma-client-py` is the closest Python equivalent that honors that choice. If this were a production system with 3+ engineers, SQLAlchemy would be preferable.

**Risk**: `prisma-client-py` is community-maintained and may lag behind the Prisma TypeScript client in features.

---

## D3: Currency Conversion — Fixed Rate vs. Live API

**Decision**: Use Frankfurter.app live historical API to fetch exchange rates per expense date.

**Alternatives**:
- **Fixed hardcoded rate** (e.g., 83.50): Simple. But "fixed" means every USD expense uses the same rate regardless of date. The Goa trip in March 2026 would use a June 2026 rate — wrong.
- **Open Exchange Rates** (paid): Accurate but requires API key and payment.
- **Frankfurter.app**: Free, no API key, supports historical rates by date. Returns rate for the exact expense date.

**Key constraint**: Once an expense is imported, the rate used is FROZEN in the `CurrencyConversionApplied` event. Even if Frankfurter rates change tomorrow, historical expenses are never recalculated. This is Priya's requirement: "The sheet pretends a dollar is a rupee. That can't be right" — so we convert correctly at import time, and that rate is permanent.

---

## D4: Anomaly Resolution Policy — Never Auto-Delete

**Decision**: The system NEVER auto-deletes or auto-modifies any CSV row. Every change requires explicit user decision.

**Alternatives**:
- **Auto-reject clear duplicates**: Faster import, but violates Meera's requirement ("I want to approve anything the app deletes or changes").
- **User approval required for all anomalies**: Slower, but fully auditable. Every decision becomes an `AnomalyResolved` event.

**Implementation**: 
- Raw CSV rows stored in `raw_import_rows` table permanently (status: PENDING → IMPORTED/REJECTED, never deleted)
- Each anomaly decision generates `AnomalyResolved` event with user ID + timestamp
- Import report shows all decisions made

---

## D5: Membership Policy

**Decision**: Default membership policy is STRICT. Groups can switch to INCLUSIVE.

**STRICT** (default): Members outside their active period are excluded from expense splits. A March expense cannot include Sam (joined April 15).

**INCLUSIVE**: Members can be included outside their active period if a user explicitly approves the `MEMBER_NOT_ACTIVE` anomaly.

**Why**: Sam's requirement is explicit: "I moved in mid-April. Why would March electricity affect my balance?" STRICT is the safe default. INCLUSIVE is the escape hatch when the group decides they want to share costs differently.

---

## D6: Split Types

**Decision**: Support 5 split types: EQUAL, PERCENTAGE, EXACT, SHARES, CUSTOM.

**From actual CSV**:
- `equal`: Most expenses — divide evenly (rows 2–11, etc.)
- `percentage`: Pizza Friday, Weekend getaway (rows 15, 32)
- `share`: Scooter rental with different bike sizes (row 22)
- `unequal`/`exact`: Birthday dinner where Aisha is not charged (row 12)
- Missing split_type (row 14): Settlement pattern

**Non-standard types** from CSV:
- `"share"` → mapped to `"shares"` (canonical)
- `"unequal"` → mapped to `"exact"` (treated as exact amounts)
Both are flagged as `NONSTANDARD_SPLIT_TYPE` anomalies but auto-aliased if user approves.

---

## D7: Amount Rounding

**Decision**: Round all amounts to 2 decimal places. Distribute remainder to the first participant.

**Why**: Division isn't always clean (e.g., ₹1000 / 3 = ₹333.33...). The sum must equal the total expense. Strategy: floor divide, give remainder to first person.

**Edge case from CSV**: Row 10 has amount `899.995` — three decimal places. We round to `900.00` at import time. This is documented as-is.

---

## D8: Zero-Amount Expense Handling

**Decision**: Zero-amount expenses are flagged as `ZERO_AMOUNT` anomalies (MEDIUM severity) and require user action.

**From CSV**: Row 31 — "Dinner order, ₹0, counted twice earlier - fixing later"

**Options**:
- **Auto-reject**: Simpler. But violates Meera's policy (never auto-delete).
- **Import as-is**: Clutters the expense list with meaningless rows.
- **Flag for review**: User sees the note "counted twice earlier - fixing later" and can reject it.

---

## D9: JWT Auth — Self-Managed vs. NextAuth

**Decision**: Self-managed JWT using `python-jose` + `passlib[bcrypt]` on the FastAPI backend.

**Alternatives**:
- **NextAuth.js**: Great for OAuth providers (Google, GitHub). Overkill for a flatmate app.
- **Self-managed JWT**: Simple email/password auth. Tokens expire in 24 hours. Stored in localStorage.

**Role system**: ADMIN (can import, manage members), MEMBER (can add expenses), VIEWER (read-only).

---

## D10: Balance Calculation Algorithm

**Decision**: Greedy debt simplification — minimize the number of transactions needed to settle all debts.

**Algorithm**:
1. Compute net balance for each person (positive = owed, negative = owes)
2. Sort creditors (descending) and debtors (descending)
3. Greedily pair largest debtor with largest creditor
4. Generate minimum set of transfers

**Why**: Aisha wants "one number per person — who pays whom, how much, done." Without simplification, you'd need N×(N-1) pairs. With greedy simplification, you get at most N-1 transfers.

---

## D11: PostgreSQL as Event Store

**Decision**: Use PostgreSQL for BOTH the event store and projections.

**Alternatives**:
- **EventStoreDB**: Purpose-built event store. Excellent. But requires additional infrastructure.
- **Redis Streams**: Fast. But adds complexity for a 2-day assignment.
- **PostgreSQL**: One database for everything. Simpler ops. The `event_store` table is append-only by convention (no UPDATE/DELETE operations on it).

**Guarantee**: Application code never updates or deletes from `event_store`. Only `INSERT` is allowed.

---

## D12: How to Handle "Dev's friend Kabir" (Row 23)

**Row 23**: Parasailing, Dev, $150 USD. Notes: "Kabir joined for the day". Split with: "Aisha;Rohan;Priya;Dev;Dev's friend Kabir".

**Decision**: "Dev's friend Kabir" is explicitly included in the `split_with` column but is not a registered group member. The system correctly triggers the `UNKNOWN_MEMBER` anomaly (HIGH severity). The user must decide how to handle this:
- **Reject**: Discard the row.
- **Override/Exclude**: Exclude the unregistered name from the split and divide the amount among the active group members.

**Policy documented in SCOPE.md**: Anomaly detection correctly validates and flags unregistered names found inside the `split_with` or `split_details` columns.


---

## D13: "Priya S" in Row 11

**Row 11**: paid_by = "Priya S" — not the same as "Priya" in the system.

**Decision**: Trigger `UNKNOWN_MEMBER` anomaly (HIGH severity). User must map "Priya S" to the known member "Priya" or reject the row.

**Why not auto-map**: "Priya S" could be a different Priya who split one expense. The system cannot make this decision safely.

---

## D14: Conflicting Duplicates Detection Algorithm

**Rows 24 & 25**: "Dinner at Thalassa" (₹2400, Aisha) and "Thalassa dinner" (₹2450, Rohan) — same day, similar description, different amounts and payers.

**Detection**: Word overlap Jaccard similarity ≥ 0.5 on the same date = `CONFLICTING_DUPLICATES` (HIGH severity).

**Resolution options**: Keep Both / Keep One / Merge (take average or choose one amount). The notes on Row 25 say "Aisha also logged this I think hers is wrong" — so the correct action would be Discard Row 25 (Rohan's entry) after user confirms.
