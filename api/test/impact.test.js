const test = require('node:test');
const assert = require('node:assert/strict');
const { TableClient } = require('@azure/data-tables');
const handler = require('../impact');

test('errors are not cached', () => {
  assert.equal(handler._private.jsonResponse(503, {}).headers['Cache-Control'], 'no-store');
});

test('only approved aggregate metrics are returned even if storage contains other rows', async () => {
  const original = TableClient.fromConnectionString;
  const originalConnection = process.env.AARI_IMPACT_STORAGE_CONNECTION_STRING;
  const originalTelemetry = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  process.env.AARI_IMPACT_STORAGE_CONNECTION_STRING = 'local-test-placeholder';
  delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  let query;
  TableClient.fromConnectionString = () => ({
    async *listEntities(options) {
      query = options.queryOptions.filter;
      yield { rowKey: 'students_trained', Value: 12, Label: 'Students', DisplayOrder: 1 };
      yield { rowKey: 'private_row', Value: 5, Label: 'Private information', DisplayOrder: 2 };
    }
  });
  const log = () => {}; log.warn = log; log.error = log;
  const context = { log };
  try {
    await handler(context, { method: 'GET' });
    assert.equal(context.res.status, 200);
    assert.deepEqual(context.res.body.metrics.map(metric => metric.id), ['students_trained']);
    assert.match(query, /RowKey eq 'students_trained'/);
    assert.ok(!JSON.stringify(context.res.body).includes('Private information'));
  } finally {
    TableClient.fromConnectionString = original;
    if (originalConnection === undefined) delete process.env.AARI_IMPACT_STORAGE_CONNECTION_STRING;
    else process.env.AARI_IMPACT_STORAGE_CONNECTION_STRING = originalConnection;
    if (originalTelemetry !== undefined) process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = originalTelemetry;
  }
});
