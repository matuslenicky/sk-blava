// Správanie webu ŠK Blava 1928 (bez knižníc): rozbaľovacie menu, záložky zápasovej karty, filtre zápasov, odpočet, kalendár.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---- menu na telefóne: rozbalí sa pod hlavičkou a posunie obsah (žiadna vrstva navrch) ----
const menuBtn = $('.menu-btn'), menu = $('#menu');
if (menuBtn && menu) {
  const set = (open) => { menuBtn.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open); };
  menuBtn.addEventListener('click', () => set(menuBtn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { set(false); menuBtn.focus(); } });
  matchMedia('(min-width: 960px)').addEventListener('change', (e) => { if (e.matches) set(false); });
}

// ---- záložky zápasovej karty na úvode (vzor ARIA tabs: šípky, Home/End) ----
const tabs = $$('[role="tab"]');
const select = (tab, focus = false) => {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  // focus() neposunie pás záložiek, keď je záložka viditeľná len kúskom (End, šípka z prvej na poslednú)
  if (focus) { tab.focus({ preventScroll: true }); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', (e) => {
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    select(tabs[(k + tabs.length) % tabs.length], true);
  });
});

// ---- odpočet do výkopu ----
const plural = (n, a, b, c) => `${n} ${n === 1 ? a : n >= 2 && n <= 4 ? b : c}`;
function tick() {
  for (const el of $$('.cd[data-kickoff]')) {
    const ms = Date.parse(el.dataset.kickoff) - Date.now();
    if (Number.isNaN(ms)) continue;
    el.hidden = false;
    if (ms <= 0) { el.textContent = ms > -105 * 60e3 ? 'Práve sa hrá' : 'Zápas sa skončil, výsledok čoskoro'; continue; }
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    el.textContent = d >= 1 ? `Výkop o ${plural(d, 'deň', 'dni', 'dní')}${d < 3 ? ` a ${plural(h, 'hodinu', 'hodiny', 'hodín')}` : ''}` : `Výkop o ${h ? plural(h, 'hodinu', 'hodiny', 'hodín') + ' ' : ''}${plural(m, 'minútu', 'minúty', 'minút')}`;
  }
}
if ($('.cd[data-kickoff]')) { tick(); setInterval(tick, 30e3); }

// ---- filtre zápasov (tím, doma/vonku), zapamätané v adrese ----
const filters = $('[data-filters]');
if (filters) {
  filters.hidden = false;
  const q = new URLSearchParams(location.search);
  const state = { team: q.get('tim') || '', where: q.get('kde') || '' };
  const apply = () => {
    $$('[data-f-team]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fTeam === state.team)));
    $$('[data-f-where]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fWhere === state.where)));
    for (const li of $$('.mrow')) li.hidden = (state.team && li.dataset.team !== state.team) || (state.where && li.dataset.where !== state.where);
    for (const m of $$('[data-month]')) m.hidden = !$$('.mrow', m).some((li) => !li.hidden);
    for (const col of $$('.cols2--list > section')) { const e = $('[data-empty]', col); if (e) e.hidden = $$('.mrow', col).some((li) => !li.hidden); }
    const p = new URLSearchParams();
    if (state.team) p.set('tim', state.team);
    if (state.where) p.set('kde', state.where);
    history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
  };
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('fTeam' in b.dataset) state.team = b.dataset.fTeam;
    if ('fWhere' in b.dataset) state.where = b.dataset.fWhere;
    apply();
  });
  if ($(`[data-f-team="${CSS.escape(state.team)}"]`) && $(`[data-f-where="${CSS.escape(state.where)}"]`)) apply();
  else { state.team = ''; state.where = ''; apply(); }
}

// ---- kalendár zápasov: odber cez webcal a Google Kalendár (potrebujú úplnú adresu .ics) ----
for (const box of $$('[data-cal]')) {
  const ics = $('[data-ics]', box);
  const abs = new URL(ics.getAttribute('href'), location.href);
  if (!/^https?:$/.test(abs.protocol) || /^(localhost|127\.)/.test(abs.hostname)) continue;
  const webcal = abs.href.replace(/^https?:/, 'webcal:');
  const w = $('[data-webcal]', box), g = $('[data-gcal]', box);
  w.href = webcal; w.hidden = false;
  g.href = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`; g.hidden = false;
}
document.addEventListener('click', (e) => { $$('[data-cal][open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  $$('[data-cal][open]').forEach((d) => { d.open = false; $('summary', d).focus(); });
});
