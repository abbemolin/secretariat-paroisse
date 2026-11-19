#!/usr/bin/env python3
"""Génère les 4 formulaires publics (HTML autonome) à intégrer sur croix-glorieuse.org.

Usage : python3 generer.py "https://script.google.com/macros/s/XXXX/exec"
Les fichiers produits peuvent être collés dans un bloc « Code HTML » de l'éditeur IONOS
ou hébergés tels quels et intégrés dans une iframe.
"""
import sys, json, pathlib

URL = sys.argv[1] if len(sys.argv) > 1 else "COLLER_ICI_L_ADRESSE_DU_SCRIPT"

def c(cle, label, type="text", requis=False, aide=""):
    return dict(cle=cle, label=label, type=type, requis=requis, aide=aide)

FORMULAIRES = {
    "bapteme": dict(
        titre="Demande de baptême",
        intro="Vous souhaitez faire baptiser votre enfant ? Remplissez ce formulaire : le secrétariat vous recontactera pour la suite de la préparation.",
        groupes=[
            ("L'enfant", [c("enfant_prenoms", "Prénoms", requis=True), c("enfant_nom", "Nom", requis=True),
                          c("enfant_naissance_date", "Date de naissance", "date", True), c("enfant_naissance_lieu", "Lieu de naissance")]),
            ("Les parents", [c("pere_prenom", "Prénom du père"), c("pere_nom", "Nom du père"),
                             c("mere_prenom", "Prénom de la mère"), c("mere_nom_jeune_fille", "Nom de jeune fille de la mère"),
                             c("adresse", "Adresse"), c("telephone", "Téléphone", "tel", True), c("email", "E-mail", "email", True)]),
            ("Parrain et marraine", [c("parrain_nom", "Parrain (prénom et nom)"), c("marraine_nom", "Marraine (prénom et nom)")]),
            ("Le baptême", [c("date_souhaitee", "Date souhaitée", "date"), c("message", "Message (facultatif)", "textarea")]),
        ]),
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
#cg-{type} input,#cg-{type} textarea{{width:100%;box-sizing:border-box;padding:.65em .75em;border:1px solid #ccc;border-radius:6px;font:inherit;background:#fff}}
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
#cg-{type} .cg-piege{{position:absolute;left:-9999px;height:0;overflow:hidden}}
@media(max-width:560px){{#cg-{type} .cg-grille{{grid-template-columns:1fr}}}}
</style>
<h2>{titre}</h2>
<p class="cg-intro">{intro}</p>
<form novalidate>
{groupes}
<div class="cg-piege" aria-hidden="true"><label>Site web<input name="site_web" tabindex="-1" autocomplete="off"></label></div>
<label class="cg-consent"><input type="checkbox" name="consentement" required> <span>J'accepte que la paroisse La Croix glorieuse utilise ces informations uniquement pour traiter ma demande. <span class="cg-req">*</span></span></label>
<button type="submit">Envoyer ma demande</button>
<div class="cg-msg"></div>
</form>
<script>
(function(){{
  var URL_SCRIPT = {url};
  var racine = document.getElementById('cg-{type}');
  var form = racine.querySelector('form'), msg = racine.querySelector('.cg-msg'), bouton = form.querySelector('button');
  function afficher(texte, ok){{ msg.textContent = texte; msg.className = 'cg-msg ' + (ok ? 'cg-ok' : 'cg-ko'); msg.style.display = 'block'; }}
  form.addEventListener('submit', function(e){{
    e.preventDefault();
    var manque = Array.prototype.filter.call(form.querySelectorAll('[required]'), function(x){{ return x.type === 'checkbox' ? !x.checked : !x.value.trim(); }});
    if (manque.length) {{ afficher('Merci de remplir les champs marqués d\\'une étoile et d\\'accepter l\\'utilisation de vos données.', false); manque[0].focus(); return; }}
    if (form.pere_nom && !form.pere_nom.value.trim() && !form.mere_nom_jeune_fille.value.trim()) {{ afficher('Merci d\\'indiquer au moins un des parents.', false); form.pere_prenom.focus(); return; }}
    var email = form.querySelector('[name=email]');
    if (email && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email.value.trim())) {{ afficher('Adresse e-mail invalide.', false); email.focus(); return; }}
    var champs = {{}};
    Array.prototype.forEach.call(form.querySelectorAll('input[name],textarea[name]'), function(x){{ if (x.name !== 'consentement' && x.name !== 'site_web') champs[x.name] = x.value.trim(); }});
    bouton.disabled = true; bouton.textContent = 'Envoi…';
    fetch(URL_SCRIPT, {{ method: 'POST', headers: {{ 'Content-Type': 'text/plain;charset=utf-8' }},
      body: JSON.stringify({{ action: 'public.demande', payload: {{ type: '{type}', champs: champs, consentement: true, site_web: form.site_web.value }} }}) }})
      .then(function(r){{ return r.json(); }})
      .then(function(r){{
        if (!r.ok) throw new Error(r.message);
        form.querySelectorAll('fieldset,.cg-consent,button').forEach(function(x){{ x.style.display = 'none'; }});
        afficher('Merci ! Votre demande a bien été transmise au secrétariat de la paroisse. Nous vous recontacterons prochainement.', true);
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

def champ_html(ch):
    etoile = ' <span class="cg-req">*</span>' if ch["requis"] else ""
    req = " required" if ch["requis"] else ""
    if ch["type"] == "textarea":
        controle = f'<textarea name="{ch["cle"]}"{req}></textarea>'
        cls = "cg-large"
    else:
        auto = {"email": ' autocomplete="email"', "tel": ' autocomplete="tel"'}.get(ch["type"], "")
        controle = f'<input type="{ch["type"]}" name="{ch["cle"]}"{req}{auto}>'
        cls = ""
    return f'<div class="{cls}"><label>{ch["label"]}{etoile}</label>{controle}</div>'

sortie = pathlib.Path(__file__).parent
for type_, f in FORMULAIRES.items():
    groupes = "\n".join(
        f'<fieldset><legend>{titre}</legend><div class="cg-grille">' + "".join(champ_html(ch) for ch in champs) + "</div></fieldset>"
        for titre, champs in f["groupes"])
    html = MODELE.format(type=type_, titre=f["titre"], intro=f["intro"], groupes=groupes, url=json.dumps(URL))
    (sortie / f"formulaire-{type_}.html").write_text(html, encoding="utf-8")
    print("✓ formulaire-" + type_ + ".html")
