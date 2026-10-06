# Browser security build

Run `npm ci --ignore-scripts`, `npm run build`, and `npm test` with Node.js 22.
The deployment serves `dist`, with API code packaged separately.

Tailwind is compiled for each page using that page's original color and font
configuration. Lucide is copied from the exact locked npm dependency with its
license. Inline page scripts live in `assets/js/pages`; inline event handlers
use the shared local UI script. When adding a page, add its Tailwind config and
include its compiled stylesheet. Keep dynamically selected utility classes as
complete strings so the compiler discovers them.

The enforced script policy permits only local scripts and rejects inline
handlers and eval. Inline styles remain permitted because existing layout and
animation code uses them. Jotform remains a separately governed iframe.

Google Ads and visitor analytics are disabled, including conversion reporting.
No consent is assumed. Reintroducing tracking requires a reviewed data flow,
consent implementation, privacy wording, and CSP update. Hosting security logs
are separate from marketing analytics.

The legacy workflow that wrote directly to main is retired. Dependency update
PRs are requested weekly; this does not replace repository review requirements.

Release through an Azure preview first. Verify all pages, icons, navigation,
metrics, and the application iframe before merging. Revert the release commit
to restore the preceding build if a production regression occurs.
