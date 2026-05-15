# Sessions 6 and 7 Outreach Pack

Use this to book and run the final trust-validation calls without extra prep work.

## Immediate Goal

Book and complete the last 2 validation sessions:

- `Session 6 candidate` for signal-review trust
- `Session 7 candidate` for paper-trade execution trust

Then log both sessions in `/app/pilot` and check whether average trust reaches `4.0+`.

## Who These Sessions Are For

### Session 6 Candidate

- Segment: `Signal reviewer`
- Goal: validate whether signal proof, invalidation framing, recent price context, and previous similar outcome now feel trustworthy enough for a tiny paper trade

### Session 7 Candidate

- Segment: `Paper trader`
- Goal: validate whether final confirmation, max loss, reward, risk/reward, and audit trail now make execution feel controlled enough to use

## Invite Message: Session 6

```text
Hey [name], I’m running one more short private validation round for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to see whether the updated signal review now feels trustworthy enough to use: why the signal passed, what would prove it wrong, recent price context, and what similar setups did before.

It takes about 30 minutes. I’ll ask you to review one signal, think out loud, inspect the final paper-trade confirmation, and tell me what still feels unclear, useful, or not worth paying for.

Would you be open to being part of this final validation round this week?
```

## Invite Message: Session 7

```text
Hey [name], I’m running one more short private validation round for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to test whether the updated paper-trade flow now feels controlled enough to use, especially the final confirmation with quantity, notional, max loss, reward, and audit trail.

It takes about 30 minutes. I’ll ask you to review one setup, inspect the paper-order confirmation, and tell me where the workflow feels safe, unclear, or not yet worth paying for.

Would you be open to being part of this final validation round this week?
```

## Follow-Up If They Reply Yes

```text
Perfect. I’m keeping this lightweight and paper-only.

I’d like to do a 30-minute session where you review one AI setup, inspect the trust and risk details, and tell me whether the flow now feels trustworthy enough to use.

Here are a few times that work for me:
- [slot 1]
- [slot 2]
- [slot 3]

If one works, I’ll send over the link and keep the session focused on feedback, not live trading.
```

## Day-Of Checklist

Before the call:

1. Open `/app/signals`.
2. Make sure the Signal Trust Panel is visible.
3. Make sure Signal Proof & Audit Trail is visible.
4. Make sure recent price context is visible.
5. Make sure previous similar signal outcome is visible.
6. Make sure the final Paper Trade Confirmation modal is ready to show.
7. Keep [`docs/final-trust-validation-sessions.md`](./final-trust-validation-sessions.md) open.
8. Keep [`docs/session-6-7-operator-answer-sheet.md`](./session-6-7-operator-answer-sheet.md) open.

During the call:

1. Use the opening script from the operator answer sheet.
2. Let the participant think out loud before you explain anything.
3. Ask all 6 questions for that session.
4. Listen for whether they would place a tiny paper trade now.
5. Listen for whether they moved from `Maybe` to `Yes` on payment.
6. Write down the exact trust blocker if they still hesitate.

After the call:

1. Log the feedback immediately in `/app/pilot`.
2. Mark the candidate `COMPLETED`.
3. Save one clear friction line and one clear value line.
4. Check the updated pilot recommendation.

## Paste-Back Template

Use this right after each session:

```text
Participant:
Candidate:
Segment:
Trust score:
Value score:
Would pay:
Friction:
Notes:
```

## Success Condition

This round is successful if:

- both sessions are completed
- both sessions are logged in `/app/pilot`
- average trust reaches `4.0+`
- average value stays `4.0+`
- at least some users move from `Maybe` to `Yes`

## If Trust Is Still Weak

Do not widen the beta yet. Build more longitudinal proof:

- repeated signal-proof history
- stronger order outcome reporting
- longer-term paper performance evidence
