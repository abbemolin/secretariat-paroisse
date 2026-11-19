// Lecture seule des données de l'AppMESSE (base Supabase publique de l'AppMESSE).
import { estDemo } from './api.js'

const URL = 'https://pmeaimfcwtykhqtueomd.supabase.co/rest/v1/'
const CLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZWFpbWZjd3R5a2hxdHVlb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MzA4MzIsImV4cCI6MjA4MzMwNjgzMn0.X91Usnq8WtZYuY40UFIo7Xl8P1O46LKqe1GvJ7RIWYE'
export const LIEN_APPMESSE = 'https://abbemolin.github.io/appMesse/intentions.html'

export const CELEBRANTS = { molin: 'Abbé Molin', legall: 'Abbé Le Gall', carbonnieres: 'Carbonnières', autre: 'Autre prêtre' }
export const COULEURS_LITURGIQUES = { Blanc: '#f4f1e8', Rouge: '#c0392b', Vert: '#2e8b57', Violet: '#6c3483', Rose: '#e8a0b8', Noir: '#222' }

const iso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

async function lire(table, requete) {
  const rep = await fetch(`${URL}${table}?${requete}`, { headers: { apikey: CLE, Authorization: `Bearer ${CLE}` } })
  if (!rep.ok) throw new Error('AppMESSE injoignable')
  return rep.json()
}

/** Ordo (fête, couleur, classe) et intentions des `jours` prochains jours, aujourd'hui compris. */
export async function chargerAppMesse(jours = 7) {
  const debut = iso(new Date()), fin = iso(new Date(Date.now() + (jours - 1) * 86400000))
  if (estDemo()) {
    return {
      ordo: [{ date: debut, fete: 'S. Élisabeth de Hongrie, veuve', classe: 'III', couleur: 'Blanc', commemoraison: null },
             { date: iso(Date.now() + 86400000), fete: 'S. Félix de Valois, confesseur', classe: 'III', couleur: 'Blanc' }],
      intentions: [
        { id: 1, date_messe: debut, heure_messe: '18:30', type_intention: 'Défunt', nom_intention: 'Joseph Muller', statut: 'valide', celebrant: 'legall' },
        { id: 2, date_messe: iso(Date.now() + 86400000), heure_messe: '12:15', type_intention: 'Action de grâce', nom_intention: 'Pour une naissance', statut: 'valide' },
        { id: 3, date_messe: iso(Date.now() + 86400000), heure_messe: '18:30', type_intention: 'Défunt', nom_intention: 'Famille Schmitt', statut: 'en_attente' }
      ]
    }
  }
  const [ordo, intentions] = await Promise.all([
    lire('ordo_liturgique', `select=date,fete,classe,couleur,commemoraison&date=gte.${debut}&date=lte.${fin}&order=date`),
    lire('intentions', `select=id,date_messe,heure_messe,type_intention,nom_intention,statut,celebrant&date_messe=gte.${debut}&date_messe=lte.${fin}&statut=in.(valide,en_attente)&order=date_messe,heure_messe`)
  ])
  return { ordo, intentions }
}
