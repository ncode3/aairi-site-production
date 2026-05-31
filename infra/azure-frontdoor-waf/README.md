# Azure Front Door WAF

> Cost status: do not redeploy this stack by default. The May 2026 website cost audit found that `afd-aari-website-prod` on `Premium_AzureFrontDoor` was responsible for about `$120.24` of `$122.15` month-to-date website spend. The production cost-control path is to route DNS directly to Azure Static Web Apps and delete this Front Door profile unless AARI intentionally approves paid WAF/edge protection.

This template puts Azure Front Door Premium in front of the Azure Static Web App and attaches an Azure WAF policy.

It adds:

- Azure Front Door edge routing to the Static Web Apps origin.
- HTTPS-only origin forwarding.
- Azure WAF managed Default Rule Set.
- Azure WAF Bot Manager Rule Set.
- Per-IP rate limiting for the whole site.
- Stricter per-IP rate limiting for `/api/submit-inquiry`.
- Blocking for unsupported HTTP methods.

Azure Front Door also provides platform-level network DDoS protection at the edge. The WAF policy handles layer 7 protections, including bot and HTTP flood mitigation.

## Deploy

```bash
az deployment group create \
  --resource-group rg-aari-website-prod \
  --template-file infra/azure-frontdoor-waf/main.bicep \
  --parameters staticWebAppHostname=polite-tree-06850430f.7.azurestaticapps.net
```

Start with `wafMode=Detection` if you want to tune logs before enforcement:

```bash
az deployment group create \
  --resource-group rg-aari-website-prod \
  --template-file infra/azure-frontdoor-waf/main.bicep \
  --parameters wafMode=Detection
```

## Required Follow-Up

1. Add `atlanta-robotics.org` and `www.atlanta-robotics.org` as Azure Front Door custom domains.
2. Point DNS to the Azure Front Door endpoint after custom domain validation.
3. Set the Azure Static Web Apps application setting `AZURE_FRONT_DOOR_ID` to the Front Door profile ID value from the `X-Azure-FDID` request header.
4. Add this block to `staticwebapp.config.json` only after `AZURE_FRONT_DOOR_ID` is known, otherwise direct traffic will be blocked:

```json
"forwardingGateway": {
  "allowedForwardedHosts": [
    "atlanta-robotics.org",
    "www.atlanta-robotics.org"
  ],
  "requiredHeaders": {
    "X-Azure-FDID": "<front-door-id>"
  }
}
```

The API already honors `AZURE_FRONT_DOOR_ID` when set and silently blocks direct form posts that do not include the expected `X-Azure-FDID` header.
