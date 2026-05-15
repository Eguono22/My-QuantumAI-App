# Post-Emma Validation Decision

Use this only after Emma gives real answers during the validation call. Do not make a pilot decision from the rehearsal answers in [`docs/emma-final-trust-validation-live-notes.md`](./emma-final-trust-validation-live-notes.md).

## Inputs To Collect

Log Emma's real feedback in `/app/pilot` first, then copy the updated summary here:

- Participant: `Emma`
- Session type: `Session 6` / `Session 7`
- Segment: `Signal reviewer` / `Paper trader`
- Trust score:
- Value score:
- Would pay: `Yes` / `Maybe` / `No`
- Tiny paper trade now: `Yes` / `No`
- Biggest trust blocker:
- Biggest value signal:
- Pilot average trust after logging:
- Pilot average value after logging:
- Pilot yes-rate after logging:

## Decision Gate

### Expand Paper Beta

Choose this only if all are true:

- pilot average trust is `4.0+`
- pilot average value is `4.0+`
- yes-rate is at least `40%`
- Emma would place a tiny paper trade
- the remaining blocker is not a setup, risk, or execution-safety issue

Next action:

```text
Invite the next 10 qualified paper-only beta users and keep the product scope narrow around signal review, risk confirmation, and order auditability.
```

### Build More Proof

Choose this if trust is still below `4.0`, Emma stays hesitant on tiny paper execution, or the main blocker is still proof depth.

Next action:

```text
Build repeated signal-proof history, stronger order outcome reporting, and longer-term paper performance evidence before widening the beta.
```

### Clarify Paid Value

Choose this if trust and value are strong, but `Would pay` stays mostly `Maybe`.

Next action:

```text
Test a simple Pro offer around paper-trading analytics, audit trail, and MT5 workflow support before adding more product surface.
```

## Recommended Default If Emma Matches The Rehearsal Pattern

If Emma says she would place a tiny paper trade but remains `Maybe` on payment because she wants repeated proof, choose `Build More Proof`.

The first feature to build should be a compact post-trade outcome summary:

- original signal thesis
- submitted paper order details
- accepted / filled / rejected status
- whether price respected the original invalidation point
- simple outcome label: `working`, `invalidated`, `stopped`, `target reached`, or `manual review needed`

## Rehearsal Decision Outcome

Use this as the working product direction only if Emma's real answers match the rehearsal notes.

- Decision: `Build More Proof`
- Reason: Emma is willing to place a tiny paper trade, but payment confidence is still gated by repeated proof, post-trade outcome clarity, and longer-term paper performance evidence.
- Next action: Build a compact post-trade outcome summary before expanding the paper beta.
- Do not expand live-money scope: `Yes`

## Next Build Brief

Build a compact post-trade outcome summary that appears after a paper order has enough status or price context to explain what happened.

### User Outcome

The trader should be able to answer:

- What was the original trade thesis?
- What paper order was submitted?
- Was the order accepted, filled, rejected, or still pending?
- Did price respect or violate the original invalidation point?
- Is the trade working, invalidated, stopped, target reached, or still needing manual review?

### Minimum Fields

- signal symbol
- signal direction
- original rationale
- invalidation level
- submitted quantity
- submitted notional
- max loss at stop
- latest order status
- latest fill price if available
- outcome label
- short outcome explanation

### Scope Guardrails

- Keep this paper-only.
- Do not add live-money automation.
- Do not widen the beta until real feedback confirms trust and willingness to pay.

## Final Note To Save

```text
Decision: Build More Proof
Reason: Emma is willing to place a tiny paper trade, but payment confidence still depends on repeated proof and clearer post-trade outcomes.
Next action: Build a compact post-trade outcome summary.
Do not expand live-money scope: Yes
```
