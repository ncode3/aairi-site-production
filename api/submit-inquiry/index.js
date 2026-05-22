const GENERIC_SUCCESS = 'Thanks. Your message has been received.';
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const MIN_SUBMIT_MS = 3000;

const allowedInquiryTypes = new Set([
  'Partnership',
  'Sponsorship',
  'Student Program',
  'Media',
  'Volunteer',
  'Community Inquiry',
  'Vendor / Service Provider',
  'Other'
]);

const disposableEmailDomains = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'sharklasers.com',
  'getnada.com',
  'trashmail.com'
]);

const spamPatterns = [
  /\bcrypto(?:currency)?\b/i,
  /\bbitcoin\b/i,
  /\bforex\b/i,
  /\bcasino\b/i,
  /\bgambling\b/i,
  /\bseo\s+backlinks?\b/i,
  /\bguest\s+post\b/i,
  /\badult\b/i,
  /\bpills?\b/i,
  /\bloan\s+offer\b/i,
  /\bclick\s+here\b/i,
  /\bwhatsapp\s+only\b/i,
  /\binvestment\s+guaranteed\b/i,
  /\bmake\s+money\s+fast\b/i,
  /\bviagra\b/i,
  /\bporn\b/i,
  /\bescort\b/i
];

const rateLimitStore = new Map();

function getHeader(req, name) {
  const headers = req.headers || {};
  const lowerName = name.toLowerCase();
  return headers[name] || headers[lowerName] || '';
}

function getClientIp(req) {
  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeader(req, 'x-client-ip') || 'unknown';
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

function countLinks(value) {
  return (value.match(/https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(\/|\b)/gi) || []).length;
}

function hasSpamKeywords(value) {
  return spamPatterns.some((pattern) => pattern.test(value));
}

function hasExcessivePunctuation(value) {
  return /[!?]{5,}/.test(value) || /([a-zA-Z0-9])\1{9,}/.test(value);
}

function hasFakeNamePattern(value) {
  const compact = value.replace(/\s+/g, '');
  return compact.length > 24 && /[a-z]/i.test(compact) && /\d/.test(compact);
}

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body
  };
}

function successResponse() {
  return jsonResponse(200, { ok: true, message: GENERIC_SUCCESS });
}

function validationResponse(message, code) {
  return jsonResponse(400, { ok: false, code, message });
}

function logBlocked(context, reason, req, payload) {
  const ip = getClientIp(req);
  const entry = {
    event: 'form_blocked',
    reason,
    form_name: normalizeString(payload.form_name),
    inquiry_type: normalizeString(payload.inquiry_type),
    email_domain: normalizeString(payload.email).split('@').pop()?.toLowerCase() || '',
    ip,
    page_url: normalizeString(payload.page_url),
    timestamp: new Date().toISOString()
  };
  context.log.warn(JSON.stringify(entry));
}

function logAccepted(context, req, payload) {
  context.log(JSON.stringify({
    event: 'form_accepted',
    form_name: normalizeString(payload.form_name),
    inquiry_type: normalizeString(payload.inquiry_type),
    email_domain: normalizeString(payload.email).split('@').pop()?.toLowerCase() || '',
    ip: getClientIp(req),
    timestamp: new Date().toISOString()
  }));
}

function isRateLimited(key, now = Date.now()) {
  const recent = (rateLimitStore.get(key) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitStore.set(key, recent);
  return false;
}

function hasExpectedFrontDoorHeader(req) {
  const expectedFrontDoorId = process.env.AZURE_FRONT_DOOR_ID;
  if (!expectedFrontDoorId) return true;
  return getHeader(req, 'x-azure-fdid') === expectedFrontDoorId;
}

function validatePayload(payload, now = Date.now()) {
  const name = normalizeString(payload.full_name);
  const email = normalizeString(payload.email).toLowerCase();
  const emailDomain = email.split('@').pop() || '';
  const message = normalizeString(payload.message);
  const inquiryType = normalizeString(payload.inquiry_type);
  const renderedAt = Number(payload.form_rendered_at);
  const bodyForSpamChecks = [
    name,
    normalizeString(payload.organization),
    normalizeString(payload.reason_for_inquiry),
    normalizeString(payload.goal),
    message
  ].join(' ');

  if (normalizeString(payload.company_website) || normalizeString(payload.fax_number)) {
    return { blocked: true, reason: 'honeypot_filled' };
  }
  if (!Number.isFinite(renderedAt) || now - renderedAt < MIN_SUBMIT_MS) {
    return { blocked: true, reason: 'submitted_too_fast' };
  }
  if (!isValidEmail(email) || disposableEmailDomains.has(emailDomain)) {
    return { validationError: true, code: 'invalid_email', message: 'Please enter a valid email address.' };
  }
  if (name.length < 2 || name.length > 80 || hasFakeNamePattern(name)) {
    return { validationError: true, code: 'invalid_name', message: 'Please enter your name using 2 to 80 characters.' };
  }
  if (message.length < 20 || message.length > 2000) {
    return { validationError: true, code: 'invalid_message', message: 'Please enter a message between 20 and 2000 characters.' };
  }
  if (!allowedInquiryTypes.has(inquiryType)) {
    return { validationError: true, code: 'invalid_inquiry_type', message: 'Please choose an inquiry type.' };
  }
  if (!normalizeString(payload.organization) || !normalizeString(payload.reason_for_inquiry) || !normalizeString(payload.goal) || !normalizeString(payload.timeline) || normalizeString(payload.contact_policy_confirm) !== 'yes') {
    return { validationError: true, code: 'missing_required_fields', message: 'Please complete all required fields.' };
  }

  const linkCount = countLinks(bodyForSpamChecks);
  if (linkCount > 2) {
    return { blocked: true, reason: 'too_many_links' };
  }
  if (hasSpamKeywords(bodyForSpamChecks) || hasExcessivePunctuation(bodyForSpamChecks)) {
    return { blocked: true, reason: 'spam_keywords' };
  }

  return { ok: true, linkCount };
}

function buildForwardPayload(payload, req, linkCount) {
  return {
    form_name: normalizeString(payload.form_name),
    full_name: normalizeString(payload.full_name),
    email: normalizeString(payload.email),
    organization: normalizeString(payload.organization),
    inquiry_type: normalizeString(payload.inquiry_type),
    reason_for_inquiry: normalizeString(payload.reason_for_inquiry),
    goal: normalizeString(payload.goal),
    timeline: normalizeString(payload.timeline),
    budget_range: normalizeString(payload.budget_range),
    contact_policy_confirm: normalizeString(payload.contact_policy_confirm),
    message: normalizeString(payload.message),
    page_url: normalizeString(payload.page_url),
    submitted_at: new Date().toISOString(),
    utm_source: normalizeString(payload.utm_source),
    utm_medium: normalizeString(payload.utm_medium),
    utm_campaign: normalizeString(payload.utm_campaign),
    utm_term: normalizeString(payload.utm_term),
    utm_content: normalizeString(payload.utm_content),
    link_count: linkCount,
    ip: getClientIp(req)
  };
}

function buildEmailText(data) {
  const labels = {
    form_name: 'Form',
    full_name: 'Full name',
    email: 'Email',
    organization: 'Organization / affiliation',
    inquiry_type: 'Inquiry type',
    reason_for_inquiry: 'Reason for inquiry',
    goal: 'What they hope to accomplish',
    timeline: 'Timeline for engagement',
    budget_range: 'Estimated budget or funding range',
    contact_policy_confirm: 'Contact policy confirmed',
    message: 'Message',
    page_url: 'Page URL',
    submitted_at: 'Submitted at',
    utm_source: 'UTM source',
    utm_medium: 'UTM medium',
    utm_campaign: 'UTM campaign',
    utm_term: 'UTM term',
    utm_content: 'UTM content',
    link_count: 'Detected links',
    ip: 'IP'
  };

  return Object.entries(labels)
    .map(([key, label]) => {
      const value = normalizeString(String(data[key] || ''));
      return value ? `${label}: ${value}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function buildMailtoUrl(data) {
  const subject = `AARI Inquiry: ${data.inquiry_type} - ${data.organization || data.full_name}`;
  return `mailto:nolan@atlanta-robotics.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildEmailText(data))}`;
}

async function forwardSubmission(data) {
  if (process.env.CONTACT_WEBHOOK_URL) {
    const response = await fetch(process.env.CONTACT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`webhook_http_${response.status}`);
    return { delivered: true };
  }

  if (process.env.SENDGRID_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.CONTACT_FROM_EMAIL) {
    const subject = `AARI Inquiry: ${data.inquiry_type} - ${data.organization || data.full_name}`;
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: process.env.CONTACT_TO_EMAIL }] }],
        from: { email: process.env.CONTACT_FROM_EMAIL, name: 'AARI Website' },
        reply_to: { email: data.email, name: data.full_name },
        subject,
        content: [{ type: 'text/plain', value: buildEmailText(data) }]
      })
    });
    if (!response.ok) throw new Error(`sendgrid_http_${response.status}`);
    return { delivered: true };
  }

  return { delivered: false, mailto: buildMailtoUrl(data) };
}

async function handleRequest(context, req) {
  const payload = req.body || {};
  const ip = getClientIp(req);
  const validation = validatePayload(payload);

  if (validation.validationError) {
    if (validation.code === 'invalid_email') logBlocked(context, 'invalid_email', req, payload);
    return validationResponse(validation.message, validation.code);
  }

  if (validation.blocked) {
    logBlocked(context, validation.reason, req, payload);
    return successResponse();
  }

  if (isRateLimited(ip)) {
    logBlocked(context, 'rate_limited', req, payload);
    return successResponse();
  }

  if (!hasExpectedFrontDoorHeader(req)) {
    logBlocked(context, 'frontdoor_header_failed', req, payload);
    return successResponse();
  }

  const forwardPayload = buildForwardPayload(payload, req, validation.linkCount);
  const delivery = await forwardSubmission(forwardPayload);
  logAccepted(context, req, payload);
  return jsonResponse(200, {
    ok: true,
    message: GENERIC_SUCCESS,
    ...(delivery.mailto ? { mailto: delivery.mailto } : {})
  });
}

module.exports = async function (context, req) {
  try {
    context.res = await handleRequest(context, req);
  } catch (error) {
    context.log.error(JSON.stringify({
      event: 'form_delivery_failed',
      reason: error.message,
      timestamp: new Date().toISOString()
    }));
    context.res = jsonResponse(500, {
      ok: false,
      code: 'delivery_failed',
      message: 'We could not send your message right now. Please try the contact form again later.'
    });
  }
};

module.exports._private = {
  validatePayload,
  isRateLimited,
  countLinks,
  hasSpamKeywords,
  buildForwardPayload
};
