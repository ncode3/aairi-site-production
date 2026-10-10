lucide.createIcons();

        const mobileToggle = document.getElementById('mobile-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        mobileToggle?.addEventListener('click', () => {
            const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
            mobileToggle.setAttribute('aria-expanded', String(!expanded));
            mobileMenu.classList.toggle('hidden');
        });

        document.querySelectorAll('#mobile-menu a').forEach((link) => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                mobileToggle?.setAttribute('aria-expanded', 'false');
            });
        });

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animateMetricValue = (card) => {
            if (prefersReducedMotion || card.dataset.metricAnimated === 'true') return;
            const span = card.querySelector('[id^="metric-"]');
            if (!span) return;
            const finalText = span.textContent.trim();
            const numberMatch = finalText.match(/[\d,.]+/);
            if (!numberMatch) return;
            const finalNumber = Number(numberMatch[0].replace(/,/g, ''));
            if (!Number.isFinite(finalNumber)) return;
            const prefix = finalText.slice(0, numberMatch.index);
            const suffix = finalText.slice((numberMatch.index || 0) + numberMatch[0].length);
            const duration = 900;
            const startedAt = performance.now();
            card.dataset.metricAnimated = 'true';
            const tick = (now) => {
                const progress = Math.min((now - startedAt) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                span.textContent = `${prefix}${Math.round(finalNumber * eased).toLocaleString()}${suffix}`;
                if (progress < 1) requestAnimationFrame(tick);
                else span.textContent = finalText;
            };
            requestAnimationFrame(tick);
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    if (entry.target.classList.contains('metric-card')) {
                        animateMetricValue(entry.target);
                    }
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        document.querySelectorAll('.glass-panel, .doctrine-card, .lane-card, .proof-card, .metric-card, .profile-card, .trust-card, .fund-card, .stack-card, .timeline-card, .field-card, .qual-stat, [data-reveal-sequence]').forEach((el) => {
            el.classList.add('fade-in-up');
            observer.observe(el);
        });

        document.querySelectorAll('.stack-card').forEach((card) => {
            card.addEventListener('click', () => {
                const expanded = card.getAttribute('aria-expanded') === 'true';
                document.querySelectorAll('.stack-card[aria-expanded="true"]').forEach((openCard) => {
                    if (openCard !== card) openCard.setAttribute('aria-expanded', 'false');
                });
                card.setAttribute('aria-expanded', String(!expanded));
            });
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    card.click();
                }
            });
        });

        document.querySelectorAll('[data-expandable-card]').forEach((card) => {
            const button = card.querySelector('button[aria-expanded][aria-controls]');
            if (!button) return;
            const collapsedLabel = button.textContent;
            button.dataset.collapsedLabel = collapsedLabel;
            button.addEventListener('click', () => {
                const expanded = button.getAttribute('aria-expanded') === 'true';
                const group = card.closest('[data-expandable-group]');
                group?.querySelectorAll('[data-expandable-card].is-expanded').forEach((openCard) => {
                    if (openCard === card) return;
                    openCard.classList.remove('is-expanded');
                    const openButton = openCard.querySelector('button[aria-expanded]');
                    if (!openButton) return;
                    openButton.setAttribute('aria-expanded', 'false');
                    openButton.textContent = openButton.dataset.collapsedLabel || 'Learn more';
                });
                card.classList.toggle('is-expanded', !expanded);
                button.setAttribute('aria-expanded', String(!expanded));
                button.textContent = expanded ? button.dataset.collapsedLabel : 'Show less';
            });
        });

        const partnerEcosystem = [
            {
                name: 'NVIDIA',
                category: 'Cloud',
                status: 'Active - relationship deepening',
                role: "Supports AARI's compute, CUDA-Q, Jetson edge AI, Omniverse, and quantum curriculum pathway.",
                logo: 'images/logo-nvidia.png'
            },
            {
                name: 'Microsoft',
                category: 'Cloud',
                status: '2026 Grant Partner - $35,000 + 42U rack',
                role: "Microsoft Community Affairs awarded AARI $35,000 for the Infrastructure Foundations and Datacenter Career Pathways Cohort and donated a full 42U server rack for student training.",
                logo: 'images/logo-microsoft.webp'
            },
            {
                name: 'Red Hat',
                category: 'Cloud',
                status: 'Active - internal champion in place',
                role: 'Supports open infrastructure learning across OpenShift, Linux, containers, automation, and certification pathways.',
                logo: 'images/logo-redhat.png'
            },
            {
                name: 'AWS',
                category: 'Cloud',
                status: 'Active - alliance accepted',
                role: "Supports AARI's cloud and ML pathway through AWS-MLU alignment, lab infrastructure, and Nexus deployment patterns."
            },
            {
                name: 'QTS Data Centers',
                category: 'Data Centers',
                status: '2026 Grant Partner - $15,000',
                role: "QTS awarded AARI a $15,000 grant in 2026 to support general operations and strengthen AARI's data center and AI infrastructure workforce pathway.",
                logo: 'assets/logos/qts-logo.svg'
            },
            {
                name: 'Morehouse College',
                category: 'Academic',
                status: 'Active - anchor institution',
                role: "Core academic anchor for AARI's AUC student pipeline, faculty collaboration, and hybrid quantum curriculum.",
                logo: 'images/logo-morehouse.png'
            },
            {
                name: 'Cisco',
                category: 'Cloud',
                status: 'Closed - funded',
                role: 'Funded AARI through a $25K community grant and validates the networking layer of the infrastructure model.',
                logo: 'images/logo-cisco.svg'
            },
            {
                name: 'Rose-Hulman Institute of Technology',
                category: 'Academic',
                status: 'Active - Co-PI engaged',
                role: "Adds nationally recognized robotics curriculum depth through Dr. Carlotta A. Berry's NSF Co-PI engagement.",
                logo: 'images/logo-rose-hulman.svg'
            },
            {
                name: 'ATDC / Georgia Tech',
                category: 'Community',
                status: 'Active - ongoing',
                role: "Connects AARI to Atlanta's tech ecosystem and supports curriculum review through the ATDC network.",
                logo: 'images/logo-atdc.webp'
            },
            {
                name: 'Google Cloud',
                category: 'Cloud',
                status: 'Early discussion',
                role: "Supports AARI's multi-cloud posture and future AI services, credits, and lab integration pathways.",
                logo: 'images/logo-google-cloud.png'
            },
            {
                name: 'Waymo',
                category: 'Robotics',
                status: 'Event participation - August 27, 2026',
                role: 'Waymo representatives participated in the August 27 back-to-school robotics event. Ongoing instruction or supervision is not represented.',
                logo: 'images/logo-waymo.png'
            },
            {
                name: 'Benevity',
                category: 'Philanthropy',
                status: 'Active - approved',
                role: 'Supports corporate matching and donor platform access where employer programs make AARI eligible.',
                logo: 'images/logo-benevity.svg'
            },
            {
                name: 'a16z Cultural Leadership Fund',
                category: 'Philanthropy',
                status: 'Ecosystem Partner Program - renewable support',
                role: "Renewable support recognizing AARI's work expanding access to the infrastructure layer of AI for HBCU students and underrepresented technical talent.",
                logo: 'assets/logos/a16z-logo.svg'
            }
        ];

        const escapePartnerText = (value) => String(value).replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));

        const installPartnerCarousels = () => {
            document.querySelectorAll('[data-partner-carousel]').forEach((carousel) => {
                const track = carousel.querySelector('[data-carousel-track]');
                const dots = carousel.querySelector('[data-carousel-dots]');
                const filters = carousel.querySelector('[data-partner-filters]');
                const viewport = carousel.querySelector('.partner-carousel-viewport');
                const prev = carousel.querySelector('[data-carousel-prev]');
                const next = carousel.querySelector('[data-carousel-next]');
                let index = 0;
                let cardsPerView = 3;
                let startX = 0;
                let activeFilter = 'All';

                const getCardsPerView = () => {
                    if (window.matchMedia('(max-width: 640px)').matches) return 1;
                    if (window.matchMedia('(max-width: 1024px)').matches) return 2;
                    return 3;
                };

                const renderCards = () => {
                    const filteredPartners = activeFilter === 'All'
                        ? partnerEcosystem
                        : partnerEcosystem.filter((partner) => partner.category === activeFilter);
                    track.innerHTML = filteredPartners.map((partner) => {
                        const name = escapePartnerText(partner.name);
                        const category = escapePartnerText(partner.category);
                        const role = escapePartnerText(partner.role);
                        const mark = partner.logo
                            ? `<div class="partner-logo-box" data-logo-box><img src="${escapePartnerText(partner.logo)}" alt="${name}" loading="lazy" data-logo-fallback="${name}"></div>`
                            : `<div class="partner-text-mark"><span>${name}</span></div>`;
                        return `
                            <article class="partner-slide" aria-label="${name}, ${category}">
                                <div class="partner-story-card glass-panel rounded-3xl p-5 border border-white/10" tabindex="0" data-role="${role}">
                                    ${mark}
                                    <p class="mt-5 text-xs uppercase tracking-[0.2em] text-electric-400 font-bold">${category}</p>
                                    <p class="mt-2 text-xs text-slatebrand-500">${escapePartnerText(partner.status || '')}</p>
                                    <h4 class="mt-3 text-xl font-bold text-white">${name}</h4>
                                    <p class="mt-3 text-sm leading-relaxed text-slatebrand-300">${role}</p>
                                </div>
                            </article>`;
                    }).join('');
                    track.querySelectorAll('[data-logo-fallback]').forEach((img) => {
                        img.addEventListener('error', () => {
                            const fallbackName = escapePartnerText(img.dataset.logoFallback || 'Partner');
                            img.closest('[data-logo-box]').outerHTML = `<div class="partner-text-mark"><span>${fallbackName}</span></div>`;
                        }, { once: true });
                    });
                };

                const visiblePartners = () => activeFilter === 'All'
                    ? partnerEcosystem
                    : partnerEcosystem.filter((partner) => partner.category === activeFilter);

                const maxIndex = () => Math.max(visiblePartners().length - cardsPerView, 0);

                const renderDots = () => {
                    const pageCount = Math.max(Math.ceil(visiblePartners().length / cardsPerView), 1);
                    const activePage = Math.min(Math.floor(index / cardsPerView), pageCount - 1);
                    dots.innerHTML = Array.from({ length: pageCount }, (_, page) => `
                        <button type="button" class="partner-dot h-2.5 w-2.5 rounded-full border border-white/20 bg-white/20" data-carousel-dot="${page}" aria-label="Show partner group ${page + 1}" aria-current="${page === activePage ? 'true' : 'false'}"></button>
                    `).join('');
                    dots.querySelectorAll('[data-carousel-dot]').forEach((dot) => {
                        dot.addEventListener('click', () => {
                            const page = Number(dot.dataset.carouselDot);
                            index = page === pageCount - 1 ? maxIndex() : Math.min(page * cardsPerView, maxIndex());
                            update();
                        });
                    });
                };

                const update = () => {
                    cardsPerView = getCardsPerView();
                    index = Math.min(index, maxIndex());
                    const slide = track.querySelector('.partner-slide');
                    if (!slide) return;
                    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
                    const offset = index * (slide.getBoundingClientRect().width + gap);
                    track.style.transform = `translateX(-${offset}px)`;
                    prev.disabled = index === 0;
                    next.disabled = index >= maxIndex();
                    prev.classList.toggle('opacity-40', prev.disabled);
                    next.classList.toggle('opacity-40', next.disabled);
                    renderDots();
                };

                renderCards();
                renderDots();
                update();
                filters?.querySelectorAll('[data-filter]').forEach((button) => {
                    button.addEventListener('click', () => {
                        activeFilter = button.dataset.filter || 'All';
                        index = 0;
                        filters.querySelectorAll('[data-filter]').forEach((filterButton) => {
                            filterButton.setAttribute('aria-pressed', String(filterButton === button));
                        });
                        renderCards();
                        update();
                    });
                });

                prev.addEventListener('click', () => {
                    index = Math.max(index - cardsPerView, 0);
                    update();
                });
                next.addEventListener('click', () => {
                    index = Math.min(index + cardsPerView, maxIndex());
                    update();
                });
                viewport.addEventListener('keydown', (event) => {
                    if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        prev.click();
                    }
                    if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        next.click();
                    }
                });
                viewport.addEventListener('touchstart', (event) => {
                    startX = event.touches[0].clientX;
                }, { passive: true });
                viewport.addEventListener('touchend', (event) => {
                    const delta = event.changedTouches[0].clientX - startX;
                    if (Math.abs(delta) < 40) return;
                    if (delta < 0) next.click();
                    if (delta > 0) prev.click();
                });
                window.addEventListener('resize', update);
            });
        };
        installPartnerCarousels();

        const formatImpactUpdatedAt = (isoValue) => {
            const updatedAt = new Date(isoValue);
            if (Number.isNaN(updatedAt.getTime())) return '';
            const elapsedSeconds = Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 1000));
            if (elapsedSeconds < 60) return 'Updated just now';
            const elapsedMinutes = Math.round(elapsedSeconds / 60);
            if (elapsedMinutes < 60) return `Updated ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;
            const elapsedHours = Math.round(elapsedMinutes / 60);
            if (elapsedHours < 24) return `Updated ${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
            const elapsedDays = Math.round(elapsedHours / 24);
            return `Updated ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
        };

        const hydrateImpactMetrics = async () => {
            try {
                const response = await fetch('/api/impact', {
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok) return;
                const payload = await response.json();
                if (!Array.isArray(payload.metrics)) return;

                payload.metrics.forEach((metric) => {
                    if (!metric || !metric.id || typeof metric.display !== 'string') return;
                    const target = document.getElementById(`metric-${metric.id}`);
                    if (target) target.textContent = metric.display;
                });

                const latestUpdatedAt = payload.metrics
                    .map((metric) => metric.updated_at)
                    .filter(Boolean)
                    .sort()
                    .at(-1);
                const indicator = document.getElementById('impact-live-updated');
                const updatedText = latestUpdatedAt ? formatImpactUpdatedAt(latestUpdatedAt) : '';
                if (indicator && updatedText) {
                    indicator.textContent = `${updatedText} from AARIImpactMetrics.`;
                    indicator.classList.remove('hidden');
                }
            } catch (error) {
                // Static fallback values remain visible if the API or backing store is unavailable.
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hydrateImpactMetrics, { once: true });
        } else {
            hydrateImpactMetrics();
        }

        const confirmationText = 'Thanks. Your message has been received.';

        const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
        const populateSourceFields = (form) => {
            const params = new URLSearchParams(window.location.search);
            const fields = {
                page_url: window.location.href,
                timestamp: new Date().toISOString(),
                form_rendered_at: form.dataset.loadedAt || String(Date.now()),
                utm_source: params.get('utm_source') || '',
                utm_medium: params.get('utm_medium') || '',
                utm_campaign: params.get('utm_campaign') || '',
                utm_term: params.get('utm_term') || '',
                utm_content: params.get('utm_content') || ''
            };
            Object.entries(fields).forEach(([name, value]) => {
                const input = form.querySelector(`[name="${name}"]`);
                if (input) input.value = value;
            });
        };

        const showFormMessage = (element, message) => {
            if (!element) return;
            element.textContent = message;
            element.classList.add('visible');
        };

        const formDataToPayload = (formData) => {
            const payload = {};
            formData.forEach((value, key) => {
                payload[key] = value.toString();
            });
            return payload;
        };

        const installSecureIntakeForms = () => {
            document.querySelectorAll('form[data-secure-intake]').forEach((form) => {
                form.dataset.loadedAt = String(Date.now());
                populateSourceFields(form);
                form.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const confirmation = form.querySelector('.form-confirmation');
                    const errorMessage = form.querySelector('.form-error');
                    const submitButton = form.querySelector('button[type="submit"]');
                    confirmation?.classList.remove('visible');
                    errorMessage?.classList.remove('visible');
                    const formName = form.dataset.formName || form.querySelector('[name="form_name"]')?.value || 'Inquiry form';

                    const emailInput = form.querySelector('[name="email"]');
                    emailInput?.setCustomValidity('');
                    if (!form.reportValidity()) return;
                    populateSourceFields(form);

                    const data = new FormData(form);
                    const email = (data.get('email') || '').toString().trim();
                    const message = (data.get('message') || '').toString().trim();

                    if (!isValidEmail(email)) {
                        window.AARIAnalytics?.trackFormBlocked({ formName, blockReason: 'invalid_email' });
                        emailInput?.setCustomValidity('Please enter a valid email address.');
                        emailInput?.reportValidity();
                        return;
                    }

                    if (message.length < 20 || message.length > 2000) {
                        showFormMessage(errorMessage, 'Please enter a message between 20 and 2000 characters.');
                        return;
                    }

                    submitButton.disabled = true;
                    submitButton.textContent = 'Sending...';

                    try {
                        const response = await fetch('/api/submit-inquiry', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(formDataToPayload(data))
                        });
                        const result = await response.json().catch(() => ({}));

                        if (!response.ok) {
                            if (result.code) window.AARIAnalytics?.trackFormBlocked({ formName, blockReason: result.code });
                            showFormMessage(errorMessage, result.message || 'We could not send your message. Please try again later.');
                            return;
                        }

                        showFormMessage(confirmation, result.message || confirmationText);
                        window.AARIAnalytics?.trackFormSubmit({ formName, inquiryType: data.get('inquiry_type') || '' });
                        if (result.mailto) {
                            const emailLink = document.createElement('a');
                            emailLink.href = result.mailto;
                            emailLink.textContent = 'Open email draft';
                            emailLink.className = 'block mt-3 underline font-bold';
                            confirmation.appendChild(emailLink);
                            window.location.href = result.mailto;
                            return;
                        }
                        form.reset();
                        form.dataset.loadedAt = String(Date.now());
                        populateSourceFields(form);
                    } catch (error) {
                        showFormMessage(errorMessage, 'We could not send your message right now. Please try the contact form again later.');
                    } finally {
                        submitButton.disabled = false;
                        submitButton.textContent = form.id === 'funder-form' ? 'Send Funder Inquiry' : 'Send Inquiry';
                    }
                });
            });
        };
        const escapeEventHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
        const loadHomepageEvents = async () => {
            const grid = document.getElementById('upcoming-events-grid');
            if (!grid) return;
            try {
                const response = await fetch('assets/data/events.json', { cache: 'no-store' });
                if (!response.ok) throw new Error('Events could not be loaded');
                const events = (await response.json()).sort((a, b) => a.date.localeCompare(b.date));
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
                const upcoming = events.filter((event) => event.date >= today).slice(0, 3);
                if (!upcoming.length) {
                    grid.innerHTML = '<div class="bright-card rounded-3xl p-6 md:col-span-2 xl:col-span-3"><p class="text-slatebrand-300">New dates will be added soon.</p><a href="events.html" class="mt-4 inline-flex font-extrabold text-gold-400">Open the events calendar →</a></div>';
                    return;
                }
                const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
                const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
                const eventDate = (event, field = 'startTime') => new Date(`${event.date}T${event[field] || '12:00'}:00-04:00`);
                grid.innerHTML = upcoming.map((event) => {
                    const time = event.allDay ? 'Time to be confirmed' : `${timeFormatter.format(eventDate(event))}–${timeFormatter.format(eventDate(event, 'endTime'))} ET`;
                    return `<article class="bright-card rounded-3xl p-6">
                        <div class="flex items-start justify-between gap-4">
                            <div><p class="text-sm font-extrabold uppercase tracking-[0.14em] text-gold-400">${escapeEventHtml(dateFormatter.format(eventDate(event)))}</p><p class="mt-1 text-xs font-semibold text-slatebrand-400">${escapeEventHtml(time)}</p></div>
                            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slatebrand-300">${escapeEventHtml(event.audience)}</span>
                        </div>
                        <h3 class="mt-5 text-xl font-extrabold text-white">${escapeEventHtml(event.title)}</h3>
                        <p class="mt-3 text-sm leading-relaxed text-slatebrand-300">${escapeEventHtml(event.description)}</p>
                        <a href="events.html#event-${escapeEventHtml(event.id)}" class="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-gold-400 hover:text-gold-300">Event details <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
                    </article>`;
                }).join('');
                lucide.createIcons();
            } catch (error) {
                // Keep the static schedule when refreshing fails.
            }
        };
        loadHomepageEvents();
        installSecureIntakeForms();
