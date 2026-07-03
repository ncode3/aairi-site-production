# Azure Cost Guardrails

This deployment keeps the AARI website production resource group cost-conscious without deleting resources.

It configures:

- required cost tags: `Environment=prod`, `Owner=AARI`, `CostCenter=aari-website`
- monthly budget `budget-aari-website-prod` at `$150`
- actual budget notifications at `50%`, `80%`, and `100%`
- forecasted budget notification at `100%`
- Log Analytics retention at `14` days
- Log Analytics daily ingestion cap at `1` GB

Deploy from the repo root:

```bash
az deployment sub create \
  --location eastus2 \
  --template-file infra/azure-cost-guardrails/main.bicep
```

The default `budgetContactEmails` value preserves the existing `nolan@atlanta-robotics.org` budget contact. Override it only if AARI changes the owner email. The budget also notifies subscription owners and contributors.

Preview first:

```bash
az deployment sub what-if \
  --location eastus2 \
  --template-file infra/azure-cost-guardrails/main.bicep
```
