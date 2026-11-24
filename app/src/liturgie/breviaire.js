// Bréviaire : copie fidèle de breviaire.html de l'AppMesse (mêmes données, même logique),
// dans un élément de la page du secrétariat. Amélioration : le plein écran.
// Lit data/breviaire/AAAA/MM-JJ/<Heure>.json (généré chaque 1er décembre par l'AppMesse).
import { lireFichier, prechargerLiturgie, suivrePrechargement, deux } from './source.js'
import { chargerCalendrier, jourLiturgique, titreFrancais } from './calendrier.js'
import { chargerExsurge } from './exsurge.js'
import { basculerSombreLiturgie, estSombre } from '../affichage.js'
import { NOMS_HEURES, heureDuMoment } from './heures.js'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const LANGUES = ['Latin', 'Francais']
const HEURES = NOMS_HEURES
const TAILLES = [0.88, 1, 1.12, 1.25, 1.4]

const GABARIT = `
<div class="brev-hero">
  <button type="button" class="brev-nav-jour brev-nav-jour-left" data-jour="-1" aria-label="Jour précédent"><span class="brev-nav-arrow">‹</span></button>
  <button type="button" class="brev-nav-jour brev-nav-jour-right" data-jour="1" aria-label="Jour suivant"><span class="brev-nav-arrow">›</span></button>
  <div class="brev-hero-body">
    <span class="brev-hero-fete" data-r="fete">Chargement…</span>
    <span class="brev-hero-date" data-r="date"></span>
  </div>
</div>
<div class="heures-tabs" data-r="heures">${HEURES.map(([h, n]) => `<button type="button" class="heure-tab" data-heure="${h}">${n}</button>`).join('')}</div>
<div class="brev-toolbar" data-r="toolbar">
  <div class="lang-toggle">
    <button type="button" class="lang-btn" data-lang="Latin">Latin</button>
    <button type="button" class="lang-btn" data-lang="Francais">Français</button>
    <button type="button" class="lang-btn" data-r="greg" hidden>Grégorien</button>
  </div>
  <div class="brev-toolbar-filler"></div>
  <button type="button" class="taille-btn" data-taille="-1" aria-label="Réduire le texte">A−</button>
  <button type="button" class="taille-btn" data-taille="1" aria-label="Agrandir le texte">A+</button>
  <button type="button" class="taille-btn" data-r="sombre" aria-label="Mode sombre" title="Mode sombre">☾</button>
  <button type="button" class="taille-btn" data-r="plein" aria-label="Plein écran" title="Plein écran">⤢</button>
</div>
<div class="greg-options" data-r="gregopt" hidden><button type="button" class="greg-btn" data-r="trad">Traduction française</button></div>
<nav class="brev-parties" data-r="parties" hidden></nav>
<div class="brev-content" data-r="contenu"><div class="brev-loading">Chargement de l'office…</div></div>
<button type="button" class="brev-horsligne" data-r="horsligne" hidden></button>`

export function monterBreviaire(racine, options = {}) {
  const vivant = { ok: true }
  racine.classList.add('liturgie', 'brev')
  racine.innerHTML = GABARIT
  const r = (n) => racine.querySelector(`[data-r="${n}"]`)
  const box = r('contenu')
  const nettoyages = []
  const ecouter = (cible, ev, fn, o) => { cible.addEventListener(ev, fn, o); nettoyages.push(() => cible.removeEventListener(ev, fn, o)) }

  // Zone qui défile : la page du secrétariat, ou le bréviaire lui-même en plein écran
  const hote = racine.closest('main')
  const defil = () => (racine.classList.contains('plein') ? racine : hote || document.scrollingElement)
  const scrollY = () => defil().scrollTop
  const scrollTo = (top) => defil().scrollTo({ top, behavior: 'instant' })

  let _offset = 0
  if (/^\d{4}-\d{2}-\d{2}$/.test(options.date || '')) {   // ouvert depuis l'Ordo sur un jour donné
    const [y, m, d] = options.date.split('-').map(Number)
    const auj = new Date(); auj.setHours(0, 0, 0, 0)
    _offset = Math.round((new Date(y, m - 1, d) - auj) / 86400000)
  }
  let _heure = 'Laudes'
  let _lang = 'Latin'
  let _gregorien = false
  let _traduction = false
  let _dessin = 0
  let _requete = 0
  const _cache = {}
  try {
    const l = localStorage.getItem('breviaire-langue')
    if (LANGUES.includes(l)) _lang = l
    _gregorien = localStorage.getItem('breviaire-gregorien') === '1'
    _traduction = localStorage.getItem('breviaire-traduction') === '1'
  } catch { /* ignore */ }

  function dateNav() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + _offset)
    return d
  }
  function naviguerJour(delta) { _offset += delta; chargerOffice() }
  function setHeure(btn) {
    racine.querySelectorAll('.heure-tab').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    _heure = btn.dataset.heure
    majBoutonsLangue()
    chargerOffice()
  }
  const enGregorien = () => _gregorien && _heure === 'Vespera'

  function majBoutonsLangue() {
    racine.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === _lang && !enGregorien()))
    const g = r('greg')
    g.hidden = _heure !== 'Vespera'
    g.classList.toggle('active', enGregorien())
    r('gregopt').hidden = !enGregorien()
    r('trad').classList.toggle('active', _traduction)
    majEveil()
  }

  // ── Écran allumé pendant les Vêpres en grégorien ──
  let _eveil = null
  async function majEveil() {
    try {
      if (vivant.ok && enGregorien() && document.visibilityState === 'visible') {
        if (!_eveil && navigator.wakeLock) {
          _eveil = await navigator.wakeLock.request('screen')
          _eveil.addEventListener('release', () => { _eveil = null })
        }
      } else if (_eveil) { await _eveil.release(); _eveil = null }
    } catch { _eveil = null }
  }
  ecouter(document, 'visibilitychange', majEveil)

  function memoriserGregorien() { try { localStorage.setItem('breviaire-gregorien', _gregorien ? '1' : '0') } catch { /* ignore */ } }

  // Mémorise la partie lue, pour la retrouver après le changement de langue
  function positionLecture() {
    const l = box.querySelector('.brev-ligne.active')
    if (!l) return null
    const b = l.getBoundingClientRect()
    return { i: cleLigne(l), part: b.height ? Math.max(0, (hautBarres() - b.top) / b.height) : 0 }
  }
  function restaurerLecture(pos) {
    if (!pos) return
    const l = [...box.querySelectorAll('.brev-ligne')].find((x) => cleLigne(x) === pos.i)
    if (!l) return
    const b = l.getBoundingClientRect()
    if (pos.part > 0) scrollTo(scrollY() + b.top + b.height * pos.part - hautBarres())
  }
  function changerLangueEnFondu(office) {
    const pos = positionLecture()
    const requete = ++_requete
    const sansEffet = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box.classList.add('brev-fondu')
    setTimeout(() => {
      if (!vivant.ok) return
      if (requete !== _requete) { box.classList.remove('brev-fondu'); return }
      afficher(office, true)
      restaurerLecture(pos)
      box.classList.remove('brev-fondu')
    }, sansEffet ? 0 : 160)
  }
  function setGregorien() {
    _gregorien = true
    arreterSon()
    memoriserGregorien()
    majBoutonsLangue()
    chargerOffice()
  }
  function setLang(lang) {
    _lang = lang
    _gregorien = false
    memoriserGregorien()
    try { localStorage.setItem('breviaire-langue', lang) } catch { /* ignore */ }
    majBoutonsLangue()
    const o = _cache[cleOffice()]
    arreterSon()
    if (o) changerLangueEnFondu(o); else chargerOffice()
  }
  function cleOffice() {
    const d = dateNav()
    const fichier = enGregorien() ? 'Vespera-gregorien' : _heure
    return `${d.getFullYear()}/${deux(d.getMonth() + 1)}-${deux(d.getDate())}/${fichier}`
  }

  async function chargerOffice() {
    arreterSon()
    const d = dateNav()
    const cle = cleOffice()
    const requete = ++_requete
    r('date').textContent = JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear()
    if (_cache[cle]) { afficher(_cache[cle]); return }
    box.classList.remove('brev-fondu')
    r('parties').hidden = true
    box.innerHTML = '<div class="brev-loading">Chargement de l\'office…</div>'
    try {
      const office = await lireFichier(`data/breviaire/${cle}.json`)
      if (!vivant.ok || requete !== _requete) return
      if (!office) { afficherVide('Office non disponible pour ce jour.'); return }
      _cache[cle] = office
      afficher(office)
    } catch (e) {
      if (!vivant.ok || requete !== _requete) return
      console.error(e)
      afficherVide('Impossible de charger cet office. Vérifiez la connexion : hors ligne, seuls les offices déjà téléchargés sont disponibles.')
    }
  }
  function afficherVide(message) {
    r('fete').textContent = 'Bréviaire'
    r('parties').hidden = true
    box.innerHTML = '<div class="brev-empty"></div>'
    box.firstChild.textContent = message
  }

  // ── Mise en forme des cellules (HTML déjà nettoyé par tools/breviaire/generate.py) ──
  const RE_TITRE = /<span class="do-titre"><b><i>([^<]*)<\/i><\/b><\/span>/
  const RE_RUBR = (l) => '<span class="do-rubr"><i>' + l + '</i></span>'

  // « Capitule Hymne Verset » : un titre pour chaque partie
  function separerParties(html) {
    const m = html.match(RE_TITRE)
    if (!m) return html
    const mots = m[1].trim().split(/\s+/)
    if (mots.length !== 3 || !/^Capit/.test(mots[0])) return html
    const [cap, milieu, verset] = mots
    const blocs = html.replace(RE_TITRE, '').split(/<br>\s*<br>/)
    let vuMilieu = false
    const sortie = blocs.map((b, i) => {
      const t = b.trim().replace(/^(?:<br>\s*)+/, '')
      if (i === 0) return `<span class="do-partie">${cap}</span>${t}`
      if (t.startsWith(RE_RUBR(milieu))) {
        vuMilieu = true
        return `<span class="do-partie">${milieu}</span>` + t.slice(RE_RUBR(milieu).length).replace(/^\s*<br>\s*/, '')
      }
      if (!vuMilieu && /^<span class="do-rubr"><i>(R\.br|℟)/.test(t)) {
        vuMilieu = true
        return `<span class="do-partie">${milieu}</span>${t}`
      }
      if (i === blocs.length - 1 && (/^<span class="do-rubr"><i>℣/.test(t) || (t.startsWith('<div class="gabc">') && /V\/\./.test(t)))) {
        return `<span class="do-partie">${verset}</span>${t}`
      }
      return t
    })
    return sortie.join('<br><br>').replace(/<\/span><br><br><span class="do-partie">/g, '</span><span class="do-partie">')
      .replace(/<br><br>(<span class="do-partie">)/g, '$1')
  }

  // « Psalmus 127; Tonus: 1g2 » → « Psaume 127 · 1er ton (g2) »
  function nomTon(ton) {
    const altere = /\balteratus\b/.test(ton)
    ton = ton.replace(/\s*alteratus/, '').trim()
    if (/^peregrinus$/i.test(ton)) return 'ton pérégrin'
    if (/^solemn/i.test(ton)) return 'ton solennel'
    const m = ton.match(/^(\d)(.*)$/)
    if (!m) return 'ton ' + ton
    const rang = m[1] === '1' ? '1er' : m[1] + 'e'
    return `${rang} ton${m[2] ? ` (${m[2].replace(/^\./, '')})` : ''}${altere ? ' altéré' : ''}`
  }
  function titreClair(t) {
    const ton = (t.match(/;\s*Tonus:\s*([^;]+)/) || [])[1]
    const base = t.split(';')[0].trim()
    const m = base.match(/^Psalmus\s+(\d+)\s*(\([^)]*\))?/)
    const nom = m ? `Psaume ${m[1]}${m[2] ? ' ' + m[2] : ''}` : /Mari/.test(base) ? 'Magnificat' : base
    return ton ? `${nom} · ${nomTon(ton)}` : nom
  }
  function mettreEnForme(cellule) {
    return cellule.split(/(<div class="gabc">[^]*?<\/div>)/)
      .map((p) => (p.startsWith('<div class="gabc">') ? p : versetsPsaume(mettreEnFormeTexte(p)))).join('')
  }
  function titrePsaume(t) { return t.replace(/\s*\(([^)]*)\)\s*$/, ' ($1)').trim() }

  // Doxologie à la fin des psaumes et cantiques : non affichée
  const RE_DOXOLOGIE = /^\s*(?:℣\.\s*|℟\.\s*)?(?:Gl[óo]ria Patri|Gloire au Père|Sicut erat|Comme il était)/i
  const sansBalises = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  // Chaque verset : numéro dans la marge, première moitié jusqu'à l'astérisque, seconde moitié en dessous
  function versetsPsaume(html) {
    if (!html.includes('class="do-psaume"')) return html
    const morceaux = html.split(/<br>/)
    const sortie = []
    let dans = false
    for (const brut of morceaux) {
      const m = brut.trim()
      const t = m.match(/<span class="do-psaume">[^<]*(?:<span class="ps-ref">[^<]*<\/span>)?<\/span>/)
      if (t) {
        const avant = m.slice(0, t.index).trim(), reste = m.slice(t.index + t[0].length).trim()
        if (avant) sortie.push({ bloc: false, h: avant })
        sortie.push({ bloc: true, h: t[0] })
        dans = true
        if (reste && !RE_DOXOLOGIE.test(sansBalises(reste))) sortie.push(verset(reste))
        continue
      }
      if (dans && (!m || /^<span class="do-(?:rubr|titre|partie)"><i>Ant\.|^<span class="do-(?:titre|partie)">/.test(m))) dans = false
      if (dans) {
        if (!RE_DOXOLOGIE.test(sansBalises(m))) sortie.push(verset(m))
        continue
      }
      sortie.push({ bloc: false, h: brut })
    }
    let out = ''
    sortie.forEach((x, i) => {
      const prec = sortie[i - 1]
      if (i && !x.bloc && !prec.bloc) out += '<br>'
      out += x.h
    })
    return out
  }
  function verset(m) {
    const n = m.match(/^<sup class="vnum">(\w+)<\/sup>\s*/)
    const texte = n ? m.slice(n[0].length) : m
    const coupe = texte.search(/\s\*\s/)
    const corps = coupe < 0 ? `<span class="v1">${texte}</span>`
      : `<span class="v1">${texte.slice(0, coupe)}&nbsp;<span class="ast">*</span></span><span class="v2">${texte.slice(coupe + 3)}</span>`
    return { bloc: true, h: `<div class="v"><span class="vn">${n ? n[1] : ''}</span><span class="vt">${corps}</span></div>` }
  }
  function mettreEnFormeTexte(html) {
    return html
      .replace(/\s*\{[^{}]*\}/g, '')
      .replace(/<span class="do-titre"><b><i>(.)<\/i><\/b><\/span>/gu, '<span class="do-initiale">$1</span>')
      .replace(/<span class="do-rubr"><b><i>(.)<\/i><\/b><\/span>/gu, '<span class="do-initiale">$1</span>')
      .replace(/<span class="do-petit">\d+:(\w+)<\/span>\s*/g, '<sup class="vnum">$1</sup>')
      .replace(/<span class="do-rubr"><i>((?:Psalmus|Psaume|Canticum|Cantique)\b[^<]*)<\/i><\/span>(?:\s*\[\d+\])?\s*(?:<br>\s*)?(?:<span class="do-rubr"><i>([^<]*\d[^<]*)<\/i><\/span>\s*(?:<br>\s*)?)?/g,
        (_, t) => (enGregorien()
          ? (([n, ton]) => `<span class="do-psaume">${n}${ton ? `<span class="ps-ref">${ton}</span>` : ''}</span>`)(titreClair(t).split(' · '))
          : `<span class="do-psaume">${titrePsaume(t)}</span>`))
      .replace(/<br>\s*(<span class="do-psaume">)/g, '$1')
  }
  // « Capitule · Hymne · Verset » : une page pour le capitule, une pour l'hymne (avec son verset)
  function decouperPages(html) {
    const morceaux = html.split(/(?=<span class="do-partie">)/).filter((m) => m.replace(/<[^>]+>/g, '').trim())
    if (morceaux.length < 2) return [html]
    const pages = []
    morceaux.forEach((m) => {
      const nom = (m.match(/^<span class="do-partie">([^<]*)</) || [])[1] || ''
      if (pages.length && /^(Vers|Verset)/.test(nom)) pages[pages.length - 1] += m
      else pages.push(m)
    })
    return pages
  }
  function buildLigne(ligne, i) {
    const latin = typeof ligne === 'string' || _lang !== 'Francais'
    const brut = typeof ligne === 'string' ? ligne : ligne[latin ? 0 : 1]
    return decouperPages(mettreEnForme(separerParties(brut))).map((h, k) =>
      `<div class="brev-ligne" data-i="${i}" data-k="${k}"><div class="brev-text ${latin ? 'latin' : 'francais'}">${h}</div></div>`).join('')
  }

  function afficher(office, garderPosition = false) {
    r('fete').textContent = titreBreviaire(office)
    const garde = (l) => !/\{omittitur\}\s*(<[^>]+>\s*)*$/.test(typeof l === 'string' ? l : l[0])
    box.innerHTML = office.lignes.map((l, i) => (garde(l) ? buildLigne(l, i) : '')).join('')
    fusionnerAnonymes()
    box.classList.add('par-partie')
    const memo = garderPosition ? null : lectureMemorisee()
    _restaure = true
    construireParties(garderPosition ? _partie : memo && memo.i)
    dessinerPartitions(office)
    if (!garderPosition) {
      const haut = racine.getBoundingClientRect().top + scrollY() - (racine.classList.contains('plein') ? 0 : defilHaut())
      if (scrollY() > haut) scrollTo(haut)
      if (memo && memo.part > 0) setTimeout(() => { if (vivant.ok) { restaurerLecture(memo); _restaure = false } }, 60)
      else _restaure = false
    } else _restaure = false
  }
  const defilHaut = () => (defil() === document.scrollingElement ? 0 : defil().getBoundingClientRect().top)

  // Fêtes de la communauté et du diocèse : nommées dans le titre (les textes restent ceux du jour)
  function titreBreviaire(office) {
    const base = titreFrancais(office.titre_fr || (office.titre || 'Bréviaire').split(' ~ ')[0])
    try {
      const [y, m, d] = (office.date || '').split('-').map(Number)
      const o = y && jourLiturgique(y, m, d)
      if (!o) return base
      if (o.source === 'smmd' || o.source === 'diocese') return o.fete
      if (o.mention) return `${base} · ${o.mention} (facultatif)`
    } catch (e) { console.error(e) }
    return base
  }

  // ── Parties de l'heure : une par écran ──
  let _partie = null
  let _restaure = false
  function lectureMemorisee() {
    try {
      const m = JSON.parse(localStorage.getItem('breviaire-lecture') || 'null')
      return m && m.cle === cleOffice() ? m : null
    } catch { return null }
  }
  function memoriserLecture() {
    if (_restaure) return
    const pos = positionLecture()
    if (!pos) return
    try { localStorage.setItem('breviaire-lecture', JSON.stringify({ cle: cleOffice(), ...pos })) } catch { /* ignore */ }
  }
  let _minuteurLecture = null
  const surDefilement = () => { clearTimeout(_minuteurLecture); _minuteurLecture = setTimeout(memoriserLecture, 400) }
  if (hote) ecouter(hote, 'scroll', surDefilement, { passive: true })
  ecouter(racine, 'scroll', surDefilement, { passive: true })
  ecouter(window, 'scroll', surDefilement, { passive: true })

  const NOMS_PARTIES = { Incipit: 'Début', Invitatorium: 'Invitatoire', Hymnus: 'Hymne', Psalmi: 'Psaumes',
    'Psalmi cum lectionibus': 'Psaumes', Capitulum: 'Capitule', 'Lectio brevis': 'Leçon brève', Responsorium: 'Répons',
    Versus: 'Verset', Oratio: 'Oraison', Conclusio: 'Conclusion', Martyrologium: 'Martyrologe',
    'De Officio Capituli': 'Office du chapitre', 'Antiphona finalis B.M.V.': 'Antienne à la Vierge',
    'Preces Feriales': 'Prières', 'Canticum: Benedictus': 'Benedictus', 'Canticum: Magnificat': 'Magnificat',
    'Canticum: Nunc dimittis': 'Nunc dimittis', 'Cantique : Benedictus': 'Benedictus',
    'Cantique : Magnificat': 'Magnificat', 'Cantique : Nunc dimittis': 'Nunc dimittis' }

  function nomPartie(el) {
    const ps = el.querySelector('.do-psaume')
    if (ps) {
      const t = (ps.firstChild ? ps.firstChild.textContent : ps.textContent).split(' · ')[0].trim()
      return t.replace(/^Psalmus/, 'Psaume').replace(/^Canticum B\. Mariæ Virginis/, 'Magnificat')
        .replace(/^Canticum Zachariæ/, 'Benedictus').replace(/^Canticum Simeonis/, 'Nunc dimittis')
        .replace(/^Canticum Trium Puerorum/i, 'Cantique des trois enfants')
        .replace(/^Cantique de (la B\. Vierge Marie|la Bienheureuse Vierge Marie)$/, 'Magnificat')
        .replace(/^Cantique de Zacharie$/, 'Benedictus').replace(/^Cantique de Siméon$/, 'Nunc dimittis')
        .replace(/^Canticum/, 'Cantique')
    }
    const titres = [...el.querySelectorAll('.do-titre, .do-partie')].map((t) => t.textContent.trim()).filter((t) => t.length > 1)
    if (titres.length) {
      const n = titres.filter((t, j) => !j || !/^(Versus|Verset)$/.test(t)).slice(0, 2)
        .map((t) => NOMS_PARTIES[t] || t.replace(/^Lectio (\d)/, 'Leçon $1').replace(/^Antienne finale.*/, 'Antienne à la Vierge'))
      return n.join(' · ')
    }
    const m = el.textContent.match(/(?:Lectio|Leçon)\s*(\d+)/)
    if (m) return 'Leçon ' + m[1]
    return null
  }
  // Petites parties sans titre : rattachées à la voisine. Le Pater et l'absolution vont avec la leçon suivante.
  function fusionnerAnonymes() {
    const lignes = [...box.querySelectorAll('.brev-ligne')]
    lignes.forEach((l, j) => {
      if (nomPartie(l)) return
      const suivante = lignes[j + 1]
      const versSuivante = /Pater\s*Noster|Notre Père/i.test(l.textContent) && suivante && !suivante.querySelector('.do-psaume')
      const cible = versSuivante ? lignes[j + 1] : lignes.slice(0, j).reverse().find((x) => x.isConnected)
      if (!cible) return
      const textes = [...l.children]
      if (versSuivante) cible.prepend(...textes); else cible.append(...textes)
      l.remove()
    })
  }
  function construireParties(garder) {
    const lignes = [...box.querySelectorAll('.brev-ligne')]
    const barre = r('parties')
    barre.innerHTML = ''
    barre.hidden = lignes.length < 2
    lignes.forEach((l, k) => {
      const ps = l.querySelector('.do-psaume')
      if (ps) ps.classList.add('masque')
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'partie-tab'
      b.textContent = nomPartie(l) || 'Partie'
      b.onclick = () => allerPartie(k)
      barre.appendChild(b)
    })
    const idx = Math.max(0, lignes.findIndex((l) => cleLigne(l) === garder))
    allerPartie(idx, 0, true)
  }
  function allerPartie(k, sens = 0, silencieux = false) {
    const lignes = [...box.querySelectorAll('.brev-ligne')]
    if (!lignes.length || k < 0 || k >= lignes.length) return
    const tabs = [...r('parties').querySelectorAll('.partie-tab')]
    lignes.forEach((l, j) => l.classList.toggle('active', j === k))
    tabs.forEach((t, j) => t.classList.toggle('active', j === k))
    _partie = cleLigne(lignes[k])
    memoriserLecture()
    const tab = tabs[k]
    if (tab) tab.parentElement.scrollTo({ left: tab.offsetLeft - (tab.parentElement.clientWidth - tab.offsetWidth) / 2, behavior: silencieux ? 'instant' : 'smooth' })
    if (silencieux) return
    lignes[k].classList.remove('entre-g', 'entre-d')
    void lignes[k].offsetWidth
    if (sens) lignes[k].classList.add(sens > 0 ? 'entre-g' : 'entre-d')
    const top = scrollY() + box.getBoundingClientRect().top - hautBarres()
    if (scrollY() > top) scrollTo(top)
  }
  const cleLigne = (l) => `${l.dataset.i}.${l.dataset.k || 0}`
  const partieActive = () => [...box.querySelectorAll('.brev-ligne')].findIndex((x) => x.classList.contains('active'))
  function hautBarres() {
    const b = r('parties')
    return b.hidden ? r('toolbar').getBoundingClientRect().bottom : b.getBoundingClientRect().bottom
  }
  function majHautBarre() { racine.style.setProperty('--haut-barre', r('toolbar').offsetHeight + 'px') }
  ecouter(window, 'resize', majHautBarre)

  // Glisser le doigt : partie suivante ou précédente
  let x0 = null, y0 = 0, t0 = 0
  ecouter(box, 'touchstart', (e) => {
    if (e.touches.length !== 1) { x0 = null; return }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now()
  }, { passive: true })
  ecouter(box, 'touchend', (e) => {
    if (x0 === null) return
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0
    x0 = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t0 > 700) return
    const k = partieActive()
    if (dx < 0) allerPartie(k + 1, 1); else allerPartie(k - 1, -1)
  }, { passive: true })

  ecouter(document, 'keydown', (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable) return
    if (e.key === 'ArrowLeft') naviguerJour(-1)
    if (e.key === 'ArrowRight') naviguerJour(1)
    if (e.key === 'Escape' && racine.classList.contains('plein')) basculerPlein(false)
  })

  // ── Partitions grégoriennes (Exsurge) ──
  let exsurge = null
  const RE_VERSET = /\s*(?:\^?(\d+)\.\^?|V\/\.|R\/\.)\s*\(::\)/g

  function dessinerScore(source, boite) {
    const ctxt = new exsurge.ChantContext()
    ctxt.lyricTextFont = ctxt.dropCapTextFont = ctxt.annotationTextFont = "'Cormorant Garamond', Georgia, serif"
    ctxt.lyricTextSize *= 1.2
    ctxt.spaceBetweenSystems = 0
    const tete = (source.match(/^annotation:\s*([^;]*);/m) || [])[1]
    const lettrine = !/initial-style:\s*0/.test(source)
    const mapping = exsurge.Gabc.createMappingsFromSource(ctxt, source)
    const score = new exsurge.ChantScore(ctxt, mapping, lettrine)
    if (lettrine && tete) score.annotation = new exsurge.Annotation(ctxt, tete)
    boite._mapping = mapping
    return new Promise((fin) => score.performLayoutAsync(ctxt, () =>
      score.layoutChantLines(ctxt, boite.clientWidth || (box.clientWidth - 32), () => {
        boite.innerHTML = score.createSvg(ctxt)
        fin()
      })))
  }
  // Psaume ou cantique : le ton sur le premier verset, puis le texte avec ses repères
  function decouperPsaume(source) {
    if (!/^name:\s*(?:\d+[-,]|Magnificat-)/m.test(source)) return null
    const pos = source.search(/%%/)
    const corps = source.slice(pos + 2)
    const debut = corps.search(/\s*(?:\^?\d+\.\^?|V\/\.|R\/\.)\s*\(::\)/)
    if (debut < 0) return null
    const entete = source.slice(0, pos + 2)
    const ton = entete + corps.slice(0, debut) + ' (::)'
    let m, dernier = null
    const reg = new RegExp(RE_VERSET.source, 'g')
    const blocs = []
    while ((m = reg.exec(corps))) {
      if (dernier) blocs.push({ num: dernier.num, txt: corps.slice(dernier.fin, m.index) })
      dernier = { num: m[1] || '', fin: reg.lastIndex }
    }
    if (dernier) blocs.push({ num: dernier.num, txt: corps.slice(dernier.fin) })
    const html = blocs.filter((b) => !RE_DOXOLOGIE.test(b.txt.replace(/\([^)]*\)/g, '').replace(/[*_^]/g, ''))).map((b) => {
      const t = b.txt
        .replace(/\*\(:\)/g, '\u0001')
        .replace(/\^†\^|†\([^)]*\)/g, '†')
        .replace(/\([^)]*\)/g, '')
        .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
        .replace(/\*([^*\s]+)\*/g, '<b>$1</b>')
        .replace(/_([^_\s]+)_/g, '<i>$1</i>')
        .replace(/\u0001/g, '*')
        .replace(/\s+/g, ' ').trim()
      return t ? `<span class="verset">${b.num ? `<sup class="vnum">${b.num}</sup>` : ''}${t}</span>` : ''
    }).join('')
    return { ton, html }
  }

  // ── Écoute : mélodie reconstituée à partir des notes ──
  function evenementsDe(mapping) {
    const evts = []
    let bemols = new Set()
    for (const mp of mapping) {
      for (const n of mp.notations) {
        const nom = n.constructor.name
        if (n.notes) {
          n.notes.forEach((x) => {
            let hauteur = x.pitch.toInt()
            if (bemols.has(x.staffPosition)) hauteur -= 1
            let duree = 0.3
            if (x.morae && x.morae.length) duree *= 2
            if (x.epismata && x.epismata.length) duree *= 1.4
            evts.push({ hauteur, duree })
          })
        } else if (nom === 'Accidental') {
          if (n.accidentalType === -1) bemols.add(n.staffPosition)
          else bemols.delete(n.staffPosition)
        } else if (n.isDivider) {
          bemols = new Set()
          if (evts.length) {
            const pause = /Quarter|Virgula/.test(nom) ? 0.12 : /Half/.test(nom) ? 0.3 : 0.5
            evts[evts.length - 1].pause = pause
            if (!/Quarter|Virgula/.test(nom)) evts[evts.length - 1].duree *= 1.5
          }
        }
      }
    }
    return evts
  }
  let _audio = null
  let _boutonSon = null
  function arreterSon() {
    if (_audio) { try { _audio.close() } catch { /* ignore */ } _audio = null }
    if (_boutonSon) { _boutonSon.textContent = _boutonSon.dataset.libelle; _boutonSon = null }
  }
  function jouer(evts, decalage, bouton) {
    const memeBouton = _boutonSon === bouton
    arreterSon()
    if (memeBouton || !evts.length) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = _audio = new Ctx()
    _boutonSon = bouton
    bouton.textContent = '■ Arrêter'
    // Son d'orgue très doux : presque uniquement la fondamentale, filtrée, attaque lente
    const onde = ctx.createPeriodicWave(new Float32Array(4), new Float32Array([0, 1, 0.12, 0.03]))
    const filtre = ctx.createBiquadFilter()
    filtre.type = 'lowpass'
    filtre.frequency.value = 1000
    filtre.connect(ctx.destination)
    const VOLUME = 0.1, ATTAQUE = 0.1, RELACHE = 0.18
    let t = ctx.currentTime + 0.08
    for (const e of evts) {
      const frequence = 440 * Math.pow(2, (e.hauteur + decalage - 69) / 12)
      const gain = ctx.createGain()
      const fin = t + e.duree + (e.pause ? 0 : RELACHE * 0.6)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(VOLUME, t + ATTAQUE)
      gain.gain.setValueAtTime(VOLUME, Math.max(t + ATTAQUE, fin - RELACHE))
      gain.gain.linearRampToValueAtTime(0, fin)
      gain.connect(filtre)
      for (const desaccord of [-2, 2]) {
        const osc = ctx.createOscillator()
        osc.setPeriodicWave(onde)
        osc.frequency.value = frequence
        osc.detune.value = desaccord
        osc.connect(gain)
        osc.start(t)
        osc.stop(fin + 0.01)
      }
      t += e.duree + (e.pause || 0)
    }
    setTimeout(() => { if (_audio === ctx) arreterSon() }, (t - ctx.currentTime + 0.1) * 1000)
  }
  function teneurDe(source) {
    const compte = new Map()
    const mapping = exsurge.Gabc.createMappingsFromSource(new exsurge.ChantContext(), source)
    for (const e of evenementsDe(mapping)) compte.set(e.hauteur, (compte.get(e.hauteur) || 0) + 1)
    return [...compte].sort((a, b) => b[1] - a[1])[0][0]
  }
  const plusProche = (valeur, cibles) => cibles.reduce((m, c) => (Math.abs(c - valeur) <= Math.abs(m - valeur) ? c : m))
  const decalageTeneur = (t) => 67 - t
  function decalageTessiture(evts) {
    const haut = Math.max(...evts.map((e) => e.hauteur))
    return plusProche(haut + 48, [70, 72]) - haut
  }
  function typePiece(el) {
    let n = el.previousSibling
    while (n && (n.nodeName === 'BR' || (n.nodeType === 3 && !n.textContent.trim()))) n = n.previousSibling
    if (!n || n.nodeType !== 1) return null
    const t = n.textContent.trim()
    if (/^Ant\./.test(t)) return 'antienne'
    if (/^Hymn/i.test(t)) return 'hymne'
    return null
  }
  function boutonEcouter(boite, type, teneur) {
    const evts = evenementsDe(boite._mapping || [])
    if (!evts.length) return null
    const decalage = type === 'antienne' && teneur !== null ? decalageTeneur(teneur) : decalageTessiture(evts)
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'greg-ecoute'
    b.textContent = b.dataset.libelle = '▶ Écouter'
    b.onclick = () => jouer(evts, decalage, b)
    return b
  }

  // ── Traduction française sous les pièces ──
  function basculerTraduction() {
    _traduction = !_traduction
    try { localStorage.setItem('breviaire-traduction', _traduction ? '1' : '0') } catch { /* ignore */ }
    majBoutonsLangue()
    arreterSon()
    const o = _cache[cleOffice()]
    if (o) afficher(o)
  }
  async function chargerFrancais(office) {
    if (office._francais) return office._francais
    const d = office.date.split('-')
    const o = await lireFichier(`data/breviaire/${d[0]}/${d[1]}-${d[2]}/Vespera.json`)
    if (!o) throw new Error('Traduction indisponible')
    office._francais = o.lignes.map((l) => l[1])
    return office._francais
  }
  function morceauxFrancais(cellule, k = 0) {
    const html = decouperPages(mettreEnForme(separerParties(cellule)))[k] || ''
    return html.split(/(?=<span class="do-partie">|<span class="do-rubr"><i>Ant\.|<span class="do-psaume">)/)
      .map((m) => m
        .replace(/<span class="do-(?:partie|psaume|titre)">[^]*?<\/span>/g, '')
        .replace(/^(?:\s*<br>\s*)+|(?:\s*<br>\s*)+$/g, '').trim())
      .filter((m) => m.replace(/<[^>]+>/g, '').trim())
  }
  function blocTraduction(html) {
    const d = document.createElement('div')
    d.className = 'greg-trad'
    d.lang = 'fr'
    d.innerHTML = html
    return d
  }
  async function dessinerPartitions(office) {
    const dessin = ++_dessin
    if (!box.querySelector('.gabc')) return
    try { exsurge = await chargerExsurge() } catch (e) { console.error(e); return }
    if (!vivant.ok || dessin !== _dessin) return
    let francais = null
    if (enGregorien() && _traduction && office) {
      try { francais = await chargerFrancais(office) } catch (e) { console.error(e) }
      if (!vivant.ok || dessin !== _dessin) return
    }
    for (const ligne of box.querySelectorAll('.brev-ligne')) {
      const pieces = [...ligne.querySelectorAll('.gabc')]
      const fr = francais ? morceauxFrancais(francais[parseInt(ligne.dataset.i, 10)] || '', +ligne.dataset.k || 0) : []
      const parPiece = fr.length === pieces.length
      const psaumes = pieces.map((p) => (decouperPsaume(p.textContent) ? p.textContent : null))
      for (let i = 0; i < pieces.length; i++) {
        const el = pieces[i]
        el.style.display = 'none'
        const source = el.textContent
        const boite = document.createElement('div')
        boite.className = 'gregorien-score'
        el.after(boite)
        const psaume = decouperPsaume(source)
        try { await dessinerScore(psaume ? psaume.ton : source, boite) } catch (e) { console.error(e); boite.textContent = 'Partition indisponible.' }
        if (!vivant.ok || dessin !== _dessin) return
        let dernier = boite
        const type = typePiece(el)
        if (type) {
          let suivant = psaumes.slice(i + 1).find(Boolean)
          if (!suivant) suivant = psaumes.slice(0, i).reverse().find(Boolean)
          let teneur = null
          if (type === 'antienne' && suivant) { try { teneur = teneurDe(suivant) } catch (e) { console.error(e) } }
          const bouton = boutonEcouter(boite, type, teneur)
          if (bouton) boite.before(bouton)
        }
        if (psaume) {
          const v = document.createElement('div')
          v.className = 'gregorien-versets'
          v.innerHTML = psaume.html
          dernier.after(v)
          dernier = v
        }
        if (parPiece && fr[i]) dernier.after(blocTraduction(fr[i]))
      }
      if (francais && !parPiece && fr.length) (ligne.querySelector('.brev-text') || ligne).appendChild(blocTraduction(fr.join('<br>')))
    }
  }

  // ── Taille du texte ──
  let _taille = 1
  try { const t = parseInt(localStorage.getItem('breviaire-taille'), 10); if (TAILLES[t]) _taille = t } catch { /* ignore */ }
  function appliquerTaille() {
    box.style.setProperty('--brev-k', TAILLES[_taille])
    racine.querySelector('[data-taille="-1"]').disabled = _taille === 0
    racine.querySelector('[data-taille="1"]').disabled = _taille === TAILLES.length - 1
  }
  function changerTaille(delta) {
    _taille = Math.min(TAILLES.length - 1, Math.max(0, _taille + delta))
    try { localStorage.setItem('breviaire-taille', _taille) } catch { /* ignore */ }
    appliquerTaille()
  }

  // ── Plein écran (amélioration) : le bréviaire seul, sans les menus ──
  function basculerPlein(oui = !racine.classList.contains('plein')) {
    const pos = positionLecture()
    racine.classList.toggle('plein', oui)
    r('plein').textContent = oui ? '✕' : '⤢'
    r('plein').title = oui ? 'Quitter le plein écran' : 'Plein écran'
    r('plein').setAttribute('aria-label', r('plein').title)
    try {
      if (oui && !document.fullscreenElement) racine.requestFullscreen?.()?.catch?.(() => {})
      if (!oui && document.fullscreenElement === racine) document.exitFullscreen?.()?.catch?.(() => {})
    } catch { /* ignore */ }
    majHautBarre()
    requestAnimationFrame(() => restaurerLecture(pos))
  }
  ecouter(document, 'fullscreenchange', () => { if (!document.fullscreenElement && racine.classList.contains('plein')) basculerPlein(false) })

  // ── À l'ouverture : l'heure correspondant au moment de la journée ──
  _heure = HEURES.some(([h]) => h === options.heure) ? options.heure : heureDuMoment()   // ?heure=… (depuis « Ma journée »)
  racine.querySelectorAll('.heure-tab').forEach((b) => {
    const actif = b.dataset.heure === _heure
    b.classList.toggle('active', actif)
    if (actif) requestAnimationFrame(() => { b.parentElement.scrollLeft = b.offsetLeft - (b.parentElement.clientWidth - b.offsetWidth) / 2 })
  })

  // Boutons
  ecouter(racine, 'click', (e) => {
    const b = e.target.closest('button')
    if (!b || !racine.contains(b)) return
    if (b.dataset.jour) naviguerJour(+b.dataset.jour)
    else if (b.dataset.heure) setHeure(b)
    else if (b.dataset.lang) setLang(b.dataset.lang)
    else if (b.dataset.taille) changerTaille(+b.dataset.taille)
    else if (b.dataset.r === 'greg') setGregorien()
    else if (b.dataset.r === 'trad') basculerTraduction()
    else if (b.dataset.r === 'plein') basculerPlein()
    else if (b.dataset.r === 'sombre') basculerSombreLiturgie()
    else if (b.dataset.r === 'horsligne') prechargerLiturgie()
  })

  // Hors ligne : les 30 prochains jours
  const finSuivi = suivrePrechargement((t) => { const b = r('horsligne'); b.hidden = !t; b.textContent = t || '' })
  nettoyages.push(finSuivi)

  // Bouton ☾ / ☀ (les partitions suivent la couleur du texte)
  function majSombre() {
    const sombre = estSombre(), b = r('sombre')
    b.textContent = sombre ? '☀' : '☾'
    b.title = sombre ? 'Mode clair' : 'Mode sombre'
    b.setAttribute('aria-label', b.title)
  }
  ecouter(window, 'theme-liturgie', majSombre)
  majSombre()

  majHautBarre()
  appliquerTaille()
  majBoutonsLangue()
  chargerCalendrier().then(() => { if (vivant.ok) chargerOffice() })
  prechargerLiturgie()

  return () => {
    vivant.ok = false
    arreterSon()
    if (_eveil) { _eveil.release().catch(() => {}); _eveil = null }
    if (document.fullscreenElement === racine) document.exitFullscreen?.().catch(() => {})
    clearTimeout(_minuteurLecture)
    nettoyages.forEach((f) => f())
    racine.innerHTML = ''
  }
}
