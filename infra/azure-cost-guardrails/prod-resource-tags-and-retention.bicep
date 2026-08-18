@description('Required production cost tags.')
param tags object

@description('Monthly budget amount in USD.')
param monthlyBudgetAmount int

@description('Budget notification email addresses.')
param budgetContactEmails array

@description('Budget start date.')
param budgetStartDate string

@description('Budget end date.')
param budgetEndDate string

@description('Log Analytics retention in days.')
param logAnalyticsRetentionInDays int

@description('Daily Log Analytics ingestion cap in GB.')
param logAnalyticsDailyQuotaGb int

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: 'swa-aari-website-prod'
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: 'staariwebsiteprod001'
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: 'appi-aari-website-prod'
}

resource staticWebAppTags 'Microsoft.Resources/tags@2021-04-01' = {
  name: 'default'
  scope: staticWebApp
  properties: {
    tags: tags
  }
}

resource storageAccountTags 'Microsoft.Resources/tags@2021-04-01' = {
  name: 'default'
  scope: storageAccount
  properties: {
    tags: union(storageAccount.tags, tags)
  }
}

resource appInsightsTags 'Microsoft.Resources/tags@2021-04-01' = {
  name: 'default'
  scope: appInsights
  properties: {
    tags: union(appInsights.tags, tags)
  }
}

resource controlledLogAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'law-aari-website-prod'
  location: 'eastus'
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logAnalyticsRetentionInDays
    workspaceCapping: {
      dailyQuotaGb: logAnalyticsDailyQuotaGb
    }
  }
}

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: 'budget-aari-website-prod'
  properties: {
    category: 'Cost'
    amount: monthlyBudgetAmount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
      endDate: budgetEndDate
    }
    notifications: {
      Actual_GreaterThan_80_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
        contactRoles: [
          'Owner'
          'Contributor'
        ]
      }
      Actual_GreaterThan_100_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
        contactRoles: [
          'Owner'
          'Contributor'
        ]
      }
      Actual_GreaterThan_125_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 125
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
        contactRoles: [
          'Owner'
          'Contributor'
        ]
      }
      Forecasted_GreaterThan_100_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: budgetContactEmails
        contactRoles: [
          'Owner'
          'Contributor'
        ]
      }
    }
  }
}
