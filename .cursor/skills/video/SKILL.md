---
name: video
description: After a change, start the app, click the happy path, and record a short video walkthrough. Use when the user invokes /video or asks for a video of the change working.
---

# Video walkthrough

After you make the change, start the app, click through the happy path, and record a short video walkthrough of it working. Attach the video (and screenshots) as artifacts.

## How

1. Start the frontend if it is not already running:

   ```sh
   cd frontend
   npm run dev
   ```

   The app is at `http://localhost:5173`. Catalogs come from `VITE_DATA_BASE_URL` (`https://f005.backblazeb2.com/file/responder-debrief-data`). Wait until the page loads.

2. Click through the happy path a real user would take for this change. For this app that is usually: home map → open a fire → confirm the fire chrome and perimeter (`rd-fire-shell`, `rd-fire-perimeter`). Adapt the clicks to whatever you changed.

3. Record the walkthrough. Set up the UI first, then `RecordScreen` with `START_RECORDING`, drive the clicks with the computer-use agent, and `SAVE_RECORDING` immediately after. Follow the walkthrough-artifacts skill for naming and attaching.

4. Attach the video and a small set of screenshots as walkthrough artifacts. Do not attach failing or redundant recordings. Fix the failure and record again.
