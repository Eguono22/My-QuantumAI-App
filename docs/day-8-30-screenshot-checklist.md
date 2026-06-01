# Day 8-30 Screenshot Checklist

Use this checklist to manually verify the expanded 30-day Pilot experience in the UI.

## Setup

1. Start backend and frontend locally.
2. Open the app and log in.
3. Navigate to `/app/pilot`.
4. Ensure Pilot clock is started.

## Required Screenshots

1. Pilot header showing `30-Day Trust Pilot`.
2. Sidebar navigation showing `30-Day Pilot`.
3. Day 8 card visible.
4. Day 9 card visible.
5. Day 10 card visible.
6. Day 11 card visible.
7. Day 12 card visible.
8. Day 13 card visible.
9. Day 14 card visible.
10. Day 15 card visible.
11. Day 16 card visible.
12. Day 17 card visible.
13. Day 18 card visible.
14. Day 19 card visible.
15. Day 20 card visible.
16. Day 21 card visible.
17. Day 22 card visible.
18. Day 23 card visible.
19. Day 24 card visible.
20. Day 25 card visible.
21. Day 26 card visible.
22. Day 27 card visible.
23. Day 28 card visible.
24. Day 29 card visible.
25. Day 30 card visible.
26. Pilot Report textarea containing `## Day 8 Checkpoint` through `## Day 30 Checkpoint`.

## Verification Points

1. Each checkpoint card includes:
- a day/status pill
- a title
- a message
- a next action
- a metrics line

2. Status tone colors align with status:
- `PASS` -> emerald theme
- `HOLD` -> red theme
- `IN PROGRESS` -> amber theme

3. Pilot day metric supports `30` as max day.

4. Report header reads `# QuantumAI 30-Day Trust Pilot Report`.

## Optional Regression Checks

1. Day 5-7 cards still render.
2. Copy Report still works.
3. Existing gate and recommendation sections still render correctly.
