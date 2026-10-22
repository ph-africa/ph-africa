BAKULU VIDEOS & LIVE — CLOUDFLARE DEPLOYMENT

Project structure:
  public/index.html
  public/style.css
  public/script.js
  worker.js
  wrangler.jsonc

Deploy using Wrangler CLI:
1. Install Node.js LTS from https://nodejs.org/ and restart VS Code.
2. In VS Code choose Terminal > New Terminal.
3. Use cd to move into the extracted bakulu-video-live folder.
4. Run: npx wrangler login
   A browser opens; log into your Cloudflare account and authorize Wrangler.
5. Run: npx wrangler deploy
6. Wrangler prints a workers.dev URL. Open that URL.

Test API endpoints by replacing YOUR-WORKER-URL with the URL printed by Wrangler:
  https://YOUR-WORKER-URL/api/videos?page=1&per_page=5
  https://YOUR-WORKER-URL/api/livecams

Expected result:
- Video endpoint should return JSON with a videos array.
- Live endpoint should return JSON data from the old live feed.

If either endpoint returns an error, HTML, or an empty array, the provider may be blocking the request or returning a different response structure. Copy the result/error for diagnosis.

Do not upload secrets into the front-end. This project has no payment integrations.
