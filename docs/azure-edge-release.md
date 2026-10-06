# Existing edge hardening release

This is prepared configuration, not evidence that Azure controls are active.
Use the existing Front Door and WAF. Do not create paid infrastructure or enable
enterprise-grade edge without separate cost approval.

1. Verify DNS points both public hosts to the intended Front Door.
2. Export the existing route and security policy for rollback. Add every custom
   domain attached to the route to its existing WAF association for `/*`, keeping
   the endpoint association. Preserve the managed rules and rate limits.
3. Enable HTTP and HTTPS on the existing route with HTTPS redirect enabled.
   Verify redirects, HTTPS pages and APIs, and active WAF coverage.
4. Set repository variables `AARI_FRONT_DOOR_ID` and `AARI_FRONT_DOOR_HOSTNAME`
   to the verified profile ID and endpoint hostname. These are configuration
   identifiers, not authentication credentials. Keep actual values out of Git.
5. After edge coverage and DNS are verified, set `AARI_ORIGIN_LOCK_ENABLED` to
   `true` and release. The production build requires both the Front Door backend
   service tag and the exact profile header. Previews remain separately reachable.
6. Verify public domains, application iframe, images, and impact metrics. Direct
   origin requests must be denied even with a forged profile header. Confirm
   Front Door health and logging after propagation.

The template now includes supplied existing domains in route and firewall
associations and enables HTTPS redirects for HTTP. It is not automatically
deployed. Review a what-if before deploying because it also describes paid
infrastructure. Prefer minimal updates to existing resources for this release.

For an outage, an authorized operator can revert or disable the flag and redeploy.
This restores direct-origin exposure temporarily; diagnose and re-enable promptly.

Storage credential migration, Entra policies, production logging, Jotform account
controls, repository review gates, and server-side email delivery remain separate.
This change neither grants access nor rotates credentials.
