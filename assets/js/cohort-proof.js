(function () {
    const indexProofSection = document.getElementById('site-2-progress');
    if (indexProofSection) {
        indexProofSection.setAttribute('aria-labelledby', 'summer-2026-proof-summary');
        indexProofSection.innerHTML = `
            <div class="section-shell grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
                <div>
                    <div class="section-kicker mb-5"><i data-lucide="badge-check" class="w-4 h-4"></i>Summer 2026 cohort complete</div>
                    <h2 id="summer-2026-proof-summary" class="text-3xl md:text-5xl font-bold leading-tight mb-5">From Training Activity to Documented Proof</h2>
                    <div class="space-y-4 text-lg text-slatebrand-300 leading-relaxed">
                        <p>The Summer 2026 cohort is closed. AARI's six-participant weekly ledger now documents <strong class="text-white">483 participant-hours</strong> across <strong class="text-white">at least 150 participant-days</strong> and 35 of 42 expected weekly entries, including the September 4 closeout submission. These are documented minimums because five of six expected final-week reports were not present in the reviewed closeout record.</p>
                        <p>Progress reports document work across Linux, Git, SSH, networking, cloud services, infrastructure monitoring, cybersecurity, ROS 2 and robot integration, curriculum development, database design, application prototypes, and technical handoff. The strongest lesson is equally important: the learning model worked, but artifact capture and closeout discipline must improve.</p>
                    </div>
                    <div class="mt-7 flex flex-wrap gap-3">
                        <a href="impact.html#summer-2026-results" class="inline-flex items-center gap-2 bg-electric-500 hover:bg-electric-400 text-white font-bold px-6 py-3 rounded-xl transition-colors">Review Full Cohort Results <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
                        <a href="impact-methodology.html" class="inline-flex items-center gap-2 border border-white/15 hover:border-gold-400/40 text-white font-semibold px-6 py-3 rounded-xl transition-colors">See Measurement Method</a>
                    </div>
                </div>
                <figure class="glass-panel rounded-3xl overflow-hidden border border-white/10">
                    <img src="images/data-center-site-2/aari-solar-colocation-team.webp" alt="AARI scholars and partners during Summer 2026 hands-on data-center infrastructure work." class="w-full h-[26rem] object-cover object-center" width="1050" height="1400" loading="lazy">
                    <div class="grid sm:grid-cols-3 gap-px border-t border-white/10 bg-white/10">
                        <div class="bg-navy-900 p-4"><p class="text-2xl font-extrabold text-gold-400">483</p><p class="mt-1 text-xs text-slatebrand-300">Documented participant-hours</p></div>
                        <div class="bg-navy-900 p-4"><p class="text-2xl font-extrabold text-gold-400">150+</p><p class="mt-1 text-xs text-slatebrand-300">Recorded participant-days</p></div>
                        <div class="bg-navy-900 p-4"><p class="text-2xl font-extrabold text-gold-400">$115K</p><p class="mt-1 text-xs text-slatebrand-300">Student-reported infrastructure placement*</p></div>
                    </div>
                    <figcaption class="p-5 text-sm text-slatebrand-300 leading-relaxed">Summer 2026 infrastructure work is now reported as outcomes, artifacts, and operating lessons rather than work in progress. <span class="text-xs text-slatebrand-400">*Student-reported compensation; employer confirmation is not represented.</span></figcaption>
                </figure>
            </div>`;
    }

    const infrastructureProofSection = document.getElementById('site-2');
    if (infrastructureProofSection && window.location.pathname.endsWith('infrastructure.html')) {
        infrastructureProofSection.setAttribute('aria-labelledby', 'infrastructure-cohort-proof-heading');
        infrastructureProofSection.innerHTML = `
            <div class="max-w-7xl mx-auto px-6">
                <div class="text-center max-w-4xl mx-auto mb-14">
                    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-900/30 border border-green-500/30 text-green-300 text-sm font-medium mb-6">
                        <i data-lucide="badge-check" class="w-4 h-4"></i>
                        Summer 2026 Cohort Complete
                    </div>
                    <h2 id="infrastructure-cohort-proof-heading" class="text-3xl md:text-4xl font-bold mb-4">Students Built Across the Infrastructure Stack</h2>
                    <p class="text-slate-400 text-lg leading-relaxed">The summer program is no longer reported as a construction milestone. The closeout record now shows what students actually did: 483 documented participant-hours, at least 150 participant-days, cross-layer technical work, public artifacts, and a measurable set of lessons for the next cohort.</p>
                </div>

                <div class="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    <article class="glass-panel rounded-2xl p-7 border-t-4 border-blue-500">
                        <div class="flex items-center gap-3 mb-5"><div class="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/30"><i data-lucide="server" class="text-blue-400 w-6 h-6"></i></div><h3 class="text-xl font-bold">Infrastructure-Up Work</h3></div>
                        <ul class="space-y-3 text-sm text-slate-300">
                            <li>Linux, SSH, Git, networking, and systems documentation</li>
                            <li>Data-center orchestration and database design</li>
                            <li>Cloud services, infrastructure monitoring, and cybersecurity</li>
                            <li>ROS 2, robot integration, and physical-system troubleshooting</li>
                        </ul>
                    </article>

                    <article class="glass-panel rounded-2xl p-7 border-t-4 border-amber-500">
                        <div class="flex items-center gap-3 mb-5"><div class="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/30"><i data-lucide="folder-check" class="text-amber-400 w-6 h-6"></i></div><h3 class="text-xl font-bold">Evidence Produced</h3></div>
                        <ul class="space-y-3 text-sm text-slate-300">
                            <li>Data-center orchestration code and educational-suite code</li>
                            <li>Linux, networking, and computer-architecture curriculum</li>
                            <li>Cloud-security projects and application prototypes</li>
                            <li>Twenty-one of 35 weekly entries included a labeled evidence section</li>
                        </ul>
                    </article>

                    <article class="glass-panel rounded-2xl p-7 border-t-4 border-green-500">
                        <div class="flex items-center gap-3 mb-5"><div class="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/30"><i data-lucide="clipboard-check" class="text-green-400 w-6 h-6"></i></div><h3 class="text-xl font-bold">What Changes Next</h3></div>
                        <ul class="space-y-3 text-sm text-slate-300">
                            <li>One verified roster and access record from day one</li>
                            <li>Weekly artifact gates instead of end-of-cohort reconstruction</li>
                            <li>Earlier README, demo, resume, and technical-handoff reviews</li>
                            <li>Completed results stay separate from future goals</li>
                        </ul>
                    </article>
                </div>

                <div class="mt-10 max-w-6xl mx-auto glass-panel rounded-2xl p-6 md:p-7 border border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div>
                        <p class="text-sm uppercase tracking-[0.18em] text-green-300 mb-2">Workforce signal</p>
                        <p class="text-lg text-slate-300"><strong class="text-white">$115,000 student-reported infrastructure placement.</strong> AARI reports this as student-reported compensation and does not represent employer confirmation.</p>
                    </div>
                    <a href="impact.html#summer-2026-results" class="shrink-0 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">View Verified Results <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
                </div>
            </div>`;
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}());
