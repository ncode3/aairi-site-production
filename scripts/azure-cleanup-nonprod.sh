#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${DRY_RUN:-true}"
TARGET_RESOURCE_GROUPS="${TARGET_RESOURCE_GROUPS:-}"
CONFIRM_NONPROD_DELETE="${CONFIRM_NONPROD_DELETE:-}"
CONFIRM_RESOURCE_GROUPS="${CONFIRM_RESOURCE_GROUPS:-}"

if [[ -z "${TARGET_RESOURCE_GROUPS}" ]]; then
  echo "No resource groups were provided for cleanup."
  echo
  echo "Non-production/orphan candidates by name or tag:"
  az group list \
    --query "[?tags.Environment!='prod' && tags.environment!='prod' && (contains(name, 'dev') || contains(name, 'test') || contains(name, 'stage') || contains(name, 'staging') || contains(name, 'demo') || contains(name, 'lab') || contains(name, 'orphan'))].{name:name,location:location,tags:tags}" \
    --output table
  echo
  echo "To delete, rerun with:"
  echo "  TARGET_RESOURCE_GROUPS='rg-one,rg-two'"
  echo "  CONFIRM_NONPROD_DELETE='delete nonprod only'"
  echo "  CONFIRM_RESOURCE_GROUPS='rg-one,rg-two'"
  echo "  DRY_RUN=false"
  exit 0
fi

if [[ "${CONFIRM_NONPROD_DELETE}" != "delete nonprod only" ]]; then
  echo "Refusing to delete. Set CONFIRM_NONPROD_DELETE='delete nonprod only'."
  exit 1
fi

if [[ "${CONFIRM_RESOURCE_GROUPS}" != "${TARGET_RESOURCE_GROUPS}" ]]; then
  echo "Refusing to delete. CONFIRM_RESOURCE_GROUPS must exactly match TARGET_RESOURCE_GROUPS."
  exit 1
fi

RESOURCE_GROUPS=()
remaining_groups="${TARGET_RESOURCE_GROUPS}"
while [[ "${remaining_groups}" == *,* ]]; do
  RESOURCE_GROUPS+=("${remaining_groups%%,*}")
  remaining_groups="${remaining_groups#*,}"
done
RESOURCE_GROUPS+=("${remaining_groups}")

for rg in "${RESOURCE_GROUPS[@]}"; do
  rg="${rg#"${rg%%[![:space:]]*}"}"
  rg="${rg%"${rg##*[![:space:]]}"}"
  if [[ -z "${rg}" ]]; then
    continue
  fi

  lower_rg="$(echo "${rg}" | tr '[:upper:]' '[:lower:]')"
  if [[ "${lower_rg}" == *prod* || "${lower_rg}" == "rg-aari-website-prod" ]]; then
    echo "Refusing to delete production-looking resource group: ${rg}"
    exit 1
  fi

  exists="$(az group exists --name "${rg}" -o tsv)"
  if [[ "${exists}" != "true" ]]; then
    echo "Resource group does not exist: ${rg}"
    continue
  fi

  env_tag="$(az group show --name "${rg}" --query "tags.Environment || tags.environment || ''" -o tsv)"
  if [[ "$(echo "${env_tag}" | tr '[:upper:]' '[:lower:]')" == "prod" ]]; then
    echo "Refusing to delete ${rg}; Environment tag is prod."
    exit 1
  fi

  echo
  echo "Resources in ${rg}:"
  az resource list \
    --resource-group "${rg}" \
    --query "[].{name:name,type:type,sku:sku.name,location:location,tags:tags}" \
    --output table

  if [[ "${DRY_RUN}" == "false" ]]; then
    echo "Deleting non-production resource group: ${rg}"
    az group delete --name "${rg}" --yes --no-wait
  else
    echo "Dry run only. Set DRY_RUN=false to delete ${rg}."
  fi
done
