#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-aari-website-prod}"
BUDGET_NAME="${BUDGET_NAME:-budget-aari-website-prod}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-150}"
BUDGET_START_DATE="${BUDGET_START_DATE:-2026-05-01T00:00:00Z}"
BUDGET_END_DATE="${BUDGET_END_DATE:-2027-05-01T00:00:00Z}"
BUDGET_CONTACT_EMAILS_JSON="${BUDGET_CONTACT_EMAILS_JSON:-[\"nolan@atlanta-robotics.org\"]}"
LOG_ANALYTICS_WORKSPACE="${LOG_ANALYTICS_WORKSPACE:-law-aari-website-prod}"
LOG_ANALYTICS_RETENTION_DAYS="${LOG_ANALYTICS_RETENTION_DAYS:-30}"
LOG_ANALYTICS_DAILY_QUOTA_GB="${LOG_ANALYTICS_DAILY_QUOTA_GB:-1}"

SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"
BUDGET_URL="https://management.azure.com${SCOPE}/providers/Microsoft.Consumption/budgets/${BUDGET_NAME}?api-version=2023-05-01"
WORKSPACE_URL="https://management.azure.com${SCOPE}/providers/Microsoft.OperationalInsights/workspaces/${LOG_ANALYTICS_WORKSPACE}?api-version=2023-09-01"

BODY_FILE="$(mktemp)"
WORKSPACE_BODY_FILE="$(mktemp)"
cleanup() {
  rm -f "${BODY_FILE}" "${WORKSPACE_BODY_FILE}"
}
trap cleanup EXIT

cat > "${BODY_FILE}" <<JSON
{
  "properties": {
    "category": "Cost",
    "amount": ${BUDGET_AMOUNT},
    "timeGrain": "Monthly",
    "timePeriod": {
      "startDate": "${BUDGET_START_DATE}",
      "endDate": "${BUDGET_END_DATE}"
    },
    "notifications": {
      "Actual_GreaterThan_80_Percent": {
        "enabled": true,
        "operator": "GreaterThan",
        "threshold": 80,
        "thresholdType": "Actual",
        "contactEmails": ${BUDGET_CONTACT_EMAILS_JSON},
        "contactRoles": ["Owner", "Contributor"]
      },
      "Actual_GreaterThan_100_Percent": {
        "enabled": true,
        "operator": "GreaterThan",
        "threshold": 100,
        "thresholdType": "Actual",
        "contactEmails": ${BUDGET_CONTACT_EMAILS_JSON},
        "contactRoles": ["Owner", "Contributor"]
      },
      "Actual_GreaterThan_125_Percent": {
        "enabled": true,
        "operator": "GreaterThan",
        "threshold": 125,
        "thresholdType": "Actual",
        "contactEmails": ${BUDGET_CONTACT_EMAILS_JSON},
        "contactRoles": ["Owner", "Contributor"]
      },
      "Forecasted_GreaterThan_100_Percent": {
        "enabled": true,
        "operator": "GreaterThan",
        "threshold": 100,
        "thresholdType": "Forecasted",
        "contactEmails": ${BUDGET_CONTACT_EMAILS_JSON},
        "contactRoles": ["Owner", "Contributor"]
      }
    }
  }
}
JSON

cat > "${WORKSPACE_BODY_FILE}" <<JSON
{
  "properties": {
    "retentionInDays": ${LOG_ANALYTICS_RETENTION_DAYS},
    "workspaceCapping": {
      "dailyQuotaGb": ${LOG_ANALYTICS_DAILY_QUOTA_GB}
    }
  }
}
JSON

echo "Updating ${BUDGET_NAME} at ${SCOPE}"
az rest --method put --url "${BUDGET_URL}" --body @"${BODY_FILE}" --output none

echo "Setting ${LOG_ANALYTICS_WORKSPACE} retention to ${LOG_ANALYTICS_RETENTION_DAYS} days and daily cap to ${LOG_ANALYTICS_DAILY_QUOTA_GB} GB"
az rest --method patch --url "${WORKSPACE_URL}" --body @"${WORKSPACE_BODY_FILE}" --output none

echo "Verifying budget notifications"
az rest --method get --url "${BUDGET_URL}" \
  --query "{amount:properties.amount,currentSpend:properties.currentSpend.amount,forecastSpend:properties.forecastSpend.amount,notifications:properties.notifications}" \
  -o json

echo "Verifying Log Analytics controls"
az monitor log-analytics workspace show \
  -g "${RESOURCE_GROUP}" \
  -n "${LOG_ANALYTICS_WORKSPACE}" \
  --query "{name:name,retentionInDays:retentionInDays,dailyQuotaGb:workspaceCapping.dailyQuotaGb}" \
  -o table
