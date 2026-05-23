const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'AARIImpactMetrics';
const CACHE_TTL_MS = 60 * 1000;

let cachedPayload = null;
let cachedAt = 0;

function getInstrumentationKey() {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  return connectionString?.match(/InstrumentationKey=([^;]+)/i)?.[1] || '';
}

function durationTimespan(durationMs) {
  const ms = Math.max(0, Number(durationMs) || 0);
  const seconds = Math.floor(ms / 1000);
  const milliseconds = String(Math.floor(ms % 1000)).padStart(3, '0');
  return `00:00:${String(seconds).padStart(2, '0')}.${milliseconds}`;
}

function trackTelemetry(item) {
  const instrumentationKey = getInstrumentationKey();
  if (!instrumentationKey || typeof fetch !== 'function') return;
  const envelope = {
    time: new Date().toISOString(),
    iKey: instrumentationKey,
    ...item
  };
  fetch('https://dc.services.visualstudio.com/v2/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope)
  }).catch(() => {});
}

function trackRequestTelemetry({ duration, status }) {
  trackTelemetry({
    name: 'Microsoft.ApplicationInsights.Request',
    data: {
      baseType: 'RequestData',
      baseData: {
        ver: 2,
        id: String(Date.now()),
        name: 'GET /api/impact',
        url: '/api/impact',
        duration: durationTimespan(duration),
        responseCode: String(status),
        success: status < 500
      }
    }
  });
}

function trackDependencyTelemetry({ duration, status, success }) {
  trackTelemetry({
    name: 'Microsoft.ApplicationInsights.RemoteDependency',
    data: {
      baseType: 'RemoteDependencyData',
      baseData: {
        ver: 2,
        name: 'Azure Table Storage query AARIImpactMetrics',
        id: String(Date.now()),
        resultCode: String(status),
        duration: durationTimespan(duration),
        success,
        type: 'Azure table',
        target: TABLE_NAME,
        data: "PartitionKey eq 'impact'"
      }
    }
  });
}

function trackExceptionTelemetry(error) {
  trackTelemetry({
    name: 'Microsoft.ApplicationInsights.Exception',
    data: {
      baseType: 'ExceptionData',
      baseData: {
        ver: 2,
        exceptions: [{
          typeName: error.name || 'Error',
          message: error.message || 'Unknown error'
        }]
      }
    }
  });
}

function jsonResponse(status, body, serverTimeMs = 0) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Server-Timing': `aari-impact;dur=${Math.max(0, Math.round(serverTimeMs))}`,
      'X-AARI-Server-Time-Ms': String(Math.max(0, Math.round(serverTimeMs)))
    },
    body
  };
}

function normalizeMetric(entity) {
  const value = Number(entity.Value);
  const prefix = String(entity.Prefix || '');
  const suffix = String(entity.Suffix || '');
  const display = `${prefix}${Number.isFinite(value) ? value : entity.Value}${suffix}`;
  return {
    id: entity.rowKey,
    value,
    prefix,
    suffix,
    display,
    label: String(entity.Label || ''),
    description: String(entity.Description || ''),
    display_order: Number(entity.DisplayOrder || 0),
    updated_at: String(entity.UpdatedAt || '')
  };
}

async function readMetricsFromTable(context) {
  const connectionString = process.env.AARI_IMPACT_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('missing_storage_connection_string');
  }

  const client = TableClient.fromConnectionString(connectionString, TABLE_NAME);
  const started = Date.now();
  const metrics = [];
  try {
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq 'impact'` }
    });
    for await (const entity of entities) {
      metrics.push(normalizeMetric(entity));
    }
    trackDependencyTelemetry({ duration: Date.now() - started, status: 0, success: true });
  } catch (error) {
    trackDependencyTelemetry({
      duration: Date.now() - started,
      status: error.statusCode || 500,
      success: false
    });
    throw error;
  }

  metrics.sort((a, b) => a.display_order - b.display_order);
  if (metrics.length !== 6) {
    context.log.warn(JSON.stringify({
      event: 'impact_metric_count_mismatch',
      metric_count: metrics.length,
      timestamp: new Date().toISOString()
    }));
  }

  return {
    metrics,
    generated_at: new Date().toISOString(),
    source: TABLE_NAME
  };
}

async function handleRequest(context) {
  const now = Date.now();
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) {
    return jsonResponse(200, cachedPayload, Date.now() - now);
  }

  const payload = await readMetricsFromTable(context);
  cachedPayload = payload;
  cachedAt = now;
  return jsonResponse(200, payload, Date.now() - now);
}

module.exports = async function (context, req) {
  const started = Date.now();
  let status = 200;
  try {
    context.res = await handleRequest(context, req);
    status = context.res.status;
  } catch (error) {
    status = 503;
    context.log.error(JSON.stringify({
      event: 'impact_metrics_unavailable',
      reason: error.message,
      timestamp: new Date().toISOString()
    }));
    trackExceptionTelemetry(error);
    context.res = jsonResponse(503, {
      ok: false,
      code: 'impact_metrics_unavailable',
      message: 'Impact metrics are temporarily unavailable.'
    }, Date.now() - started);
  } finally {
    trackRequestTelemetry({ duration: Date.now() - started, status });
  }
};

module.exports._private = {
  normalizeMetric,
  jsonResponse
};
