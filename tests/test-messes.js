// node tests/test-messes.js — « Demander une messe » et « Mes intentions » (services simulés)
const { SS, props, cache } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
const jour = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };
// Agenda : messes à J+0, J+3 (2 messes), J+5 ; une conférence à J+3
const ev = (n, h, titre, id) => { const d = new Date(jour(n) + 'T' + h + ':00+01:00'); return { getId: () => id + '@google.com', getTitle: () => titre, isAllDayEvent: () => false, getStartTime: () => d, getEndTime: () => new Date(+d + 3600000), isRecurringEvent: () => false }; };
global.CalendarApp = { getDefaultCalendar: () => ({ getEvents: () => [ev(0, '18:30', 'Messe lue', 'a0'), ev(3, '08:00', 'Messe lue', 'a1'), ev(3, '18:30', 'Grand-Messe', 'a2'), ev(3, '20:00', 'Conférence', 'a3'), ev(5, '18:30', 'Messe chantée', 'a4')] }) };
global.Utilities.formatDate = (d, tz, f) => { const s = new Date(d).toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }); if (f === 'yyyy-MM-dd') return s.slice(0, 10); if (f === "yyyy-MM-dd'T'HH:mm:ssXXX") return s.replace(' ', 'T') + '+01:00'; if (f === 'u') return String(new Date(d).getDay() || 7); return s; };
const base = [{ id: 1, email_donateur: 'jean@ex.fr', nom_intention: 'Ancienne', type_intention: 'Défunt', date_messe: jour(-10), heure_messe: '18:30', statut: 'valide', celebre_le: jour(-10) },
  { id: 2, email_donateur: 'autre@ex.fr', nom_intention: 'X', date_messe: jour(5), heure_messe: '18:30', statut: 'valide' }];
global.UrlFetchApp.fetch = function (url, o) {
  o = o || {}; const rep = (c, x) => ({ getResponseCode: () => c, getContentText: () => JSON.stringify(x) });
  if (/intentions/.test(url) && o.method === 'post') { const l = JSON.parse(o.payload).map((x, k) => ({ id: 100 + base.length + k, ...x })); base.push(...l); return rep(201, l); }
  if (/intentions/.test(url)) { const m = url.match(/email_donateur=eq\.([^&]+)/); return rep(200, m ? base.filter((i) => i.email_donateur === decodeURIComponent(m[1])) : base); }
  return rep(200, []);
};
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.__t={FEUILLES,hacher_,ecrireLigne_,actionCompte_,lignes_,nouvelleSessionCpt_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const err = (f, re, m) => { try { f(); ko++; console.log('ÉCHEC (pas d\'erreur) :', m); } catch (e) { if (re.test(e.message)) ok++; else { ko++; console.log('ÉCHEC :', m, '→', e.message); } } };
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
vm.runInThisContext('feuilleComptes_()');
T.ecrireLigne_('Comptes', { id: 'j1', mail: 'jean@ex.fr', prenom: 'Jean', nom: 'Dupont', statut: 'actif', sel: 's', hash: 'h', session_v: 0 });
const cs = T.nouvelleSessionCpt_(T.lignes_('Comptes')[0]);
const r = T.actionCompte_('cpt.messes', { cs });
verif(r.messes.map(m => m.id).join() === 'a1,a2,a4', 'messes seulement (pas la conférence), à partir de demain : ' + r.messes.map(m => m.id));
verif(r.messes.find(m => m.id === 'a4').pris && !r.messes.find(m => m.id === 'a1').pris, 'créneau déjà pris grisé');
verif(r.mes_intentions.length === 1 && r.mes_intentions[0].etat === 'celebree', 'Mes intentions : ancienne messe célébrée');
verif(/18 €/.test(r.offrande), 'offrande indiquée');
err(() => T.actionCompte_('cpt.demanderMesse', { cs, type: 'Défunt', intention: 'Paul', messes: ['a4'] }), /prise/, 'messe déjà prise refusée');
err(() => T.actionCompte_('cpt.demanderMesse', { cs, type: 'Défunt', intention: 'Paul', messes: ['a3'] }), /plus proposée/, 'une conférence n\'est pas une messe');
err(() => T.actionCompte_('cpt.demanderMesse', { cs, type: '', intention: 'Paul', messes: ['a1'] }), /type/, 'type obligatoire');
const d = T.actionCompte_('cpt.demanderMesse', { cs, type: 'Défunt', intention: 'Paul Dupont', messes: ['a1', 'a2'], message: 'Merci' });
verif(d.nombre === 2, 'deux messes demandées');
const nouv = base.filter(i => i.nom_intention === 'Paul Dupont');
verif(nouv.length === 2 && nouv.every(i => i.statut === 'en_attente' && i.email_donateur === 'jean@ex.fr' && i.nom_donateur === 'Jean Dupont' && /depuis l'app/.test(i.commentaire)), 'lignes en attente avec le nom et l\'adresse du compte');
verif(d.messes.find(m => m.id === 'a1').pris, 'les créneaux demandés deviennent réservés');
verif(d.mes_intentions.filter(i => i.etat === 'attente').length === 2, 'Mes intentions : 2 en attente');
err(() => T.actionCompte_('cpt.demanderMesse', { cs, type: 'Vivant', intention: 'Autre', messes: ['a1'] }), /prise/, 'pas deux demandes sur la même messe');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
