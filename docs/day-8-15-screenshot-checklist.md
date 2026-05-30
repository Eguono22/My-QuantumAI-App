# Day 8-15 Screenshot Checklist

Use this checklist to manually verify the new Day 8-15 Pilot experience in the UI.

## Setup

1. Start backend and frontend locally.
2. Open the app and log in.
3. Navigate to `/app/pilot`.
4. Ensure Pilot clock is started.

## Required Screenshots

1. Pilot header showing `15-Day Trust Pilot`.
2. Sidebar navigation showing `15-Day Pilot`.
3. Day 8 card visible.
4. Day 9 card visible.
5. Day 10 card visible.
6. Day 11 card visible.
7. Day 12 card visible.
8. Day 13 card visible.
9. Day 14 card visible.
10. Day 15 card visible.
11. Pilot Report textarea containing `## Day 8 Checkpoint` through `## Day 15 Checkpoint`.

## Verification Points

1. Each Day 8-15 card includes:
- a day/status pill
- a title
- a message
- a next action
- metrics line

2. Status tone colors align with status:
- `PASS` -> emerald theme
- `HOLD` -> red theme
- `IN PROGRESS` -> amber theme

3. Pilot day metric supports `15` as max day.

4. Report header reads `# QuantumAI 15-Day Trust Pilot Report`.

## Optional Regression Checks

1. Day 5-7 cards still render.
2. Copy Report still works.
3. Existing gate and recommendation sections still render correctly.
