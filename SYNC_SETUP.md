# One-time setup: in-app sports refresh

The app's Update button uses a small Render service to request the existing GitHub Actions workflow. The GitHub token stays on Render and is never included in the public website.

## 1. Create a GitHub token

Create a fine-grained personal access token for the JimmyHZz1/Boxing-Fight-Calendar repository only.

Required repository permission:
- Actions: Read and write

The token is used only by the Render service to start the existing Refresh sports schedules workflow and read its run status. Do not add this token to the repository, website files, or this project chat.

## 2. Deploy the Render service

1. Sign in to Render and choose New → Blueprint.
2. Connect the JimmyHZz1/Boxing-Fight-Calendar repository.
3. Select the main branch after this change has been merged.
4. Render will read render.yaml and offer to create sports-calendar-sync-jimmyhzz1.
5. When prompted, enter the GitHub token as the value for GITHUB_TOKEN.
6. Deploy the service and wait for its health check to pass.

The expected service address is:

https://sports-calendar-sync-jimmyhzz1.onrender.com

The service has a ten-minute global request cooldown and refuses to start a second refresh while one is already running.

## 3. Check it

Open:

https://sports-calendar-sync-jimmyhzz1.onrender.com/health

A healthy service returns JSON containing ok: true.

After that one-time setup, tap Update inside Sports Calendar. You should not need to open GitHub Actions to refresh the schedules manually. The existing four-hour automatic refresh remains enabled.
