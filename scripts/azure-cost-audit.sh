#!/usr/bin/env bash
set -euo pipefail

PROD_RESOURCE_GROUP="${PROD_RESOURCE_GROUP:-rg-aari-website-prod}"
BUDGET_NAME="${BUDGET_NAME:-budget-aari-website-prod}"

EXPENSIVE_TYPES_QUERY="[?contains(['Microsoft.Cdn/profiles','Microsoft.Network/frontdoorWebApplicationFirewallPolicies','Microsoft.Web/serverfarms','Microsoft.Web/sites','Microsoft.Sql/servers','Microsoft.DocumentDB/databaseAccounts','Microsoft.Cache/Redis','Microsoft.Search/searchServices','Microsoft.CognitiveServices/accounts','Microsoft.OperationalInsights/workspaces','Microsoft.Network/natGateways','Microsoft.Network/applicationGateways','Microsoft.Network/azureFirewalls','Microsoft.ContainerService/managedClusters','Microsoft.Insights/scheduledQueryRules'], type)]"

echo "Azure account"
az account show --output table

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${PROD_RESOURCE_GROUP}"

echo
echo "Production resources in ${PROD_RESOURCE_GROUP}"
az resource list \
  --resource-group "${PROD_RESOURCE_GROUP}" \
  --query "[].{name:name,type:type,sku:sku.name,location:location,tags:tags}" \
  --output json

echo
echo "Production resources summary"
az resource list \
  --resource-group "${PROD_RESOURCE_GROUP}" \
  --query "[].{name:name,type:type,sku:sku.name,location:location}" \
  --output table

echo
echo "Potentially expensive resource types"
az resource list \
  --resource-group "${PROD_RESOURCE_GROUP}" \
  --query "${EXPENSIVE_TYPES_QUERY}[].{name:name,type:type,sku:sku.name,location:location}" \
  --output table

echo
echo "Log Analytics workspaces"
az monitor log-analytics workspace list \
  --resource-group "${PROD_RESOURCE_GROUP}" \
  --query "[].{name:name,sku:sku.name,retentionInDays:retentionInDays,dailyQuotaGb:workspaceCapping.dailyQuotaGb}" \
  --output table

echo
echo "Static Web Apps"
az staticwebapp list \
  --resource-group "${PROD_RESOURCE_GROUP}" \
  --query "[].{name:name,sku:sku.name,location:location,defaultHostname:defaultHostname}" \
  --output table

echo
echo "Month-to-date actual cost by resource type/resource"
if ! az rest --method post \
    --url "https://management.azure.com${SCOPE}/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
    --body '{"type":"ActualCost","timeframe":"MonthToDate","dataset":{"granularity":"None","aggregation":{"totalCost":{"name":"PreTaxCost","function":"Sum"}},"grouping":[{"type":"Dimension","name":"ResourceType"},{"type":"Dimension","name":"ResourceId"}]}}' \
    --query "properties.rows[].{cost:[0],type:[1],resourceId:[2],currency:[3]}" \
    --output table; then
  echo "Cost Management query failed or was throttled. Retry later with the exact command in docs/azure-cost-audit.md."
fi

echo
echo "Budget status"
if ! az rest --method get \
    --url "https://management.azure.com${SCOPE}/providers/Microsoft.Consumption/budgets/${BUDGET_NAME}?api-version=2023-05-01" \
    --query "{name:name,amount:properties.amount,currentSpend:properties.currentSpend.amount,forecastSpend:properties.forecastSpend.amount,start:properties.timePeriod.startDate,end:properties.timePeriod.endDate}" \
    --output table; then
  echo "Budget query failed or was throttled. Retry later with the exact command in docs/azure-cost-audit.md."
fi

echo
echo "Cost-driver hints"
echo "- Azure Front Door Premium and WAF are recurring paid edge services; retire them after DNS serves directly from Static Web Apps."
echo "- App Service Plans, databases, Redis, Search, OpenAI/Cognitive Services, NAT Gateway, Application Gateway, and Azure Firewall need explicit cost approval."
echo "- Keep Log Analytics retention short and cap daily ingestion unless there is a compliance requirement."
