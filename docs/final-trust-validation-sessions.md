# Final Trust Validation Sessions

Use this for sessions 6 and 7 after adding the final paper-trade confirmation, max-loss display, recent price context, and order audit trail.

## Goal

Find out whether the new trust layer fixes the remaining blocker from the first 5 pilot sessions:

`Users see value, but they still need stronger proof before trusting the signal deeply or paying confidently.`

## What To Show

Open `/app/signals` and keep these parts visible:

- Signal Trust Panel
- Signal Proof & Audit Trail
- recent price context
- previous similar signal outcome
- final Paper Trade Confirmation modal

## Session 6: Signal Reviewer

Candidate label: `Session 6 candidate`

Segment: `Signal reviewer`

### Questions

1. Does the updated trust panel now explain why this signal passed?
2. Does `What Proves It Wrong` make the setup easier to review?
3. Does the recent price context make the signal feel more believable?
4. Does the previous similar outcome help, or do you still need more proof?
5. Would you place a tiny paper trade after seeing the final confirmation modal?
6. What would make this worth paying for now?

### Example Answer Pattern

Use this only as a guide for what to listen for, not as fake feedback:

```text
This is much easier to trust because I can see why the signal passed, what would prove it wrong, and what similar setups did before. The final confirmation makes it feel safer because max loss and reward are explicit before submit. I would still want repeated history over time, but this is strong enough for a tiny paper trade.
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

## Session 7: Paper Trader

Candidate label: `Session 7 candidate`

Segment: `Paper trader`

### Questions

1. Does the final Paper Trade Confirmation reduce execution anxiety?
2. Is `Max Loss At Stop` clear enough to control the trade before submit?
3. Do potential reward and risk/reward make the setup easier to size?
4. Does the audit trail make the workflow feel more accountable after submit?
5. Would you place a tiny Alpaca paper trade from this flow?
6. What would make this worth paying for now?

### Example Answer Pattern

Use this only as a guide for what to listen for, not as fake feedback:

```text
The final confirmation is what I needed. Seeing quantity, notional, max loss, target, and the reason the trade would be wrong makes it feel controlled. The audit trail also helps because I can see whether the system accepts, fills, blocks, or rejects trades. I would still stay paper-only, but this is much closer to something I would pay for.
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

## Decision Rule After Session 7

If average trust reaches `4.0+`, average value stays `4.0+`, and at least some users move from `Maybe` to `Yes`, move toward expanding the paper-only beta.

If trust is still below `4.0`, keep improving:

- repeated signal-proof history
- stronger order outcome reporting
- longer-term paper performance evidence
