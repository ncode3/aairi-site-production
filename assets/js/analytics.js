(function () {
    const config = window.AARI_ANALYTICS_CONFIG || {};
    const ga4MeasurementId = String(config.ga4MeasurementId || '').trim();
    const hasGtag = typeof window.gtag === 'function';
    const isConfiguredGa4 = /^G-[A-Z0-9]+$/i.test(ga4MeasurementId);
    const pagePath = () => window.location.pathname + window.location.search + window.location.hash;
    const pageParams = () => ({
        page_path: pagePath(),
        page_title: document.title,
        page_location: window.location.href
    });
    const cleanParams = (params) => {
        const allowed = new Set([
            'page_path',
            'page_title',
            'page_location',
            'location',
            'form_name',
            'inquiry_type',
            'lead_score_bucket',
            'block_reason',
            'cta',
            'destination'
        ]);
        return Object.entries(params || {}).reduce((safe, [key, value]) => {
            if (allowed.has(key) && value !== undefined && value !== null && value !== '') {
                safe[key] = String(value);
            }
            return safe;
        }, {});
    };
    const sendEvent = (eventName, params) => {
        if (!hasGtag) return;
        window.gtag('event', eventName, cleanParams({ page_path: pagePath(), ...params }));
    };
    const findLocation = (element) => {
        if (window.location.pathname.endsWith('/donate.html')) return 'donate_page';
        if (element.closest('nav')) return 'nav';
        if (element.closest('footer')) return 'footer';
        if (element.closest('form')) return 'form_confirmation';
        if (element.closest('main section')) return 'hero';
        return 'page';
    };
    const scoreBucket = (score) => {
        if (score >= 7) return 'high';
        if (score >= 3) return 'medium';
        return 'low';
    };

    if (hasGtag && isConfiguredGa4) {
        window.gtag('config', ga4MeasurementId, { send_page_view: false });
    }

    sendEvent('page_view', pageParams());

    document.addEventListener('click', (event) => {
        const target = event.target.closest('a, button');
        if (!target) return;
        const href = target.getAttribute('href') || '';
        const label = (target.textContent || '').trim().toLowerCase();
        const configuredEvent = target.dataset.analyticsEvent;
        if (configuredEvent) {
            sendEvent(configuredEvent, {
                location: target.dataset.analyticsLocation || findLocation(target),
                cta: target.dataset.analyticsCta || label,
                destination: href
            });
        }
        const isDonate = target.classList.contains('donate-cta') ||
            href.includes('donate.html') ||
            href.includes('buy.stripe.com') ||
            label === 'donate' ||
            label === 'donate now';
        if (isDonate) {
            sendEvent('donate_click', { location: findLocation(target) });
            return;
        }

        const isPartnerCta = href.includes('#contact') ||
            href.includes('#become-partner') ||
            href.includes('subject=Partnership') ||
            label.includes('partner with') ||
            label.includes('fund ai') ||
            label.includes('funder brief') ||
            label.includes('become a partner') ||
            label.includes('partnership discussion') ||
            label.includes('funder conversation');
        if (isPartnerCta) {
            sendEvent('partner_cta_click', { location: findLocation(target) });
        }
    });

    document.querySelectorAll('form[data-secure-intake]').forEach((form) => {
        const markStarted = () => {
            if (form.dataset.analyticsStarted === 'true') return;
            form.dataset.analyticsStarted = 'true';
            const inquiryType = form.querySelector('[name="inquiry_type"]')?.value || '';
            sendEvent('form_start', {
                form_name: form.dataset.formName || form.querySelector('[name="form_name"]')?.value || 'Inquiry form',
                inquiry_type: inquiryType
            });
        };
        form.addEventListener('focusin', markStarted, { once: true });
        form.addEventListener('change', markStarted, { once: true });
    });

    window.AARIAnalytics = {
        pageView: () => sendEvent('page_view', pageParams()),
        trackFormSubmit: ({ formName, inquiryType, score }) => sendEvent('form_submit', {
            form_name: formName,
            inquiry_type: inquiryType,
            lead_score_bucket: scoreBucket(Number(score || 0))
        }),
        trackFormBlocked: ({ formName, blockReason }) => sendEvent('form_blocked', {
            form_name: formName,
            block_reason: blockReason
        })
    };
}());
