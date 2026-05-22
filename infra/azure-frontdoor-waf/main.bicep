@description('Azure Front Door profile name.')
param frontDoorProfileName string = 'afd-aari-website-prod'

@description('Azure Front Door endpoint name.')
param endpointName string = 'aari-website'

@description('Azure Front Door WAF policy name.')
param wafPolicyName string = 'wafAariWebsiteProd'

@description('Azure Static Web Apps default hostname, without https://.')
param staticWebAppHostname string = 'polite-tree-06850430f.7.azurestaticapps.net'

@description('Set to Detection first if tuning a new WAF policy. Use Prevention for production enforcement.')
@allowed([
  'Detection'
  'Prevention'
])
param wafMode string = 'Prevention'

@description('General per-IP rate limit for the website.')
param siteRateLimitPerMinute int = 300

@description('Stricter per-IP rate limit for contact form API submissions.')
param formRateLimitPerMinute int = 15

var wafPolicyAssociationId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${resourceGroup().name}/providers/Microsoft.Network/frontdoorWebApplicationFirewallPolicies/${wafPolicyName}'

resource frontDoorProfile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: frontDoorProfileName
  location: 'global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: frontDoorProfile
  name: endpointName
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: 'og-static-web-app'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 100
    }
    sessionAffinityState: 'Disabled'
  }
}

resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroup
  name: 'origin-static-web-app'
  properties: {
    hostName: staticWebAppHostname
    originHostHeader: staticWebAppHostname
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: endpoint
  name: 'route-all'
  properties: {
    originGroup: {
      id: originGroup.id
    }
    supportedProtocols: [
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    origin
  ]
}

resource wafPolicy 'Microsoft.Network/frontDoorWebApplicationFirewallPolicies@2024-02-01' = {
  name: wafPolicyName
  location: 'global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: wafMode
      requestBodyCheck: 'Enabled'
      javascriptChallengeExpirationInMinutes: 30
      customBlockResponseStatusCode: 403
    }
    customRules: {
      rules: [
        {
          name: 'RateLimitContactApi'
          enabledState: 'Enabled'
          priority: 10
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: formRateLimitPerMinute
          matchConditions: [
            {
              matchVariable: 'RequestUri'
              operator: 'Contains'
              negateCondition: false
              matchValue: [
                '/api/submit-inquiry'
              ]
              transforms: []
            }
          ]
          action: 'Block'
        }
        {
          name: 'RateLimitSite'
          enabledState: 'Enabled'
          priority: 20
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: siteRateLimitPerMinute
          matchConditions: [
            {
              matchVariable: 'RequestUri'
              operator: 'Contains'
              negateCondition: false
              matchValue: [
                '/'
              ]
              transforms: []
            }
          ]
          action: 'Block'
        }
        {
          name: 'BlockDisallowedMethods'
          enabledState: 'Enabled'
          priority: 30
          ruleType: 'MatchRule'
          matchConditions: [
            {
              matchVariable: 'RequestMethod'
              operator: 'Equal'
              negateCondition: false
              matchValue: [
                'PUT'
                'PATCH'
                'DELETE'
                'TRACE'
                'CONNECT'
              ]
              transforms: []
            }
          ]
          action: 'Block'
        }
      ]
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.1'
          ruleSetAction: 'Block'
        }
      ]
    }
  }
}

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = {
  parent: frontDoorProfile
  name: 'security-policy-waf'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicyAssociationId
      }
      associations: [
        {
          domains: [
            {
              id: endpoint.id
            }
          ]
          patternsToMatch: [
            '/*'
          ]
        }
      ]
    }
  }
  dependsOn: [
    route
    wafPolicy
  ]
}

output frontDoorEndpointHostName string = endpoint.properties.hostName
output frontDoorProfileResourceId string = frontDoorProfile.id
output wafPolicyResourceId string = wafPolicy.id
