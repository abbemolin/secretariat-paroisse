// Édition directe dans l'aperçu de la newsletter : reprise de newsletter.html (AppMesse).
// Les annonces et le calendrier sont modifiables dans le cadre ; c'est la version modifiée qui est envoyée.
import { escHtml } from './semaine.js'
import { NL_DOCTYPE, NL_SEP_HTML, genAnnonceHTML } from './gabarit.js'

// Styles des lignes du calendrier (identiques au calendrier)
const NL_STYLE_HEURE = 'width:84px;padding:3px 0 3px 16px;font-size:15px;color:#6D6D6C;white-space:nowrap;'
const NL_STYLE_LIBELLE = 'padding:3px 0;font-size:16px;color:#333333;'
const NL_EDIT_CSS = `
  [data-nl-zone] { outline: none; }
  [data-nl-zone] td:hover, [data-nl-zone] h1:hover, [data-nl-zone] h3:hover, [data-nl-zone] p:hover {
    background-image: linear-gradient(rgba(2,49,153,.05), rgba(2,49,153,.05));
  }
  [data-nl-zone]:focus-within { box-shadow: 0 0 0 2px rgba(2,49,153,.18); border-radius: 4px; }
  .nl-ctrls { float: right; white-space: nowrap; opacity: .45; margin-left: 6px; }
  tr:hover > td > .nl-ctrls, td:hover > .nl-ctrls { opacity: 1; }
  .nl-ctrl {
    display: inline-block; font: 11px/16px system-ui, -apple-system, sans-serif; font-weight: normal; font-style: normal;
    color: #6D6D6C; background: #fff; border: 1px solid #c9bfae; border-radius: 10px;
    padding: 1px 7px; margin-left: 4px; cursor: pointer; user-select: none; -webkit-user-select: none;
  }
  .nl-ctrl:hover { background: #023199; border-color: #023199; color: #fff; }
  .nl-ctrl.nl-del:hover { background: #B3261E; border-color: #B3261E; }
  .nl-add td { padding: 2px 0 4px 16px; }
`

// Brouillons enregistrés avant le passage au mail fluide (600 px fixe → max 600 px)
export function migrerBrouillon(html) {
  return html.replace(
    /<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="600" align="center" style="table-layout:fixed;width:600px;">/,
    '<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" style="table-layout:fixed;width:100%;max-width:600px;margin:0 auto;">'
  )
}

export function normaliserUrl(u) {
  u = (u || '').trim()
  if (!u) return ''
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u
  if (/^\+?[\d\s.]{8,}$/.test(u)) return 'tel:' + u.replace(/[\s.]/g, '')
  return 'https://' + u.replace(/^\/+/, '')
}

/**
 * Éditeur sur le cadre (iframe) de l'aperçu.
 * o = { onModifie(), onHauteur(), toast(texte), ouvrirPanneau({ titre, url, peutRetirer }), decocher(id) → bool (annonce de la liste ?), onFormat() }
 */
export function creerEditeur(frame, o) {
  let nlLien = null
  let compteur = 0
  const doc = () => frame && (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document))

  function ajuster() {
    const d = doc()
    if (frame && d && d.documentElement) frame.style.height = (d.documentElement.scrollHeight + 20) + 'px'
    o.onHauteur?.()
  }
  function modifie() { o.onModifie(); ajuster() }

  function nlBouton(d, action, texte, titre, del) {
    const b = d.createElement('span')
    b.className = 'nl-ctrl' + (del ? ' nl-del' : '')
    b.setAttribute('data-nl-ctrl', '1'); b.setAttribute('data-nl-action', action); b.setAttribute('contenteditable', 'false')
    b.title = titre; b.textContent = texte
    return b
  }
  function nlGroupe(d, boutons) {
    const g = d.createElement('span')
    g.className = 'nl-ctrls'; g.setAttribute('data-nl-ctrl', '1'); g.setAttribute('contenteditable', 'false')
    boutons.forEach((b) => g.appendChild(b))
    return g
  }
  const estLigneHoraire = (tr) => tr.children.length === 2 && tr.children[0].getAttribute('width') === '84'
  function estLigneNote(tr) {
    const tds = tr.children
    if (tds.length !== 1 || tds[0].getAttribute('colspan') !== '2' || tds[0].hasAttribute('bgcolor')) return false
    return !/line-height\s*:\s*\d+px/.test(tds[0].getAttribute('style') || '') && tds[0].textContent.trim() !== ''
  }
  function estFinDeJour(tr) {
    const td = tr.children[0]
    return tr.children.length === 1 && td && /line-height\s*:\s*18px/.test(td.getAttribute('style') || '')
  }
  function ajouterOutilsLigne(d, tr) {
    if (tr.querySelector('.nl-ctrls')) return
    const cible = tr.children[tr.children.length - 1]
    const boutons = []
    if (estLigneHoraire(tr)) boutons.push(nlBouton(d, 'messe', 'Messe', 'Afficher / ne plus afficher comme une messe (bleu, gras)'))
    boutons.push(nlBouton(d, 'suppr-ligne', '✕', 'Supprimer cette ligne', true))
    cible.insertBefore(nlGroupe(d, boutons), cible.firstChild)
  }
  function majBoutonsAnnonces(d) {
    d.querySelectorAll('[data-annonce-id]').forEach((t) => {
      const ctrl = t.querySelector('[data-nl-action="ajout-bouton"]')
      if (ctrl) ctrl.style.display = t.querySelector('[data-nl-bouton]') ? 'none' : ''
    })
  }
  function ajouterOutilsAnnonce(d, t) {
    const td = t.querySelector('td[valign="top"]')
    if (td && !td.querySelector('.nl-ctrls')) {
      td.insertBefore(nlGroupe(d, [
        nlBouton(d, 'ajout-bouton', '+ Bouton', 'Ajouter un bouton « En savoir plus » avec un lien'),
        nlBouton(d, 'retirer-annonce', '✕ Retirer', 'Retirer cette annonce de la newsletter', true)
      ]), td.firstChild)
    }
    majBoutonsAnnonces(d)
  }
  function majSeparateurs(d) {
    const visible = (el) => el.hasAttribute('data-annonce-id') && !el.hasAttribute('data-nl-hidden')
    d.querySelectorAll('[data-nl-sep]').forEach((sep) => {
      let avant = false, apres = false
      for (let n = sep.previousElementSibling; n; n = n.previousElementSibling) if (visible(n)) { avant = true; break }
      for (let n = sep.nextElementSibling; n; n = n.nextElementSibling) if (visible(n)) { apres = true; break }
      const cacher = !(avant && apres)
      sep.style.display = cacher ? 'none' : ''
      if (cacher) sep.setAttribute('data-nl-hidden', '1'); else sep.removeAttribute('data-nl-hidden')
    })
    const zone = d.querySelector('[data-nl-zone="annonces"]')
    if (zone) {
      const aucune = !Array.from(zone.querySelectorAll('[data-annonce-id]')).some(visible)
      zone.style.display = aucune ? 'none' : ''
      if (aucune) zone.setAttribute('data-nl-hidden', '1'); else zone.removeAttribute('data-nl-hidden')
    }
  }
  function selectionDansZone(d) {
    const sel = d && d.getSelection()
    if (!sel || !sel.rangeCount) return false
    const n = sel.getRangeAt(0).commonAncestorContainer
    const el = n.nodeType === 1 ? n : n.parentElement
    return !!(el && el.closest('[data-nl-zone]') && !el.closest('[data-nl-ctrl]'))
  }
  function lienSousSelection(d) {
    const sel = d && d.getSelection()
    if (!sel || !sel.rangeCount) return null
    const n = sel.getRangeAt(0).commonAncestorContainer
    const el = n.nodeType === 1 ? n : n.parentElement
    const a = el && el.closest('a')
    return a && a.closest('[data-nl-zone]') ? a : null
  }

  function actionEdition(d, action, bouton) {
    if (action === 'ajout-bouton') {
      const t = bouton.closest('[data-annonce-id]')
      if (t) { nlLien = { annonce: t }; o.ouvrirPanneau({ titre: 'Adresse du bouton « En savoir plus »', url: '', peutRetirer: false }) }
      return
    }
    const tr = bouton.closest('tr')
    if (action === 'suppr-ligne' && tr) tr.remove()
    else if (action === 'messe' && tr) {
      const [tdH, tdL] = tr.children
      const estMesseActuelle = /font-weight\s*:\s*bold/.test(tdL.getAttribute('style') || '')
      ;[tdH, tdL].forEach((td) => { td.style.color = estMesseActuelle ? '' : '#023199'; td.style.fontWeight = estMesseActuelle ? '' : 'bold'; td.style.fontStyle = '' })
      if (estMesseActuelle) { tdH.style.color = '#6D6D6C'; tdL.style.color = '#333333' }
    } else if (action === 'ajout-ligne' && tr) {
      const nv = d.createElement('tr')
      nv.innerHTML = `<td width="84" valign="top" style="${NL_STYLE_HEURE}"></td><td valign="top" style="${NL_STYLE_LIBELLE}">Nouvelle ligne</td>`
      tr.parentNode.insertBefore(nv, tr)
      ajouterOutilsLigne(d, nv)
      const sel = d.getSelection(), r = d.createRange()
      r.setStart(nv.children[0], 0); r.collapse(true)
      sel.removeAllRanges(); sel.addRange(r)
    } else if (action === 'retirer-annonce') {
      const t = bouton.closest('[data-annonce-id]')
      if (t) {
        const id = t.getAttribute('data-annonce-id')
        if (o.decocher(id)) masquerAnnonce(id, true)
        else { t.remove(); majSeparateurs(d) }   // annonce ajoutée dans l'aperçu : supprimée
      }
    }
    modifie()
  }

  function preparerEdition(d) {
    if (!d || !d.head) return
    if (!d.getElementById('nl-edit-style')) {
      const st = d.createElement('style'); st.id = 'nl-edit-style'; st.textContent = NL_EDIT_CSS; d.head.appendChild(st)
    }
    d.querySelectorAll('[data-nl-zone]').forEach((z) => { z.setAttribute('contenteditable', 'true'); z.setAttribute('spellcheck', 'true'); z.setAttribute('lang', 'fr') })
    const cal = d.querySelector('[data-nl-zone="calendrier"]')
    if (cal) {
      Array.from(cal.querySelectorAll('tr')).forEach((tr) => {
        if (estLigneHoraire(tr) || estLigneNote(tr)) ajouterOutilsLigne(d, tr)
        else if (estFinDeJour(tr)) {
          const add = d.createElement('tr')
          add.className = 'nl-add'; add.setAttribute('data-nl-ctrl', '1'); add.setAttribute('contenteditable', 'false')
          const td = d.createElement('td'); td.setAttribute('colspan', '2')
          td.appendChild(nlBouton(d, 'ajout-ligne', '+ Ajouter une ligne', 'Ajouter une ligne à ce jour'))
          add.appendChild(td); tr.parentNode.insertBefore(add, tr)
        }
      })
    }
    d.querySelectorAll('[data-annonce-id]').forEach((t) => ajouterOutilsAnnonce(d, t))
    majSeparateurs(d)
    d.addEventListener('selectionchange', () => o.onFormat?.())
    d.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-nl-action]')
      if (!b) return
      e.preventDefault()
      actionEdition(d, b.getAttribute('data-nl-action'), b)
    })
    d.addEventListener('input', () => modifie())
    // Collage : texte brut uniquement
    d.addEventListener('paste', (e) => {
      if (!e.target.closest || !e.target.closest('[data-nl-zone]')) return
      e.preventDefault()
      d.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'))
    })
    // Les liens ne s'ouvrent pas pendant l'édition
    d.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-nl-zone] a')) e.preventDefault() }, true)
  }

  function masquerAnnonce(id, masquer) {
    const d = doc()
    const t = d && d.querySelector(`[data-annonce-id="${CSS.escape(String(id))}"]`)
    if (!t) return false
    t.style.display = masquer ? 'none' : ''
    if (masquer) t.setAttribute('data-nl-hidden', '1'); else t.removeAttribute('data-nl-hidden')
    majSeparateurs(d)
    return true
  }

  return {
    /** Écrit le mail dans le cadre et le rend modifiable. */
    afficher(html) {
      const d = doc()
      d.open(); d.write(html); d.close()
      preparerEdition(d)
      setTimeout(ajuster, 300)
    },
    ajuster,
    /** HTML sans les outils d'édition ; pourEnvoi : retire aussi les marqueurs internes. */
    htmlFinal(pourEnvoi, secours) {
      const d = doc()
      if (!d || !d.documentElement || !d.querySelector('[data-nl-zone]')) return secours
      const clone = d.documentElement.cloneNode(true)
      clone.querySelectorAll('[data-nl-ctrl], #nl-edit-style, [data-nl-hidden]').forEach((n) => n.remove())
      clone.querySelectorAll('[contenteditable]').forEach((n) => { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck') })
      if (pourEnvoi) {
        clone.querySelectorAll('[data-nl-zone],[data-nl-sep],[data-annonce-id],[data-nl-annonces-liste],[data-nl-bouton]').forEach((n) => {
          ;['data-nl-bouton', 'data-nl-zone', 'data-nl-sep', 'data-annonce-id', 'data-nl-annonces-liste'].forEach((a) => n.removeAttribute(a))
        })
      }
      return NL_DOCTYPE + '\n' + clone.outerHTML
    },
    /** Annonces présentes et visibles dans la version affichée (après un brouillon). */
    annoncesVisibles() {
      const d = doc()
      if (!d) return []
      return Array.from(d.querySelectorAll('[data-annonce-id]')).filter((t) => !t.hasAttribute('data-nl-hidden')).map((t) => t.getAttribute('data-annonce-id'))
    },
    masquerAnnonce,
    etatFormat() {
      const d = doc(), dans = selectionDansZone(d), r = {}
      ;['bold', 'italic', 'underline'].forEach((c) => { try { r[c] = dans && d.queryCommandState(c) } catch { r[c] = false } })
      r.lien = dans && !!lienSousSelection(d)
      return r
    },
    appliquerFormat(cmd) {
      const d = doc()
      if (!selectionDansZone(d)) { o.toast('Sélectionnez d\'abord un texte dans les annonces ou le calendrier'); return }
      frame.contentWindow?.focus()
      try { d.execCommand('styleWithCSS', false, false) } catch { /* ignore */ }
      d.execCommand(cmd, false, null)
      modifie(); o.onFormat?.()
    },
    // CAPITALES : transforme réellement le texte ; si déjà en capitales, repasse en minuscules (1re lettre conservée)
    basculerCapitales() {
      const d = doc()
      if (!selectionDansZone(d) || d.getSelection().isCollapsed) { o.toast('Sélectionnez d\'abord le texte à mettre en capitales'); return }
      const range = d.getSelection().getRangeAt(0)
      const racine = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode
      const morceaux = []
      const w = d.createTreeWalker(racine, NodeFilter.SHOW_TEXT)
      let n
      while ((n = w.nextNode())) {
        if (!range.intersectsNode(n) || (n.parentElement && n.parentElement.closest('[data-nl-ctrl]'))) continue
        const debut = n === range.startContainer ? range.startOffset : 0
        const fin = n === range.endContainer ? range.endOffset : n.data.length
        if (fin > debut) morceaux.push({ n, debut, fin })
      }
      if (racine.nodeType === 3 && !morceaux.length) morceaux.push({ n: racine, debut: range.startOffset, fin: range.endOffset })
      const texte = morceaux.map((m) => m.n.data.slice(m.debut, m.fin)).join('')
      if (!/\p{L}/u.test(texte)) return
      const dejaCapitales = texte === texte.toLocaleUpperCase('fr-FR')
      let premiereLettre = true
      morceaux.forEach((m) => {
        let part = m.n.data.slice(m.debut, m.fin)
        if (dejaCapitales) {
          part = part.toLocaleLowerCase('fr-FR')
          if (premiereLettre) part = part.replace(/\p{L}/u, (c) => { premiereLettre = false; return c.toLocaleUpperCase('fr-FR') })
        } else part = part.toLocaleUpperCase('fr-FR')
        m.n.data = m.n.data.slice(0, m.debut) + part + m.n.data.slice(m.fin)
      })
      const premier = morceaux[0], dernier = morceaux[morceaux.length - 1]
      const r = d.createRange()
      r.setStart(premier.n, premier.debut); r.setEnd(dernier.n, Math.min(dernier.fin, dernier.n.data.length))
      const sel = d.getSelection(); sel.removeAllRanges(); sel.addRange(r)
      modifie()
    },
    // 🔗 : lien sur le texte sélectionné, ou modifier le lien où se trouve le curseur
    ouvrirPanneauLien() {
      const d = doc()
      if (!selectionDansZone(d)) { o.toast('Sélectionnez d\'abord un texte dans les annonces ou le calendrier'); return }
      const a = lienSousSelection(d), sel = d.getSelection()
      if (!a && sel.isCollapsed) { o.toast('Sélectionnez le texte à transformer en lien'); return }
      nlLien = { range: sel.getRangeAt(0).cloneRange(), a }
      o.ouvrirPanneau({ titre: a ? 'Modifier le lien' : 'Adresse du lien', url: a ? a.getAttribute('href') : '', peutRetirer: !!a })
    },
    fermerLien() { nlLien = null },
    validerLien(valeur) {
      const d = doc()
      if (!nlLien || !d) return true
      const url = normaliserUrl(valeur)
      if (!url) { o.toast('Indiquez une adresse'); return false }
      if (nlLien.annonce) {
        const td = nlLien.annonce.querySelector('td[valign="top"]')
        const t = d.createElement('div')
        t.innerHTML = `<table data-nl-bouton="1" cellpadding="0" cellspacing="0" border="0"><tbody><tr>
        <td style="border:1px solid #023199;border-radius:20px;padding:5px 16px;">
          <a href="${escHtml(url)}" target="_blank" style="color:#023199;text-decoration:none;font-size:13px;font-weight:bold;font-family:Palatino,Georgia,serif;">En savoir plus</a>
        </td></tr></tbody></table>`
        td.appendChild(t.firstElementChild)
        majBoutonsAnnonces(d)
        o.toast('Bouton ajouté — touchez « En savoir plus » pour changer son texte')
      } else if (nlLien.a) nlLien.a.setAttribute('href', url)
      else {
        frame.contentWindow?.focus()
        const sel = d.getSelection(); sel.removeAllRanges(); sel.addRange(nlLien.range)
        try { d.execCommand('styleWithCSS', false, false) } catch { /* ignore */ }
        d.execCommand('createLink', false, url)
        d.querySelectorAll('[data-nl-zone] a').forEach((a) => {
          if (a.getAttribute('href') === url && !a.getAttribute('style')) { a.setAttribute('style', 'color:#023199;text-decoration:underline;'); a.setAttribute('target', '_blank') }
        })
      }
      nlLien = null
      modifie()
      return true
    },
    retirerLien() {
      const d = doc()
      if (!nlLien || !nlLien.a) { nlLien = null; return }
      const a = nlLien.a, bouton = a.closest('[data-nl-bouton]')
      if (bouton) { bouton.remove(); majBoutonsAnnonces(d) } else a.replaceWith(...a.childNodes)
      nlLien = null
      modifie()
    },
    /** « + Annonce » : pour cette newsletter seulement. */
    ajouterAnnonce() {
      const d = doc()
      const liste = d && d.querySelector('[data-nl-annonces-liste]')
      if (!liste) { o.toast('Aperçu non prêt — rechargez'); return }
      const id = 'n' + Date.now() + '-' + (++compteur)
      const tmp = d.createElement('div')
      const dejaUne = !!liste.querySelector(':scope > [data-annonce-id]')
      tmp.innerHTML = (dejaUne ? NL_SEP_HTML : '') + genAnnonceHTML({ id, titre: 'Titre de la nouvelle annonce', description: 'Texte de l\'annonce.' })
      Array.from(tmp.children).forEach((n) => liste.appendChild(n))
      const t = liste.querySelector(`[data-annonce-id="${id}"]`)
      ajouterOutilsAnnonce(d, t)
      majSeparateurs(d)
      modifie()
      const h3 = t.querySelector('h3')
      frame.contentWindow?.focus()
      const r = d.createRange(); r.selectNodeContents(h3)
      const sel = d.getSelection(); sel.removeAllRanges(); sel.addRange(r)
      setTimeout(() => {
        const y = frame.getBoundingClientRect().top + t.getBoundingClientRect().top - 120
        frame.closest('main')?.scrollBy({ top: y, behavior: 'smooth' })
      }, 50)
    }
  }
}
