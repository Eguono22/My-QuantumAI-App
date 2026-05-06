# QuantumAI First Beta Outreach Pack

Use this right after the pilot dry run passes.

## Immediate Goal

Book the first 3 qualified beta sessions before doing any more product work.

## First 3 Candidate Types

Start with one from each group:

1. `MT5 trader`
   Already uses MT5 demo or prop-style evaluation accounts.
2. `Alpaca paper trader`
   Already tests ideas in a broker-backed paper environment.
3. `Signal reviewer`
   Already compares alerts, discretionary setups, or multiple tools before acting.

## Who To Avoid First

Skip these for the first batch:

- people who are only curious about AI
- people who do not already have a trading workflow
- people who want live-money automation immediately

## Invite Script

```text
Hey [name], I’m running a short private beta for QuantumAI, an AI-assisted paper-trading workflow.

I’m not asking you to trade real money. I want to watch how you review signals, inspect risk, and decide whether an AI trading copilot is trustworthy enough to use.

It takes about 30 minutes. I’ll ask you to use the app, think out loud, and tell me what feels unclear, useful, or not worth paying for.

Would you be open to being one of the first 5 beta users this week?
```

## Follow-Up If They Reply Yes

```text
Perfect. I’m keeping this lightweight.

I’d like to do a 30-minute session where you walk through your normal signal-review process, inspect one AI-generated setup, check risk controls, and tell me where the workflow feels useful or untrustworthy.

Here are a few times that work for me:
- [slot 1]
- [slot 2]
- [slot 3]

If one works, I’ll send over the link and keep it paper-trading only.
```

## Candidate Tracker

Fill these into `/app/pilot` as soon as you have names.

| Candidate | Segment | Source | Why they are useful | Status |
|---|---|---|---|---|
| Candidate 1 | MT5 trader | | Already reviews setups in MT5 | INVITED |
| Candidate 2 | Alpaca paper trader | | Already paper trades in a broker workflow | INVITED |
| Candidate 3 | Signal reviewer | | Can compare trust and value against existing tools | INVITED |

## Session Checklist

Use the same structure every time:

1. Ask how they currently decide whether a signal is worth acting on.
2. Have them inspect setup or connection flow without taking over.
3. Have them review one AI signal and explain what they trust or distrust.
4. Have them inspect the visible risk controls before any paper trade.
5. Ask what would make this worth paying for.
6. Save feedback in `/app/pilot` before ending the session.

## After Session 1

Write down only the highest-signal outcome:

- biggest trust blocker
- biggest moment of value
- whether they would pay: `Yes`, `Maybe`, or `No`
- whether they completed the core review loop

## Success For This Week

This week is a win if:

- 3 sessions get booked
- at least 1 session gets completed
- every completed session ends with feedback saved in `/app/pilot`

## Important Rule

Do not expand the roadmap between sessions unless the same trust blocker appears more than once.
