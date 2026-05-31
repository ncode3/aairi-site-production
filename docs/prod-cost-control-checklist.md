# AARI Website Production Cost-Control Checklist

Use this checklist before adding or changing production website infrastructure.

## Monthly review

- Check the website budget by the 5th, 15th, and 25th of each month.
- Keep `budget-aari-website-prod` enabled at the resource-group scope.
- After Front Door is retired, lower the budget amount from `$150` to `$25-$40`.
- Investigate any website resource group forecast over `$25/month`.
- Export the monthly Cost Management view grouped by `ResourceType` and `ResourceId`.

## Hosting rules

- Default host: Azure Static Web Apps.
- Keep the site static unless a backend is required.
- Do not use App Service Plans for this website unless Static Web Apps cannot support a specific production requirement.
- Do not enable Azure Front Door Premium unless AARI explicitly needs paid WAF/edge features and accepts the recurring cost.
- If edge routing is needed later, price Azure Front Door Standard first and document the expected monthly minimum before deployment.
- Do not add staging slots, deployment environments, or preview environments unless someone owns cleanup.

## DNS rules

- Production DNS should point directly to `polite-tree-06850430f.7.azurestaticapps.net` unless Front Door is intentionally reintroduced.
- In Cloudflare, keep `atlanta-robotics.org` and `www.atlanta-robotics.org` as DNS-only CNAME records to the Static Web Apps hostname.
- Do not point DNS back to `*.azurefd.net` unless a new cost approval exists.

## Monitoring rules

- Keep Application Insights only for APIs and operational telemetry that Nolan actually reviews.
- Keep Log Analytics retention short unless a compliance need exists.
- Do not stream verbose access logs to Log Analytics by default.
- Avoid scheduled query rules unless the alert is actionable.
- Delete Front Door WAF logs, Front Door metric alerts, and Front Door query alerts after Front Door is retired.

## Storage rules

- Keep `staariwebsiteprod001` on `Standard_LRS`.
- Use the storage account only for low-volume website data such as `AARIImpactMetrics`.
- Do not enable geo-redundant storage for website metrics unless there is a written recovery requirement.
- Do not store deployment artifacts or image libraries in the metrics storage account.

## Pre-deploy cost questions

Before deploying a new Azure resource, answer:

- What user-facing capability does this resource support?
- Is there a cheaper native Static Web Apps option?
- What is the monthly base cost before usage?
- What usage meter can run away?
- Is logging enabled, and where does it go?
- What budget or alert catches misuse?
- Who deletes it if the experiment ends?

## Commands

Current resources:

```bash
az resource list -g rg-aari-website-prod -o table
```

Current SKUs:

```bash
az staticwebapp show -g rg-aari-website-prod -n swa-aari-website-prod --query "{name:name, sku:sku.name, stagingEnvironmentPolicy:stagingEnvironmentPolicy}" -o table

az storage account show -g rg-aari-website-prod -n staariwebsiteprod001 --query "{name:name, sku:sku.name, kind:kind, accessTier:accessTier}" -o table

az rest --method get \
  --url 'https://management.azure.com/subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Cdn/profiles/afd-aari-website-prod?api-version=2023-05-01' \
  --query "{name:name, sku:sku.name, state:properties.resourceState}" \
  -o table
```

Current monthly cost drivers:

```bash
az rest --method post \
  --url 'https://management.azure.com/subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.CostManagement/query?api-version=2023-11-01' \
  --body '{"type":"ActualCost","timeframe":"MonthToDate","dataset":{"granularity":"None","aggregation":{"totalCost":{"name":"PreTaxCost","function":"Sum"}},"grouping":[{"type":"Dimension","name":"ResourceType"},{"type":"Dimension","name":"ResourceId"}]}}' \
  -o table
```

Budget status:

```bash
az rest --method get \
  --url 'https://management.azure.com/subscriptions/af2f3627-aeb0-40f2-845e-a21ec822c492/resourceGroups/rg-aari-website-prod/providers/Microsoft.Consumption/budgets/budget-aari-website-prod?api-version=2023-05-01' \
  --query "{name:name, amount:properties.amount, currentSpend:properties.currentSpend.amount, forecastSpend:properties.forecastSpend.amount}" \
  -o table
```

DNS health:

```bash
dig +short atlanta-robotics.org
dig +short www.atlanta-robotics.org
curl -I -L -k https://atlanta-robotics.org/
curl -I -L -k https://atlanta-robotics.org/donate
curl -I -L -k https://atlanta-robotics.org/partner
curl -I -L -k https://atlanta-robotics.org/ai-infrastructure
```

## Stop conditions

Stop and investigate before deleting anything if:

- DNS still resolves to `*.azurefd.net` or a Front Door IP.
- `atlanta-robotics.org` does not return `200`.
- `www.atlanta-robotics.org` does not return `200`.
- Static Web Apps custom domains are missing.
- Contact form submissions fail after removing the Front Door gate setting.
- Cost Management still shows new `Microsoft.Cdn/profiles` charges after Front Door is deleted.

