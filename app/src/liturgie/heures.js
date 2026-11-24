// Heures de l'office : noms et heure correspondant au moment de la journée (module léger, lu aussi par « Ma journée »).
export const NOMS_HEURES = [['Matutinum', 'Matines'], ['Laudes', 'Laudes'], ['Prima', 'Prime'], ['Tertia', 'Tierce'], ['Sexta', 'Sexte'], ['Nona', 'None'], ['Vespera', 'Vêpres'], ['Completorium', 'Complies']]
/** Heure de l'office correspondant au moment de la journée. */
export function heureDuMoment(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60
  if (h < 6) return 'Matutinum'
  if (h < 8) return 'Laudes'
  if (h < 9) return 'Prima'
  if (h < 11) return 'Tertia'
  if (h < 14) return 'Sexta'
  if (h < 16.5) return 'Nona'
  if (h < 20) return 'Vespera'
  return 'Completorium'
}
