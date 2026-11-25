#!/usr/bin/env python3
"""Génère les 4 formulaires publics (HTML autonome) à intégrer sur croix-glorieuse.org.

Usage : python3 generer.py "https://script.google.com/macros/s/XXXX/exec"
Les fichiers produits peuvent être collés dans un bloc « Code HTML » de l'éditeur IONOS
ou hébergés tels quels et intégrés dans une iframe.
"""
import sys, json, pathlib

URL = sys.argv[1] if len(sys.argv) > 1 else "COLLER_ICI_L_ADRESSE_DU_SCRIPT"

def c(cle, label, type="text", requis=False, aide="", choix=None):
    return dict(cle=cle, label=label, type=type, requis=requis, aide=aide, choix=choix or [])

A_LA_PAROISSE = "À la paroisse La Croix glorieuse"

def groupes_enfant(lieux, classe="Classe (ex. CE2)", aide_classe=False):
    return [
    ("L'enfant", [c("enfant_prenoms", "Prénoms", requis=True), c("enfant_nom", "Nom", requis=True),
                  c("enfant_naissance_date", "Date de naissance", "date", True), c("enfant_naissance_lieu", "Lieu de naissance"),
                  c("classe", classe)]),
    ("La préparation", [c("preparation", "Lieu de préparation", "select", True, choix=lieux),
                        c("ecole_autre", "Si autre école : laquelle ?")]),
    ("Les parents", [c("pere_prenom", "Prénom du père"), c("pere_nom", "Nom du père"),
                     c("mere_prenom", "Prénom de la mère"), c("mere_nom_jeune_fille", "Nom de jeune fille de la mère"),
                     c("adresse", "Adresse"), c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True)]),
    ("Le baptême de l'enfant", [c("bapteme_ou", "Où l'enfant a-t-il été baptisé ?", "select", True, choix=[A_LA_PAROISSE, "Dans une autre paroisse"]),
                                c("bapteme_date", "Date du baptême", "date"), c("bapteme_paroisse", "Paroisse du baptême (ville et paroisse)"),
                                c("certificat", "Copie de l'acte de baptême (PDF ou photo, 10 Mo maximum)", "file", True,
                                  aide="Obligatoire, sauf si l'enfant a été baptisé à la paroisse La Croix glorieuse."),
                                c("message", "Message (facultatif)", "textarea")]),
    ]


FORMULAIRES = {
    "bapteme": dict(
        titre="Demande de baptême",
        intro="Vous souhaitez faire baptiser votre enfant ? Remplissez ce formulaire : le secrétariat vous recontactera pour la suite de la préparation.",
        groupes=[
            ("L'enfant", [c("enfant_prenoms", "Prénoms", requis=True), c("enfant_nom", "Nom", requis=True),
                          c("sexe", "Garçon ou fille", "select", True, choix=["Garçon", "Fille"]),
                          c("enfant_naissance_date", "Date de naissance", "date", True), c("enfant_naissance_lieu", "Lieu de naissance")]),
            ("Les parents", [c("pere_prenom", "Prénom du père"), c("pere_nom", "Nom du père"),
                             c("mere_prenom", "Prénom de la mère"), c("mere_nom_jeune_fille", "Nom de jeune fille de la mère"),
                             c("adresse", "Adresse"), c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True)]),
            ("Parrain et marraine", [c("parrain_nom", "Parrain (prénom et nom)"), c("marraine_nom", "Marraine (prénom et nom)")]),
            ("Le baptême", [c("date_souhaitee", "Date souhaitée", "date"), c("message", "Message (facultatif)", "textarea")]),
        ]),
    "premiere_communion": dict(
        titre="Inscription à la première communion",
        intro="Votre enfant se prépare à recevoir la première communion ? Inscrivez-le ici, que la préparation ait lieu à la paroisse ou dans son école.",
        groupes=groupes_enfant(["Paroisse", "Herrade de Landsberg", "Saints Louis et Zélie Martin", "Autre école"])),
    "profession_foi": dict(
        titre="Inscription à la profession de foi",
        intro="La profession de foi se fait en classe de 3e. Inscrivez votre enfant ici, que la préparation ait lieu à la paroisse ou dans son école.",
        groupes=groupes_enfant(["Paroisse", "Saints Louis et Zélie Martin", "Autre école"], "Classe (3e)")),
    "confirmation_jeune": dict(
        titre="Inscription à la confirmation",
        intro="Vous souhaitez inscrire votre enfant à la préparation au sacrement de confirmation ? Remplissez ce formulaire, que la préparation ait lieu à la paroisse ou dans son école.",
        groupes=(lambda g: g[:3] + [("Parrain ou marraine de confirmation", [c("parrain_marraine", "Prénom et nom (si déjà choisi)")])] + g[3:])(
            groupes_enfant(["Paroisse", "Saints Louis et Zélie Martin", "Autre école"], "Classe"))),
    "mariage": dict(
        titre="Demande de mariage",
        intro="Vous souhaitez vous marier à l'église ? Merci de prendre contact le plus tôt possible, idéalement un an avant la date envisagée.",
        groupes=[
            ("La fiancée", [c("fiancee_prenoms", "Prénoms", requis=True), c("fiancee_nom", "Nom", requis=True)]),
            ("Le fiancé", [c("fiance_prenoms", "Prénoms", requis=True), c("fiance_nom", "Nom", requis=True)]),
            ("Pour vous joindre", [c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True)]),
            ("Le mariage", [c("date_souhaitee", "Date souhaitée", "date"), c("message", "Message (facultatif)", "textarea")]),
        ]),
    "catechumene": dict(
        titre="Demander le baptême (adulte)",
        intro="Vous êtes adulte et vous souhaitez recevoir le baptême ? Laissez-nous vos coordonnées : un prêtre vous recontactera.",
        groupes=[("Vos coordonnées", [c("prenoms", "Prénom", requis=True), c("nom", "Nom", requis=True),
                                       c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True),
                                       c("message", "Message (facultatif)", "textarea")])]),
    "confirmand": dict(
        titre="Demander la confirmation (adulte)",
        intro="Vous êtes baptisé(e) et souhaitez recevoir le sacrement de confirmation ? Laissez-nous vos coordonnées : nous vous recontacterons.",
        groupes=[("Vos coordonnées", [c("prenoms", "Prénom", requis=True), c("nom", "Nom", requis=True),
                                       c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True),
                                       c("message", "Message (facultatif)", "textarea")])]),
    "parrainage": dict(
        titre="Certificat de parrain ou de marraine",
        intro="Vous avez été choisi(e) comme parrain ou marraine et la paroisse de la célébration vous demande un certificat. Remplissez ce formulaire : nous vous enverrons le certificat signé.",
        groupes=[
            ("Vous", [c("prenoms", "Prénoms", requis=True), c("nom", "Nom", requis=True),
                      c("naissance_date", "Date de naissance", "date", True), c("naissance_lieu", "Lieu de naissance"),
                      c("adresse", "Adresse"), c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True)]),
            ("Votre baptême", [c("bapteme_paroisse", "Paroisse du baptême (ville et paroisse)", requis=True), c("bapteme_date", "Date du baptême (si vous la connaissez)", "date"),
                               c("piece", "Extrait de votre acte de baptême (PDF ou photo, facultatif)", "file",
                                 aide="Si vous n'avez pas été baptisé(e) à la paroisse La Croix glorieuse, joindre un extrait récent accélère la délivrance du certificat.")]),
            ("Confirmation et communion", [c("confirmation", "Avez-vous reçu la confirmation ?", "select", True, choix=["Oui", "Non", "En préparation"]),
                                           c("confirmation_paroisse", "Paroisse de la confirmation"), c("confirmation_date", "Date de la confirmation", "date"),
                                           c("premiere_communion", "Avez-vous fait votre première communion ?", "select", True, choix=["Oui", "Non", "En préparation"])]),
            ("La célébration", [c("charge", "Vous serez", "select", True, choix=["Parrain", "Marraine"]),
                                c("charge_sacrement", "Pour", "select", True, choix=["Baptême", "Confirmation"]),
                                c("filleul_prenoms", "Prénom du filleul / de la filleule", requis=True), c("filleul_nom", "Son nom"),
                                c("date_prevue", "Date prévue", "date"), c("paroisse_prevue", "Paroisse de la célébration (ville et paroisse)", requis=True),
                                c("envoyer_a", "Où envoyer le certificat ? (mail de cette paroisse, sinon il vous sera envoyé)"),
                                c("message", "Message (facultatif)", "textarea")]),
        ]),
    "recommandation": dict(
        titre="Demande de lettre de recommandation",
        intro="Vous souhaitez une lettre de recommandation de la paroisse ? Précisez à qui elle est destinée : nous reprendrons contact avec vous si besoin, puis nous vous l'enverrons signée.",
        groupes=[
            ("Vous", [c("prenoms", "Prénoms", requis=True), c("nom", "Nom", requis=True), c("adresse", "Adresse"),
                      c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True)]),
            ("La lettre", [c("motif", "Pour", "select", True, choix=["École catholique", "Emploi ou bénévolat", "Vie religieuse, séminaire", "Foyer étudiant", "Autre"]),
                           c("motif_autre", "Si autre : précisez")]),
            ("Pour un enfant (inscription dans une école)", [c("enfant_prenoms", "Prénoms de l'enfant"), c("enfant_nom", "Nom de l'enfant"), c("classe", "Classe demandée")]),
            ("Destinataire", [c("destinataire_organisme", "Établissement ou organisme", requis=True), c("destinataire_personne", "À l'attention de (ex. Monsieur le Directeur)"),
                              c("destinataire_adresse", "Adresse ou mail où envoyer la lettre (sinon elle vous sera envoyée)", "textarea"),
                              c("message", "Message (facultatif)", "textarea")]),
        ]),
}

MODELE = """<meta charset="utf-8">
<!-- Formulaire « {titre} » – Paroisse La Croix glorieuse. Les réponses arrivent dans l'appli du secrétariat. -->
<div class="cg-form" id="cg-{type}">
<style>
#cg-{type}{{font-family:inherit;max-width:640px;margin:0 auto;color:#222}}
#cg-{type} h2{{margin:0 0 .4em;font-size:1.6em}}
#cg-{type} p.cg-intro{{margin:0 0 1.4em;color:#555;line-height:1.5}}
#cg-{type} fieldset{{border:0;padding:0;margin:0 0 1.2em}}
#cg-{type} legend{{font-weight:bold;font-size:1.05em;margin-bottom:.6em;color:#521a22}}
#cg-{type} .cg-grille{{display:grid;grid-template-columns:1fr 1fr;gap:.8em}}
#cg-{type} .cg-large{{grid-column:1/-1}}
#cg-{type} label{{display:block;font-size:.9em;margin-bottom:.25em;color:#444}}
#cg-{type} input,#cg-{type} textarea,#cg-{type} select{{width:100%;box-sizing:border-box;padding:.65em .75em;border:1px solid #ccc;border-radius:6px;font:inherit;background:#fff}}
#cg-{type} input:focus,#cg-{type} textarea:focus{{outline:2px solid #d08c4c55;border-color:#d08c4c}}
#cg-{type} textarea{{min-height:110px}}
#cg-{type} .cg-req{{color:#b33}}
#cg-{type} .cg-consent{{display:flex;gap:.6em;align-items:flex-start;font-size:.9em;color:#444;margin:.4em 0 1.2em}}
#cg-{type} .cg-consent input{{width:auto;margin-top:.2em}}
#cg-{type} button{{background:#521a22;color:#fff;border:0;border-radius:6px;padding:.8em 1.6em;font:inherit;font-weight:bold;cursor:pointer}}
#cg-{type} button[disabled]{{opacity:.6;cursor:wait}}
#cg-{type} .cg-msg{{margin-top:1em;padding:.9em 1em;border-radius:6px;display:none;line-height:1.4}}
#cg-{type} .cg-ok{{background:#e8f5ec;color:#1d5e33}}
#cg-{type} .cg-ko{{background:#fdeceb;color:#8a1f17}}
#cg-{type} .cg-infos{{background:#faf3ea;border-left:4px solid #d08c4c;border-radius:6px;padding:.9em 1em;margin:0 0 1.4em;line-height:1.5}}
#cg-{type} .cg-infos p{{margin:.3em 0}}
#cg-{type} .cg-rdv{{display:inline-block;margin-top:.4em;background:#521a22;color:#fff!important;text-decoration:none;padding:.55em 1em;border-radius:6px;font-weight:bold}}
#cg-{type} .cg-piege{{position:absolute;left:-9999px;height:0;overflow:hidden}}
#cg-{type} .cg-surplace{{background:#eef3fb;border-left:4px solid #3b5b8c;border-radius:6px;padding:.8em 1em;margin:0 0 1.2em;line-height:1.45;display:none}}
#cg-{type} .cg-surplace a{{color:#3b5b8c}}
@media(max-width:560px){{#cg-{type} .cg-grille{{grid-template-columns:1fr}}}}
</style>
<h2>{titre}</h2>
<p class="cg-intro">{intro}</p>
<div class="cg-surplace"></div>
<div class="cg-infos" style="display:none"></div>
<form novalidate>
{groupes}
<div class="cg-piege" aria-hidden="true"><label>Site web<input name="site_web" tabindex="-1" autocomplete="off"></label></div>
<label class="cg-consent cg-accuse" style="display:none"><input type="checkbox" name="accuse" checked> <span>Envoyer un accusé de réception à l'adresse e-mail indiquée</span></label>
<label class="cg-consent"><input type="checkbox" name="consentement" required> <span>J'accepte que la paroisse La Croix glorieuse utilise ces informations uniquement pour traiter ma demande. <span class="cg-req">*</span></span></label>
<button type="submit">Envoyer ma demande</button>
<div class="cg-msg"></div>
</form>
<script>
(function(){{
  var URL_SCRIPT = {url};
  var racine = document.getElementById('cg-{type}');
  var form = racine.querySelector('form'), msg = racine.querySelector('.cg-msg'), bouton = form.querySelector('button');
  // Lien envoyé par mail (écoles) : ?preparation=…&ecole=… pré-remplit le lieu de préparation
  try {{
    var q = new URLSearchParams(location.search);
    if (form.preparation && q.get('preparation')) {{ form.preparation.value = q.get('preparation'); }}
    if (form.ecole_autre && q.get('ecole')) {{ form.ecole_autre.value = q.get('ecole'); }}
  }} catch (e) {{}}
  // Rempli au secrétariat (« sur place ») : lien ?p=… à usage unique, e-mail facultatif, accusé au choix
  var Q = new URLSearchParams(location.search), SUR_PLACE = Q.get('p') || '', ICI = Q.get('ici') === '1';
  if (SUR_PLACE) {{
    form.style.display = 'none';
    var bandeau = racine.querySelector('.cg-surplace');
    bandeau.style.display = 'block'; bandeau.textContent = 'Vérification du lien…';
    fetch(URL_SCRIPT, {{ method: 'POST', headers: {{ 'Content-Type': 'text/plain;charset=utf-8' }}, body: JSON.stringify({{ action: 'public.surPlace', payload: {{ p: SUR_PLACE }} }}) }})
      .then(function(r){{ return r.json(); }})
      .then(function(r){{
        if (!r.ok) throw new Error(r.message);
        bandeau.innerHTML = '<strong>Formulaire rempli au secrétariat de la paroisse.</strong> L\\'adresse e-mail est facultative.' + (ICI ? ' <a href="../#/formulaires">Annuler et revenir au secrétariat</a>' : '');
        var em = form.querySelector('[name=email]');
        if (em) {{ em.required = false; var lab = em.parentNode.querySelector('label'); if (lab) lab.textContent = 'E-mail (facultatif)'; }}
        racine.querySelector('.cg-accuse').style.display = em ? 'flex' : 'none';
        form.style.display = '';
      }})
      .catch(function(err){{
        bandeau.className = 'cg-msg cg-ko'; bandeau.style.display = 'block';
        bandeau.textContent = (err && err.message) || 'Ce lien n\\'est pas valable.';
        if (ICI) {{ var a = document.createElement('a'); a.href = '../#/formulaires'; a.textContent = ' Revenir au secrétariat'; bandeau.appendChild(a); }}
      }});
  }}
  var A_LA_PAROISSE = {a_la_paroisse};
  var AVEC_INFOS = {avec_infos}, NOM_CELEBRATION = {nom_celebration}, infosRdv = null;
  function echap(t){{ return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }}
  // Date de la célébration de l'année (fixée dans l'appli), retraite, rendez-vous avec M. le curé
  if (AVEC_INFOS) {{
    fetch(URL_SCRIPT, {{ method: 'POST', headers: {{ 'Content-Type': 'text/plain;charset=utf-8' }}, body: JSON.stringify({{ action: 'public.infos', payload: {{ type: '{type}' }} }}) }})
      .then(function(r){{ return r.json(); }})
      .then(function(r){{
        if (!r.ok) return;
        var i = r.data, html = '';
        if (i.date) {{
          var d = new Date(i.date), z = {{ timeZone: 'Europe/Paris' }};
          var jour = d.toLocaleDateString('fr-FR', {{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }});
          var heure = d.toLocaleTimeString('fr-FR', {{ hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }}).replace(':', ' h ');
          html += '<p><strong>' + NOM_CELEBRATION + ' ' + echap(i.annee) + ' :</strong> ' + echap(jour) + ' à ' + echap(heure) + (i.lieu ? ', ' + echap(i.lieu) : '') + '.</p>';
        }} else html += '<p><strong>' + NOM_CELEBRATION + ' ' + echap(i.annee) + ' :</strong> la date et l\\'heure vous seront communiquées prochainement.</p>';
        html += '<p>Les informations concernant la retraite vous seront communiquées plus tard.</p>';
        if (i.rdv && i.rdv.url) {{
          infosRdv = i.rdv;
          html += '<p><strong>Rendez-vous avec Monsieur le Curé :</strong> merci de vous inscrire rapidement.<br><a class="cg-rdv" href="' + echap(i.rdv.url) + '" target="_blank" rel="noopener">Prendre rendez-vous</a></p>';
        }}
        var bloc = racine.querySelector('.cg-infos'); bloc.innerHTML = html; bloc.style.display = 'block';
      }}).catch(function(){{}});
  }}
  function lireFichier(f){{
    return new Promise(function(ok, ko){{
      if (!f) return ok(null);
      var r = new FileReader();
      r.onload = function(){{ ok({{ nom: f.name, type: f.type || '', base64: String(r.result).split(',')[1] }}); }};
      r.onerror = function(){{ ko(new Error('Lecture du fichier impossible.')); }};
      r.readAsDataURL(f);
    }});
  }}
  // Copie de l'acte de baptême : masquée si l'enfant a été baptisé à la paroisse
  if (form.bapteme_ou && form.certificat) {{
    var bloc = form.certificat.closest('.cg-fichier');
    var maj = function(){{ bloc.style.display = form.bapteme_ou.value === A_LA_PAROISSE ? 'none' : ''; }};
    form.bapteme_ou.addEventListener('change', maj); maj();
  }}
  // Lettre de recommandation : « Si autre » et l'enfant seulement quand c'est utile
  if (form.motif) {{
    var blocEnfant = racine.querySelector('fieldset[data-enfant]'), blocAutre = form.motif_autre.closest('div');
    var majMotif = function(){{ if (blocEnfant) blocEnfant.style.display = form.motif.value === 'École catholique' ? '' : 'none'; blocAutre.style.display = form.motif.value === 'Autre' ? '' : 'none'; }};
    form.motif.addEventListener('change', majMotif); majMotif();
  }}
  function afficher(texte, ok){{ msg.textContent = texte; msg.className = 'cg-msg ' + (ok ? 'cg-ok' : 'cg-ko'); msg.style.display = 'block'; }}
  form.addEventListener('submit', function(e){{
    e.preventDefault();
    var manque = Array.prototype.filter.call(form.querySelectorAll('[required]'), function(x){{ return x.type === 'checkbox' ? !x.checked : !x.value.trim(); }});
    var champF = form.certificat || form.piece, fichier = champF && champF.files && champF.files[0];
    var sansCopie = form.bapteme_ou && form.bapteme_ou.value === A_LA_PAROISSE;
    if (manque.length) {{ afficher('Merci de remplir les champs marqués d\\'une étoile et d\\'accepter l\\'utilisation de vos données.', false); manque[0].focus(); return; }}
    if (form.pere_nom && !form.pere_nom.value.trim() && !form.mere_nom_jeune_fille.value.trim()) {{ afficher('Merci d\\'indiquer au moins un des parents.', false); form.pere_prenom.focus(); return; }}
    if (form.preparation && form.preparation.value === 'Autre école' && !form.ecole_autre.value.trim()) {{ afficher('Merci de préciser le nom de l\\'école.', false); form.ecole_autre.focus(); return; }}
    if (form.certificat && !sansCopie && !fichier) {{ afficher('Merci de joindre une copie de l\\'acte de baptême (sauf si l\\'enfant a été baptisé à la paroisse La Croix glorieuse).', false); form.certificat.focus(); return; }}
    if (fichier && fichier.size > 10 * 1024 * 1024) {{ afficher('Le fichier est trop lourd (10 Mo maximum).', false); champF.focus(); return; }}
    if (fichier && !/pdf|image|heic|heif/i.test((fichier.type || '') + fichier.name)) {{ afficher('Merci de joindre un PDF ou une photo.', false); champF.focus(); return; }}
    if (form.motif && form.motif.value === 'Autre' && !form.motif_autre.value.trim()) {{ afficher('Merci de préciser l\\'objet de la lettre.', false); form.motif_autre.focus(); return; }}
    var email = form.querySelector('[name=email]');
    if (email && !(SUR_PLACE && !email.value.trim()) && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email.value.trim())) {{ afficher('Adresse e-mail invalide.', false); email.focus(); return; }}
    var champs = {{}};
    Array.prototype.forEach.call(form.querySelectorAll('input[name],textarea[name],select[name]'), function(x){{ if (x.name !== 'consentement' && x.name !== 'accuse' && x.name !== 'site_web' && x.type !== 'file') champs[x.name] = x.value.trim(); }});
    bouton.disabled = true; bouton.textContent = 'Envoi…';
    lireFichier(sansCopie ? null : fichier).then(function(piece){{
      return fetch(URL_SCRIPT, {{ method: 'POST', headers: {{ 'Content-Type': 'text/plain;charset=utf-8' }},
        body: JSON.stringify({{ action: 'public.demande', payload: {{ type: '{type}', champs: champs, fichier: piece, consentement: true, site_web: form.site_web.value, envoi: SUR_PLACE ? '' : (Q.get('e') || ''), surplace: SUR_PLACE, accuse: !!(SUR_PLACE && form.accuse.checked) }} }}) }});
    }})
      .then(function(r){{ return r.json(); }})
      .then(function(r){{
        if (!r.ok) throw new Error(r.message);
        if (SUR_PLACE && ICI && r.data && r.data.dossier_id) {{ location.href = '../#/dossiers/' + r.data.dossier_id; return; }}
        form.querySelectorAll('fieldset,.cg-consent,button').forEach(function(x){{ x.style.display = 'none'; }});
        afficher('Merci ! Votre demande a bien été transmise au secrétariat de la paroisse. Nous vous recontacterons prochainement.', true);
        if (infosRdv && infosRdv.integre) {{
          var r2 = document.createElement('div');
          r2.innerHTML = '<p style="margin:1.4em 0 .6em;font-weight:bold;color:#521a22">Rendez-vous avec Monsieur le Curé : merci de vous inscrire rapidement.</p><iframe src="' + echap(infosRdv.integre) + '" style="border:0" width="100%" height="600" frameborder="0"></iframe>';
          form.appendChild(r2);
        }}
      }})
      .catch(function(err){{
        bouton.disabled = false; bouton.textContent = 'Envoyer ma demande';
        afficher((err && err.message && err.message.length < 200 ? err.message : 'L\\'envoi n\\'a pas fonctionné.') + ' Vous pouvez aussi écrire à secretariat@croix-glorieuse.org.', false);
      }});
  }});
}})();
</script>
</div>
"""

PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titre} – Paroisse La Croix glorieuse</title>
<link rel="icon" href="../logo-128.png">
<style>body{{margin:0;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;color:#222}}
.entete{{background:#521a22;color:#fff;padding:18px 20px;display:flex;align-items:center;gap:14px}}
.entete img{{width:52px;height:52px;border-radius:50%;background:#fff}}
.entete b{{font-size:20px;display:block}} .entete span{{font-size:13px;color:#e8c9a8}}
main{{max-width:680px;margin:24px auto;background:#fff;border-radius:14px;padding:26px 22px;box-shadow:0 2px 14px rgba(82,26,34,.08)}}
main .cg-form{{font-family:Arial,Helvetica,sans-serif}}</style></head>
<body><div class="entete"><img src="../logo-128.png" alt=""><div><b>Paroisse La Croix glorieuse</b><span>Strasbourg</span></div></div>
<main>{contenu}</main></body></html>
"""

def champ_html(ch):
    etoile = ' <span class="cg-req">*</span>' if ch["requis"] else ""
    req = " required" if ch["requis"] else ""
    if ch["type"] == "select":
        options = '<option value="">Choisir…</option>' + "".join(f'<option>{o}</option>' for o in ch["choix"])
        return f'<div class=""><label>{ch["label"]}{etoile}</label><select name="{ch["cle"]}"{req}>{options}</select></div>'
    if ch["type"] == "file":
        aide = f'<small style="display:block;color:#777;margin-top:.25em">{ch["aide"]}</small>' if ch["aide"] else ""
        return f'<div class="cg-large cg-fichier"><label>{ch["label"]}{etoile}</label><input type="file" name="{ch["cle"]}" accept="application/pdf,image/*,.heic,.heif">{aide}</div>'
    if ch["type"] == "textarea":
        controle = f'<textarea name="{ch["cle"]}"{req}></textarea>'
        cls = "cg-large"
    else:
        auto = {"email": ' autocomplete="email"', "tel": ' autocomplete="tel"'}.get(ch["type"], "")
        controle = f'<input type="{ch["type"]}" name="{ch["cle"]}"{req}{auto}>'
        cls = ""
    return f'<div class="{cls}"><label>{ch["label"]}{etoile}</label>{controle}</div>'

# Pages autonomes (liens envoyés par mail depuis l'onglet « Formulaires » du secrétariat)
SLUGS = {"premiere_communion": "premiere-communion", "profession_foi": "profession-de-foi", "bapteme": "demande-bapteme",
         "mariage": "demande-mariage", "catechumene": "bapteme-adulte", "confirmand": "confirmation-adulte",
         "parrainage": "certificat-parrain", "recommandation": "lettre-recommandation", "confirmation_jeune": "confirmation-jeunes"}

sortie = pathlib.Path(__file__).parent
SITE = sortie / "site"
SITE.mkdir(exist_ok=True)
(SITE / "CNAME").write_text("secretariat.croix-glorieuse.org\n", encoding="utf-8")
(SITE / ".nojekyll").write_text("", encoding="utf-8")
ACCUEIL = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Paroisse La Croix glorieuse</title><meta http-equiv="refresh" content="0; url=https://www.croix-glorieuse.org/"></head><body><a href="https://www.croix-glorieuse.org/">croix-glorieuse.org</a></body></html>\n'
(SITE / "index.html").write_text(ACCUEIL, encoding="utf-8")
(SITE / "404.html").write_text(ACCUEIL, encoding="utf-8")
import shutil
(SITE / 'fraternite').mkdir(exist_ok=True)
QRCODE_JS = (sortie / 'qrcode.min.js').read_text(encoding='utf-8')
(SITE / 'fraternite' / 'index.html').write_text((sortie / 'fraternite.html').read_text(encoding='utf-8').replace('__URL_SCRIPT__', json.dumps(URL)).replace('__QRCODE_JS__', QRCODE_JS), encoding='utf-8')
(SITE / 'rejoindre').mkdir(exist_ok=True)
(SITE / 'rejoindre' / 'index.html').write_text((sortie / 'rejoindre.html').read_text(encoding='utf-8').replace('__URL_SCRIPT__', json.dumps(URL)), encoding='utf-8')
for nom in ('paiement', 'livres'):
    (SITE / nom).mkdir(exist_ok=True)
    (SITE / nom / 'index.html').write_text((sortie / (nom + '.html')).read_text(encoding='utf-8').replace('__URL_SCRIPT__', json.dumps(URL)), encoding='utf-8')
(SITE / 'accord-bapteme').mkdir(exist_ok=True)
(SITE / 'accord-bapteme' / 'index.html').write_text((sortie / 'accord-bapteme.html').read_text(encoding='utf-8').replace('__URL_SCRIPT__', json.dumps(URL)), encoding='utf-8')
(SITE / 'depot').mkdir(exist_ok=True)
(SITE / 'depot' / 'index.html').write_text((sortie / 'depot.html').read_text(encoding='utf-8').replace('__URL_SCRIPT__', json.dumps(URL)), encoding='utf-8')
(SITE / 'retraite').mkdir(exist_ok=True)
(SITE / 'retraite' / 'index.html').write_text((sortie / 'retraite.html').read_text(encoding='utf-8').replace('__URL_SCRIPT__', json.dumps(URL)), encoding='utf-8')
shutil.copy(sortie.parent / "app" / "public" / "logo-128.png", SITE / "logo-128.png")
for type_, f in FORMULAIRES.items():
    groupes = "\n".join(
        f'<fieldset{' data-enfant' if titre.startswith('Pour un enfant') else ''}><legend>{titre}</legend><div class="cg-grille">' + "".join(champ_html(ch) for ch in champs) + "</div></fieldset>"
        for titre, champs in f["groupes"])
    html = MODELE.format(type=type_, titre=f["titre"], intro=f["intro"], groupes=groupes, url=json.dumps(URL), a_la_paroisse=json.dumps(A_LA_PAROISSE, ensure_ascii=False),
                        avec_infos='true' if type_ in ('premiere_communion', 'profession_foi', 'confirmation_jeune') else 'false',
                        nom_celebration=json.dumps({'premiere_communion': 'Première communion', 'profession_foi': 'Profession de foi', 'confirmation_jeune': 'Confirmation'}.get(type_, ''), ensure_ascii=False))
    (sortie / f"formulaire-{type_}.html").write_text(html, encoding="utf-8")
    print("✓ formulaire-" + type_ + ".html")
    # Pages autonomes (envoyées par mail avec un bouton), hébergées avec l'appli
    if type_ in SLUGS:
        page = PAGE.format(titre=f["titre"], contenu=html)
        dest = sortie.parent / "app" / "public" / "formulaires"
        dest.mkdir(parents=True, exist_ok=True)
        (dest / f"{type_}.html").write_text(page, encoding="utf-8")
        print("✓ app/public/formulaires/" + type_ + ".html")
        # Site des formulaires à l'adresse de la paroisse (dépôt « formulaires », secretariat.croix-glorieuse.org)
        slug = SLUGS[type_]
        (SITE / slug).mkdir(parents=True, exist_ok=True)
        (SITE / slug / "index.html").write_text(page, encoding="utf-8")
        print("✓ site/" + slug + "/")

# ─── Les pages publiques sont aussi servies par l'appli du secrétariat (secretariat.croix-glorieuse.org) ───
APP_PUBLIC = sortie.parent / "app" / "public"
for nom in ('premiere-communion', 'profession-de-foi', 'demande-bapteme', 'demande-mariage', 'bapteme-adulte', 'confirmation-adulte', 'certificat-parrain', 'lettre-recommandation', 'confirmation-jeunes', 'depot', 'fraternite', 'rejoindre', 'retraite', 'paiement', 'livres', 'accord-bapteme'):
    if (SITE / nom / 'index.html').exists():
        (APP_PUBLIC / nom).mkdir(exist_ok=True)
        shutil.copy(SITE / nom / 'index.html', APP_PUBLIC / nom / 'index.html')
(APP_PUBLIC / "CNAME").write_text("secretariat.croix-glorieuse.org\n", encoding="utf-8")
