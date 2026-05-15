# Current Beta Candidates

Prepared from the current shortlist so they can be added to `/app/pilot` quickly.

## Assumed Mapping

These are working assumptions based on the first-3 outreach structure:

| Candidate | Segment | Source | Why they are useful | Initial Status |
|---|---|---|---|---|
| Emmanuel | MT5 trader | Direct outreach | Useful for trust and execution feedback in an MT5-style workflow | COMPLETED |
| Omojesus | Alpaca paper trader | Direct outreach | Useful for testing broker-backed paper workflow and risk review | COMPLETED |
| Joshua | Signal reviewer | Direct outreach | Useful for comparing AI rationale against existing signal-review habits | COMPLETED |
| Session 4 candidate | Signal reviewer | Trust panel validation | Validate whether the Signal Trust Panel raises trust above 4.0 | COMPLETED |
| Session 5 candidate | Paper trader | Trust panel validation | Validate whether paper-only risk and execution clarity raises trade confidence | COMPLETED |
| Session 6 candidate | Signal reviewer | Final trust validation | Validate whether signal proof, price context, and previous similar outcome now feel trustworthy enough for a tiny paper trade | READY |
| Session 7 candidate | Paper trader | Final trust validation | Validate whether final confirmation, explicit max loss, and order audit trail now reduce execution anxiety | READY |

## Ready-To-Add Entries

Use these values when adding them in `/app/pilot`:

### 1. Emmanuel

- Candidate: `Emmanuel`
- Segment: `MT5 trader`
- Source: `Direct outreach`
- Notes: `Booked for first beta session. Focus on trust in setup, signal review, risk visibility, and paper-trade confidence.`
- Status: `COMPLETED`

### 2. Omojesus

- Candidate: `Omojesus`
- Segment: `Alpaca paper trader`
- Source: `Direct outreach`
- Notes: `Shortlisted for first beta batch. Best used to test broker-backed paper workflow, risk visibility, and trade confidence.`
- Status: `COMPLETED`

### 3. Joshua

- Candidate: `Joshua`
- Segment: `Signal reviewer`
- Source: `Direct outreach`
- Notes: `Shortlisted for first beta batch. Best used to compare AI rationale and trust against current manual review habits.`
- Status: `COMPLETED`

### 4. Session 4 candidate

- Candidate: `Session 4 candidate`
- Segment: `Signal reviewer`
- Source: `Trust panel validation`
- Notes: `Use the updated Signal Trust Panel. Focus on whether rationale, invalidation, confidence drivers, and risk-per-unit are enough to trust a tiny paper trade.`
- Status: `COMPLETED`

### 5. Session 5 candidate

- Candidate: `Session 5 candidate`
- Segment: `Paper trader`
- Source: `Trust panel validation`
- Notes: `Use the updated Signal Trust Panel. Focus on whether paper-only confirmation, estimated notional, max risk, stop, and target are clear enough before execution.`
- Status: `COMPLETED`

### 6. Session 6 candidate

- Candidate: `Session 6 candidate`
- Segment: `Signal reviewer`
- Source: `Final trust validation`
- Notes: `Use the final trust layer. Focus on whether why-this-passed proof, what-proves-it-wrong framing, recent price context, and previous similar outcome are enough to trust a tiny paper trade.`
- Status: `READY`

### 7. Session 7 candidate

- Candidate: `Session 7 candidate`
- Segment: `Paper trader`
- Source: `Final trust validation`
- Notes: `Use the final Paper Trade Confirmation. Focus on whether max loss, potential reward, risk/reward, and order audit trail make execution feel controlled enough for a tiny paper trade.`
- Status: `READY`

## Invite Messages

### Emmanuel

```text
Hey Emmanuel, I’m running a short private beta for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to watch how you review signals, inspect risk, and decide whether an AI trading copilot is trustworthy enough to use.

It takes about 30 minutes. I’ll ask you to use the app, think out loud, and tell me what feels unclear, useful, or not worth paying for.

Would you be open to being one of the first 5 beta users this week?
```

### Omojesus

```text
Hey Omojesus, I’m running a short private beta for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to watch how you review signals, inspect risk, and decide whether an AI trading copilot is trustworthy enough to use.

It takes about 30 minutes. I’ll ask you to use the app, think out loud, and tell me what feels unclear, useful, or not worth paying for.

Would you be open to being one of the first 5 beta users this week?
```

### Joshua

```text
Hey Joshua, I’m running a short private beta for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to watch how you review signals, inspect risk, and decide whether an AI trading copilot is trustworthy enough to use.

It takes about 30 minutes. I’ll ask you to use the app, think out loud, and tell me what feels unclear, useful, or not worth paying for.

Would you be open to being one of the first 5 beta users this week?
```

### Session 6 candidate

```text
Hey [name], I’m running one more short private validation round for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to see whether the updated signal review now feels trustworthy enough to use: why the signal passed, what would prove it wrong, recent price context, and what similar setups did before.

It takes about 30 minutes. I’ll ask you to review one signal, think out loud, inspect the final paper-trade confirmation, and tell me what still feels unclear, useful, or not worth paying for.

Would you be open to being part of this final validation round this week?
```

### Session 7 candidate

```text
Hey [name], I’m running one more short private validation round for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to test whether the updated paper-trade flow now feels controlled enough to use, especially the final confirmation with quantity, notional, max loss, reward, and audit trail.

It takes about 30 minutes. I’ll ask you to review one setup, inspect the paper-order confirmation, and tell me where the workflow feels safe, unclear, or not yet worth paying for.

Would you be open to being part of this final validation round this week?
```

## Next Move

1. Run sessions 6 and 7 using [`docs/final-trust-validation-sessions.md`](./final-trust-validation-sessions.md).
2. Use [`docs/session-6-7-operator-answer-sheet.md`](./session-6-7-operator-answer-sheet.md) during the calls.
3. Use [`docs/session-6-7-outreach-pack.md`](./session-6-7-outreach-pack.md) to send invites, schedule, and run the calls with less prep.
4. If Emma is running one of the final validation sessions, use [`docs/emma-final-trust-validation-live-notes.md`](./emma-final-trust-validation-live-notes.md) during the call.
5. Log both sessions in `/app/pilot` and check whether average trust reaches `4.0+`.
