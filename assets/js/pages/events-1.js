const EVENT_DATA_URL = 'assets/data/events.json';
    const easternDate = (dateString) => new Date(`${dateString}T12:00:00-04:00`);
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' });
    const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
    const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
    const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    let events = [];
    let visibleMonth = new Date();

    const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
    const eventDateTime = (event, field = 'startTime') => new Date(`${event.date}T${event[field] || '12:00'}:00-04:00`);
    const formatTime = (event) => event.allDay ? 'Date only' : `${timeFormatter.format(eventDateTime(event))}–${timeFormatter.format(eventDateTime(event, 'endTime'))} ET`;
    const calendarUrl = (event) => {
      const formatStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.000Z$/, 'Z');
      const start = event.allDay ? event.date.replaceAll('-', '') : formatStamp(eventDateTime(event));
      const nextDay = new Date(easternDate(event.date)); nextDay.setDate(nextDay.getDate() + 1);
      const end = event.allDay ? nextDay.toISOString().slice(0,10).replaceAll('-', '') : formatStamp(eventDateTime(event, 'endTime'));
      const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${start}/${end}`, details: event.description, location: event.location });
      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    };

    function renderSelected(event) {
      const target = document.getElementById('selected-event');
      if (!event) return;
      target.innerHTML = `
        <div class="flex flex-wrap gap-2"><span class="rounded-full border border-gold-400/25 bg-gold-400/10 px-3 py-1 text-xs font-bold text-gold-300">${escapeHtml(event.category)}</span><span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">${escapeHtml(event.audience)}</span></div>
        <h2 id="selected-event-title" class="mt-5 text-2xl font-extrabold">${escapeHtml(event.title)}</h2>
        <div class="mt-5 space-y-3 text-sm text-slate-300">
          <p class="flex gap-3"><i data-lucide="calendar" class="mt-0.5 h-4 w-4 shrink-0 text-gold-300"></i><span>${escapeHtml(dateFormatter.format(easternDate(event.date)))}</span></p>
          <p class="flex gap-3"><i data-lucide="clock-3" class="mt-0.5 h-4 w-4 shrink-0 text-gold-300"></i><span>${escapeHtml(formatTime(event))}</span></p>
          <p class="flex gap-3"><i data-lucide="map-pin" class="mt-0.5 h-4 w-4 shrink-0 text-gold-300"></i><span>${escapeHtml(event.location)}</span></p>
        </div>
        <p class="mt-5 leading-relaxed text-slate-300">${escapeHtml(event.description)}</p>
        <div class="mt-6 flex flex-col sm:flex-row xl:flex-col 2xl:flex-row gap-3">
          ${event.url ? `<a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer" class="rounded-xl bg-white px-4 py-3 text-center text-sm font-extrabold text-navy-950 hover:bg-slate-100">${escapeHtml(event.cta || 'Event details')}</a>` : ''}
          <a href="${escapeHtml(calendarUrl(event))}" target="_blank" rel="noopener noreferrer" class="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white hover:border-gold-400/50">Add to calendar</a>
        </div>`;
      lucide.createIcons();
    }

    function renderCalendar() {
      const year = visibleMonth.getFullYear();
      const month = visibleMonth.getMonth();
      document.getElementById('calendar-title').textContent = monthFormatter.format(new Date(year, month, 15));
      const grid = document.getElementById('calendar-grid');
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const previousMonthDays = new Date(year, month, 0).getDate();
      const cells = [];
      for (let index = 0; index < 42; index += 1) {
        let cellDay = index - firstDay + 1;
        let cellMonth = month;
        let cellYear = year;
        let muted = false;
        if (cellDay < 1) { cellDay = previousMonthDays + cellDay; cellMonth -= 1; muted = true; }
        if (cellDay > daysInMonth && cellMonth === month) { cellDay -= daysInMonth; cellMonth += 1; muted = true; }
        if (cellMonth < 0) { cellMonth = 11; cellYear -= 1; }
        if (cellMonth > 11) { cellMonth = 0; cellYear += 1; }
        const key = `${cellYear}-${String(cellMonth + 1).padStart(2,'0')}-${String(cellDay).padStart(2,'0')}`;
        const dayEvents = events.filter((event) => event.date === key);
        cells.push(`<div class="calendar-cell min-w-0 border-b border-r border-white/[.07] p-2 sm:p-3 ${muted ? 'bg-white/[.015] text-slate-600' : 'text-slate-200'}"><span class="text-xs sm:text-sm font-bold">${cellDay}</span><div class="mt-2 space-y-1">${dayEvents.map((event) => `<button type="button" data-event-id="${escapeHtml(event.id)}" class="event-pill w-full truncate rounded-lg border border-electric-400/30 bg-electric-400/10 px-1.5 sm:px-2 py-1 text-left text-[9px] sm:text-[11px] font-bold text-blue-100" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</button>`).join('')}</div></div>`);
      }
      grid.innerHTML = cells.join('');
      grid.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click', () => renderSelected(events.find((event) => event.id === button.dataset.eventId))));
    }

    function renderList() {
      const target = document.getElementById('event-list');
      if (!events.length) { target.innerHTML = '<p class="text-slate-300">New dates will be added soon.</p>'; return; }
      target.innerHTML = events.map((event) => `
        <article class="rounded-3xl border border-white/10 bg-white/[.035] p-6">
          <div class="flex items-start justify-between gap-4"><div><p class="text-sm font-extrabold uppercase tracking-[.12em] text-gold-300">${escapeHtml(shortDateFormatter.format(easternDate(event.date)))}</p><p class="mt-1 text-xs font-semibold text-slate-400">${escapeHtml(formatTime(event))}</p></div><span class="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold text-slate-300">${escapeHtml(event.audience)}</span></div>
          <h3 class="mt-5 text-xl font-extrabold">${escapeHtml(event.title)}</h3>
          <p class="mt-3 text-sm leading-relaxed text-slate-300">${escapeHtml(event.description)}</p>
          <p class="mt-5 flex gap-2 text-sm text-slate-400"><i data-lucide="map-pin" class="mt-0.5 h-4 w-4 shrink-0"></i><span>${escapeHtml(event.location)}</span></p>
          <button type="button" data-list-event-id="${escapeHtml(event.id)}" class="mt-6 text-sm font-extrabold text-gold-300 hover:text-gold-400">View event details →</button>
        </article>`).join('');
      target.querySelectorAll('[data-list-event-id]').forEach((button) => button.addEventListener('click', () => { const event = events.find((item) => item.id === button.dataset.listEventId); visibleMonth = easternDate(event.date); renderCalendar(); renderSelected(event); document.getElementById('calendar-title').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
      lucide.createIcons();
    }

    async function loadEvents() {
      try {
        const response = await fetch(EVENT_DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error('Events could not be loaded');
        events = (await response.json()).sort((a,b) => a.date.localeCompare(b.date));
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const firstUpcoming = events.find((event) => event.date >= today) || events[events.length - 1];
        if (firstUpcoming) { visibleMonth = easternDate(firstUpcoming.date); renderSelected(firstUpcoming); }
        renderCalendar(); renderList();
      } catch (error) {
        document.getElementById('calendar-title').textContent = 'Events calendar';
        document.getElementById('calendar-grid').innerHTML = '<p class="col-span-7 p-8 text-slate-300">The calendar is temporarily unavailable. Please check back shortly.</p>';
        document.getElementById('event-list').innerHTML = '<p class="text-slate-300">The event list is temporarily unavailable.</p>';
      }
    }

    document.getElementById('previous-month').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); renderCalendar(); });
    document.getElementById('next-month').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); renderCalendar(); });
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    mobileToggle.addEventListener('click', () => { const expanded = mobileToggle.getAttribute('aria-expanded') === 'true'; mobileToggle.setAttribute('aria-expanded', String(!expanded)); mobileMenu.classList.toggle('hidden'); });
    document.querySelectorAll('#mobile-menu a').forEach((link) => link.addEventListener('click', () => { mobileMenu.classList.add('hidden'); mobileToggle.setAttribute('aria-expanded', 'false'); }));
    lucide.createIcons();
    loadEvents();
