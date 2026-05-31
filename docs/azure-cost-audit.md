# AARI Website Production Azure Cost Audit

Audit date: 2026-05-31  
Subscription: `Azure subscription 1` (`af2f3627-aeb0-40f2-845e-a21ec822c492`)  
Production resource group: `rg-aari-website-prod`  
Budget: `budget-aari-website-prod`  
Budget period start: 2026-05-01  
Budget amount: `$150.00` monthly  
Budget current spend at audit: `$122.15`  
Forecast spend at audit: `$130.25`

## Finding

The AARI website is already hosted as an Azure Static Web App. The budget alert was caused by Azure Front Door Premium, not by the website host.

May 2026 actual cost through the audit window:

| Resource type | Resource | May cost |
| --- | --- | ---: |
| `Microsoft.Cdn/profiles` | `afd-aari-website-prod` | `$120.24` |
| `Microsoft.Web/staticSites` | `swa-aari-website-prod` | `$2.21` |
| `Microsoft.Insights/scheduledQueryRules` | two query alerts | `$0.64` |
| `Microsoft.Storage/storageAccounts` | `staariwebsiteprod001` | `< $0.01` |
| `Microsoft.OperationalInsights/workspaces` | `law-aari-website-prod` | `$0.00` |
| `Microsoft.Insights/actionGroups` and metric alerts | website alerts | `$0.00` |

## Production resources found

| Resource | Type | SKU / tier | Purpose | Cost position |
| --- | --- | --- | --- | --- |
| `swa-aari-website-prod` | Azure Static Web Apps | `Standard` | Production website hosting and managed API | Keep |
| `afd-aari-website-prod` | Azure Front Door | `Premium_AzureFrontDoor` | Edge routing and WAF in front of Static Web Apps | Remove after DNS cutover |
| `aari-website` | AFD endpoint | n/a | Public Front Door endpoint | Remove with AFD profile |
| `wafAariWebsiteProd` | Front Door WAF policy | `Premium_AzureFrontDoor` | Managed WAF, Bot Manager, rate limits | Remove with AFD profile |
| `staariwebsiteprod001` | Storage account | `Standard_LRS` | `AARIImpactMetrics` table backing the impact dashboard | Keep |
| `appi-aari-website-prod` | Application Insights | workspace-based | API telemetry | Keep, watch ingestion |
| `law-aari-website-prod` | Log Analytics workspace | `PerGB2018`, 90-day retention | AFD diagnostic logs and security query rules | Remove or reduce after AFD retirement |
| `managed-appi-aari-website-prod-ws` | Managed Log Analytics workspace | managed by Application Insights | Application Insights workspace | Keep while App Insights is enabled |
| `alert-aari-afd-*` | Metric alerts | n/a | Front Door health/security alerts | Remove after AFD retirement |
| `alert-aari-website-waf-log-actions` | Scheduled query rule | n/a | WAF log query alert | Remove after AFD retirement |
| `alert-aari-storage-table-delete` | Scheduled query rule | n/a | Storage table delete alert | Optional keep; costs about `$0.32` in May |

No App Service Plan or App Service was found in `rg-aari-website-prod`.

## DNS and traffic path

Current DNS still routes production traffic through Azure Front Door:

| Host | Current target |
| --- | --- |
| `atlanta-robotics.org` | Front Door IP `150.171.109.118` |
| `www.atlanta-robotics.org` | `aari-website-bfg4h5fuffazbchb.z03.azurefd.net` |

Static Web Apps already has both custom domains attached:

- `atlanta-robotics.org`
- `www.atlanta-robotics.org`

Direct Static Web Apps hostname:

- `polite-tree-06850430f.7.azurestaticapps.net`

## Cost reduction plan

### Step 1: Cut DNS directly to Static Web Apps

In Cloudflare DNS, change:

| Name | Type | Target | Proxy |
| --- | --- | --- | --- |
| `@` | `CNAME` | `polite-tree-06850430f.7.azurestaticapps.net` | DNS only |
| `www` | `CNAME` | `polite-tree-06850430f.7.azurestaticapps.net` | DNS only |

Cloudflare supports CNAME flattening at the apex. Keep the records DNS-only so Azure Static Web Apps managed certificates and host validation continue to work cleanly.

The repo already contains Pulumi DNS automation under `infra/cloudflare-dns`, but the current public DNS is not using the repo-declared Static Web Apps target. Run that stack only with a valid `CLOUDFLARE_API_TOKEN`.

### Step 2: Verify direct Static Web Apps traffic

After DNS changes propagate, verify:

```bash
dig +short atlanta-robotics.org
dig +short www.atlanta-robotics.org

curl -I -L -k https://atlanta-robotics.org/
curl -I -L -k https://atlanta-robotics.org/index.html
curl -I -L -k https://atlanta-robotics.org/donate
curl -I -L -k https://atlanta-robotics.org/partner
curl -I -L -k https://atlanta-robotics.org/research
curl -I -L -k https://atlanta-robotics.org/ai-infrastructure
```

Expected result: every URL returns `HTTP/2 200`.

### Step 3: Delete Front Door and Front Door-only monitoring

Only run these commands after both `atlanta-robotics.org` and `www.atlanta-robotics.org` are serving successfully from Static Web Apps.

```bash
az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Cdn/profiles/afd-aari-website-prod

az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Network/frontdoorWebApplicationFirewallPolicies/wafAariWebsiteProd

az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Insights/scheduledQueryRules/alert-aari-website-waf-log-actions
```

Optional after one week of stable direct Static Web Apps operation:

```bash
az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Insights/metricalerts/alert-aari-afd-waf-blocks

az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Insights/metricalerts/alert-aari-afd-5xx

az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Insights/metricalerts/alert-aari-afd-ddos-active

az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Insights/metricalerts/alert-aari-afd-4xx-spike

az resource delete \
  --ids /subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Insights/metricalerts/alert-aari-afd-request-flood
```

Keep `alert-aari-storage-table-delete` if table-delete monitoring is worth about `$0.30-$1.00/month`; otherwise delete it too.

## Expected monthly cost after fix

Recommended production posture:

- Azure Static Web Apps Standard: about `$9/month`
- Storage account for impact metrics: usually `< $1/month`
- Application Insights / Log Analytics: expected low single digits if sampling and retention stay controlled
- Scheduled query alerts: about `$0.30-$1.00/month` each
- Azure Front Door Premium: `$0/month` after deletion

Expected steady-state website cost after retiring Front Door: approximately `$10-$15/month`.

If AARI later needs WAF again, use the requirement as a deliberate security purchase. Do not enable Azure Front Door Premium by default for a static brochure/API site.

## Live change made during audit

The Static Web Apps app setting `AZURE_FRONT_DOOR_ID` was removed on 2026-05-31. This prepares the contact form API for direct Static Web Apps traffic after DNS is moved off Front Door. Keeping that setting would silently reject legitimate direct form submissions after the cutover.

No production hosting resource was deleted during this audit because DNS still points at Front Door.

## Follow-up risk

During the audit, `GET /api/impact` returned `404` from the Static Web Apps function endpoint. The public homepage remains online and still has static fallback impact numbers, but the live dashboard API should be repaired separately before using impact telemetry as a production proof point.

## Audit commands

List production resources:

```bash
az resource list -g rg-aari-website-prod -o table
az resource list -g ai_appi-aari-website-prod_81df5589-b705-4f55-a6e3-be958edaac44_managed -o table
```

Show website hosting SKU:

```bash
az staticwebapp show -g rg-aari-website-prod -n swa-aari-website-prod -o table
```

Show storage SKU:

```bash
az storage account show -g rg-aari-website-prod -n staariwebsiteprod001 --query "{name:name, sku:sku.name, kind:kind, accessTier:accessTier}" -o table
```

Show Front Door SKU:

```bash
az rest --method get \
  --url 'https://management.azure.com/subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Cdn/profiles/afd-aari-website-prod?api-version=2023-05-01' \
  --query "{name:name, sku:sku.name, state:properties.resourceState}" \
  -o table
```

Show May cost drivers for the website resource group:

```bash
az rest --method post \
  --url 'https://management.azure.com/subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.CostManagement/query?api-version=2023-11-01' \
  --body '{"type":"ActualCost","timeframe":"Custom","timePeriod":{"from":"2026-05-01T00:00:00Z","to":"2026-05-31T23:59:59Z"},"dataset":{"granularity":"None","aggregation":{"totalCost":{"name":"PreTaxCost","function":"Sum"}},"grouping":[{"type":"Dimension","name":"ResourceType"},{"type":"Dimension","name":"ResourceId"}]}}' \
  -o table
```

Show budget status:

```bash
az rest --method get \
  --url 'https://management.azure.com/subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Consumption/budgets/budget-aari-website-prod?api-version=2023-05-01' \
  --query "{name:name, amount:properties.amount, currentSpend:properties.currentSpend.amount, forecastSpend:properties.forecastSpend.amount, start:properties.timePeriod.startDate, end:properties.timePeriod.endDate}" \
  -o table
```

