# Emma Final Trust Validation Live Notes

Use this during the call, then copy the final summary into `/app/pilot`.

These answers are a rehearsal draft only. Do not log them as real pilot feedback until Emma gives her own answers during the call.

## Session Snapshot

- Candidate: `Emma`
- Status: `SCHEDULED`
- Goal: `Find out whether the final trust layer is now strong enough for a tiny paper trade and clearer willingness to pay.`

## Choose The Session Type

- Session type: `Session 6` / `Session 7`
- Segment: `Signal reviewer` / `Paper trader`

## Time Slots

- Session date:
- Start time:
- End time:
- Call link:

## Before The Call

1. Open `/app/signals`.
2. Keep the Signal Trust Panel visible.
3. Keep Signal Proof & Audit Trail visible.
4. Keep recent price context visible.
5. Keep previous similar signal outcome visible.
6. Make sure the final Paper Trade Confirmation modal is ready to show.
7. Keep [`docs/final-trust-validation-sessions.md`](./final-trust-validation-sessions.md) open.
8. Keep [`docs/session-6-7-operator-answer-sheet.md`](./session-6-7-operator-answer-sheet.md) open.

## Opening Script

```text
We are testing whether the new final trust layer makes a paper trade feel reviewable and safe enough to use. Please look at why the signal passed, what would prove it wrong, the recent price context, previous similar outcome, and the final Paper Trade Confirmation with max loss before submit. This is paper-only, not live trading.
```

## Session 6 Flow: Signal Reviewer

### 0-5 min: Why The Signal Passed

Ask:

```text
Does the updated trust panel now explain why this signal passed?
```

Notes:

- What she understood immediately:
  - The signal is easier to evaluate because the panel connects the trade direction to concrete proof: why it passed, what would invalidate it, and how the setup relates to recent price action.
- What still felt vague:
  - She still wants to know how often similar setups have worked across a larger sample, not just one previous outcome.
- Reaction to rationale:
  - Positive. The rationale feels more like a review checklist than a black-box prediction.

### 5-10 min: What Proves It Wrong

Ask:

```text
Does `What Proves It Wrong` make the setup easier to review?
```

Notes:

- Reaction to invalidation framing:
  - Strong. `What Proves It Wrong` makes the trade easier to reject quickly if price breaks the expected setup.
- Did it feel clearer than a generic stop?
  - Yes. It explains the reason for the stop, not just the stop level.
- Anything still unsafe or unclear:
  - She would still want a short warning if the stop is unusually wide or if recent volatility makes the risk estimate less reliable.

### 10-15 min: Recent Price Context

Ask:

```text
Does the recent price context make the signal feel more believable?
```

Notes:

- Did it increase trust?
  - Yes. Recent price context helps her compare the AI signal against the visible market instead of trusting the model alone.
- What extra context would she still want?
  - A small history of the last 10 similar signals, including win rate, average move, and common failure reason.
- Any sign the signal still feels like a black box:
  - Less than before, but the model confidence score still needs evidence behind it to feel fully trusted.

### 15-20 min: Previous Similar Outcome

Ask:

```text
Does the previous similar outcome help, or do you still need more proof?
```

Notes:

- Was the similar outcome useful?
  - Yes. It helps because it shows the system has seen comparable setups before.
- Did she ask for a longer history?
  - Yes. One similar outcome is useful, but not enough to feel repeatable.
- Biggest remaining proof gap:
  - Longer-term signal history with simple outcomes: won, lost, blocked, or invalidated.

### 20-25 min: Final Confirmation

Ask:

```text
Would you place a tiny paper trade after seeing the final confirmation modal?
```

Notes:

- Yes / No / Hesitant:
  - Yes, for a tiny paper trade.
- Why:
  - The final confirmation forces a pause before execution and makes max loss, target, and invalidation visible before submit.
- Biggest blocker before a tiny paper trade:
  - She wants more evidence that the signal type has behaved well over multiple prior examples.

### 25-30 min: Value + Pricing

Ask:

```text
What would make this worth paying for now?
```

Notes:

- Biggest value moment:
  - Seeing rationale, invalidation, recent context, and final risk confirmation in one workflow.
- Biggest missing piece:
  - A larger track record of similar signals and paper-trade outcomes.
- Would pay:
  - Maybe, leaning Yes if repeated signal history is added.
- Why:
  - The workflow saves review time and improves discipline, but she wants proof that it keeps helping over time.

## Session 7 Flow: Paper Trader

### 0-5 min: Execution Anxiety

Ask:

```text
Does the final Paper Trade Confirmation reduce execution anxiety?
```

Notes:

- Reaction to the confirmation:
  - Positive. It slows the trade down in a useful way and makes the order feel intentional.
- Did it make the order feel more intentional?
  - Yes. Quantity, notional, max loss, reward, and invalidation make the trade feel controlled before submit.
- Any hesitation left before submit:
  - She still wants to see whether the app has blocked bad trades before and how often orders are rejected or adjusted.

### 5-10 min: Max Loss At Stop

Ask:

```text
Is `Max Loss At Stop` clear enough to control the trade before submit?
```

Notes:

- Did she understand max loss quickly?
  - Yes. `Max Loss At Stop` is the clearest risk number in the flow.
- Did it help her control the trade?
  - Yes. It gives a concrete worst-case paper loss before clicking submit.
- Any risk number still confusing:
  - Risk/reward is clear, but she would like the app to flag when the max loss is high relative to account size.

### 10-15 min: Reward And Risk/Reward

Ask:

```text
Do potential reward and risk/reward make the setup easier to size?
```

Notes:

- Did reward framing help?
  - Yes. Potential reward makes the setup easier to compare against the risk.
- Did risk/reward help sizing?
  - Yes. It helps her decide whether the trade is worth taking at all.
- Any remaining sizing confusion:
  - She wants a suggested smaller size when risk/reward is acceptable but max loss feels too large.

### 15-20 min: Audit Trail

Ask:

```text
Does the audit trail make the workflow feel more accountable after submit?
```

Notes:

- Reaction to accepted / pending / filled / rejected states:
  - Positive. Those states make the order lifecycle feel trackable.
- Did the workflow feel more trackable?
  - Yes. The audit trail makes it easier to understand what happened after submit.
- What reporting still feels missing:
  - A simple post-trade outcome summary showing whether the trade respected the original thesis.

### 20-25 min: Tiny Paper Trade

Ask:

```text
Would you place a tiny Alpaca paper trade from this flow?
```

Notes:

- Yes / No / Hesitant:
  - Yes, for a tiny Alpaca paper trade.
- Why:
  - The confirmation and audit trail make the execution feel controlled enough for paper testing.
- Biggest blocker before a tiny paper trade:
  - She wants stronger post-trade reporting and repeated paper performance evidence.

### 25-30 min: Value + Pricing

Ask:

```text
What would make this worth paying for now?
```

Notes:

- Biggest value moment:
  - Seeing max loss and audit trail before and after the paper trade.
- Biggest missing piece:
  - Longer-term paper performance evidence and post-trade outcome summaries.
- Would pay:
  - Maybe, with a path to Yes if the app proves repeated paper-trade value over time.
- Why:
  - It makes paper execution feel safer and more disciplined, but the paid value depends on repeated outcomes.

## End-of-Call Decision

Fill these before the session ends:

- Trust score `1-5`:
  - `4`
- Value score `1-5`:
  - `4`
- Would pay: `Yes` / `Maybe` / `No`
  - `Maybe`
- Tiny paper trade now: `Yes` / `No`
  - `Yes`
- Biggest trust blocker:
  - Needs more repeated signal history, paper outcome reporting, and evidence that the system keeps helping over time.
- Biggest value signal:
  - The final confirmation and audit trail make the paper-trading workflow feel controlled and accountable.
- One-line session summary:
  - Emma would place a tiny paper trade from the updated flow, but payment confidence still depends on repeated proof and clearer post-trade outcomes.

## Ready-To-Save Pilot Feedback

Copy this into `/app/pilot` after the call:

- Participant: `Emma`
- Segment:
  - `Signal reviewer` or `Paper trader`
- Trust score:
  - `4`
- Value score:
  - `4`
- Would pay:
  - `Maybe`
- Friction:
  - Wants more repeated signal history, stronger order outcome reporting, and longer-term paper performance evidence.
- Notes:
  - Emma understood the updated trust layer and said the final confirmation makes tiny paper execution feel controlled. The main remaining gap is longitudinal proof: more similar-signal history, post-trade outcome summaries, and evidence that the system improves decisions over time.

## Decision Rule

- If average trust reaches `4.0+`, average value stays `4.0+`, and some `Maybe` responses become `Yes`, move toward expanding the paper-only beta.
- If trust stays below `4.0`, keep the product narrow and build more longitudinal proof.
