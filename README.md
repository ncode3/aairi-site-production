# Nolan Speaker Site

Static speaker and press-kit website for `nolancode.bio`.

## Purpose

This site positions Nolan as a paid speaker, founder, educator, and infrastructure strategist across:

- AI infrastructure
- robotics and edge AI
- quantum literacy
- workforce development
- executive and institutional strategy

## Security Posture

This site is intentionally static and low-risk.

- No server-side runtime
- No client-side secrets
- No third-party JavaScript
- No analytics scripts
- No form backend storing visitor data
- Booking form uses a local `mailto:` handoff so submission data is not posted to a public API
- Content Security Policy is set with a restrictive meta policy
- Custom domain is set through `CNAME` for GitHub Pages

## Structure

- `index.html` - Main speaker homepage
- `speaker-kit.html` - Printable one-sheet
- `media-kit.html` - Media summary
- `rider.html` - Speaker rider
- `rates.html` - Speaking rates
- `styles/site.css` - Shared styles
- `scripts/site.js` - Mobile navigation and booking form handoff
- `images/` - Headshots and legacy site imagery

## Local Preview

Run a local static server from the repo root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages Deployment

1. Push the repo to GitHub.
2. In the GitHub repo settings, enable GitHub Pages from the default branch root.
3. Confirm the custom domain is set to `nolancode.bio`.
4. In DNS, point `nolancode.bio` to GitHub Pages using the required A / ALIAS records.
5. Enforce HTTPS in GitHub Pages settings once the certificate is issued.

## Notes

- The downloadable press-kit links open printable HTML pages until final PDF assets are produced.
- If you later add a real form backend, do not expose API keys or SMTP credentials client-side.
