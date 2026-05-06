# QuantumAI Pilot Dry Run Checklist

Use this once yourself before inviting the first real beta user.

## Goal

Confirm the full `/app/pilot` workflow works end to end:

1. sign in
2. open `/app/pilot`
3. add a candidate
4. move the candidate to `SCHEDULED`
5. save one feedback entry linked to that candidate
6. confirm the candidate moves to `COMPLETED`
7. copy the pilot report

## Before You Start

- start the backend:
  ```powershell
  .\scripts\start_backend_local.ps1 -Port 8011
  ```
- start the frontend in a second terminal:
  ```powershell
  .\scripts\start_frontend_local.ps1 -Port 3000 -BackendPort 8011
  ```
- wait for:
  - backend shows `Uvicorn running on http://127.0.0.1:8011`
  - frontend shows `Compiled successfully!`

## Dry Run Steps

1. Open `http://localhost:3000`.
2. Register a fresh local account or sign in with an existing test account.
3. Open `http://localhost:3000/app/pilot`.
4. Click `Start Pilot Clock`.
5. Check the top summary cards:
   - `Pilot Day` should stop showing `Not started`
   - `Trust Gates` should render without an error banner
   - `Beta Pipeline` should load even if it is `0`
6. In `Beta Candidate Pipeline`, add one candidate with:
   - name: `Pilot Dry Run`
   - segment: any relevant segment
   - source: `Local self-test`
   - notes: `Validating pilot workflow before first beta session`
7. Confirm the candidate appears in the list with status `INVITED`.
8. Click `SCHEDULED` for that candidate.
9. Confirm the candidate status updates without a page refresh.
10. In `Beta Feedback`, create one entry linked to that candidate.
11. Use realistic values:
    - trust score: `3` or `4`
    - value score: `3` or `4`
    - would pay: `Maybe`
    - friction: one real hesitation you had during the dry run
12. Save the feedback entry.
13. Confirm:
    - the feedback entry appears in the list
    - the candidate moves to `COMPLETED`
    - the recommendation panel updates
    - the pilot report includes the new totals
14. Click `Copy Report` and paste the result somewhere temporary to verify clipboard output.

## Expected Result

The dry run passes if all of these are true:

- no red error banner appears on `/app/pilot`
- one candidate can be created
- candidate status can move from `INVITED` to `SCHEDULED`
- one feedback entry can be saved
- linked feedback moves the candidate to `COMPLETED`
- the report text updates and can be copied

## If Something Breaks

Capture three things immediately:

1. the visible UI state or screenshot
2. the last 20 lines from the backend terminal
3. the last 20 lines from the frontend terminal

That is usually enough to isolate whether the issue is:

- auth/session
- pilot API persistence
- frontend state update
- local startup/config

## After the Dry Run

- keep the saved dry-run feedback if you want one known-good baseline
- or delete the test candidate and test feedback before inviting real users
- then add the first 3 real candidates and start scheduling sessions
