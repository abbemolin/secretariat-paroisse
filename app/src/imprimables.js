// Formulaires diocésains reproduits pour impression sur papier blanc (A4).
// Chaque modèle : liste de champs (pré-remplis depuis le dossier, modifiables) + HTML.

const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const dateLongue = (s) => {
  if (!s) return ''
  const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s)
  return isNaN(d) ? String(s) : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
const aujourdhui = () => dateLongue(new Date().toISOString())
const annee = (s) => (s ? String(new Date(s).getFullYear()) : '')

const PAGE = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #222; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 20mm 20mm; position: relative; }
  .form { position: absolute; top: 12mm; right: 20mm; font-size: 10pt; }
  .l { display: flex; align-items: flex-end; gap: 3mm; margin: 0 0 6.2mm; font-size: 12pt; }
  .l b { font-weight: bold; }
  .v { flex: 1; border-bottom: 0.4mm solid #b33a5a; min-height: 6mm; padding: 0 1mm 0.6mm; font-size: 12pt; }
  .v.court { flex: 0 0 34mm; }
  .v.moyen { flex: 0 0 70mm; }
  .titre { text-align: center; color: #d9534f; font-weight: bold; font-size: 17pt; letter-spacing: .5px; margin: 10mm 0 14mm; }
  .petit { font-size: 7pt; display: block; line-height: 1; }
  .sig { display: flex; justify-content: space-between; margin-top: 18mm; font-size: 9.5pt; padding: 0 12mm; }
  @media screen { body { background: #e9e6df; } .page { background: #fff; margin: 0 auto; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }
`
const doc = (corps) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Document</title><style>${PAGE}</style></head><body><div class="page">${corps}</div></body></html>`
const ligne = (label, valeur, cls = '') => `<div class="l"><span>${label}</span><span class="v ${cls}">${e(valeur)}</span></div>`

// ─── B14 – Extrait de baptême ───
export const B14 = {
  titre: 'Extrait de baptême (B14)',
  champs: [
    ['paroisse', 'Paroisse (maternité)'], ['diocese', 'Diocèse'], ['annee', 'Registre des baptêmes, année'], ['acte', 'Acte n°'],
    ['sexe', 'Garçon ou fille', 'sexe'], ['prenoms', 'Prénoms'], ['nom', 'NOM'], ['ne_le', 'Né(e) le'], ['ne_a', 'À'],
    ['baptise_le', 'A été baptisé(e) le'], ['eglise', "À l'église"], ['de', 'De (commune)'], ['diocese_de', 'Diocèse de'],
    ['confirme_le', 'Confirmé(e) le (si confirmé)'], ['confirme_a', 'À (lieu de la confirmation)'],
    ['marie_le', 'Pour un adulte : marié religieusement le'], ['marie_a', 'À'], ['fait_a', 'Certifié conforme, à'], ['fait_le', 'Le']
  ],
  depuis(d, r) {
    const i = d.infos || {}
    const enfant = d.type === 'bapteme'
    return {
      paroisse: r.paroisse, diocese: r.diocese,
      annee: i.registre_annee || annee(d.date_celebration), acte: i.acte_numero || '',
      sexe: i.sexe || '',
      confirme_le: d.type === 'catechumene' ? dateLongue(d.date_celebration) : dateLongue(i.confirmation_date),
      confirme_a: d.type === 'catechumene' ? [i.lieu_celebration, i.commune_celebration].filter(Boolean).join(', ') : i.confirmation_lieu || '',
      prenoms: enfant ? i.enfant_prenoms : i.prenoms, nom: String((enfant ? i.enfant_nom : i.nom) || '').toUpperCase(),
      ne_le: dateLongue(enfant ? i.enfant_naissance_date : i.naissance_date), ne_a: enfant ? i.enfant_naissance_lieu : i.naissance_lieu,
      baptise_le: dateLongue(d.date_celebration), eglise: i.lieu_celebration || r.eglise, de: i.commune_celebration || r.commune,
      diocese_de: i.diocese_celebration || r.diocese,
      marie_le: dateLongue(i.marie_religieusement_le), marie_a: i.marie_religieusement_a || '',
      fait_a: r.commune, fait_le: aujourdhui()
    }
  },
  /** sign (facultatif) : { signature: dataURL, sceau: dataURL, par, le } */
  html(v, sign = {}) {
    // accord selon le sexe : « né » / « née », « BAPTISÉ » / « BAPTISÉE »…
    const f = ['Fille', 'Femme'].includes(v.sexe), g = ['Garçon', 'Homme'].includes(v.sexe)
    const acc = (base) => (f ? base + 'e' : g ? base : base + '(e)')
    return doc(`
      <div class="form">Form. <b>B 14</b></div>
      <div class="titre">EXTRAIT DE BAPTÊME</div>
      <div class="l"><span>Paroisse<span class="petit">(Maternité)</span></span><span class="v">${e(v.paroisse)}</span></div>
      <div class="l"><span>Diocèse</span><span class="v moyen">${e(v.diocese)}</span><span style="flex:1"></span></div>
      <div class="l" style="justify-content:flex-end;margin-top:8mm"><span>REGISTRE DES BAPTÊMES, ANNÉE</span><span class="v court">${e(v.annee)}</span><span>ACTE N°</span><span class="v court" style="flex-basis:28mm">${e(v.acte)}</span></div>
      ${ligne('<b>Prénoms</b>', v.prenoms)}
      ${ligne('<b>NOM</b>', v.nom)}
      ${ligne(acc('né') + ' le', v.ne_le)}
      ${ligne('à', v.ne_a)}
      ${ligne('<b>A ÉTÉ ' + (f ? 'BAPTISÉE' : g ? 'BAPTISÉ' : 'BAPTISÉ(E)') + '</b> le', v.baptise_le)}
      ${ligne("à l'église", v.eglise)}
      ${ligne('de', v.de)}
      ${ligne('diocèse de', v.diocese_de)}
      <div class="l"><span>${acc('Confirmé')} le</span><span class="v">${e(v.confirme_le)}</span><span>à</span><span class="v">${e(v.confirme_a)}</span></div>
      <div class="l"><span>Pour un adulte, si nécessaire :</span></div>
      <div class="l"><span>${acc('Marié')} religieusement le</span><span class="v">${e(v.marie_le)}</span><span>à</span><span class="v">${e(v.marie_a)}</span></div>
      <div class="l" style="margin-top:10mm"><span>Certifié conforme au Registre</span></div>
      <div class="l" style="margin-top:8mm;padding-left:50mm"><span>A</span><span class="v">${e(v.fait_a)}</span><span>le</span><span class="v moyen" style="flex-basis:40mm">${e(v.fait_le)}</span></div>
      <div class="sig" style="align-items:flex-start">
        <div style="width:60mm;text-align:center">Sceau paroissial
          ${sign.sceau ? `<div style="margin-top:2mm"><img src="${sign.sceau}" style="max-width:38mm;max-height:38mm;opacity:.92"></div>` : ''}</div>
        <div style="width:62mm;text-align:left">Signature d'une personne<br>canoniquement mandatée
          ${sign.signature ? `<div style="margin-top:2mm"><img src="${sign.signature}" style="max-width:58mm;max-height:24mm"></div>` : ''}
          ${sign.par ? `<div style="font-size:8.5pt;color:#555;margin-top:1mm">${e(sign.par)}${sign.le ? ', le ' + e(sign.le) : ''}</div>` : ''}</div>
      </div>
    `)
  }
}

// ─── B6 – L'entrée en catéchuménat ───
export const B6 = {
  titre: "L'entrée en catéchuménat (B6)",
  champs: [
    ['diocese', 'Diocèse de'], ['annee', 'Année'], ['paroisse', 'Paroisse'], ['acte', 'Acte n°'],
    ['date', 'Le (date de l\'accueil)'], ['ministre', 'Prêtre ou diacre'], ['prenoms', 'Prénoms'], ['nom', 'NOM'],
    ['nom_jf', 'NOM de jeune fille'], ['ne_le', 'Né(e) le'], ['ne_a', 'À'], ['epoux', 'Éventuellement époux – épouse de'],
    ['domicile', 'Domicilié(e) à'], ['service', 'Membres du service diocésain du catéchuménat', 'zone'], ['accompagnateurs', 'Accompagnateurs', 'zone']
  ],
  depuis(d, r) {
    const i = d.infos || {}
    return {
      diocese: r.diocese, annee: i.b6_annee || annee(i.entree_date), paroisse: r.paroisse, acte: i.b6_acte || '',
      date: dateLongue(i.entree_date), ministre: i.entree_ministre || '', prenoms: i.prenoms, nom: String(i.nom || '').toUpperCase(),
      nom_jf: i.nom_jeune_fille || '', ne_le: dateLongue(i.naissance_date), ne_a: i.naissance_lieu || '', epoux: i.conjoint || '',
      domicile: i.adresse || '', service: i.service_diocesain || '', accompagnateurs: i.accompagnateurs || ''
    }
  },
  /** sign (facultatif) : { pretre, catechumene, sceau : dataURL, le } */
  html(v, sign = {}) {
    const img = (src, h = 20) => (src ? `<img src="${src}" style="max-width:52mm;max-height:${h}mm;display:block;margin:2mm auto 0">` : '')
    const lignesMulti = (t, n) => {
      const l = String(t || '').split('\n')
      return Array.from({ length: Math.max(n, l.length) }, (_, k) => `<div class="l"><span class="v" style="border-bottom-style:dotted;border-color:#333">${e(l[k] || '')}</span></div>`).join('')
    }
    const pt = (x) => `<span class="v" style="border-bottom:0.3mm dotted #333">${e(x)}</span>`
    return doc(`
      <style>.v{border-bottom:0.3mm dotted #333!important} .page{font-family:'Times New Roman',Times,serif} .l{font-size:12.5pt}</style>
      <div class="form" style="border:1px solid #333;padding:1mm 3mm">Form B6</div>
      <div style="text-align:center;margin:14mm 0 12mm;font-size:13pt">L'ENTREE EN CATECHUMENAT<br>(Registre diocésain)</div>
      <div class="l"><span>Diocèse de</span>${pt(v.diocese)}<span>Année</span><span class="v court">${e(v.annee)}</span></div>
      <div class="l"><span>Paroisse</span>${pt(v.paroisse)}<span>Acte n°</span><span class="v court">${e(v.acte)}</span></div>
      <div class="l"><span>Le</span><span class="v moyen" style="flex-basis:55mm">${e(v.date)}</span><span>a été accueilli(e) dans la communauté chrétienne par moi</span></div>
      <div class="l"><span style="font-size:9pt;font-style:italic">(désignation du prêtre ou du diacre)</span>${pt(v.ministre)}</div>
      <div class="l"><span>Prénoms</span>${pt(v.prenoms)}</div>
      <div class="l"><span>NOM</span>${pt(v.nom)}</div>
      <div class="l"><span>NOM de jeune fille</span>${pt(v.nom_jf)}</div>
      <div class="l"><span>Né(e) le</span><span class="v moyen" style="flex-basis:55mm">${e(v.ne_le)}</span><span>à</span>${pt(v.ne_a)}</div>
      <div class="l"><span>Eventuellement époux – épouse de :</span>${pt(v.epoux)}</div>
      <div class="l"><span>Domicilié(e) à :</span>${pt(v.domicile)}</div>
      <div class="l"><span>En présence de membres du service diocésain du catéchuménat :</span>${pt(String(v.service || '').split('\n')[0])}</div>
      ${lignesMulti(String(v.service || '').split('\n').slice(1).join('\n'), 2)}
      <p style="font-size:12.5pt;margin:2mm 0 4mm">Pour recevoir l'éducation de la foi de l'Eglise catholique et être acheminé(e) vers les sacrements de l'Initiation Chrétienne : Baptême – Confirmation – Eucharistie.</p>
      <div class="l"><span>Ses accompagnateurs sont</span>${pt(String(v.accompagnateurs || '').split('\n')[0])}</div>
      ${lignesMulti(String(v.accompagnateurs || '').split('\n').slice(1).join('\n'), 2)}
      <p style="text-align:center;font-size:12.5pt;margin:8mm 0">Dans la foi et la joie du Christ, nous signons ensemble.</p>
      <div style="display:flex;justify-content:space-between;font-size:12pt;text-align:center">
        <div style="width:58mm">Le prêtre ou le diacre${img(sign.pretre)}${sign.pretre && v.ministre ? `<div style="font-size:8.5pt;color:#555">${e(v.ministre)}</div>` : ''}</div>
        <div style="width:52mm">Le catéchumène${img(sign.catechumene)}</div>
        <div style="width:58mm">Le membre du service diocésain<br>du catéchuménat</div>
      </div>
      ${sign.le ? `<div style="text-align:center;font-size:8.5pt;color:#555;margin-top:2mm">Signé le ${e(sign.le)}</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:10mm;font-size:12pt">
        <div style="width:58mm;text-align:center">${sign.sceau ? `<img src="${sign.sceau}" style="max-width:34mm;max-height:34mm;opacity:.92">` : ''}</div>
        <div style="width:52mm;text-align:center">Les accompagnateurs</div>
        <div style="width:58mm"></div>
      </div>
    `)
  }
}

// ─── Extrait du registre des sépultures (mise en page paroissiale) ───
export const SEPULTURE = {
  titre: 'Extrait du registre des sépultures',
  champs: [
    ['paroisse', 'Paroisse'], ['diocese', 'Diocèse'], ['annee', 'Registre des sépultures, année'], ['acte', 'Acte n°'],
    ['prenoms', 'Prénoms'], ['nom', 'NOM'], ['ne_le', 'Né(e) le'], ['decede_le', 'Décédé(e) le'], ['domicile', 'Domicilié(e) à'],
    ['etat_civil', 'État civil'], ['obseques_le', 'Obsèques célébrées le'], ['eglise', "À l'église"], ['celebrant', 'Par'],
    ['sepulture', 'Sépulture'], ['fait_a', 'Certifié conforme, à'], ['fait_le', 'Le']
  ],
  depuis(d, r) {
    const i = d.infos || {}
    return {
      paroisse: r.paroisse, diocese: r.diocese, annee: i.registre_annee || annee(d.date_celebration), acte: i.acte_numero || '',
      prenoms: i.defunt_prenoms, nom: String(i.defunt_nom || '').toUpperCase(), ne_le: dateLongue(i.defunt_naissance_date),
      decede_le: dateLongue(i.defunt_deces_date), domicile: i.defunt_adresse || '', etat_civil: i.defunt_etat_civil || '',
      obseques_le: dateLongue(d.date_celebration), eglise: i.lieu_celebration || r.eglise, celebrant: i.celebrant || '',
      sepulture: [i.sepulture, i.cimetiere].filter(Boolean).join(' – '), fait_a: r.commune, fait_le: aujourdhui()
    }
  },
  html(v) {
    return doc(`
      <div class="titre" style="color:#333">EXTRAIT DU REGISTRE DES SÉPULTURES</div>
      ${ligne('Paroisse', v.paroisse)}
      <div class="l"><span>Diocèse</span><span class="v moyen">${e(v.diocese)}</span><span style="flex:1"></span></div>
      <div class="l" style="justify-content:flex-end;margin-top:8mm"><span>REGISTRE DES SÉPULTURES, ANNÉE</span><span class="v court">${e(v.annee)}</span><span>ACTE N°</span><span class="v court" style="flex-basis:28mm">${e(v.acte)}</span></div>
      ${ligne('<b>Prénoms</b>', v.prenoms)}${ligne('<b>NOM</b>', v.nom)}${ligne('né(e) le', v.ne_le)}${ligne('décédé(e) le', v.decede_le)}
      ${ligne('domicilié(e) à', v.domicile)}${ligne('état civil', v.etat_civil)}
      ${ligne('<b>OBSÈQUES CÉLÉBRÉES</b> le', v.obseques_le)}${ligne("à l'église", v.eglise)}${ligne('par', v.celebrant)}${ligne('sépulture', v.sepulture)}
      <div class="l" style="margin-top:10mm"><span>Certifié conforme au Registre</span></div>
      <div class="l" style="margin-top:8mm;padding-left:50mm"><span>A</span><span class="v">${e(v.fait_a)}</span><span>le</span><span class="v moyen" style="flex-basis:40mm">${e(v.fait_le)}</span></div>
      <div class="sig"><span>Sceau paroissial</span><span>Signature</span></div>
    `)
  }
}

export const IMPRIMABLES = { B14, B6, sepulture: SEPULTURE }
