targetScope = 'subscription'

@description('Production resource group name.')
param resourceGroupName string = 'rg-aari-website-prod'

@description('Production resource group location.')
param resourceGroupLocation string = 'eastus2'

@description('Monthly budget amount in USD.')
param monthlyBudgetAmount int = 150

@description('Budget notification email addresses. Defaults to the existing AARI/Nolan owner budget contact.')
param budgetContactEmails array = [
  'nolan@atlanta-robotics.org'
]

@description('Budget start date. Defaults to the current budget period start to avoid resetting the existing budget window.')
param budgetStartDate string = '2026-05-01T00:00:00Z'

@description('Budget end date.')
param budgetEndDate string = '2027-05-01T00:00:00Z'

@description('Log Analytics retention in days for website production telemetry. PerGB2018 workspaces require at least 30 days.')
@minValue(30)
@maxValue(30)
param logAnalyticsRetentionInDays int = 30

@description('Daily Log Analytics ingestion cap in GB. Use a small cap for the website because it is static-first.')
@minValue(0)
param logAnalyticsDailyQuotaGb int = 1

var requiredTags = {
  Environment: 'prod'
  Owner: 'AARI'
  CostCenter: 'aari-website'
}

resource prodRg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: resourceGroupLocation
  tags: requiredTags
}

module prodResources 'prod-resource-tags-and-retention.bicep' = {
  name: 'aari-website-prod-cost-tags-retention'
  scope: prodRg
  params: {
    tags: requiredTags
    monthlyBudgetAmount: monthlyBudgetAmount
    budgetContactEmails: budgetContactEmails
    budgetStartDate: budgetStartDate
    budgetEndDate: budgetEndDate
    logAnalyticsRetentionInDays: logAnalyticsRetentionInDays
    logAnalyticsDailyQuotaGb: logAnalyticsDailyQuotaGb
  }
}

output budgetName string = 'budget-aari-website-prod'
output productionResourceGroupName string = prodRg.name
