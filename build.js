// Statický generátor webu ŠK Blava 1928: data/ + src/ -> dist/   (node build.js; TODAY=2026-11-16 prepíše dnešný dátum)
// Obsah: zápasy, tabuľky a súpisky zo Sportnetu (data/sportnet.json, scripts/sportnet.mjs), údaje o klube z data/klub.json
// (len zo zverejnených zdrojov), erby súperov zo Sportnetu (scripts/logos.py), fotky a príspevky z Instagramu klubu (scripts/photos.py -> data/foto-out.json, src/img/foto).
// Podpis vzhľadu: stuha z erbu nesie výsledok zápasu, vlnovka potoka Blava, pokrik z klubovej hymny; modrá a žltá z erbu.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const rd = (f, def) => { const p = path.join(ROOT, 'data', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : def; };
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const club = rd('klub.json');
const sn = rd('sportnet.json');
const foto = rd('foto-out.json', null); // fotky a príspevky z Instagramu klubu (scripts/photos.py)
const SPACE = config.sportnet.appSpace;

// ---- pomocné -------------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const todayISO = () => local.format(new Date()).slice(0, 10);
const TODAY = process.env.TODAY || todayISO();
const DAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
const DAYS_S = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
const MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const MONTHS_G = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
const dObj = (iso) => new Date(iso + 'T12:00:00Z');
const dShort = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`; };
const dDay = (iso) => DAYS_S[dObj(iso).getUTCDay()];
const DAYS_ACC = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
const dWhen = (iso) => { const d = dObj(iso); return `${DAYS_ACC[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dLong = (iso) => { const d = dObj(iso); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dDate = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dFull = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`; };
const monthKey = (iso) => iso.slice(0, 7);
const monthName = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
// okamih výkopu s posunom časového pásma (letný čas) pre odpočet v prehliadači
function isoLocal(date, time = '12:00') {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const [ld, lt] = local.format(new Date(guess)).split(' ');
  const shown = Date.UTC(...ld.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), ...lt.split(':').map(Number));
  const off = (shown - guess) / 6e4;
  return `${date}T${time}:00+${String(Math.floor(off / 60)).padStart(2, '0')}:${String(off % 60).padStart(2, '0')}`;
}
const acc = (league) => league.replace(/\bliga\b/, 'ligu'); // 4. pád: hrajú IV. ligu
const tel = (n) => 'tel:' + n.replace(/\s+/g, '');
const SEASON = sn.season.replace(/^(\d{4})\/\d\d(\d\d)$/, '$1/$2');
const plural = (n, a, b, c) => `${n} ${n === 1 ? a : n >= 2 && n <= 4 ? b : c}`;
const zo = (n) => `${/^(4|6|7|1[467]|[467]\d)$/.test(String(n)) ? 'zo' : 'z'} ${n}`; // „zo 16“, „z 11“ (podľa výslovnosti čísla)
const num = (n) => Number(n).toLocaleString('sk-SK');

// ---- súťaže, tímy, zápasy ------------------------------------------------------------------------
const compName = (name) => club.sutaze[name] || club.sutaze[name.replace(/\s+/g, ' ').trim()] || name.replace(/\s+/g, ' ').replace(/-ObFZ TT/, ' ObFZ Trnava').replace(/\s*Macron \| yoursport\s*/, ' ').replace(/-/g, ' ').trim();
const ROUND = (r) => (/^\d+$/.test(r) ? `${r}. kolo` : String(r || '').replace(/\.\s*kolo/i, '. kolo').replace(/Kolo/, 'kolo'));
const teams = sn.teams.map((t) => {
  const league = t.competitions.find((c) => !c.cup);
  // tabuľka prípraviek bez zapísaných výsledkov (všetci 0:0, body len za účasť) by klamala, preto sa neukazuje
  const raw = league ? sn.tables[league.key] : null;
  const table = raw && raw.rows.some((r) => r.gf || r.ga) ? raw : null;
  const pos = table?.rows.find((r) => r.our);
  return {
    ...t, url: `timy/${t.slug}/`, code: t.adult ? t.slug[0] : norm(t.short).replace(/-/g, ''),
    full: t.adult ? t.short : `${t.short} ${t.sub}`,
    leagueName: league ? compName(league.name) : '', leagueKey: league?.key || '', table, pos: pos?.pos || null, of: table?.rows.length || 0,
  };
});
// tímy bez zápasu v sezóne (napr. prihlásený B-tím bez súťaže) sa na webe neukazujú
for (let i = teams.length - 1; i >= 0; i--) if (!sn.matches.some((m) => m.team === teams[i].slug)) teams.splice(i, 1);
const bySlug = Object.fromEntries(teams.map((t) => [t.slug, t]));
// kolá bez súpera (voľno) sa v zoznamoch nezobrazujú, inak by ostal prázdny riadok
const matches = sn.matches.filter((m) => String(m.opponent || '').trim()).map((m) => {
  const t = bySlug[m.team];
  const past = m.played || m.date < TODAY;
  let gf = null, ga = null, res = null;
  // prípravky (U11 a mladší) výsledok nezapisujú, Sportnet pri nich dáva 0:0 bez gólov
  if (m.score === '0:0' && !(m.goals || []).length && /^U(\d|1[01])\b/.test(t.short)) m = { ...m, score: null };
  if (m.score) { const [h, a] = m.score.split(':').map(Number); [gf, ga] = m.home ? [h, a] : [a, h]; res = gf > ga ? 'w' : gf < ga ? 'l' : 'd'; }
  const slug = `${m.date}-${t.code}-${norm(m.opponent)}`;
  return { ...m, past, gf, ga, res, slug, url: `zapasy/${slug}/`, comp: compName(m.competition), roundName: ROUND(m.round), teamObj: t, cup: /cup|pohár/i.test(m.competition) };
});
const teamMatches = (slug) => matches.filter((m) => m.team === slug);
const upcoming = matches.filter((m) => !m.past);
const results = matches.filter((m) => m.past).reverse();
const RES = { w: 'Výhra', d: 'Remíza', l: 'Prehra' };
const RES_S = { w: 'V', d: 'R', l: 'P' };
const noScore = (m) => (m.teamObj.adult ? 'Sportnet výsledok neuvádza' : 'Výsledky prípraviek sa nezapisujú');

// strelci tímu v sezóne (vlastné góly sa nerátajú)
function scorers(slug) {
  const c = new Map();
  for (const m of teamMatches(slug)) for (const g of m.goals || []) if (g.side === 'our' && g.kind !== 'own' && g.player) c.set(g.player, (c.get(g.player) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sk'));
}
function record(slug, filter = () => true) {
  const r = { w: 0, d: 0, l: 0, gf: 0, ga: 0, n: 0 };
  for (const m of teamMatches(slug)) if (m.res && filter(m)) { r[m.res]++; r.gf += m.gf; r.ga += m.ga; r.n++; }
  return r;
}

// ---- obrázky -----------------------------------------------------------------------------------
const CREST_R = 480 / 311; // erb je široký (stuha cez kruh)
const logoFile = (space) => space && fs.existsSync(path.join(SRC, 'img', 'kluby', `${space}.webp`));
const initials = (name) => String(name).replace(/^(TJ|OŠK|OFK|ŠK|FK|FC|MFK|MŠK|PFK|TFK|PŠK|ZFC|OTJ|AFC|Telovýchovná jednota)\s+/i, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function logo(space, name, R, size = 40, eager = false) {
  if (space === SPACE) return `<img class="logo" src="${R}img/erb-128.webp" alt="" width="${Math.round(size * CREST_R)}" height="${size}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
  if (logoFile(space)) return `<img class="logo" src="${R}img/kluby/${space}.webp" alt="" width="${size}" height="${size}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
  return `<span class="logo logo--txt" aria-hidden="true">${esc(initials(name))}</span>`;
}
// ---- fotky z Instagramu ----------------------------------------------------------------------------
const igImg = (R, name, ws, { w, h, alt = '', sizes = '100vw', cls = '', eager = false }) => {
  const set = ws.map((x) => `${R}img/foto/${name}-${x}.webp ${x}w`).join(', ');
  const def = ws.length > 1 ? ws.at(-2) : ws[0];
  return `<img${cls ? ` class="${cls}"` : ''} src="${R}img/foto/${name}-${def}.webp" srcset="${set}" sizes="${sizes}" alt="${esc(alt)}" width="${w}" height="${h}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
};
const IG_HANDLE = ''; // klub Instagram nemá
const igFirst = (t) => (t.split('\n').find((l) => l.trim()) || '').replace(/^(REVIEW|KONIEC)\.\s*/i, '');
// príspevok k zápasu: mládež podľa „U19 | …“ v deň zápasu, muži podľa citátu trénera alebo „KONIEC.“ najviac 2 dni po zápase
function igReport(m) {
  if (!foto) return null;
  const days = (a, b) => (dObj(a) - dObj(b)) / 864e5;
  return foto.posts.find((p) => {
    const u = /^(U\d+)\s*\|/.exec(p.text);
    if (u) return !m.teamObj.adult && m.teamObj.short.split(' ')[0] === u[1] && !/ B$/.test(m.teamObj.short) && p.date === m.date;
    if (!m.teamObj.adult || !(/Jaroslav Prekop/.test(p.text) || /^KONIEC\./.test(p.text))) return false;
    const d = days(p.date, m.date);
    if (d < 0 || d > 2) return false;
    return !matches.some((x) => x.team === m.team && x.id !== m.id && x.past && x.date > m.date && x.date <= p.date);
  }) || null;
}
const igAlbum = (m) => (foto?.album && foto.album.match.team === m.team && foto.album.match.date === m.date ? foto.album : null);
function gallery(a, R) {
  return `<ul class="gal">${a.items.map((it) => `<li><a href="${R}img/foto/alb-${it.n}-${it.widths.at(-1)}.webp">${igImg(R, `alb-${it.n}`, it.widths, { w: it.w, h: it.h, alt: `${a.alt}, fotka ${it.n}`, sizes: '(min-width: 1100px) 280px, 50vw' })}</a></li>`).join('')}</ul>`;
}
function igGrid(R, n = 6) {
  return `<ul class="iggrid">${foto.posts.slice(0, n).map((p) => `<li><a href="${p.url}" rel="noopener">${igImg(R, 'ig-' + p.code.replace('reel/', 'reel-'), p.thumb, { w: p.thumb.at(-1), h: Math.round(p.thumb.at(-1) * 1.25), sizes: '(min-width: 1100px) 220px, 46vw' })}${p.video ? `<span class="ig-play" aria-hidden="true">${I.play}</span>` : ''}<span class="ig-cap">${esc(igFirst(p.text) || (p.video ? 'Video' : 'Príspevok'))}</span><span class="ig-meta">${I.heart}<span class="sr">Páči sa: </span>${p.likes} · ${dShort(p.date)}</span></a></li>`).join('')}</ul>`;
}

// ---- ikony (Lucide, ISC; sociálne siete jednoduché tvary) ------------------------------------------
const ico = (p, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  phone: ico('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  mail: ico('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  pin: ico('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
  route: ico('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'),
  cal: ico('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  ext: ico('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  arrow: ico('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  menu: ico('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: ico('<path d="M18 6 6 18M6 6l12 12"/>'),
  ball: ico('<circle cx="12" cy="12" r="10"/><path d="m12 7 4.2 3-1.6 5H9.4L7.8 10z"/><path d="M12 2v5M21.5 9.5 16.2 10M18 20l-3.4-5M6 20l3.4-5M2.5 9.5l5.3.5"/>'),
  up: ico('<path d="M7 17 17 7M8 7h9v9"/>'),
  heart: ico('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>'),
  play: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
  fb: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H8v3h2.5V21z"/></svg>',
  ig: ico('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
  yt: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>',
};
const SOC = [['facebook', 'Facebook', I.fb], ['instagram', 'Instagram', I.ig], ['youtube', 'YouTube', I.yt]].filter(([k]) => club.socialne?.[k]);
const socLinks = (cls = 'soc') => `<ul class="${cls}">${SOC.map(([k, t, i]) => `<li><a href="${club.socialne[k]}" rel="noopener">${i}<span>${t}</span></a></li>`).join('')}</ul>`;

// ---- CSP a rozloženie ----------------------------------------------------------------------------
// GitHub Pages nedovolí hlavičky, preto <meta>: skripty len z webu, jediný inline skript HEAD_JS povolený hashom.
const HEAD_JS = `document.documentElement.classList.add('js')`;
const sha256 = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const CONNECT = ["'self'", ...(config.supabase?.url ? [new URL(config.supabase.url).origin] : [])];
const CSP = [
  "default-src 'none'", `script-src 'self' ${sha256(HEAD_JS)}`, "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
  `connect-src ${CONNECT.join(' ')}`, "base-uri 'none'", "form-action 'none'", "object-src 'none'", "manifest-src 'self'",
].join('; ');

// menu rozdelené okolo erbu (na počítači tri odkazy vľavo, tri vpravo)
const NAV = [['zapasy/', 'Zápasy'], ['tabulky/', 'Tabuľky'], ['timy/', 'Tímy'], ['klub/', 'Klub'], ['stadion/', 'Areál'], ['kontakt/', 'Kontakt']];
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${club.stadion.geo.join(',')}`;
const mapyUrl = `https://mapy.com/fnc/v1/showmap?mapset=basic&amp;center=${club.stadion.geo[1]},${club.stadion.geo[0]}&amp;zoom=16&amp;marker=true`; // mapy.com/s/?q= vracia 404
const DESC = `${club.nazov} – futbal v Jaslovských Bohuniciach od roku ${club.zalozenie}. Zápasy, výsledky, tabuľky a súpisky áčka aj mládeže, ďalšie kluby ŠK Blava a športový areál.`;

function layout({ route, title, desc, body, active, bodyClass = '' }) {
  const depth = route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const cur = (u) => (active && active === u ? ' aria-current="page"' : '');
  const fullTitle = (config.ukazka ? 'Návrh webu – ' : '') + (route ? `${title} | ${club.nazov}` : `${club.nazov} – ${title}`);
  const canon = config.siteUrl ? `${config.siteUrl}${route}` : '';
  const ld = route ? '' : `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SportsClub', name: club.nazov, legalName: club.pravnyNazov, sport: 'Futbal', foundingDate: String(club.zalozenie),
    email: club.kontakt.email, telephone: club.kontakt.telefon.replace(/\s+/g, ''),
    address: { '@type': 'PostalAddress', streetAddress: club.adresa[0], postalCode: club.adresa[1].slice(0, 6), addressLocality: club.mesto, addressCountry: 'SK' },
    location: { '@type': 'StadiumOrArena', name: club.stadion.nazov, geo: { '@type': 'GeoCoordinates', latitude: club.stadion.geo[0], longitude: club.stadion.geo[1] } },
    sameAs: [club.facebook, club.sportnetUrl],
  }).replace(/</g, '\\u003c')}</script>`;
  const li = ([u, t]) => `<li><a href="${R}${u}"${cur(u)}>${t}</a></li>`;
  return `<!doctype html>
<html lang="sk" data-root="${R}"${config.ukazka ? ' class="has-demo"' : ''}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc || DESC)}">
${config.noindex ? '<meta name="robots" content="noindex">\n' : ''}${canon ? `<link rel="canonical" href="${canon}">\n` : ''}<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sk_SK">
<meta name="theme-color" content="#1b3fa0">
<link rel="icon" type="image/png" href="${R}img/favicon.png">
<link rel="apple-touch-icon" href="${R}img/apple-touch-icon.png">
<link rel="preload" href="${R}fonts/bricolage-grotesque-800.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="${R}fonts/figtree-400.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${R}css/site.css">
<script>${HEAD_JS}</script>
<script type="module" src="${R}js/site.mjs"></script>
${ld}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#obsah">Preskočiť na obsah</a>
${config.ukazka ? '<p class="demo">Návrh webu · nie je to oficiálna stránka klubu</p>' : ''}
<header class="hdr">
  <div class="wrap hdr-in">
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu">${I.menu}<span>Menu</span></button>
    <a class="brand" href="${R}"${route ? '' : ' aria-current="page"'}><img src="${R}img/erb-240.webp" alt="" width="96" height="62"><span class="sr">${esc(club.nazov)}, úvod</span></a>
    <nav class="nav" id="menu" aria-label="Hlavné menu">
      <ul class="nav-l">${NAV.slice(0, 3).map(li).join('')}</ul>
      <ul class="nav-r">${NAV.slice(3).map(li).join('')}</ul>
    </nav>
  </div>
</header>
<main id="obsah">
${body}
</main>
<footer class="ftr">
  ${wave('ftr-wave')}
  <div class="wrap ftr-grid">
    <div class="ftr-club">
      <img src="${R}img/erb-240.webp" alt="" width="112" height="73" loading="lazy">
      <p class="ftr-name">${esc(club.nazov)}</p><p>${esc(club.pravnyNazov)}<br>${esc(club.adresa.join(', '))}</p>
    </div>
    <div><h2 class="ftr-h">Štadión</h2><p>${esc(club.stadion.nazov)}<br>${club.stadion.adresa.map(esc).join(', ')}</p><p><a href="${mapsUrl}" rel="noopener">Navigovať</a></p></div>
    <div><h2 class="ftr-h">Kontakt</h2><p>${esc(club.kontakt.osoba)}, ${esc(club.kontakt.funkcia)}<br><a href="${tel(club.kontakt.telefon)}">${esc(club.kontakt.telefon)}</a><br><a href="mailto:${club.kontakt.email}">${esc(club.kontakt.email)}</a></p></div>
    <div><h2 class="ftr-h">Sledujte nás</h2><p><a href="${club.facebook}" rel="noopener">Facebook ŠK Blava</a></p><p class="ftr-src">Výsledky zo Sportnetu (Futbalnet), aktualizované ${dFull(sn.updated.slice(0, 10))}.</p></div>
  </div>
  <div class="ftr-bar"><div class="wrap ftr-bar-in"><span>© ${new Date().getFullYear()} ${esc(club.pravnyNazov)}</span><a href="${R}ochrana-sukromia/">Ochrana súkromia</a>${config.adminDemo ? `<a href="${R}admin/">Administrácia (ukážka)</a>` : ''}</div></div>
</footer>
</body>
</html>
`;
}

// ---- spoločné bloky ------------------------------------------------------------------------------
// vlnovka potoka Blava („malý potok, ale silná riava“) ako predel sekcií
const wave = (cls) => `<svg class="wave ${cls}" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 22 C 100 4, 200 4, 300 22 S 500 40, 600 22 S 800 4, 900 22 S 1100 40, 1200 22" fill="none" stroke="currentColor" stroke-width="5"/><path d="M0 32 C 100 14, 200 14, 300 32 S 500 50, 600 32 S 800 14, 900 32 S 1100 50, 1200 32" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/></svg>`;
const pageHead = ({ title, sub = '', crumbs = [], R, aside = '' }) => `<section class="phead"><div class="wrap phead-in">
  <div>${crumbs.length ? `<nav class="crumbs" aria-label="Omrvinky"><a href="${R}">Úvod</a>${crumbs.map(([u, t]) => u ? `<a href="${R}${u}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join('')}</nav>` : ''}
  <h1 class="h1">${esc(title)}</h1>${sub ? `<p class="phead-sub">${sub}</p>` : ''}</div>${aside}
</div>${wave('phead-wave')}</section>`;
const secHead = (h, id, moreLink = '') => `<div class="sec-head"><h2 class="h2" id="${id}">${h}</h2>${moreLink}</div>`;
const more = (href, t) => `<a class="more" href="${href}">${t}${I.arrow}</a>`;
const venueName = (v) => v.replace(/\s+/g, ' ').trim();

// zápasová karta: stuha z erbu (modrý pás s vystrihnutými koncami) nesie výsledok alebo výkop
function card(m, R, { big = false, label = '', self = false } = {}) {
  const ourName = m.teamObj.adult ? club.nazov : `${club.nazov} ${m.teamObj.short}`;
  const us = { name: ourName, space: SPACE }, them = { name: m.opponent, space: m.oppSpace };
  const [h, a] = m.home ? [us, them] : [them, us];
  const lbl = label || (m.score || m.past ? 'Posledný zápas' : 'Najbližší zápas');
  const side = (t, role) => `<div class="rc-side${t.space === SPACE ? ' is-us' : ''}">${logo(t.space, t.name, R, big ? 60 : 48, big)}<span class="rc-name">${esc(t.name)}</span><span class="rc-role">${role}</span></div>`;
  let mid, note = '';
  if (m.score) { mid = `<span class="sr">Výsledok </span>${esc(m.score)}`; note = `<span class="rc-res rc-res--${m.res}">${RES[m.res]}</span>${m.half ? `<span>polčas ${esc(m.half)}</span>` : ''}`; }
  else if (m.past) { mid = '<span aria-hidden="true">–</span>'; note = `<span>${noScore(m)}</span>`; }
  else { mid = `<span class="sr">Výkop o </span>${esc(m.time || '–')}`; note = `<span class="cd" data-kickoff="${isoLocal(m.date, m.time)}" hidden></span>`; }
  const links = [];
  if (m.score && m.detail && !self) links.push(`<a class="rc-a" href="${R}${m.url}">Priebeh a zostavy${I.arrow}</a>`);
  if (!m.past) links.push(`<a class="rc-a" href="${R}kalendar/zapas-${m.id}.ics" download>${I.cal}Do kalendára</a>`);
  const meta = [esc(m.comp) + (m.roundName ? `, ${esc(m.roundName)}` : ''), m.venue ? esc(venueName(m.venue)) : '', m.audience ? plural(m.audience, 'divák', 'diváci', 'divákov') : ''].filter(Boolean);
  return `<article class="rc${big ? ' rc--big' : ''}">
  <p class="rc-top"><span class="rc-label">${esc(lbl)}</span><span>${esc(m.teamObj.full)}</span></p>
  <p class="rc-when"><time datetime="${m.date}">${dLong(m.date)}</time></p>
  <div class="rc-teams">${side(h, 'domáci')}${side(a, 'hostia')}</div>
  <p class="ribbon"><span class="ribbon-in">${mid}</span></p>
  <p class="rc-note">${note}</p>
  <p class="rc-meta">${meta.join('<span aria-hidden="true"> · </span>')}</p>
  ${links.length ? `<p class="rc-links">${links.join('')}</p>` : ''}
</article>`;
}

// zoznam zápasov: program ako kamene pozdĺž potoka Blava, výsledky na modrých stuhách s vystrihnutými koncami (ako na erbe)
function matchRow(m, R, { showTeam = true } = {}) {
  const href = m.detail || !m.past ? ` href="${R}${m.url}"` : '';
  const tag = href ? 'a' : 'div';
  const team = showTeam ? `${esc(m.teamObj.short)} · ` : '';
  const comp = esc(m.cup ? m.comp : m.roundName || m.comp);
  if (!m.past) {
    return `<li class="mrow mrow--stone" data-team="${m.team}" data-where="${m.home ? 'doma' : 'vonku'}"><${tag} class="stone"${href}>
  <span class="stone-d"><time datetime="${m.date}">${dDay(m.date)} ${dShort(m.date)}</time><b>${esc(m.time || '–')}</b></span>
  <span class="stone-o">${logo(m.oppSpace, m.opponent, R, 26)}<span>${esc(m.opponent)}</span></span>
  <span class="stone-k">${team}${m.home ? 'doma' : 'vonku'}, ${comp}</span>
</${tag}></li>`;
  }
  return `<li class="mrow mrow--rib" data-team="${m.team}" data-where="${m.home ? 'doma' : 'vonku'}"><${tag} class="rib rib--${m.res || 'n'}"${href}>
  <span class="rib-d"><time datetime="${m.date}">${dShort(m.date)}</time>${showTeam ? `<span>${esc(m.teamObj.short)}</span>` : ''}</span>
  <span class="rib-o"><span class="rib-n">${esc(m.opponent)}</span><span class="rib-k">${m.home ? 'doma' : 'vonku'}, ${comp}</span></span>
  <span class="rib-s">${m.score ? `<span class="sr">${RES[m.res]}, </span>${esc(m.score)}` : '<small>bez výsl.</small>'}</span>
</${tag}></li>`;
}
const matchList = (list, R, opts) => `<ol class="mlist ${list.length && list.every((m) => m.past) ? 'mlist--ribbons' : 'mlist--creek'}">${list.map((m) => matchRow(m, R, opts)).join('')}</ol>`;

function tableHtml(tb, R, { compact = false, caption = '' } = {}) {
  let rows = tb.rows;
  if (compact) { const i = rows.findIndex((r) => r.our); const from = Math.max(0, Math.min(i - 2, rows.length - 5)); rows = rows.slice(from, from + 5); }
  return `<div class="tbl-wrap"><table class="tbl">${caption ? `<caption>${caption}</caption>` : ''}
  <thead><tr><th scope="col"><abbr title="Poradie">#</abbr></th><th scope="col" class="tl">Tím</th><th scope="col"><abbr title="Zápasy">Z</abbr></th><th scope="col" class="hm"><abbr title="Výhry">V</abbr></th><th scope="col" class="hm"><abbr title="Remízy">R</abbr></th><th scope="col" class="hm"><abbr title="Prehry">P</abbr></th><th scope="col">Skóre</th><th scope="col"><abbr title="Body">B</abbr></th></tr></thead>
  <tbody>${rows.map((r) => `<tr${r.our ? ' class="our"' : ''}><td class="pos">${r.pos}</td><th scope="row" class="tl"><span class="tteam">${logo(r.space, r.name, R, 24)}<span>${esc(r.name)}</span></span></th><td>${r.played}</td><td class="hm">${r.won}</td><td class="hm">${r.draw}</td><td class="hm">${r.lost}</td><td class="nw">${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody>
</table></div>`;
}
const formHtml = (slug, n = 5) => {
  const last = teamMatches(slug).filter((m) => m.res).slice(-n);
  return last.length ? `<ol class="form" aria-label="Forma: ${last.length === 1 ? 'posledný zápas' : last.length <= 4 ? `posledné ${last.length} zápasy` : `posledných ${last.length} zápasov`}">${last.map((m) => `<li class="res-bg--${m.res}" title="${dShort(m.date)} ${esc(m.opponent)} ${m.score}"><span aria-hidden="true">${RES_S[m.res]}</span><span class="sr">${RES[m.res]} ${esc(m.opponent)} ${m.score}</span></li>`).join('')}</ol>` : '';
};

// kalendár zápasov (.ics): odber cez webcal/Google doplní site.mjs, inak stiahnutie
const calBox = (file, R, id) => `<details class="cal" data-cal id="${id}">
  <summary class="btn btn--line">${I.cal}<span>Zápasy do kalendára</span></summary>
  <div class="cal-pop">
    <a class="cal-o" data-webcal href="${R}kalendar/${file}" hidden><b>Odoberať v telefóne</b><span>iPhone, Mac, Outlook – rozpis sa sám aktualizuje</span></a>
    <a class="cal-o" data-gcal href="${R}kalendar/${file}" rel="noopener" hidden><b>Pridať do Google Kalendára</b><span>aj pre Android</span></a>
    <a class="cal-o" data-ics href="${R}kalendar/${file}" download><b>Stiahnuť súbor .ics</b><span>jednorazovo, bez aktualizácií</span></a>
  </div>
</details>`;

// výber zápasu na kartu: zápas v najbližších 7 dňoch, inak posledný odohraný (zimná prestávka), inak najbližší
function cardPick(slug) {
  const list = teamMatches(slug);
  const next = list.find((m) => !m.past);
  const last = [...list].reverse().find((m) => m.past && (m.score || !m.teamObj.adult));
  const soon = next && (dObj(next.date) - dObj(TODAY)) / 864e5 <= 7;
  return soon ? next : last || next;
}

// tímy podľa vekových skupín
const GROUPS = [['Muži', (t) => t.adult], ['Dorast', (t) => /dorast/i.test(t.sub)], ['Žiaci', (t) => /žiaci/i.test(t.sub)], ['Prípravka', (t) => /prípravka/i.test(t.sub)]];
function teamGrid(R) {
  return GROUPS.map(([g, f]) => [g, teams.filter(f)]).filter(([, l]) => l.length).map(([g, l]) => `<section class="tgroup" aria-label="${g}"><h3 class="tgroup-h">${g}</h3><ul class="tgrid">${l.map((t) => `<li class="tcard${t.adult ? ' tcard--adult' : ''}"><a href="${R}${t.url}">
  <span class="tcard-n">${esc(t.short)}</span>
  <span class="tcard-l">${esc(t.leagueName)}</span>
  ${t.pos ? `<span class="tcard-p"><b>${t.pos}.</b> ${zo(t.of)}</span>` : '<span class="tcard-p">bez tabuľky</span>'}
</a></li>`).join('')}</ul></section>`).join('');
}


// ---- stránky -----------------------------------------------------------------------------------
const pages = [];
const add = (route, opts) => pages.push({ route, ...opts });
const A = teams[0];
const crewRole = { coach: 'Tréner', assist_coach: 'Asistent trénera', coach_goalkeepers: 'Tréner brankárov', manager: 'Vedúci mužstva', doctor: 'Lekár', physiotherapist: 'Fyzioterapeut', masseur: 'Masér', club_representative: 'Zástupca klubu', other: 'Člen realizačného tímu' };
const POS = [['goalkeeper', 'Brankári'], ['defender', 'Obrancovia'], ['midfielder', 'Stredopoliari'], ['forward', 'Útočníci'], ['', 'Hráči']];

// pás s pokrikom z hymny (na počítači pomaly plynie, pri obmedzenom pohybe stojí)
const chant = () => `<div class="chant" aria-hidden="true"><p class="chant-in">${[...club.hymna.refren, ...club.hymna.koniec, ...club.hymna.refren, ...club.hymna.koniec].map((l) => `<span>${esc(l)}</span>`).join('')}</p></div>`;

// ďalšie kluby ŠK Blava (úvod, Klub)
function clubsBand(R, full = false) {
  return `<section class="sec clubs" aria-labelledby="kluby-h"><div class="wrap">
  ${secHead('Viac než futbal', 'kluby-h', full ? '' : more(`${R}klub/#kluby`, 'Kluby ŠK Blava'))}
  <p class="lead">${esc(club.pravnyNazov)} združujú ${club.kluby.zoznam.length} klubov. Hrá sa, trénuje a súťaží v areáli pri štadióne a v obci.</p>
  <ul class="clubs-grid">${club.kluby.zoznam.map((k, i) => `<li class="club${i === 0 ? ' club--main' : ''}"><h3 class="club-h">${esc(k.nazov)}</h3><p>${esc(k.text)}</p>${k.url ? `<a class="club-a" href="${k.url}" rel="noopener">Facebook klubu</a>` : ''}</li>`).join('')}</ul>
  ${full ? `<p class="src">Zdroj: web ŠK Blava (kluby, správa o činnosti za rok 2024).</p>` : ''}
</div></section>`;
}

// hymna klubu
function anthem(R, full = false) {
  const h = club.hymna;
  return `<section class="anthem" aria-labelledby="hymna-h">${wave('anthem-wave')}<div class="wrap anthem-in">
  <div>
    <p class="eyebrow">Hymna ŠK Blava</p>
    <h2 class="h2" id="hymna-h">Zdáme sa vám malí, ale my vieme, čo je boj</h2>
    <div class="verse">${h.zaciatok.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
    <p class="btns"><a class="btn btn--yellow" href="${club.hymnaMp3}" rel="noopener">${I.play}Vypočuť si hymnu (MP3)</a>${full ? '' : `<a class="btn btn--ghost" href="${R}klub/#hymna">Celý text</a>`}</p>
  </div>
  <div class="verse verse--chant">${(full ? [...h.refren, ...h.koniec] : h.refren).map((l) => `<p>${esc(l)}</p>`).join('')}</div>
</div></section>`;
}

// úvod
add('', {
  title: `futbal v Jaslovských Bohuniciach od roku ${club.zalozenie}`, active: '', bodyClass: 'home',
  body: (R) => {
    const tabs = teams.map((t) => ({ t, m: cardPick(t.slug) })).filter((x) => x.m);
    const nextAll = upcoming.slice(0, 6);
    const lastAll = results.filter((m) => m.score).slice(0, 6);
    const lg = record(A.slug, (m) => !m.cup);
    const top = scorers(A.slug);
    const winterNext = upcoming[0];
    const aNext = upcoming.find((m) => m.team === A.slug);
    const winterText = !winterNext ? '' : aNext && aNext.date === winterNext.date
      ? `Jar sa začína ${dWhen(winterNext.date)}, áčko v ten deň hrá ${aNext.home ? 'doma proti' : 'vonku na ihrisku'} ${esc(aNext.opponent)}.`
      : `Mládež začína jar ${dWhen(winterNext.date)}${aNext ? `, áčko ${dWhen(aNext.date)} ${aNext.home ? 'doma proti' : 'vonku na ihrisku'} ${esc(aNext.opponent)}` : ''}.`;
    const best = teams.filter((t) => t.pos && !t.adult).sort((a, b) => a.pos - b.pos)[0];
    return `<section class="hero" aria-labelledby="hero-h">
  <div class="wrap hero-in">
    <div class="hero-copy">
      <p class="eyebrow">Jaslovské Bohunice · od roku ${club.zalozenie}</p>
      <h1 class="hero-h" id="hero-h">Malý potok, <span class="hl">ale silná riava</span></h1>
      <p class="hero-p">Tak spieva hymna ŠK Blava, pomenovaného po potoku, ktorý tečie obcou. Muži hrajú ${esc(acc(A.leagueName))}${A.pos ? ` a po jeseni sú na ${A.pos}. mieste` : ''}${best ? `, ${esc(best.full)} ${/žiaci/i.test(best.full) ? 'sú' : 'je'} ${best.pos <= 3 ? `${best.pos}.` : `na ${best.pos}. mieste`} vo svojej súťaži` : ''}.</p>
      <p class="hero-cta"><a class="btn btn--blue" href="${R}zapasy/">Program a výsledky</a><a class="btn btn--line" href="${R}klub/">Klub od roku 1928</a></p>
    </div>
    <div class="hero-card">
      <div class="tabs" role="tablist" aria-label="Zápas podľa tímu">${tabs.map(({ t }, i) => `<button type="button" role="tab" id="tab-${t.slug}" aria-controls="tp-${t.slug}" aria-selected="${i ? 'false' : 'true'}"${i ? ' tabindex="-1"' : ''}>${esc(t.short)}</button>`).join('')}</div>
      ${tabs.map(({ t, m }, i) => `<div class="tabp" role="tabpanel" id="tp-${t.slug}" aria-labelledby="tab-${t.slug}" tabindex="0"${i ? ' hidden' : ''}>${card(m, R, { big: true })}</div>`).join('\n      ')}
    </div>
  </div>
</section>
${chant()}
${winterText && (dObj(winterNext.date) - dObj(TODAY)) / 864e5 > 14 ? `<section class="pause"><div class="wrap"><p><b>Zimná prestávka.</b> ${winterText}</p></div></section>` : ''}
<section class="sec" aria-labelledby="prog-h"><div class="wrap">
  ${secHead('Program a výsledky', 'prog-h', more(`${R}zapasy/`, 'Všetky zápasy'))}
  <div class="cols2">
    <div><h3 class="h3">Najbližšie</h3>${matchList(nextAll, R)}</div>
    <div><h3 class="h3">Posledné výsledky</h3>${matchList(lastAll, R)}</div>
  </div>
</div></section>
${A.table ? `<section class="sec sec--tint" aria-labelledby="liga-h"><div class="wrap">
  ${secHead(`Áčko, ${esc(A.leagueName)}`, 'liga-h', more(`${R}tabulky/#${A.slug}`, 'Celá tabuľka'))}
  <div class="liga">
    <div>${tableHtml(A.table, R, { compact: true, caption: `<span class="sr">Výrez tabuľky okolo ŠK Blava 1928</span>` })}</div>
    <div class="liga-side">
      <p class="big-pos"><span class="bp-n">${A.pos}.</span><span class="bp-l">miesto ${zo(A.of)} po ${lg.n} ${lg.n === 1 ? 'zápase' : 'zápasoch'}, ${plural(lg.w, 'výhra', 'výhry', 'výhier')}, ${plural(lg.d, 'remíza', 'remízy', 'remíz')}, ${plural(lg.l, 'prehra', 'prehry', 'prehier')}, skóre ${lg.gf}:${lg.ga}</span></p>
      <div class="liga-row"><h3 class="h4">Forma</h3>${formHtml(A.slug)}</div>
      ${top.length ? `<div class="liga-row liga-row--list"><h3 class="h4">Strelci áčka</h3><ol class="scorers">${top.slice(0, 4).map(([n, g]) => `<li><span>${esc(n)}</span><b>${g}</b></li>`).join('')}</ol></div>` : ''}
    </div>
  </div>
</div></section>` : ''}
<section class="sec" aria-labelledby="timy-h"><div class="wrap">
  ${secHead('Tímy', 'timy-h', more(`${R}timy/`, 'Súpisky a zápasy'))}
  ${teamGrid(R)}
</div></section>
${anthem(R)}
${clubsBand(R)}
<section class="sec sec--tint" aria-labelledby="hist-h"><div class="wrap story">
  <div>
    <p class="eyebrow eyebrow--green">Od roku 1928</p>
    <h2 class="h2" id="hist-h">Biele dresy so zeleným pruhom</h2>
    <p>${esc(club.historia[2].text)} ${esc(club.historia[1].text)}</p>
    ${more(`${R}klub/`, 'História klubu')}
  </div>
  <ol class="years">${club.historia.slice(0, 4).map((h) => `<li><b>${esc(h.rok)}</b><span>${esc(h.text.split('. ')[0])}.</span></li>`).join('')}</ol>
</div></section>`;
  },
});

// zápasy
add('zapasy/', {
  title: 'Zápasy a výsledky', active: 'zapasy/', desc: `Program a výsledky všetkých tímov ${club.nazov} v sezóne ${SEASON}.`,
  body: (R) => {
    const grp = (list) => {
      const months = new Map();
      for (const m of list) { const k = monthKey(m.date); if (!months.has(k)) months.set(k, []); months.get(k).push(m); }
      return [...months].map(([k, l]) => `<section class="month" data-month><h3 class="month-h">${monthName(k)}</h3>${matchList(l, R)}</section>`).join('');
    };
    return `${pageHead({ title: 'Zápasy a výsledky', sub: `Sezóna ${SEASON}, všetky tímy. Výsledky, góly a karty preberáme zo Sportnetu.`, R, crumbs: [[null, 'Zápasy']] })}
<section class="sec sec--first"><div class="wrap">
  <div class="filters" data-filters hidden>
    <div class="chips" role="group" aria-label="Tím"><button type="button" class="chip" data-f-team="" aria-pressed="true">Všetky</button>${teams.map((t) => `<button type="button" class="chip" data-f-team="${t.slug}" aria-pressed="false">${esc(t.short)}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Miesto"><button type="button" class="chip" data-f-where="" aria-pressed="true">Doma aj vonku</button><button type="button" class="chip" data-f-where="doma" aria-pressed="false">Doma</button><button type="button" class="chip" data-f-where="vonku" aria-pressed="false">Vonku</button></div>
  </div>
  <div class="cols2 cols2--list">
    <section aria-labelledby="z-prog"><h2 class="h2" id="z-prog">Program</h2>${upcoming.length ? grp(upcoming) : '<p>Ďalšie zápasy zatiaľ nie sú vyžrebované.</p>'}<p class="empty" data-empty hidden>Pre tento výber nie je naplánovaný žiadny zápas.</p></section>
    <section aria-labelledby="z-vys"><h2 class="h2" id="z-vys">Výsledky</h2>${grp(results)}<p class="empty" data-empty hidden>Pre tento výber zatiaľ nie je žiadny výsledok.</p></section>
  </div>
  <div class="cal-row">${calBox('vsetky.ics', R, 'cal-vsetky')}</div>
</div></section>`;
  },
});

// detail zápasu
function lineupHtml(l, title) {
  if (!l || (!l.start.length && !l.subs.length)) return '';
  const li = (p) => `<li><span class="ln-nr">${esc(p.nr)}</span><span>${esc(p.name)}${p.c ? ' <abbr class="cap" title="kapitán">C</abbr>' : ''}</span></li>`;
  return `<div class="lineup"><h3 class="h4">${esc(title)}</h3><ol class="ln">${l.start.map(li).join('')}</ol>${l.subs.length ? `<p class="ln-h">Náhradníci</p><ol class="ln ln--subs">${l.subs.map(li).join('')}</ol>` : ''}${l.coach ? `<p class="ln-coach">Tréner: ${esc(l.coach)}</p>` : ''}</div>`;
}
for (const m of matches) {
  if (m.past && !m.detail) continue;
  const name = m.home ? `${club.nazov} – ${m.opponent}` : `${m.opponent} – ${club.nazov}`;
  add(m.url, {
    title: `${name}${m.score ? ` ${m.score}` : ''}`, active: 'zapasy/',
    desc: `${m.teamObj.full}, ${m.comp}, ${dLong(m.date)}.`,
    body: (R) => {
      const ev = [...(m.goals || []).map((g) => ({ ...g, t: 'goal' })), ...(m.cards || []).map((c) => ({ ...c, t: 'card' })), ...((m.lineups?.subs) || []).map((s) => ({ ...s, t: 'sub' }))]
        .sort((a, b) => (parseInt(a.min, 10) || 0) - (parseInt(b.min, 10) || 0));
      const evIcon = (e) => e.t === 'goal' ? `<span class="ev-i ev-goal" aria-hidden="true">${I.ball}</span>` : e.t === 'card' ? `<span class="ev-i ev-card ev-card--${e.kind}" aria-hidden="true"></span>` : '<span class="ev-i ev-sub" aria-hidden="true">⇄</span>';
      const evText = (e) => e.t === 'goal' ? `Gól: ${esc(e.player)}${e.kind === 'penalty' ? ' (z penalty)' : e.kind === 'own' ? ' (vlastný)' : ''}` : e.t === 'card' ? `${e.kind === 'yellow' ? 'Žltá karta' : e.kind === 'red' ? 'Červená karta' : 'Druhá žltá a červená'}: ${esc(e.player)}` : `Striedanie: ${esc(e.in)} za ${esc(e.out)}`;
      const evSide = (e) => ((e.side === 'our') === m.home ? 'h' : 'a');
      const evTeam = (e) => (e.side === 'our' ? club.nazov : m.opponent);
      const prevMeet = matches.filter((x) => x.oppSpace === m.oppSpace && x.id !== m.id && x.team === m.team && x.score);
      const snUrl = sn.matches.find((x) => x.id === m.id)?.url;
      return `${pageHead({ title: name, sub: `${esc(m.teamObj.full)}, ${esc(m.comp)}${m.roundName ? `, ${esc(m.roundName)}` : ''}`, R, crumbs: [['zapasy/', 'Zápasy'], [null, dShort(m.date) + ' ' + m.opponent]] })}
<section class="sec sec--first"><div class="wrap match">
  <div class="match-card">${card(m, R, { big: true, self: true, label: m.score ? 'Konečný výsledok' : 'Zápas' })}</div>
  <div class="match-info">
    ${ev.length ? `<h2 class="h3">Priebeh zápasu</h2><ol class="evs">${ev.map((e) => `<li class="ev ev--${evSide(e)}"><span class="ev-min">${esc(e.min)}′</span>${evIcon(e)}<span>${evText(e)}<small>${esc(evTeam(e))}</small></span></li>`).join('')}</ol>` : m.score ? '<p>Zápis o stretnutí neobsahuje góly ani karty.</p>' : ''}
    <dl class="facts">
      <div><dt>Dátum</dt><dd>${dLong(m.date)}${m.time ? `, ${esc(m.time)}` : ''}</dd></div>
      ${m.venue ? `<div><dt>Ihrisko</dt><dd>${esc(venueName(m.venue))}</dd></div>` : ''}
      ${m.audience ? `<div><dt>Diváci</dt><dd>${num(m.audience)}</dd></div>` : ''}
      ${m.referee ? `<div><dt>Rozhodca</dt><dd>${esc(m.referee)}</dd></div>` : ''}
    </dl>
    <p class="btns">${m.score && snUrl ? `<a class="btn btn--line" href="${snUrl}" rel="noopener">${I.ext}Zápis na Sportnete</a>` : ''}${!m.past ? `<a class="btn btn--blue" href="${R}kalendar/zapas-${m.id}.ics" download>${I.cal}Pridať do kalendára</a>${m.home ? `<a class="btn btn--line" href="${mapsUrl}" rel="noopener">${I.route}Navigovať na štadión</a>` : ''}` : ''}</p>
  </div>
  ${(() => { const rp = igReport(m); return rp ? `<div class="report"><p class="report-src">${I.ig}Instagram klubu, ${dFull(rp.date)}</p>${rp.text.replace(/^REVIEW\.\s*/i, '').split(/\n+/).filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join('')}<p><a class="more" href="${rp.url}" rel="noopener">Príspevok na Instagrame${I.arrow}</a></p></div>` : ''; })()}
  ${(() => { const a = igAlbum(m); return a ? `<div class="match-gal"><h2 class="h3">Fotky zo zápasu</h2>${gallery(a, R)}<p class="src">Fotky: <a href="${a.url}" rel="noopener">Instagram klubu @${IG_HANDLE}</a>, ${dFull(a.date)}.</p></div>` : ''; })()}
  ${m.lineups ? `<div class="lineups"><h2 class="h3 lineups-h">Zostavy</h2>${lineupHtml(m.home ? m.lineups.our : m.lineups.opp, m.home ? club.nazov : m.opponent)}${lineupHtml(m.home ? m.lineups.opp : m.lineups.our, m.home ? m.opponent : club.nazov)}</div>` : ''}
  ${prevMeet.length ? `<div class="meet"><h2 class="h3">Ďalšie zápasy s týmto súperom v sezóne</h2>${matchList(prevMeet, R, { showTeam: false })}</div>` : ''}
</div></section>`;
    },
  });
}

// tabuľky
add('tabulky/', {
  title: 'Tabuľky', active: 'tabulky/', desc: `Tabuľky súťaží, v ktorých hrajú tímy ${club.nazov} v sezóne ${SEASON}.`,
  body: (R) => `${pageHead({ title: 'Tabuľky', sub: `Sezóna ${SEASON}. Poradie podľa Sportnetu, náš tím je zvýraznený.`, R, crumbs: [[null, 'Tabuľky']] })}
<section class="sec sec--first"><div class="wrap">
  <nav class="toc" aria-label="Tabuľky tímov">${teams.filter((t) => t.table).map((t) => `<a href="#${t.slug}">${esc(t.short)}</a>`).join('')}</nav>
  ${teams.filter((t) => t.table).map((t) => `<section class="tsec" id="${t.slug}" aria-labelledby="h-${t.slug}">
    <div class="sec-head"><h2 class="h2" id="h-${t.slug}">${esc(t.full)}</h2>${more(`${R}${t.url}`, 'Stránka tímu')}</div>
    <p class="tsec-l">${esc(t.leagueName)}</p>
    ${tableHtml(t.table, R)}
  </section>`).join('')}
  ${teams.some((t) => !t.table) ? `<p class="note">${teams.filter((t) => !t.table).map((t) => esc(t.short)).join(', ')}: prípravky hrajú bez tabuľky.</p>` : ''}
</div></section>`,
});

// tímy
add('timy/', {
  title: 'Tímy', active: 'timy/', desc: `Všetky tímy ${club.nazov}: muži, dorast, žiaci a prípravka v sezóne ${SEASON}.`,
  body: (R) => `${pageHead({ title: 'Tímy', sub: `${teams.length} tímov v sezóne ${SEASON}, od prípravky U9 po A-mužstvo.`, R, crumbs: [[null, 'Tímy']] })}
<section class="sec sec--first"><div class="wrap">${teamGrid(R)}
</div></section>`,
});

for (const t of teams) {
  add(t.url, {
    title: t.full, active: 'timy/', desc: `${club.nazov} – ${t.full}: ${t.leagueName}, zápasy, tabuľka a súpiska v sezóne ${SEASON}.`,
    body: (R) => {
      const list = teamMatches(t.slug);
      const nx = list.filter((m) => !m.past), rs = list.filter((m) => m.past).reverse();
      const pick = cardPick(t.slug);
      const rec = record(t.slug);
      const sc = scorers(t.slug);
      const groups = POS.map(([k, h]) => [h, t.squad.athletes.filter((a) => (k ? a.pos === k : !POS.some(([x]) => x && x === a.pos)))]).filter(([, l]) => l.length);
      const nrCount = new Map(); for (const a of t.squad.athletes) nrCount.set(a.nr, (nrCount.get(a.nr) || 0) + 1);
      const nr = (a) => (a.nr !== '' && nrCount.get(a.nr) === 1 ? a.nr : '');
      return `${pageHead({ title: t.full, sub: `${esc(t.leagueName)}${t.pos ? `, <b>${t.pos}. miesto</b> ${zo(t.of)}` : ''}`, R, crumbs: [['timy/', 'Tímy'], [null, t.short]] })}
${t.adult && foto?.hero ? `<figure class="team-photo">${igImg(R, 'hero', foto.hero.widths, { w: foto.hero.w, h: foto.hero.h, alt: foto.hero.alt, sizes: '(min-width: 1024px) calc(100vw - 256px), 100vw' })}<figcaption>${esc(t.full)} v sezóne ${SEASON}. Foto: <a href="${foto.hero.url}" rel="noopener">Instagram klubu</a></figcaption></figure>` : ''}
<section class="sec sec--first"><div class="wrap team-top">
  ${pick ? `<div>${card(pick, R, { big: true })}</div>` : ''}
  <div class="team-side">
    ${rec.n ? `<p class="stat"><span class="stat-n">${rec.w}–${rec.d}–${rec.l}</span><span class="stat-l">výhry, remízy a prehry vo všetkých súťažiach, skóre ${rec.gf}:${rec.ga}</span></p><div class="liga-row"><h2 class="h4">Forma</h2>${formHtml(t.slug)}</div>` : '<p>Výsledky prípraviek sa nezapisujú, rozpis zápasov je nižšie.</p>'}
    ${sc.length && t.adult ? `<div class="liga-row liga-row--list"><h2 class="h4">Strelci v sezóne</h2><ol class="scorers">${sc.slice(0, 5).map(([n, g]) => `<li><span>${esc(n)}</span><b>${g}</b></li>`).join('')}</ol></div>` : ''}
    ${calBox(`${t.slug}.ics`, R, `cal-${t.slug}`)}
  </div>
</div></section>
<section class="sec" aria-labelledby="tz-h"><div class="wrap">
  ${secHead('Zápasy', 'tz-h')}
  <div class="cols2">
    <div><h3 class="h3">Program</h3>${nx.length ? matchList(nx, R, { showTeam: false }) : '<p>Ďalšie zápasy zatiaľ nie sú vyžrebované.</p>'}</div>
    <div><h3 class="h3">Výsledky</h3>${rs.length ? matchList(rs, R, { showTeam: false }) : '<p>Tím v tejto sezóne ešte nehral.</p>'}</div>
  </div>
</div></section>
${t.table ? `<section class="sec sec--sky" aria-labelledby="tt-h"><div class="wrap">${secHead('Tabuľka', 'tt-h')}<p class="tsec-l">${esc(t.leagueName)}</p>${tableHtml(t.table, R)}</div></section>` : ''}
${t.squad.athletes.length || t.squad.crew.length ? `<section class="sec" aria-labelledby="ts-h"><div class="wrap">
  ${secHead('Súpiska', 'ts-h')}
  <p class="note">Hráči, ktorí v kalendárnom roku ${sn.updated.slice(0, 4)} nastúpili alebo boli v nominácii na zápas (podľa Sportnetu).${t.adult ? '' : ' Pri mládeži uvádzame len mená.'}</p>
  ${groups.map(([h, l]) => `<h3 class="h4 sq-h">${h}</h3><ul class="squad">${l.sort((a, b) => a.name.split(' ').at(-1).localeCompare(b.name.split(' ').at(-1), 'sk')).map((a) => `<li class="pl"><span class="pl-nr" aria-hidden="true">${esc(nr(a)) || '<span class="pl-dot"></span>'}</span><span class="pl-name">${esc(a.name)}${a.captain && t.adult ? ' <abbr class="cap" title="kapitán">C</abbr>' : ''}</span>${nr(a) ? `<span class="sr">, číslo ${nr(a)}</span>` : ''}</li>`).join('')}</ul>`).join('')}
  ${t.squad.crew.length ? `<h3 class="h4 sq-h">Realizačný tím</h3><ul class="crew">${t.squad.crew.map((c) => `<li><span class="crew-r">${esc(crewRole[c.role] || crewRole.other)}</span><span>${esc(c.name)}</span></li>`).join('')}</ul>` : ''}
</div></section>` : ''}`;
    },
  });
}

// klub a história
add('klub/', {
  title: 'Klub a história', active: 'klub/', desc: `${club.pravnyNazov}: futbal od roku 1928, hymna, kluby ŠK Blava a výročné publikácie.`,
  body: (R) => `${pageHead({ title: 'Klub a história', sub: `${esc(club.pravnyNazov)}. Prezident ${esc(club.spravnaRada.prezident)}, sekretár ${esc(club.spravnaRada.sekretar)}.`, R, crumbs: [[null, 'Klub']] })}
<section class="sec sec--first"><div class="wrap klub-grid">
  <div class="prose">
    <h2 class="h2">História</h2>
    <ol class="timeline">${club.historia.map((h) => `<li${h.rok ? '' : ' class="tl-norok"'}>${h.rok ? `<span class="tl-y">${esc(h.rok)}</span>` : ''}<p>${esc(h.text)}</p></li>`).join('')}</ol>
    <p class="src">Zdroje: ${[...new Set(club.historia.flatMap((h) => h.zdroj.split('; ')))].map(esc).join(', ')}.</p>
  </div>
  <aside class="klub-aside">
    <img src="${R}img/erb-480.webp" alt="Erb ŠK Blava: žltý kruh s nápisom Jaslovské Bohunice, modrá stuha ŠK Blava, rok 1928" width="240" height="155" loading="lazy">
    <h2 class="h4">Na čítanie</h2>
    <ul class="docs">${club.vyrocia.map((v) => `<li><a href="${v.url}" rel="noopener">${I.ext}<span>${esc(v.nazov)}</span><small>starý web klubu</small></a></li>`).join('')}<li><a href="${club.bulletin.url}" rel="noopener">${I.ext}<span>Klubový bulletin</span><small>${esc(club.bulletin.text)}</small></a></li></ul>
  </aside>
</div></section>
<div id="hymna">${anthem(R, true)}</div>
<div id="kluby">${clubsBand(R, true)}</div>`,
});

// areál
add('stadion/', {
  title: 'Štadión a areál', active: 'stadion/', desc: `${club.stadion.nazov}, ${club.stadion.adresa.join(', ')}. Ihrisko, športoviská na prenájom a rezervácie.`,
  body: (R) => {
    const home = upcoming.filter((m) => m.home).slice(0, 6);
    const s = club.stadion;
    return `${pageHead({ title: 'Štadión a areál', sub: `${esc(s.nazov)}, ${s.adresa.map(esc).join(', ')}`, R, crumbs: [[null, 'Areál']] })}
<section class="sec sec--first"><div class="wrap stad">
  <dl class="facts facts--big">
    <div><dt>Hracia plocha</dt><dd>${esc(s.rozmery)}</dd></div>
    <div><dt>Adresa</dt><dd>${s.adresa.map(esc).join(', ')}</dd></div>
  </dl>
  <p class="btns"><a class="btn btn--blue" href="${mapsUrl}" rel="noopener">${I.route}Navigovať (Google Mapy)</a><a class="btn btn--line" href="${mapyUrl}" rel="noopener">${I.pin}Mapy.com</a></p>
  <p class="src">Údaje o ihrisku: Sportnet. ${esc(s.sienSlavy)}</p>
  <div class="offers">
    <article class="offer"><h2 class="h3">Športoviská na prenájom</h2><p>V areáli sú ${esc(s.sportoviska)}. Obsadenosť kurtov a haly je v rezervačnom systéme, ceny určuje obec.</p><p class="btns"><a class="btn btn--blue" href="${s.rezervacie}" rel="noopener">${I.cal}Obsadenosť a rezervácie</a><a class="btn btn--line" href="${s.cennik}" rel="noopener">${I.ext}Cenník (web obce)</a></p></article>
    <article class="offer"><h2 class="h3">Správa areálu</h2><p>${esc(club.hospodar.osoba)}, ${esc(club.hospodar.funkcia)}.</p><p class="btns"><a class="btn btn--line" href="${tel(club.hospodar.telefon)}">${I.phone}${esc(club.hospodar.telefon)}</a><a class="btn btn--line" href="mailto:${club.kontakt.email}">${I.mail}${esc(club.kontakt.email)}</a></p></article>
  </div>
  <p class="src">Ponuka podľa webu ŠK Blava, aktuálne podmienky potvrdí klub.</p>
  ${home.length ? `<h2 class="h3">Najbližšie zápasy doma</h2>${matchList(home, R)}` : ''}
</div></section>`;
  },
});

// kontakt
add('kontakt/', {
  title: 'Kontakt', active: 'kontakt/', desc: `Kontakt na ${club.nazov}: ${club.kontakt.osoba}, telefón, e-mail, adresa a fakturačné údaje.`,
  body: (R) => `${pageHead({ title: 'Kontakt', sub: 'Zápisy do mládeže, zápasy, prenájom športovísk a spolupráca.', R, crumbs: [[null, 'Kontakt']] })}
<section class="sec sec--first"><div class="wrap contact">
  <div class="ccard">
    <h2 class="h4">${esc(club.kontakt.funkcia[0].toUpperCase() + club.kontakt.funkcia.slice(1))}</h2>
    <p class="ccard-n">${esc(club.kontakt.osoba)}</p>
    <p class="btns"><a class="btn btn--yellow" href="${tel(club.kontakt.telefon)}">${I.phone}${esc(club.kontakt.telefon)}</a><a class="btn btn--ghost" href="mailto:${club.kontakt.email}">${I.mail}<span>${esc(club.kontakt.email).replace('@', '<wbr>@')}</span></a></p>
  </div>
  <dl class="facts">
    <div><dt>Názov</dt><dd>${esc(club.pravnyNazov)}</dd></div>
    <div><dt>Sídlo</dt><dd>${club.adresa.map(esc).join(', ')}</dd></div>
    <div><dt>IČO / DIČ</dt><dd>${esc(club.ico)} / ${esc(club.dic)}</dd></div>
    <div><dt>Bankové spojenie</dt><dd>${esc(club.ucet)}</dd></div>
  </dl>
  <div>
    <h2 class="h3">Klub na webe</h2>
    <ul class="docs">
      <li><a href="${club.facebook}" rel="noopener">${I.fb}<span>Facebook ŠK Blava</span><small>novinky a pozvánky na zápasy</small></a></li>
      <li><a href="${club.sportnetUrl}" rel="noopener">${I.ext}<span>Profil klubu na Sportnete</span><small>zápisy o stretnutí, súpisky</small></a></li>
      <li><a href="${club.staryWeb}" rel="noopener">${I.ext}<span>Doterajší web ŠK Blava</span><small>skblava.sk, aj ostatné kluby</small></a></li>
    </ul>
    <p class="src">Kontakty a fakturačné údaje: web ŠK Blava. Tréneri tímov sú na stránkach <a href="${R}timy/">tímov</a>.</p>
  </div>
</div></section>`,
});

add('ochrana-sukromia/', {
  title: 'Ochrana súkromia', desc: 'Ako web ŠK Blava 1928 pracuje s údajmi.',
  body: (R) => `${pageHead({ title: 'Ochrana súkromia', R, crumbs: [[null, 'Ochrana súkromia']] })}
<section class="sec sec--first"><div class="wrap prose">
  <p>Web nepoužíva cookies, analytiku ani reklamné nástroje a nenačítava nič z iných serverov. Všetky súbory vrátane písma a erbov sú uložené priamo na webe. Odkazy na Facebook, rezervačný systém a hymnu sú obyčajné odkazy.</p>
  <p>Mená hráčov, trénerov a rozhodcov, výsledky, strelcov, karty a počty divákov preberáme z verejného systému Sportnet (Futbalnet), kam ich zapisujú kluby a zväzy pri zápasoch. Vek hráčov nezverejňujeme, pri mládeži uvádzame len mená a zostavy zápasov len pri dospelých.</p>
  <p>Ak chcete niečo opraviť alebo odstrániť, napíšte na <a href="mailto:${club.kontakt.email}">${esc(club.kontakt.email)}</a>.</p>
</div></section>`,
});

add('404/', {
  title: 'Stránka sa nenašla',
  body: (R) => `${pageHead({ title: 'Stránka sa nenašla', sub: 'Adresa je chybná alebo sa stránka presunula.', R })}
<section class="sec sec--first"><div class="wrap"><p class="btns"><a class="btn btn--blue" href="${R}">Na úvod</a><a class="btn btn--line" href="${R}zapasy/">Zápasy a výsledky</a></p></div></section>`,
});


// ---- kalendár (.ics, RFC 5545) ----------------------------------------------------------------
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (line) => {
  const out = []; let cur = '';
  for (const ch of line) { if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch; }
  out.push(cur);
  return out.join('\r\n');
};
const VTZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Bratislava',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'];
function ics(list, calName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = list.map((m) => {
    const us = m.teamObj.adult ? club.nazov : `${club.nazov} ${m.teamObj.short}`;
    const [h, a] = m.home ? [us, m.opponent] : [m.opponent, us];
    const d = m.date.replace(/-/g, '');
    const t = (m.time || '').slice(0, 5);
    const when = t ? [`DTSTART;TZID=Europe/Bratislava:${d}T${t.replace(':', '')}00`, 'DURATION:PT2H'] : [`DTSTART;VALUE=DATE:${d}`];
    const desc = [m.comp + (m.roundName ? `, ${m.roundName}` : ''), m.home ? 'Domáci zápas' : 'Zápas vonku'].join('\n');
    return ['BEGIN:VEVENT', `UID:zapas-${m.id}@${config.sportnet.club}.sportnet`, `DTSTAMP:${stamp}`, ...when,
      `SUMMARY:${icsEsc(`${m.teamObj.short}: ${h} – ${a}${m.score ? ` ${m.score}` : ''}`)}`,
      `DESCRIPTION:${icsEsc(desc)}`, m.venue && `LOCATION:${icsEsc(m.venue.replace(/\s+/g, ' '))}`, 'END:VEVENT'].filter(Boolean);
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${club.nazov}//Zapasy//SK`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(calName)}`, 'X-WR-TIMEZONE:Europe/Bratislava', ...VTZ, ...events.flat(), 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}

// ---- ukážka administrácie (dist/admin/demo.json pre src/admin/admin.js) ------------------------------
function writeAdminDemo() {
  // rovnaký tvar dát ako administrácia OK Častkovce (src/admin/admin.js je spoločný základ)
  const R = '../';
  const snById = Object.fromEntries(sn.matches.map((m) => [m.id, m]));
  const people = (t) => t.squad.athletes.map((a) => ({ name: a.name, number: a.nr === '' ? '' : String(a.nr), role: '', photo: null }));
  const demo = {
    club: { nazov: club.nazov, crest: `${R}img/erb-128.webp` },
    updated: sn.updated, season: sn.season,
    teams: teams.map((t) => ({ slug: t.slug, short: t.short, sub: t.adult ? 'Muži' : t.sub })),
    matches: matches.map((m) => ({
      id: m.id, team: m.team, date: m.date, time: m.time, home: m.home, opponent: m.opponent, competition: m.comp, part: '',
      round: (/\d+/.exec(m.round) || [''])[0], played: m.past, score: m.score, goals: m.goals || [], cards: m.cards || [],
      venue: (m.venue || '').replace(/\s+/g, ' '), url: snById[m.id]?.url || null, gallery: null, video: null,
    })),
    rosters: Object.fromEntries(teams.map((t) => [t.slug, people(t).map(({ name, number, photo }) => ({ name, number, photo }))])),
    news: [],
    info: {
      nazov: club.nazov, pravnyNazov: club.pravnyNazov, adresa: club.adresa, osoba: club.kontakt.osoba, telefon: club.kontakt.telefon, email: club.kontakt.email,
      facebook: club.facebook, ico: club.ico, ucet: club.ucet, stadion: { nazov: club.stadion.nazov, kapacita: '', rozmery: club.stadion.rozmery, vip: '' },
    },
    allTeams: teams.map((t) => ({
      slug: t.slug, short: t.short, sub: t.adult ? 'Muži' : t.sub, league: t.leagueName, url: t.url, photo: null,
      groups: [{ title: 'Hráči', people: people(t) }, { title: 'Realizačný tím', people: t.squad.crew.map((c) => ({ name: c.name, number: '', role: crewRole[c.role] || crewRole.other, photo: null })) }],
    })),
    coaches: [],
    pages: {
      historia: { title: 'História', url: 'klub/', html: `<ul>${club.historia.map((h) => `<li><b>${esc(h.rok)}</b> – ${esc(h.text)}</li>`).join('')}</ul>` },
      hymna: { title: 'Hymna klubu', url: 'klub/', html: [...club.hymna.zaciatok, ...club.hymna.refren].map((l) => `<p>${esc(l)}</p>`).join('') },
      'ochrana-sukromia': { title: 'Ochrana súkromia', url: 'ochrana-sukromia/', html: '<p>Web nepoužíva cookies, analytiku ani reklamné nástroje.</p>' },
    },
    home: {
      heroTitle: 'Malý potok, ale silná riava', heroText: `Muži hrajú ${acc(A.leagueName)}. V klube je ${teams.length} futbalových tímov a ďalšie kluby ŠK Blava.`, hero: null,
      stadion: { title: 'Štadión a areál', text: club.stadion.sportoviska },
    },
    galleries: [], videos: [], fanshop: { pozn: '', email: club.kontakt.email, produkty: [] }, partners: [],
  };
  fs.writeFileSync(path.join(OUT, 'admin', 'demo.json'), JSON.stringify(demo));
}

// ---- zápis -------------------------------------------------------------------------------------
// obsah dist/ sa maže po súboroch: koreň môže držať náhľadový server (fs.watch) alebo otvorený terminál
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
const copy = (from, to) => { if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true }); };
copy(path.join(SRC, 'img'), path.join(OUT, 'img'));
copy(path.join(SRC, 'fonts'), path.join(OUT, 'fonts'));
copy(path.join(SRC, 'js'), path.join(OUT, 'js'));
copy(path.join(ROOT, 'media', 'foto-web'), path.join(OUT, 'foto'));
if (config.adminDemo !== false && fs.existsSync(path.join(SRC, 'admin', 'index.html'))) { copy(path.join(SRC, 'admin'), path.join(OUT, 'admin')); writeAdminDemo(); }
fs.rmSync(path.join(OUT, 'fonts', 'fonts.css'), { force: true });
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
const fontsCss = fs.readFileSync(path.join(SRC, 'fonts', 'fonts.css'), 'utf8').replace(/url\(([^)]+)\)/g, 'url(../fonts/$1)');
fs.writeFileSync(path.join(OUT, 'css', 'site.css'), fontsCss + fs.readFileSync(path.join(SRC, 'css', 'site.css'), 'utf8'));

for (const p of pages) {
  const depth = p.route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const html = layout({ ...p, body: p.body(R) });
  const file = path.join(OUT, p.route, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
// GitHub Pages: 404 v koreni (absolútne cesty, lebo sa zobrazuje na ľubovoľnej adrese)
const BASE = process.env.BASE_PATH || config.basePath || '/';
const notFound = fs.readFileSync(path.join(OUT, '404', 'index.html'), 'utf8').replace(/(href|src|data-root)="(\.\.\/)+/g, `$1="${BASE}`);
fs.writeFileSync(path.join(OUT, '404.html'), notFound);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, '.gitattributes'), '*.ics -text\n'); // RFC 5545 chce CRLF, git na Windowse by ho zmenil

// kalendáre .ics: každý tím, všetky zápasy a jednotlivé budúce zápasy
fs.mkdirSync(path.join(OUT, 'kalendar'), { recursive: true });
for (const t of teams) fs.writeFileSync(path.join(OUT, 'kalendar', `${t.slug}.ics`), ics(teamMatches(t.slug), `${club.nazov} – ${t.full}`));
fs.writeFileSync(path.join(OUT, 'kalendar', 'vsetky.ics'), ics(matches, `${club.nazov} – všetky zápasy`));
for (const m of upcoming) fs.writeFileSync(path.join(OUT, 'kalendar', `zapas-${m.id}.ics`), ics([m], `${club.nazov} – ${m.teamObj.full}`));
console.log(`Hotovo: ${pages.length} stránok -> dist/ (dnes = ${TODAY})`);
