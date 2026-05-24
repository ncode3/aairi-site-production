#!/usr/bin/env node

const { TableClient, odata } = require('@azure/data-tables');

const TABLE_NAME = process.env.AARI_IMPACT_TABLE_NAME || 'AARIImpactMetrics';
const PARTITION_KEY = process.env.AARI_IMPACT_PARTITION_KEY || 'impact';
const CONNECTION_STRING = process.env.AARI_IMPACT_STORAGE_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;

const ALLOWED_ROW_KEYS = new Set([
  'active_projects',
  'first_placement',
  'footprint_sqft',
  'partners_engaged',
  'students_trained',
  'workshops_delivered'
]);

function printUsage() {
  console.log(`Usage:
  node api/scripts/update-impact-metric.js --row-key students_trained --display-count "42+" --description "Updated description"
  node api/scripts/update-impact-metric.js --row-key active_projects --display-count "6" --updated-at 2026-05-23T21:00:00Z
  node api/scripts/update-impact-metric.js --list

Environment:
  AARI_IMPACT_STORAGE_CONNECTION_STRING or AZURE_STORAGE_CONNECTION_STRING is required.
  AARI_IMPACT_TABLE_NAME defaults to AARIImpactMetrics.
  AARI_IMPACT_PARTITION_KEY defaults to impact.

Allowed RowKey values:
  ${Array.from(ALLOWED_ROW_KEYS).join(', ')}
`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    if (key === 'help' || key === 'list') {
      args[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function normalizeUpdatedAt(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('--updated-at must be a valid ISO date/time');
  }
  return date.toISOString();
}

function normalizeDisplayCount(value) {
  if (typeof value === 'undefined') return undefined;
  const normalized = String(value).trim();
  if (!normalized) throw new Error('--display-count cannot be empty');
  if (normalized.length > 40) throw new Error('--display-count is too long');
  return normalized;
}

function makeClient() {
  if (!CONNECTION_STRING) {
    throw new Error('Missing AARI_IMPACT_STORAGE_CONNECTION_STRING or AZURE_STORAGE_CONNECTION_STRING');
  }
  return TableClient.fromConnectionString(CONNECTION_STRING, TABLE_NAME);
}

function entityToSummary(entity) {
  return {
    RowKey: entity.rowKey,
    DisplayCount: entity.DisplayCount || '',
    Description: entity.Description || '',
    UpdatedAt: entity.UpdatedAt || ''
  };
}

async function listMetrics(client) {
  const entities = client.listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${PARTITION_KEY}` }
  });
  const rows = [];
  for await (const entity of entities) {
    if (ALLOWED_ROW_KEYS.has(entity.rowKey)) rows.push(entityToSummary(entity));
  }
  rows.sort((a, b) => a.RowKey.localeCompare(b.RowKey));
  console.table(rows);
}

async function updateMetric(client, args) {
  const rowKey = args['row-key'];
  if (!ALLOWED_ROW_KEYS.has(rowKey)) {
    throw new Error(`Unsupported --row-key "${rowKey}"`);
  }

  const patch = {
    partitionKey: PARTITION_KEY,
    rowKey,
    UpdatedAt: normalizeUpdatedAt(args['updated-at'])
  };

  const displayCount = normalizeDisplayCount(args['display-count']);
  if (typeof displayCount !== 'undefined') patch.DisplayCount = displayCount;
  if (typeof args.description !== 'undefined') patch.Description = String(args.description).trim();

  const changedFields = Object.keys(patch).filter((key) => !['partitionKey', 'rowKey'].includes(key));
  if (changedFields.length === 1 && changedFields[0] === 'UpdatedAt' && typeof args['updated-at'] === 'undefined') {
    throw new Error('Nothing to update. Provide --display-count, --description, or --updated-at.');
  }

  await client.updateEntity(patch, 'Merge');
  const updated = await client.getEntity(PARTITION_KEY, rowKey);
  console.log(`Updated ${TABLE_NAME}/${PARTITION_KEY}/${rowKey}`);
  console.table([entityToSummary(updated)]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  const client = makeClient();
  if (args.list) {
    await listMetrics(client);
    return;
  }
  await updateMetric(client, args);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  printUsage();
  process.exitCode = 1;
});
