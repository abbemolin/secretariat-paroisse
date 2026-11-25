import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, Erreur, EnTete } from '../ui.jsx'

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const PREPARATIONS = { premiere_communion: 'Premières communions', profession_foi: 'Professions de foi', confirmation_jeune: 'Confirmations (jeunes)', confirmand: 'Confirmands adultes', catechumene: 'Catéchumènes' }
const euros = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

function Ecart({ v, prec }) {
  const d = (v || 0) - (prec || 0)
  if (!d) return <span className="inline-flex items-center gap-0.5 text-xs text-nuit-600/75"><Minus className="h-3 w-3" />comme l'an dernier</span>
  const I = d > 0 ? ArrowUpRight : ArrowDownRight
  return <span className={`inline-flex items-center gap-0.5 text-xs ${d > 0 ? 'text-emerald-700' : 'text-nuit-600/70'}`}><I className="h-3 w-3" />{d > 0 ? '+' : ''}{d} <span className="text-nuit-600/75">({prec || 0} l'an dernier)</span></span>
}
function Chiffre({ titre, v, prec, format = (x) => x }) {
  return (
    <div className="carte p-4">
      <div className="text-xs text-nuit-600/70">{titre}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{format(v || 0)}</div>
      {prec !== undefined && <Ecart v={v} prec={prec} />}
    </div>
  )
}

export default function Statistiques() {
  const anneeCourante = new Date().getFullYear()
  const [annee, setAnnee] = useState(String(anneeCourante))
  const [scolaire, setScolaire] = useState(() => { const n = new Date(), a = n.getMonth() >= 8 ? n.getFullYear() : n.getFullYear() - 1; return `${a}-${a + 1}` })
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState(null)
  useEffect(() => { setD(null); api('statistiques', { annee, scolaire }).then(setD).catch(setErreur) }, [annee, scolaire])
  const annees = Array.from({ length: 6 }, (_, i) => String(anneeCourante - i))
  const scolaires = Array.from({ length: 6 }, (_, i) => { const a = anneeCourante + 1 - i; return `${a - 1}-${a}` })
  const sel = 'champ w-auto py-1 text-sm'
  const total = (x) => Object.values(x?.par_type || {}).reduce((a, n) => a + n, 0)
  const maxMois = d ? Math.max(1, ...d.sacrements.par_mois, ...d.sacrements_prec.par_mois) : 1
  return (
    <>
      <EnTete titre="Statistiques" sousTitre="Tableau de bord annuel — comparé à l'année précédente" />
      <Erreur erreur={erreur} />
      {!d ? <Chargement /> : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-xl font-semibold">Sacrements célébrés</h2>
              <select className={sel} value={annee} onChange={(e) => setAnnee(e.target.value)}>{annees.map((a) => <option key={a}>{a}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Chiffre titre={`Total ${d.annee}`} v={total(d.sacrements)} prec={total(d.sacrements_prec)} />
              {d.types.map((t) => <Chiffre key={t.cle} titre={t.nom} v={d.sacrements.par_type[t.cle]} prec={d.sacrements_prec.par_type[t.cle]} />)}
            </div>
            <div className="carte mt-3 p-4">
              <div className="mb-2 flex items-center gap-4 text-xs text-nuit-600/70"><span>Par mois</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-nuit" />{d.annee}</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-nuit-100" />{d.annee_prec}</span></div>
              <div className="flex h-36 items-end gap-1.5">
                {MOIS.map((m, i) => (
                  <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                      <div className="w-1/2 rounded-t bg-nuit-100" style={{ height: `${(d.sacrements_prec.par_mois[i] / maxMois) * 100}%` }} title={`${m} ${d.annee_prec} : ${d.sacrements_prec.par_mois[i]}`} />
                      <div className="w-1/2 rounded-t bg-nuit" style={{ height: `${(d.sacrements.par_mois[i] / maxMois) * 100}%` }} title={`${m} ${d.annee} : ${d.sacrements.par_mois[i]}`} />
                    </div>
                    <span className="text-xs text-nuit-600/75">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-xl font-semibold">Catéchèse et Cor Unum</h2>
              <select className={sel} value={scolaire} onChange={(e) => setScolaire(e.target.value)}>{scolaires.map((a) => <option key={a} value={a}>{a.replace('-', '–')}</option>)}</select>
            </div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-nuit-600/70">Catéchisme</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Chiffre titre="Enfants inscrits" v={d.catechese.enfants} prec={d.catechese_prec.enfants} />
              <Chiffre titre="Cotisations dues" v={d.catechese.du} format={euros} />
              <Chiffre titre="Reçu" v={d.catechese.paye} format={euros} />
              <Chiffre titre="Reste à recevoir" v={Math.max(0, d.catechese.du - d.catechese.paye)} format={euros} />
            </div>
            {Object.keys(d.catechese.classes).length > 0 && (
              <div className="carte mt-3 p-4">
                <div className="mb-2 text-xs text-nuit-600/70">Par classe</div>
                <div className="space-y-1.5">
                  {Object.entries(d.catechese.classes).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                    <div key={c} className="flex items-center gap-3 text-sm"><span className="w-28 shrink-0 truncate">{c}</span>
                      <div className="h-2.5 flex-1 rounded bg-nuit-50"><div className="h-full rounded bg-or" style={{ width: `${(n / d.catechese.enfants) * 100}%` }} /></div>
                      <span className="w-8 text-right tabular-nums">{n}</span></div>
                  ))}
                </div>
              </div>
            )}
            <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-nuit-600/70">Préparations aux sacrements</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(PREPARATIONS).map(([k, n]) => <Chiffre key={k} titre={n} v={d.catechese.preparations[k]} prec={d.catechese_prec.preparations[k]} />)}
            </div>
            <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-nuit-600/70">Cor Unum</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Chiffre titre="Membres" v={d.cor.membres} prec={d.cor_prec.membres} />
              <Chiffre titre="Fraternités" v={d.cor.fraternites} prec={d.cor_prec.fraternites} />
              <Chiffre titre="Chefs" v={d.cor.chefs} prec={d.cor_prec.chefs} />
              <Chiffre titre="Pas encore placés" v={d.cor.membres - d.cor.places} />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
