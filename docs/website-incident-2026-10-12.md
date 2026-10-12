# Homepage responsiveness investigation, October 12, 2026

The reported symptom was Chrome's **Page Unresponsive** dialog on
`https://atlanta-robotics.org/`, observed around 10:49 a.m. Eastern.
The user reported recovery at 10:50 a.m. Eastern.

## Verified evidence

- The active production repository is `ncode3/aairi-site-production`, branch `main`.
- Azure production deployment run `38095656486` succeeded October 10 at
  23:38 UTC for commit `81ec2b0a63fc4ce67c58b6914c31aacdb94e8b11`.
  There was no new deployment at the reported incident time.
- After recovery, `/`, `/index.html`, homepage JavaScript, local icon library,
  compiled CSS, event JSON, and `/api/impact` all returned HTTP 200.
- The served homepage and repository homepage had the same byte count (60,596).
  Live JavaScript matched the repository content.
- A fresh Chrome session loaded the homepage and followed the Programs link.
  No application JavaScript errors appeared during these checks.
- Both homepage videos were paused, with `preload="none"` and no autoplay.
  The videos were not being automatically decoded during the observed load.

## Reliability defects corrected

- Homepage responses sent `Clear-Site-Data: "cache"`, evicting same-origin
  browser caches on every visit. Removed this header from both configured page
  routes. HTML still uses `no-store`; asset freshness policies remain intact.
- A 357,796-byte local icon library was parser blocking in the document head.
  Defer it and the dependent homepage script in document order so HTML can
  render while scripts download.
- Missing icons previously threw at the first line of the homepage script,
  preventing other controls from initializing. Icon creation is now optional.
- Add predeployment Chromium checks at desktop and mobile sizes: throttled CPU,
  interactive stack controls, event rendering, main-thread heartbeat, no
  automatic MP4 requests, and readable content with an unavailable icon library.

## Limits and follow-up

These defects are verified contributors to load fragility, **not a proven cause
of the original freeze**. A frozen renderer is not itself proof of an Azure
outage. No browser trace from the affected machine or account-level Azure
Service Health/Front Door request history was available in this investigation.
The new browser checks protect deployment changes; they are not continuous
availability monitoring and cannot reproduce every extension, GPU, memory, or
network condition on a visitor's computer.

If the freeze recurs, preserve a Chrome performance trace and the incident time,
then correlate it with Azure Service Health and Front Door request logs.
Rollback the correction by reverting its commit and letting the Azure workflow
redeploy; no data migration is involved.
