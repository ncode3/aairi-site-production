"""Render event and partner evidence into HTML before staging the public site."""
from pathlib import Path
from datetime import datetime, date
from zoneinfo import ZoneInfo
from html import escape
import calendar
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TODAY = datetime.now(ZoneInfo('America/New_York')).date().isoformat()

def replace_content(text, element_id, content):
    # These dedicated placeholder divs contain no authored sibling content.
    start = re.search(r'<div\b[^>]*\bid="' + re.escape(element_id) + r'"[^>]*>', text)
    if not start:
        raise ValueError(f'Missing static content target: {element_id}')
    depth = 1
    for tag in re.finditer(r'</?div\b[^>]*>', text[start.end():]):
        depth += -1 if tag[0].startswith('</') else 1
        if depth == 0:
            end = start.end() + tag.start()
            return text[:start.end()] + content + text[end:]
    raise ValueError(f'Unclosed content target: {element_id}')

def event_time(event):
    if event.get('allDay'):
        return 'Time to be confirmed' if event['date'] >= TODAY else 'Date only'
    def fmt(t):
        return datetime.strptime(t, '%H:%M').strftime('%I:%M %p').lstrip('0')
    return f"{fmt(event['startTime'])}–{fmt(event['endTime'])} ET"

def photos(event):
    return '<div class="grid sm:grid-cols-2 gap-3 mt-5">' + ''.join(
        f'<figure><a href="{escape(p["src"])}"><img src="{escape(p["src"])}" alt="{escape(p["alt"])}" loading="lazy" class="w-full aspect-[4/3] object-cover rounded-xl"></a><figcaption class="mt-2 text-xs text-slate-400">{escape(p["caption"])}</figcaption></figure>'
        for p in event.get('photos', [])
    ) + '</div>' if event.get('photos') else ''

def card(event, homepage=False):
    d = date.fromisoformat(event['date']).strftime('%b %d, %Y').replace(' 0', ' ')
    link = event.get('url') or f'events.html#event-{event["id"]}'
    return f'''<article id="event-{escape(event['id'])}" class="glass-panel rounded-3xl border border-white/10 p-6 scroll-mt-24">
<p class="text-sm font-bold text-gold-300">{d}</p><p class="mt-1 text-xs text-slate-400">{escape(event_time(event))} · {escape(event['audience'])}</p>
<h3 class="mt-4 text-xl font-bold">{escape(event['title'])}</h3><p class="mt-3 text-sm text-slate-300">{escape(event['description'])}</p><p class="mt-4 text-sm text-slate-400">{escape(event['location'])}</p>
{'' if homepage else photos(event)}<a href="{escape(link)}" class="inline-block mt-5 font-bold text-gold-300">{escape(event.get('cta') or 'Event details')} →</a></article>'''

def render():
    events = sorted(json.loads((ROOT/'assets/data/events.json').read_text()), key=lambda e:e['date'])
    upcoming = [e for e in events if e['date'] >= TODAY]
    past = [e for e in events if e['date'] < TODAY][::-1]
    home = ROOT/'index.html'
    home.write_text(replace_content(home.read_text(), 'upcoming-events-grid', ''.join(card(e,True) for e in upcoming[:3]) or '<p>New dates will be added soon. <a href="events.html">See past events.</a></p>'))
    page = ROOT/'events.html'
    text=page.read_text()
    text=replace_content(text,'event-list','<h3 class="md:col-span-2 xl:col-span-3 text-2xl font-bold">Upcoming events</h3>'+''.join(card(e) for e in upcoming)+'<h3 class="md:col-span-2 xl:col-span-3 text-2xl font-bold mt-6">Past events &amp; photos</h3>'+''.join(card(e) for e in past))
    selected=(upcoming or events)[0]
    month=date.fromisoformat(selected['date']).replace(day=1)
    text=re.sub(r'(<h2 id="calendar-title"[^>]*>).*?(</h2>)',r'\g<1>'+month.strftime('%B %Y')+r'\g<2>',text)
    cells=[]
    for week in calendar.Calendar(firstweekday=6).monthdatescalendar(month.year,month.month):
        for day in week:
            entries=[e for e in events if e['date']==day.isoformat()]
            cells.append(f'<div class="calendar-cell min-w-0 border-b border-r border-white/10 p-2"><span class="text-sm">{day.day}</span>'+''.join(f'<a class="block mt-2 text-xs text-gold-300" href="#event-{escape(e["id"])}">{escape(e["title"])}</a>' for e in entries)+'</div>')
    text=replace_content(text,'calendar-grid',''.join(cells))
    text=replace_content(text,'selected-event',f'<h2 id="selected-event-title" class="text-2xl font-bold">{escape(selected["title"])}</h2><p class="mt-4 text-slate-300">{escape(selected["date"])} · {escape(event_time(selected))}</p><p class="mt-3 text-slate-300">{escape(selected["location"])}</p><a class="inline-block mt-5 font-bold text-gold-300" href="#event-{escape(selected["id"])}">Full details →</a>')
    page.write_text(text)
    # Read the repository-authored partner array without running browser code.
    js=(ROOT/'assets/js/pages/partners-1.js').read_text()
    array=re.search(r'const partnerEcosystem = (\[[\s\S]*?\n        \]);',js)[1]
    partners=json.loads(subprocess.check_output(['node','-e','process.stdout.write(JSON.stringify('+array+'))'],text=True))
    cards=''.join(f'''<article class="partner-slide" aria-label="{escape(p['name'])}, {escape(p['category'])}"><div class="partner-story-card glass-panel rounded-3xl p-5 border border-white/10">{f'<div class="partner-logo-box"><img src="{escape(p["logo"])}" alt="{escape(p["name"])}" loading="lazy"></div>' if p.get('logo') else ''}<p class="mt-5 text-xs text-blue-400">{escape(p['category'])}</p><p class="mt-2 text-xs text-slate-400">{escape(p['status'])}</p><h4 class="mt-3 text-xl font-bold">{escape(p['name'])}</h4><p class="mt-3 text-sm text-slate-400">{escape(p['role'])}</p></div></article>''' for p in partners)
    partner_page=ROOT/'partners.html'; text=partner_page.read_text()
    # Assign a stable placeholder ID once, then use the same balanced replacement.
    text=text.replace('class="partner-carousel-track" data-carousel-track','id="partner-card-track" class="partner-carousel-track" data-carousel-track') if 'id="partner-card-track"' not in text else text
    text=replace_content(text,'partner-card-track',cards)
    partner_page.write_text(text)
    print('Rendered static event schedules, dated photos, and partner cards.')

if __name__=='__main__': render()
