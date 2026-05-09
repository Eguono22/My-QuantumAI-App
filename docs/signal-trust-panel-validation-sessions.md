# Signal Trust Panel Validation Sessions

Use this for sessions 4 and 5 after adding the Signal Trust Panel.

## Goal

Find out whether the new panel fixes the main blocker from the first 3 pilot sessions:

`Users see value, but trust needs clearer rationale, invalidation, risk, and paper-only confirmation.`

## What To Show

Open `/app/signals` and pick one actionable signal. Keep the Signal Trust Panel visible while asking the questions.

## Session 4: Signal Reviewer

Candidate label: `Session 4 candidate`

Segment: `Signal reviewer`

### Questions

1. Does the Signal Trust Panel explain why this signal appeared now?
2. Does the invalidation condition make the setup easier to trust?
3. Are the confidence drivers enough, or do you still need proof?
4. Would you place a tiny paper trade from this view?
5. What would make this worth paying for?

### Example Answer Pattern

Use this only as a guide for what to listen for, not as fake feedback:

```text
The panel makes the signal easier to review because I can see the rationale, invalidation level, vote mix, and risk per unit in one place. I would still want a short comparison against recent price action or trend context before fully trusting it. I would be willing to paper trade a tiny size if the stop and target are visible and the order is clearly paper-only.
```

### Feedback Template

```text
Participant: [real name]
Segment: Signal reviewer
Trust score:
Value score:
Would pay:
Friction:
Notes:
```

## Session 5: Paper Trader

Candidate label: `Session 5 candidate`

Segment: `Paper trader`

### Questions

1. Does `PAPER` confirmation remove execution anxiety?
2. Do estimated notional and risk per unit make the trade feel controlled?
3. Are entry, stop, target, and invalidation clear enough before execution?
4. Would you place a tiny Alpaca paper trade from this view?
5. What would make this worth paying for?

### Example Answer Pattern

Use this only as a guide for what to listen for, not as fake feedback:

```text
The paper-only label and risk fields make the workflow feel safer. I would still want a final pre-submit confirmation showing quantity, notional, and max loss before the order is sent. If the app tracks results and shows why trades were accepted or blocked, it could be worth paying for.
```

### Feedback Template

```text
Participant: [real name]
Segment: Paper trader
Trust score:
Value score:
Would pay:
Friction:
Notes:
```

## Decision Rule After Session 5

If total feedback is at least 5 and average trust is `4.0+`, the pilot can move toward `Expand Pilot`.

If average trust is still below `4.0`, keep improving:

- rationale depth
- invalidation clarity
- final pre-trade confirmation
- order audit trail
