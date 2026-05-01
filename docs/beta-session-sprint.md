# QuantumAI 5-Session Beta Sprint

Use this sprint to get the first real evidence from traders without expanding the product scope.

## Goal

Run 5 private beta sessions through `/app/pilot` and decide whether the next product move is:

- expand the pilot
- fix trust
- sharpen value
- clarify pricing

## Who To Invite

Prioritize traders who already review signals or paper trade regularly:

- MT5 demo or prop-style traders
- Alpaca paper traders
- crypto traders who already use chart alerts
- signal reviewers who compare multiple tools

Avoid inviting people who are only curious about AI and do not already have a trading workflow.

## Outreach Message

```text
Hey [name], I’m running a short private beta for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to watch how you review signals, inspect risk, and decide whether an AI trading copilot is trustworthy enough to use.

It takes about 30 minutes. I’ll ask you to use the app, think out loud, and tell me what feels unclear, useful, or not worth paying for.

Would you be open to being one of the first 5 beta users this week?
```

## Session Flow

1. Add the person to `/app/pilot` as a beta candidate.
2. Move them to `SCHEDULED` when a time is booked.
3. During the call, follow the Beta Session Kit in `/app/pilot`.
4. Save feedback linked to their candidate record.
5. Confirm the candidate automatically moves to `COMPLETED`.
6. Copy the Pilot Report after every session batch.

## Interview Prompts

Ask these in order:

1. What do you currently use to decide whether a signal is worth acting on?
2. What would make you distrust this AI signal?
3. What information would you need before placing even a tiny paper trade?
4. Where did you hesitate while using the workflow?
5. What would make this worth paying for?

## Pass Criteria

After 5 sessions, the pilot is promising if:

- average trust score is 4.0 or higher
- average value score is 4.0 or higher
- at least 40% say they would pay
- at least 3 users complete the core paper-trading review loop
- the same blocker does not appear in most sessions

## Decision Rule

Use the recommendation panel in `/app/pilot` as the source of truth:

- `Expand Pilot`: invite 10 more qualified beta users
- `Fix Trust`: improve rationale, audit trail, and risk explanations
- `Sharpen Value`: make the daily workflow faster and more obviously useful
- `Clarify Pricing`: test a simple Pro offer before adding features
- `Collect Feedback`: keep interviewing before making roadmap decisions
