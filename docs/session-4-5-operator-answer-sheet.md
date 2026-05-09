# Sessions 4 and 5 Operator Answer Sheet

Use this sheet to guide the next two validation calls. These are not real participant answers. Log feedback only after the participant gives their own scores and comments.

## Opening Script

```text
We are testing whether the new Signal Trust Panel makes an AI paper-trading signal easier to trust. Please look at the rationale, invalidation condition, confidence drivers, risk per unit, estimated notional, stop, target, and PAPER confirmation. This is paper-only, not live trading.
```

## Session 4: Signal Reviewer

Candidate: `Session 4 candidate`

Segment: `Signal reviewer`

### Questions And Strong Target Answers

1. Does the Signal Trust Panel explain why this signal appeared now?

```text
Yes, if the rationale clearly connects the signal to market conditions, model confidence, and the visible trade setup. The best version tells me why the signal exists now instead of just saying buy or sell.
```

2. Does the invalidation condition make the setup easier to trust?

```text
Yes. A clear invalidation condition makes the trade feel reviewable because I know what would prove the signal wrong before I enter.
```

3. Are the confidence drivers enough, or do you still need proof?

```text
The confidence drivers help, but I still want proof from recent price action, model history, or a short audit trail showing why this signal passed.
```

4. Would you place a tiny paper trade from this view?

```text
Yes, if the order is clearly paper-only and I can see entry, stop, target, estimated notional, and risk before submitting.
```

5. What would make this worth paying for?

```text
I would pay if it consistently saves review time, explains why signals passed or failed, tracks paper-trade outcomes, and helps me avoid emotional entries.
```

### Suggested Scoring Guide

Trust score: `4` if the panel is clear but still needs proof or audit history.

Value score: `4` if the user says it saves review time or improves discipline.

Would pay: `Maybe` unless they explicitly say they would pay for a named outcome.

Common friction to listen for: `Needs more proof, backtest context, or recent price-action comparison.`

## Session 5: Paper Trader

Candidate: `Session 5 candidate`

Segment: `Paper trader`

### Questions And Strong Target Answers

1. Does `PAPER` confirmation remove execution anxiety?

```text
Yes. Seeing PAPER clearly reduces anxiety because I know this is not risking real money while I test the workflow.
```

2. Do estimated notional and risk per unit make the trade feel controlled?

```text
Yes. Estimated notional and risk per unit make the trade easier to size and prevent me from clicking without understanding exposure.
```

3. Are entry, stop, target, and invalidation clear enough before execution?

```text
Mostly yes. I can understand the setup, but I would still like a final confirmation screen showing quantity, notional, stop, target, and max loss before submit.
```

4. Would you place a tiny Alpaca paper trade from this view?

```text
Yes, for a tiny paper trade. I would not move to live trading until the app has a stronger trade history, audit trail, and risk controls.
```

5. What would make this worth paying for?

```text
I would pay if it gives me safe paper execution, performance tracking, signal explanations, risk controls, and a clear report of what worked and what did not.
```

### Suggested Scoring Guide

Trust score: `4` if paper-only execution feels safe but the user still wants final confirmation or audit history.

Value score: `4` or `5` if the user values safer practice, tracking, and reduced execution mistakes.

Would pay: `Maybe` for cautious interest, `Yes` only if they name a concrete paid outcome.

Common friction to listen for: `Wants final pre-submit confirmation, max-loss display, and order audit trail.`

## Paste-Back Format

Send one completed block per participant:

```text
Participant:
Candidate ID:
Segment:
Trust score:
Value score:
Would pay:
Friction:
Notes:
```

## Decision After Both Sessions

If total feedback reaches at least `5`, trust is `4.0+`, value is `4.0+`, and enough users say `Yes` or strong `Maybe`, move toward expanding the paper-only beta.

If trust remains below `4.0`, build the next trust feature before inviting more users: final pre-trade confirmation, signal audit trail, or recent price-action proof.
