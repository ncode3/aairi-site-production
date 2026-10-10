lucide.createIcons();
        const partnerEcosystem = [
            {
                name: 'NVIDIA',
                category: 'Strategic Anchor',
                status: 'Active - relationship deepening',
                role: "Supports AARI's compute, CUDA-Q, Jetson edge AI, Omniverse, and quantum curriculum pathway.",
                logo: 'images/logo-nvidia.png'
            },
            {
                name: 'Microsoft',
                category: 'Strategic Anchor',
                status: '2026 Grant Partner - $35,000 + 42U rack',
                role: "Microsoft Community Affairs awarded AARI $35,000 for the Infrastructure Foundations and Datacenter Career Pathways Cohort and donated a full 42U server rack for student training.",
                logo: 'images/logo-microsoft.webp'
            },
            {
                name: 'Red Hat',
                category: 'Strategic Anchor',
                status: 'Active - internal champion in place',
                role: 'Supports open infrastructure learning across OpenShift, Linux, containers, automation, and certification pathways.',
                logo: 'images/logo-redhat.png'
            },
            {
                name: 'AWS',
                category: 'Strategic Anchor',
                status: 'Active - alliance accepted',
                role: "Supports AARI's cloud and ML pathway through AWS-MLU alignment, lab infrastructure, and Nexus deployment patterns."
            },
            {
                name: 'QTS Data Centers',
                category: 'Grant Partner',
                status: '2026 Grant Partner - $15,000',
                role: "General operating support for AARI's AI infrastructure and data center workforce pathway.",
                logo: 'assets/logos/qts-logo.svg'
            },
            {
                name: 'Morehouse College',
                category: 'Strategic Anchor (Academic)',
                status: 'Active - anchor institution',
                role: "Core academic anchor for AARI's AUC student pipeline, faculty collaboration, and hybrid quantum curriculum.",
                logo: 'images/logo-morehouse.png'
            },
            {
                name: 'Cisco',
                category: 'Pilot Partner',
                status: 'Closed - funded',
                role: 'Funded AARI through a $25K community grant and validates the networking layer of the infrastructure model.',
                logo: 'images/logo-cisco.svg'
            },
            {
                name: 'Rose-Hulman Institute of Technology',
                category: 'Pilot Partner (Academic)',
                status: 'Active - Co-PI engaged',
                role: "Adds nationally recognized robotics curriculum depth through Dr. Carlotta A. Berry's NSF Co-PI engagement.",
                logo: 'images/logo-rose-hulman.svg'
            },
            {
                name: 'ATDC / Georgia Tech',
                category: 'Community Sponsor',
                status: 'Active - ongoing',
                role: "Connects AARI to Atlanta's tech ecosystem and supports curriculum review through the ATDC network.",
                logo: 'images/logo-atdc.webp'
            },
            {
                name: 'Google Cloud',
                category: 'Community Sponsor',
                status: 'Early discussion',
                role: "Supports AARI's multi-cloud posture and future AI services, credits, and lab integration pathways.",
                logo: 'images/logo-google-cloud.png'
            },
            {
                name: 'Smart Illuminating Helmet',
                category: 'Equity Advisory',
                status: 'Active - advisory relationship',
                role: "Extends AARI's edge AI methodology into commercial hardware, telemetry, and Jetson-enabled proof-of-concept work."
            },
            {
                name: 'Benevity',
                category: 'Platform',
                status: 'Active - approved',
                role: 'Supports corporate matching and donor platform access where employer programs make AARI eligible.',
                logo: 'images/logo-benevity.svg'
            },
            {
                name: 'a16z Cultural Leadership Fund',
                category: 'Ecosystem Partner Program',
                status: 'Renewable support',
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
                const viewport = carousel.querySelector('.partner-carousel-viewport');
                const prev = carousel.querySelector('[data-carousel-prev]');
                const next = carousel.querySelector('[data-carousel-next]');
                let index = 0;
                let cardsPerView = 3;
                let startX = 0;

                const getCardsPerView = () => {
                    if (window.matchMedia('(max-width: 640px)').matches) return 1;
                    if (window.matchMedia('(max-width: 1024px)').matches) return 2;
                    return 3;
                };
                const maxIndex = () => Math.max(partnerEcosystem.length - cardsPerView, 0);
                const renderCards = () => {
                    track.innerHTML = partnerEcosystem.map((partner) => {
                        const name = escapePartnerText(partner.name);
                        const category = escapePartnerText(partner.category);
                        const role = escapePartnerText(partner.role);
                        const mark = partner.logo
                            ? `<div class="partner-logo-box" data-logo-box><img src="${escapePartnerText(partner.logo)}" alt="${name}" loading="lazy" data-logo-fallback="${name}"></div>`
                            : `<div class="partner-text-mark"><span>${name}</span></div>`;
                        return `
                            <article class="partner-slide" aria-label="${name}, ${category}">
                                <div class="partner-story-card glass-panel rounded-3xl p-5 border border-white/10">
                                    ${mark}
                                    <p class="mt-5 text-xs uppercase tracking-[0.2em] text-blue-400 font-bold">${category}</p>
                                    <p class="mt-2 text-xs text-slate-500">${escapePartnerText(partner.status || '')}</p>
                                    <h4 class="mt-3 text-xl font-bold text-white">${name}</h4>
                                    <p class="mt-3 text-sm leading-relaxed text-slate-400">${role}</p>
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
                const renderDots = () => {
                    const pageCount = Math.ceil(partnerEcosystem.length / cardsPerView);
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
                    track.style.transform = `translateX(-${index * (slide.getBoundingClientRect().width + gap)}px)`;
                    prev.disabled = index === 0;
                    next.disabled = index >= maxIndex();
                    prev.classList.toggle('opacity-40', prev.disabled);
                    next.classList.toggle('opacity-40', next.disabled);
                    renderDots();
                };

                renderCards();
                renderDots();
                update();
                prev.addEventListener('click', () => { index = Math.max(index - cardsPerView, 0); update(); });
                next.addEventListener('click', () => { index = Math.min(index + cardsPerView, maxIndex()); update(); });
                viewport.addEventListener('keydown', (event) => {
                    if (event.key === 'ArrowLeft') { event.preventDefault(); prev.click(); }
                    if (event.key === 'ArrowRight') { event.preventDefault(); next.click(); }
                });
                viewport.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
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

        const fadeElements = document.querySelectorAll('.fade-in-up');
        const fadeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
        }, { threshold: 0.1 });
        fadeElements.forEach(el => fadeObserver.observe(el));
