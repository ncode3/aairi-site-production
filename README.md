# AAIRI Official Website

[![Azure Static Web Apps CI/CD](https://github.com/ncode3/aairi-site-production/actions/workflows/azure-static-web-apps-polite-tree-06850430f.yml/badge.svg)](https://github.com/ncode3/aairi-site-production/actions/workflows/azure-static-web-apps-polite-tree-06850430f.yml)

Official website for the **Atlanta AI & Robotics Initiative (AARI)**, a 501(c)(3) nonprofit organization providing hands-on AI and robotics education to students, veterans, and underserved communities in Atlanta.

## Framework

This app is **plain static HTML**.

- No Vite
- No React
- No Next.js
- No Node build step
- Publish root is the repository root

## Azure Static Web Apps Deployment

The site is configured for Azure Static Web Apps with GitHub as source control.

- **Azure resource name:** `swa-aari-website-prod`
- **Azure resource group:** `rg-aari-website-prod`
- **Production branch:** `main`
- **Workflow:** `.github/workflows/azure-static-web-apps-polite-tree-06850430f.yml`
- **Build command:** none
- **App location:** `/`
- **Output directory:** repository root
- **Build mode:** `skip_app_build: true`

## Website Structure

- `index.html` - Main landing page
- `api/submit-inquiry/` - Azure Static Web Apps contact form handler
- `about.html` - About page
- `scholars.html` - Scholars program page
- `infrastructure.html` - Infrastructure page
- `partners.html` - Partners page
- `privacy.html` - Privacy policy
- `thank-you.html` - Thank-you page
- `images/` - Site imagery and logos

## Contact Form Anti-Spam Flow

Current form handling:

- The public partnership and funder forms in `index.html#contact` POST to the Azure Static Web Apps API at `/api/submit-inquiry`.
- Before this hardening, the forms generated a browser `mailto:` link. The new backend is required for server-side spam checks and provider-side delivery.
- The API forwards accepted submissions through `CONTACT_WEBHOOK_URL` when set, or through SendGrid when `SENDGRID_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL` are set.
- When no provider secret is configured, the API preserves the previous browser email workflow by returning a `mailto:` draft only after the server-side anti-spam checks accept the submission.
- Azure edge security is defined in `infra/azure-frontdoor-waf/` for Azure Front Door Premium with WAF, Bot Manager, rate limiting, and platform DDoS absorption at the Azure edge.

Server-side protections:

- CSS-hidden honeypot fields named `company_website` and `fax_number`; filled values return a neutral success response and are not forwarded.
- `form_rendered_at` timestamp validation; submissions under 3 seconds are blocked with a neutral success response.
- In-memory per-IP rate limiting of 3 submissions per 10 minutes per active function instance.
- Azure Front Door WAF should perform CAPTCHA or JavaScript Challenge at the edge for suspicious traffic before requests reach Static Web Apps.
- When `AZURE_FRONT_DOOR_ID` is set, direct API posts that bypass Azure Front Door are silently blocked by checking the `X-Azure-FDID` header.
- Email, name, message length, inquiry type, link count, spam keyword, repeated character, and excessive punctuation validation.
- Required contact-policy confirmation plus inquiry classification for partnership, sponsorship, student program, media, volunteer, community, vendor/service provider, and other messages.
- Blocked submissions are logged with reason codes including `honeypot_filled`, `submitted_too_fast`, `rate_limited`, `frontdoor_header_failed`, `invalid_email`, `spam_keywords`, and `too_many_links`.

User-facing behavior:

- Spam-blocked submissions receive: `Thanks. Your message has been received.`
- Legitimate validation problems, such as invalid email or short message text, return clear correction messages.

Required production settings:

```bash
AZURE_FRONT_DOOR_ID="<front-door-id>"
CONTACT_WEBHOOK_URL="<form-provider-or-automation-webhook>"
```

Or, for SendGrid delivery:

```bash
AZURE_FRONT_DOOR_ID="<front-door-id>"
SENDGRID_API_KEY="<sendgrid-api-key>"
CONTACT_TO_EMAIL="<staff-inbox@atlanta-robotics.org>"
CONTACT_FROM_EMAIL="website@atlanta-robotics.org"
```

`AZURE_FRONT_DOOR_ID` should be set after Azure Front Door is deployed and DNS is routed through it. The Static Web Apps `staticwebapp.config.json` file can also enforce the same `X-Azure-FDID` header after the ID is known.

Manual test checklist:

- Normal valid submission waits at least 3 seconds, passes Azure Front Door WAF, and is delivered to the configured provider.
- Honeypot-filled bot submission returns the neutral success message and logs `honeypot_filled`.
- Too-fast submission returns the neutral success message and logs `submitted_too_fast`.
- Invalid email returns a visible email validation message and logs `invalid_email`.
- Repeated submissions after 3 successful attempts within 10 minutes return the neutral success message and log `rate_limited`.
- Message with more than 2 links returns the neutral success message and logs `too_many_links`.
- Direct API posts that bypass Azure Front Door return the neutral success message and log `frontdoor_header_failed` once `AZURE_FRONT_DOOR_ID` is configured.

## Impact Dashboard

The homepage Impact section keeps static fallback values in `index.html` and hydrates the six visible numbers from `/api/impact` when the API is available.

Architecture:

- **Read endpoint:** `GET /api/impact`
- **Azure Static Web Apps API runtime:** Node 20
- **Backing store:** Azure Table Storage table `AARIImpactMetrics`
- **Storage account:** `staariwebsiteprod001`
- **Resource group:** `rg-aari-website-prod`
- **Application Insights:** `appi-aari-website-prod`
- **Write path:** Azure Portal only for now; there is no public write endpoint.

Required production settings:

```bash
AARI_IMPACT_STORAGE_CONNECTION_STRING="<storage-connection-string>"
APPLICATIONINSIGHTS_CONNECTION_STRING="<application-insights-connection-string>"
```

Table rows use `PartitionKey=impact` and these `RowKey` values:

- `students_trained`
- `workshops_delivered`
- `partners_engaged`
- `first_placement`
- `active_projects`
- `footprint_sqft`

Each row stores:

- `Value`
- `Prefix`
- `Suffix`
- `DisplayCount`
- `DisplayOrder`
- `Label`
- `Description`
- `UpdatedAt`

`DisplayCount` is the admin-editable display string used by `/api/impact` when present. The older `Value`, `Prefix`, and `Suffix` fields remain in the table for compatibility and fallback.

### Admin-Only Impact Metric Update Script

The repository includes a local admin script at:

```bash
api/scripts/update-impact-metric.js
```

It updates only these rows in `AARIImpactMetrics` with `PartitionKey=impact`:

- `active_projects`
- `first_placement`
- `footprint_sqft`
- `partners_engaged`
- `students_trained`
- `workshops_delivered`

Editable fields:

- `DisplayCount`
- `Description`
- `UpdatedAt`

The script does not expose a public write endpoint. It uses environment variables for Azure credentials and must be run by an operator with access to the storage account.

Local setup:

```bash
cd api
npm install
export AARI_IMPACT_STORAGE_CONNECTION_STRING="<storage-account-connection-string>"
```

List current rows:

```bash
npm run impact:list
```

Update one metric:

```bash
npm run impact:update -- --row-key students_trained --display-count "42+" --description "Distinct students reached through AARI workshops, labs, and cohort programming."
```

Set an explicit timestamp:

```bash
npm run impact:update -- --row-key active_projects --display-count "6" --updated-at "2026-05-23T21:00:00Z"
```

If `--updated-at` is omitted, the script writes the current UTC time. After an update, wait up to 60 seconds for `/api/impact` cache to refresh.

Deployment note:

- The script is deployed with the repository for operator use, but it is not wired to a route.
- Production read access still uses `/api/impact`.
- Production write access remains local/admin-only through this script or the Azure Portal.

### Updating Impact Metrics in Azure Portal

1. Open Azure Portal.
2. Go to `Storage accounts`.
3. Open `staariwebsiteprod001`.
4. In the left navigation, open `Storage browser`.
5. Open `Tables`.
6. Open `AARIImpactMetrics`.
7. Select the row with `PartitionKey` set to `impact` and the metric `RowKey` you want to change.
8. Update `DisplayCount`, `Description`, and `UpdatedAt` as needed.
9. Save the row.
10. Wait up to 60 seconds for `/api/impact` edge cache to refresh.

Do not change `RowKey` values unless the matching element IDs in `index.html` are updated too.

## Site Security Headers

`staticwebapp.config.json` adds global browser security headers:

- Content Security Policy
- HSTS
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- Referrer policy
- Permissions policy
- Cross-origin opener policy

It also disables unsupported HTTP methods for the form API and prevents API response caching.

## DNS Records Required For Azure Static Web Apps

The custom domain migration to Azure Static Web Apps requires DNS records to move off GitHub Pages.

### Apex domain

For `atlanta-robotics.org`, Azure Static Web Apps requires:

- a TXT validation record generated by Azure
- then either:
  - `ALIAS` / `ANAME` / CNAME flattening to the Azure Static Web App default hostname, or
  - apex forwarding to `www.atlanta-robotics.org` if your provider does not support flattening

Current Azure values:

- **Azure Static Web App default hostname:** `polite-tree-06850430f.7.azurestaticapps.net`
- **Apex TXT host:** `@`
- **Apex TXT value:** `_mish3wq5ou7jsdbsac5xoin79mx1rjk`

### WWW subdomain

For `www.atlanta-robotics.org`, create:

- `CNAME www -> polite-tree-06850430f.7.azurestaticapps.net`

## Pulumi Cloudflare DNS Cutover

The Cloudflare DNS cutover is managed in:

- `infra/cloudflare-dns/`

This Pulumi project manages only the website cutover records:

- removes the legacy GitHub Pages apex A records
- removes the legacy `www -> ncode3.github.io` CNAME
- creates the Azure Static Web Apps validation TXT record
- creates the Azure Static Web Apps apex CNAME
- creates the Azure Static Web Apps `www` CNAME

It does **not** touch unrelated records such as:

- MX
- Google verification
- `autodiscover`
- `automation`
- `coach`
- `gdc`
- `vpn`
- `_domainconnect`

### Cloudflare authentication

Use an environment variable only. Do not commit secrets.

```bash
export CLOUDFLARE_API_TOKEN="<cloudflare-api-token>"
```

Required token scopes:

- `Zone:Read`
- `DNS:Edit`

### Pulumi config example

```bash
cd infra/cloudflare-dns
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
pulumi login
pulumi stack init dev
pulumi config set domain atlanta-robotics.org
pulumi config set azureHostname polite-tree-06850430f.7.azurestaticapps.net
pulumi config set validationToken _mish3wq5ou7jsdbsac5xoin79mx1rjk
pulumi config set githubPagesWwwTarget ncode3.github.io
```

Optional when automatic zone lookup is not desired:

```bash
pulumi config set cloudflareZoneId "<cloudflare-zone-id>"
```

### Preview and apply

Review the exact planned changes before apply:

```bash
pulumi preview
pulumi up
```

Expected website cutover changes:

- delete `A @ 185.199.108.153`
- delete `A @ 185.199.109.153`
- delete `A @ 185.199.110.153`
- delete `A @ 185.199.111.153`
- delete `CNAME www ncode3.github.io`
- create `TXT @ _mish3wq5ou7jsdbsac5xoin79mx1rjk`
- create `CNAME @ polite-tree-06850430f.7.azurestaticapps.net`
- create `CNAME www polite-tree-06850430f.7.azurestaticapps.net`

### Verification commands

```bash
dig TXT atlanta-robotics.org
dig atlanta-robotics.org
dig www.atlanta-robotics.org
curl -I https://atlanta-robotics.org
curl -I https://www.atlanta-robotics.org
az staticwebapp hostname list -n swa-aari-website-prod -g rg-aari-website-prod -o table
```

### Redirect behavior

After both domains are attached in Azure Static Web Apps:

- set `www.atlanta-robotics.org` or `atlanta-robotics.org` as the default domain in Azure
- Azure will redirect the non-default custom domain to the default custom domain

## Rollback Instructions

If the Azure Static Web Apps deployment fails or the domain cutover is not complete:

1. Leave GitHub Pages active.
2. Keep the current GitHub Pages DNS records in place.
3. Disable or ignore the Azure Static Web Apps custom-domain mapping until validation is complete.
4. Re-run the GitHub Actions workflow after any workflow fix:

```bash
gh workflow run azure-static-web-apps-polite-tree-06850430f.yml --repo ncode3/aairi-site-production
```

5. If necessary, redeploy the last known good GitHub Pages commit:

```bash
git revert <bad-commit>
git push origin main
```

6. To roll back DNS from Azure Static Web Apps to GitHub Pages, reapply the previous Cloudflare website records:

- `A @ 185.199.108.153`
- `A @ 185.199.109.153`
- `A @ 185.199.110.153`
- `A @ 185.199.111.153`
- `CNAME www ncode3.github.io`

## Current Public URLs

- Current nonprofit production domain: [https://atlanta-robotics.org](https://atlanta-robotics.org)
- Azure Static Web App default hostname: [https://polite-tree-06850430f.7.azurestaticapps.net](https://polite-tree-06850430f.7.azurestaticapps.net)

## Contact

- Website: [atlanta-robotics.org](https://atlanta-robotics.org)
- Contact: use the website contact form.

## License

© 2026 Atlanta AI & Robotics Initiative. All rights reserved.
