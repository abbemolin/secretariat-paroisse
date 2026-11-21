/* Agenda de la paroisse (repris du bloc « Horaires du jour » du site croix-glorieuse.org), pour l'app « Croix glorieuse ».
   Usage : var a = creerAgendaParoisse({ mesDates: function () { return [...] } }); parent.appendChild(a.element) */
(function(){
  var HTML_AGENDA="<div class=\"cg-jour ouvert\"> <h2 class=\"cg-titre\"> Agenda de la paroisse </h2> <button type=\"button\" class=\"cg-resume\" aria-expanded=\"false\" > <span class=\"cg-prochain\"> Chargement… </span> <span class=\"cg-fleche\" aria-hidden=\"true\"> </span> </button> <div class=\"cg-panneau\" > <div class=\"cg-interieur\"> <div class=\"cg-tete\"> <button type=\"button\" class=\"cg-nav cg-prec\" aria-label=\"Jour précédent\"> ‹ </button> <div class=\"cg-date\" aria-live=\"polite\"> <div class=\"cg-num\"> </div> <div class=\"cg-fetes\"> </div> </div> <button type=\"button\" class=\"cg-nav cg-suiv\" aria-label=\"Jour suivant\"> › </button> </div> <div class=\"cg-filtre\" role=\"group\" aria-label=\"Affichage\"> <button type=\"button\" data-f=\"tout\" aria-pressed=\"true\"> Tout </button> <button type=\"button\" data-f=\"messes\" aria-pressed=\"false\"> Messes seulement </button> </div> <div class=\"cg-hl\" hidden>Hors connexion : dernière version vue.</div> <ul class=\"cg-liste\"> </ul> <div class=\"cg-pied\"> <button type=\"button\" class=\"cg-auj\" hidden=\"\"> ↺ Aujourd'hui </button> </div> <a class=\"cg-abo cg-wa\" target=\"_blank\" rel=\"noopener\" href=\"https://chat.whatsapp.com/BWfpf5rkl5WJX1rIuRb1kq\"> <svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" aria-hidden=\"true\"> <path fill=\"currentColor\" d=\"M12 3C6.9 3 3 6.6 3 11.1c0 2.4 1.1 4.5 3 6L5.3 21l4-2.1c.9.2 1.8.3 2.7.3 5.1 0 9-3.6 9-8.1S17.1 3 12 3zm-4 9.3a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm4 0a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm4 0a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4z\"> </path> </svg> Rejoindre la communauté WhatsApp <span class=\"cg-long\"> de la paroisse </span> </a> <a class=\"cg-abo\" target=\"_blank\" rel=\"noopener\" href=\"https://cc3f859c.sibforms.com/serve/MUIFAMCpRFsMbqTq3H3C-grSI9sWsI-_tfdXZHu4syn0O-XJ6wk8M63DlrvS-tSVLyFNLkSofG-1gXvVOTXUJDFcw2Rudn0HdKlRE5egxKINekVsvFTzUxnq71pVHuuKvA8tJGbCm4VnTA3fO85gfXAW2OulsG-ip9hwraXWVMNWRIOlSPDI9k0f5cT508R8fUG6JfJTjuJYC-aW\"> ✉ Recevoir les informations paroissiales </a> </div> </div> </div> ";
  var st=document.createElement("style"); st.textContent=" .cg-jour{ --cg-accent:#521a22;     /* bordeaux du site */ --cg-texte:#292529; --cg-doux:#8a888a; --cg-ligne:#e6e2e2; --cg-vert:#2e6b3f;       /* « en cours » */ font-family:inherit; color:var(--cg-texte); background:#fff; border-radius:14px; box-shadow:0 1px 8px rgba(82,26,34,.07); margin-bottom:14px !important; padding:14px 14px 10px; box-sizing:border-box; text-align:center; } .cg-jour *{box-sizing:border-box} .cg-titre{font-family:Georgia,serif;font-size:19px;font-weight:700;line-height:1.2;color:var(--cg-accent);margin:0;text-align:left} /* Ligne résumé */ .cg-resume{max-width:100%;text-align:center;display:inline-flex;align-items:center;gap:10px;border:0;background:none;cursor:pointer;font:inherit;font-size:18px;color:var(--cg-texte);padding:6px 4px;border-bottom:1px solid var(--cg-ligne);text-decoration:none} .cg-resume:hover,.cg-resume:focus-visible{border-bottom-color:var(--cg-accent)} .cg-prochain{line-height:1.5} .cg-prochain b{color:var(--cg-accent)} .cg-prochain .q{color:var(--cg-doux);font-size:.85em} .cg-prochain .fini{opacity:.4} .cg-prochain .sep{color:var(--cg-doux)} .cg-live{display:block;font-size:.85em;color:var(--cg-vert);font-weight:600} .cg-live::before,.cg-badge::before{content:\"\";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cg-vert);margin-right:6px;vertical-align:1px;animation:cg-pouls 2s infinite} .cg-alerte{display:block;font-size:.85em;color:var(--cg-accent);font-weight:700} .cg-alerte .j{text-transform:capitalize} @keyframes cg-pouls{0%,100%{opacity:1}50%{opacity:.3}} .cg-fleche{width:8px;height:8px;border-right:2px solid var(--cg-accent);border-bottom:2px solid var(--cg-accent);transform:translateY(-3px) rotate(45deg);transition:transform .25s;flex:0 0 auto} .cg-jour.ouvert .cg-fleche{transform:translateY(2px) rotate(-135deg)} /* Panneau dépliable */ .cg-panneau{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease} .cg-jour.ouvert .cg-panneau{grid-template-rows:1fr} .cg-interieur{overflow:hidden;min-height:0} .cg-tete{display:flex;align-items:center;gap:8px;margin:16px 0 6px} .cg-nav{flex:0 0 36px;height:36px;border-radius:50%;border:1px solid var(--cg-ligne);background:#fff;color:var(--cg-accent);font-size:22px;line-height:1;cursor:pointer;padding:0 0 3px} .cg-nav:hover{background:var(--cg-accent);border-color:var(--cg-accent);color:#fff} .cg-date{flex:1;min-width:0} .cg-num{font-family:\"Book Antiqua\",Palatino,Georgia,serif;font-size:20px;font-weight:700;color:#000} .cg-fetes{font-size:14px;font-style:italic;color:var(--cg-doux);margin-top:2px} .cg-fetes .cg-lienpage{color:var(--cg-accent);text-decoration:none;border-bottom:1px solid var(--cg-ligne)} .cg-filtre{display:inline-flex;border:1px solid var(--cg-ligne);border-radius:18px;overflow:hidden;margin:4px 0 10px} .cg-filtre button{border:0;background:#fff;color:var(--cg-texte);font:inherit;font-size:14px;padding:5px 14px;cursor:pointer} .cg-filtre button+button{border-left:1px solid var(--cg-ligne)} .cg-filtre button[aria-pressed=\"true\"]{background:var(--cg-accent);color:#fff} /* Liste */ .cg-liste{list-style:none;margin:0;padding:0;text-align:left;font-size:16px;transition:opacity .15s} .cg-liste.ch{opacity:.35} .cg-liste.g{animation:cg-g .25s ease-out} .cg-liste.d{animation:cg-d .25s ease-out} @keyframes cg-g{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}} @keyframes cg-d{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}} .cg-liste li{display:flex;gap:14px;padding:8px 4px;border-bottom:1px solid var(--cg-ligne)} .cg-liste li:last-child{border-bottom:0} .cg-liste time{flex:0 0 3.4em;white-space:nowrap;font-weight:700;color:var(--cg-accent);font-variant-numeric:tabular-nums} .cg-liste.plages time{flex-basis:7.4em} .cg-liste li.spe span{font-weight:700} .cg-liste li.passe{opacity:.4} .cg-liste li.encours{background:#f1f7f2} .cg-badge{display:inline-block;margin-left:8px;font-size:13px;font-weight:600;font-style:normal;color:var(--cg-vert);white-space:nowrap} .cg-liste li.alerte span{color:var(--cg-accent);font-weight:700;font-style:normal} .cg-liste li.alerte span::before{content:\"⚠ \"} .cg-liste li.alerte{background:#fbeef0} .cg-liste li.alerte .lieu::before{content:none} .cg-liste time.jr{font-size:13px;padding-top:2px} .cg-liste .cg-lienpage{color:inherit;text-decoration:none;border-bottom:1px solid var(--cg-ligne)} .cg-liste .cg-lienpage:hover{color:var(--cg-accent);border-bottom-color:var(--cg-accent)} .cg-liste .cg-lienpage span{color:var(--cg-accent)} .cg-liste .cg-groupe{display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:1px 9px;border-radius:12px;background:#e7f6ec;color:#1d7a43;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;vertical-align:1px} .cg-liste .cg-groupe:hover{background:#1d7a43;color:#fff} .cg-pastille{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px;vertical-align:1px;border:1px solid rgba(0,0,0,.25)} .cg-liste .cg-textes{display:inline-flex;align-items:center;justify-content:center;margin-left:6px;width:28px;height:24px;border-radius:6px;color:var(--cg-accent);opacity:.75;text-decoration:none;vertical-align:-5px} .cg-liste .cg-textes:hover,.cg-liste .cg-textes:focus-visible{opacity:1;background:#f5ecee} .cg-liste .trad{font-style:normal;font-weight:400;font-size:14px;color:var(--cg-doux)} .cg-liste .lieu{display:block;font-weight:400!important;font-size:14px;color:var(--cg-doux)} .cg-info{justify-content:center;color:var(--cg-doux);font-style:italic} .cg-demo{justify-content:center;font-size:13px;color:var(--cg-doux);background:#fff6d6;border-radius:4px} .cg-pied{display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px;font-size:14px} .cg-pied a{color:var(--cg-accent);text-decoration:none;margin-left:auto;font-weight:700} .cg-auj{border:0;background:none;color:var(--cg-accent);cursor:pointer;font:inherit;padding:0} .cg-abo{display:block;margin:10px 0 6px;padding:8px;border:1px solid var(--cg-ligne);border-radius:18px;color:var(--cg-accent);text-decoration:none;font-size:14px} .cg-abo:hover{background:var(--cg-accent);color:#fff;border-color:var(--cg-accent)} .cg-wa{margin-bottom:0;color:#1d7a43} .cg-wa svg{vertical-align:-2px} .cg-wa:hover{background:#1d7a43;border-color:#1d7a43} @media (max-width:480px){.cg-long{display:none}.cg-titre{font-size:24px}.cg-resume{font-size:16px}} @media (prefers-reduced-motion:reduce){.cg-panneau,.cg-fleche{transition:none}.cg-liste.g,.cg-liste.d,.cg-live::before,.cg-badge::before{animation:none}}  .cg-resume{display:none!important} .cg-tete{margin-top:8px} .cg-liste li.perso{background:#faf3ea} .cg-liste li.perso span{color:var(--cg-accent)} .cg-perso{display:inline-block;margin-left:8px;font-size:12px;font-weight:600;font-style:normal;background:#d08c4c;color:#fff;border-radius:999px;padding:1px 8px;white-space:nowrap} .cg-hl{background:#f1e8e1;color:#5b4a45;border-radius:8px;padding:6px 10px;font-size:13.5px;margin:4px 0 8px}"; document.head.appendChild(st);

window.creerAgendaParoisse=function(opts){ opts=opts||{};
  var R=document.createElement("div"); R.innerHTML=HTML_AGENDA; R=R.firstElementChild;
  /* =================== RÉGLAGES =================== */
  var CONFIG = {
    calendarId : "saintlouisenville67@gmail.com",
    apiKey     : "AIzaSyC3aFIwr-Gl8VKYl9KKxVPcSbIM_GB6cJY",
    appMesse : "https://abbemolin.github.io/appMesse/",   // données de l'app Messe (calendrier, propres, bréviaire)
    pageSecours: "https://www.croix-glorieuse.org/horaires",   // si Google ne répond pas
    filtreParDefaut : "tout",   // "tout" ou "messes"
    masquer : [],  // titres à ne jamais afficher (vide = tout afficher)
    // Titres anonymisés : le nom de la personne est retiré, seul le mot affiché reste
    anonymiser : [ [/bapteme/, "Baptême"], [/mariage/, "Mariage"] ],
    // Liens ajoutés à certains événements : [titre repéré, adresse, "groupe" (bouton de discussion), "page" (titre cliquable) ou "don" (titre cliquable, ouvre le paiement dans un nouvel onglet)]
    liens : [
      [/^enseignement etudiants/, "https://chat.whatsapp.com/EOZiGW5lynS5l0lIIPQ9gK", "groupe"],
      [/catechisme elementaire/, "https://www.croix-glorieuse.org/cat%C3%A9chisme-%C3%A9l%C3%A9mentaire-pour-les-adultes", "page"],
      [/^patronage/, "https://www.croix-glorieuse.org/patronagesaintlouis", "page"],
      [/^quete chauffage/, "https://www.helloasso.com/associations/association-pour-le-culte-catholique-traditionnel-en-alsace/formulaires/10", "don"]
    ],
    // Changements signalés (⚠) : uniquement les événements qui commencent par « Pas de »
    changements : [ /^pas de / ],
    // Activités régulières : style normal. Tout le reste = événement particulier (en gras)
    reguliers : [
      /^laudes$/, /^vepres/, /^adoration$/, /^confessions?$/, /^pas de messe/,
      /^(grand'?\s?)?messe( anticipee)?( \(missel de paul vi\))?$/,
      /^catechisme$/, /^patronage$/, /^rosaire/, /^chapelet/, /^aumonerie/,
      /^preparation a la confirmation/, /bapteme/, /mariage/
    ]
  };
  /* ================================================ */
  var TZ="Europe/Paris";
  var $=function(s){return R.querySelector(s);};
  var liste=$(".cg-liste"), resume=$(".cg-resume"), prochain=$(".cg-prochain"), btnAuj=$(".cg-auj");
  var cache={}, charges={}, enCours={}, demo=false, epingle=false, sens=0, horsLigne=false;
  var filtre=CONFIG.filtreParDefaut;
  try{ var f0=localStorage.getItem("cg-filtre"); if(f0==="tout"||f0==="messes") filtre=f0; }catch(e){}
  function norm(s){return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[’]/g,"'").trim();}
  function esc(s){return (s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function cleJour(d){return new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
  function ajout(j,n){var d=new Date(j+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function heure(d){return new Intl.DateTimeFormat("fr-FR",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}).format(d).replace(":","h");}
  var aujourdhui=cleJour(new Date()), jour=aujourdhui;
  /* ---------- Fête du jour et textes : données de l'app Messe (calendrier 1962, Divinum Officium) ---------- */
  var APP=CONFIG.appMesse, CAL=null;
  function chargerCalendrier(){
    try{ var c=JSON.parse(sessionStorage.getItem("cg-cal")||"null"); if(c&&c.t>Date.now()-6*3600000){CAL=c.d;return Promise.resolve();} }catch(e){}
    return fetch(APP+"data/messe/calendrier.json").then(function(r){if(!r.ok) throw 0;return r.json();})
      .then(function(d){CAL=d; try{sessionStorage.setItem("cg-cal",JSON.stringify({t:Date.now(),d:d}));}catch(e){} })
      .catch(function(){CAL={};});
  }
  function chargerTitres(){            // titres en français, partagés avec l'app (titres.js)
    return new Promise(function(ok){
      if(window.titreFrancais) return ok();
      var sc=document.createElement("script"); sc.src=APP+"titres.js"; sc.onload=sc.onerror=function(){ok();};
      document.head.appendChild(sc);
    });
  }
  function frTitre(t){ t=t||""; return window.titreFrancais?window.titreFrancais(t):t.replace(/\s+\d+(?:er|e) d(?:e |’|')\S+$/,""); }
  var COULEURS={blanc:"#f4f1e8",rouge:"#b3202e",vert:"#2e7d4a",violet:"#6b3a8c",rose:"#e39ab1",noir:"#222"};
  function feteDu(j){
    var c=CAL&&CAL[j]; if(!c) return null;
    return {titre:frTitre(c.titre_fr||c.titre), couleur:COULEURS[norm(c.couleur)]||"", classe:c.classe||""};
  }
  function htmlFete(f){
    return f?'<span class="cg-pastille" style="background:'+f.couleur+'" title="Couleur liturgique"></span>'+esc(f.titre):"";
  }
  /* ---------- Liens « Textes » (missel traditionnel uniquement) ---------- */
  var ICO_LIVRE='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M4 4.5C4 3.7 4.7 3 5.5 3H11v16H5.5c-.8 0-1.5.4-1.5 1V4.5zM13 3h5.5c.8 0 1.5.7 1.5 1.5V20c0-.6-.7-1-1.5-1H13V3z"></path></svg>';
  function lienTextes(h,j){
    var t=norm(h.t), quoi=null;
    if(/paul vi|anticipee/.test(t)) return "";
    if(h.k.messe) quoi="messe";
    else if(/^laudes/.test(t)) quoi="Laudes";
    else if(/^vepres/.test(t)) quoi="Vespera";
    if(!quoi) return "";
    var nom=quoi==="messe"?"Propre de la messe":quoi==="Laudes"?"Laudes":"Vêpres";
    return '<a class="cg-textes" href="#" data-j="'+j+'" data-q="'+quoi+'" title="'+nom+' — latin / français" aria-label="'+nom+' (latin / français)">'+ICO_LIVRE+'</a>';
  }
  // Les textes viennent de fichiers externes : on retire tout ce qui pourrait exécuter du code
  function propre(h){
    return String(h||"").replace(/<\s*(script|iframe|object|embed|style|link|meta|form)[\s\S]*?(<\/\s*\1\s*>|$)/gi,"")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"").replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi,"");
  }
  // Page complète des textes (servie dans une fenêtre, ou par-dessus le site si la fenêtre est bloquée)
  function pageTextes(nom,date,corps,fermer){
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+nom+' — '+date+'</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap"><style>'+
      'body{margin:0;background:#fffdf8;color:#292529;font:18.5px/1.55 "EB Garamond","Book Antiqua",Palatino,Georgia,serif}'+
      'header{position:sticky;top:0;z-index:1;background:#551a25;color:#fff;padding:12px 18px;display:flex;align-items:center;gap:10px}header div{flex:1;min-width:0}header h1{margin:0;font-size:22px;font-weight:600;letter-spacing:.01em}header p{margin:2px 0 0;font-size:15px;opacity:.85}'+
      'header button{flex:0 0 auto;border:1px solid rgba(255,255,255,.6);background:none;color:#fff;border-radius:18px;padding:6px 12px;font:600 14px Arial,sans-serif;cursor:pointer}'+
      'header button:disabled{opacity:.35;cursor:default}header .taille{display:flex;gap:4px}header .taille button{padding:6px 10px;min-width:40px}'+
      'main{max-width:980px;margin:0 auto;padding:6px 22px 40px;line-height:1.6;font-size:calc(1em * var(--k,1))}h2{font-size:1.06em;color:#551a25;margin:30px 0 4px;text-align:center}'+
      '.fete{text-align:center;color:#6f6a6c;font-style:italic;margin:16px 0 4px}'+
      'h3{font-size:.91em;color:#551a25;margin:24px 0 6px;letter-spacing:.02em}'+
      '.cols{display:grid;grid-template-columns:.82fr 1fr;gap:28px}.cols>div{min-width:0}'+
      '.do-rubr,.do-petit{color:#a4878d;font-size:.86em}.do-titre{display:block;color:#551a25;font-size:.9em;margin-top:8px}.do-titre b,.do-titre i{font-weight:600;font-style:normal}'+
      '.lettrine{color:#551a25;font-weight:700;font-style:normal;font-size:1.25em;line-height:1}'+
      '.cols+.cols{margin-top:8px}'+
      '.partition{margin:14px 0 10px;opacity:0;transition:opacity .5s ease}.partition.prete{opacity:1}.partition svg{display:block;max-width:100%;height:auto}'+
      '.sous{color:#551a25;font-size:.95em;margin:16px 0 0;font-style:italic}'+
      '.trad-ant{margin:-2px 0 14px;font-style:italic;color:#4a4346}'+
      '.psaume{margin:30px 0 0;padding-top:16px;border-top:1px solid #efe7e3}.psaume:first-of-type{margin-top:6px;padding-top:0;border-top:0}'+
      '.ps-titre{margin:10px 0 2px;font:600 .74em Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#a4878d}'+
      '.vs{margin:4px 0 10px}.v{display:grid;grid-template-columns:.82fr 1fr;gap:28px;padding:3px 0}.v>div{min-width:0;padding-left:1.1em;text-indent:-1.1em}.vide{height:10px}'+
      '.la{hyphens:manual;-webkit-hyphens:manual}'+
      '.ref{color:#a4878d;font-size:.86em;font-style:italic;padding:2px 0 0}'+
      '.chant{border-left:2px solid #c9a9b0;padding-left:12px;margin-left:-14px}'+
      '.sous-titre{font-weight:400;font-style:italic;color:#8a7d80}'+
      '.ast{color:#b3202e;font-size:.85em}.rub{color:#a4878d;font-size:.86em}'+
      '.lecture{margin:2px 0 8px}'+
      'details.ord{margin:18px 0 0;border-top:1px solid #eee7e2;border-bottom:1px solid #eee7e2}'+
      'details.ord summary{cursor:pointer;list-style:none;padding:10px 2px;color:#551a25;font-weight:700;font-size:.91em}'+
      'details.ord summary::-webkit-details-marker{display:none}'+
      'details.ord summary::before{content:"▸";display:inline-block;width:1.1em;transition:transform .2s}details.ord[open] summary::before{transform:rotate(90deg)}'+
      'details.ord .cols,details.ord .vs{padding:0 0 12px}'+
      '.info{color:#8a888a;font-style:italic;padding:30px 0;text-align:center}'+
      '@media(max-width:700px){.chant{margin-left:-8px;padding-left:7px}body{font-size:16px}main{padding:4px 10px 30px;line-height:1.45}.cols,.v{gap:10px}.cols>div,.v>div{overflow-wrap:anywhere;hyphens:auto}.cols>div+div,.v>div+div{border-left:1px solid #eee7e2;padding-left:9px}.v>div+div{padding-left:calc(9px + 1.1em)}'+
        'header{padding:10px 12px;gap:6px}header h1{font-size:19px}header p{font-size:13.5px}header .taille button{min-width:34px;padding:5px 7px}#fermer{padding:5px 10px}}'+
      '@media (prefers-reduced-motion:reduce){.partition{transition:none}}'+
      '</style></head><body><header><div><h1>'+nom+'</h1><p>'+date+'</p></div>'+
      '<span class="taille"><button type="button" id="moins" aria-label="Texte plus petit">A−</button><button type="button" id="plus" aria-label="Texte plus grand">A+</button></span>'+
      (fermer?'<button type="button" id="fermer">✕ Fermer</button>':'')+'</header><main>'+corps+'</main>'+
      // Taille du texte : retenue d'une ouverture à l'autre
      '<script>(function(){var T=[.85,1,1.15,1.3,1.5],i=1;try{var v=parseInt(localStorage.getItem("cg-taille"),10);if(T[v])i=v;}catch(e){}'+
      'var m=document.getElementById("moins"),p=document.getElementById("plus");'+
      'function app(){document.documentElement.style.setProperty("--k",T[i]);m.disabled=i===0;p.disabled=i===T.length-1;try{localStorage.setItem("cg-taille",i);}catch(e){}}'+
      'm.onclick=function(){if(i>0){i--;app();}};p.onclick=function(){if(i<T.length-1){i++;app();}};app();})();<\/script>'+
      '</body></html>';
  }
  // Mise en forme « lecture claire » : titres de parties en français, notes techniques retirées,
  // lettrines propres, et (pour les offices) sans numéros de versets
  var NOMS_PARTIES={introitus:"Introït",oratio:"Collecte",lectio:"Épître",graduale:"Graduel",tractus:"Trait",sequentia:"Séquence",
    evangelium:"Évangile",offertorium:"Offertoire",secreta:"Secrète",prefatio:"Préface",communio:"Communion",postcommunio:"Postcommunion",
    gloria:"Gloria",credo:"Credo",commemoratio:"Commémoraison"};
  var RE_TITRE=/^\s*<span class="do-titre"><b><i>\s*([^<]{2,}?)\s*<\/i><\/b><\/span>\s*(\{[^}]*\})?\s*(<br>)?\s*/;
  function clair(t,office){
    t=String(t||"")
      .replace(/\{[^}]*\}/g,"")                                                        // notes techniques
      .replace(/<span class="do-(?:rubr|titre)"><b><i>([^<\s])<\/i><\/b><\/span>/g,'<span class="lettrine">$1</span>');   // lettrines
    if(office) t=t.replace(/<span class="do-petit">\s*\d+:\d+[a-z]?\s*<\/span>\s*/g,"").replace(/(<\/span>)\s*\[\d+\]/g,"$1");   // versets
    return propre(t).trim();
  }
  function sansTexte(h){ return !String(h).replace(/<[^>]+>|&nbsp;|\s/g,""); }
  /* ---------- Partitions grégoriennes des Vêpres (antiennes et hymne) ---------- */
  function decoder(h){ var t=document.createElement("textarea"); t.innerHTML=h; return t.value; }
  // Découpe une ligne du fichier grégorien : antiennes (dans l'ordre) et hymne ; les tons de psaumes et le reste sont ignorés
  function piecesGregoriennes(ligne){
    var res={antiennes:[],hymne:null}, morceaux=String(ligne||"").split(/(<div class="gabc">[\s\S]*?<\/div>)/), avant="";
    morceaux.forEach(function(m){
      var g=m.match(/^<div class="gabc">([\s\S]*?)<\/div>$/);
      if(!g){ avant=m.replace(/<[^>]+>/g,"").trim(); return; }
      var src=decoder(g[1]);
      if(/office-part:\s*Hymnus/i.test(src)) res.hymne=src;
      else if(/Ant\.$/.test(avant) && !/^\s*name:\s*(\d+[-,]|Magnificat-)/m.test(src)) res.antiennes.push(src);
      avant="";
    });
    return res;
  }
  var SOURCES=[];
  function partition(src){ SOURCES.push(src); return '<div class="partition" data-n="'+(SOURCES.length-1)+'"></div>'; }
  function cols(la,fr){ return sansTexte(la+fr)?"":'<div class="cols"><div class="la">'+la+'</div><div lang="fr">'+fr+'</div></div>'; }
  // Offices : latin et français alignés ligne à ligne (verset par verset) quand les deux textes ont le même découpage
  // Ligne qui n'est qu'une référence biblique (« Ps 84:2 », « Jer 29:11; 29:12 »)
  function estRef(h){ h=String(h).trim(); return /^<span class="do-rubr"><i>[^<]*<\/i><\/span>$/.test(h) && /\d+[:,]\d+/.test(h.replace(/<[^>]+>/g,"")); }
  function versets(la,fr){
    if(sansTexte(la+fr)) return "";
    var L=la.split(/\s*<br>\s*/), F=fr.split(/\s*<br>\s*/);
    function net(a){ while(a.length&&sansTexte(a[a.length-1])) a.pop(); while(a.length&&sansTexte(a[0])) a.shift(); return a; }
    L=net(L); F=net(F);
    if(L.length!==F.length||L.length<2) return cols(L.filter(function(x){return !estRef(x);}).join("<br>"),fr);
    var marque=function(t){ return t.replace(/\s\*\s/g,' <span class="ast">*</span> ').replace(/\s?([†‡])\s?/g,' <span class="ast">$1</span> '); };
    return '<div class="vs">'+L.map(function(x,i){
      if(sansTexte(x+F[i])) return '<div class="vide"></div>';
      if(estRef(x)&&estRef(F[i])) return '<div class="ref">'+F[i]+'</div>';          // référence biblique : une seule fois
      return '<div class="v"><div class="la">'+marque(x)+'</div><div lang="fr">'+marque(F[i])+'</div></div>';
    }).join("")+'</div>';
  }
  // Gloria et Credo (Ordinaire de la messe, Divinum Officium), dépliables
  var ORDINAIRE={
    Gloria:["Glória in excélsis Deo. Et in terra pax homínibus bonæ voluntátis. <br>Laudámus te. Benedícimus te. Adorámus te. Glorificámus te. Grátias ágimus tibi propter magnam glóriam tuam. <br>Dómine Deus, Rex cæléstis, Deus Pater omnípotens. Dómine Fili unigénite, Jesu Christe. Dómine Deus, Agnus Dei, Fílius Patris. <br>Qui tollis peccáta mundi, miserére nobis. Qui tollis peccáta mundi, súscipe deprecatiónem nostram. Qui sedes ad déxteram Patris, miserére nobis. <br>Quóniam tu solus Sanctus. Tu solus Dóminus. Tu solus Altíssimus, Jesu Christe. Cum Sancto Spíritu ✠ in glória Dei Patris. Amen.", "Gloire à Dieu au plus haut des cieux. Et paix sur la terre aux hommes de bonne volonté.<br>Nous vous louons, nous vous bénissons, nous vous adorons, nous vous gloriﬁons. Nous vous rendons grâces pour votre immense gloire.<br>Seigneur Dieu, Roi du ciel, Dieu le Père tout-puissant. Seigneur Fils Unique, Jésus-Christ. Seigneur Dieu, Agneau de Dieu, le Fils du Père.<br>Vous qui enlevez les péchés du monde, ayez pitié de nous. Vous qui enlevez les péchés du monde, accueillez notre prière. Vous qui êtes assis à la droite du Père, ayez pitié de nous.<br>Car vous seul êtes Saint, vous seul êtes Seigneur, vous seul êtes le Très-Haut, Jésus-Christ, avec le Saint-Esprit, ✠ dans la gloire de Dieu le Père. Ainsi soit-il."],
    Credo:["Credo in unum Deum, Patrem omnipoténtem, factórem cæli et terræ, visibílium ómnium et invisibílium. <br>Et in unum Dóminum Jesum Christum, Fílium Dei unigénitum. Et ex Patre natum ante ómnia sǽcula. Deum de Deo, Lumen de Lúmine, Deum verum de Deo vero. Génitum, non factum, consubstantiálem Patri: per quem ómnia facta sunt. <br>Qui propter nos hómines et propter nostram salútem descéndit de cælis. <br><i class=\"rub\">(Hic genuflectitur)</i> Et incarnátus est de Spíritu Sancto ex María Vírgine: Et homo factus est. <br>Crucifíxus étiam pro nobis: sub Póntio Piláto passus, et sepúltus est. Et resurréxit tértia die, secúndum Scriptúras. <br>Et ascéndit in cælum: sedet ad déxteram Patris. Et íterum ventúrus est cum glória judicáre vivos et mórtuos: cujus regni non erit finis. <br>Et in Spíritum Sanctum, Dóminum et vivificántem: qui ex Patre Filióque procédit. Qui cum Patre et Fílio simul adorátur et conglorificátur: qui locútus est per Prophétas. <br>Et unam sanctam cathólicam et apostólicam Ecclésiam. Confíteor unum baptísma in remissiónem peccatórum. Et exspécto resurrectiónem mortuórum. Et vitam ventúri sæculi. Amen.", "Je crois en un seul Dieu. Le Père tout-puissant, Créateur du ciel et de la terre, de l’univers visible et invisible.<br>Et en un seul Seigneur Jésus-Christ, le Fils unique de Dieu, né du Père avant tous les siècles. Dieu de Dieu, Lumière de Lumière, vrai Dieu de vrai Dieu. Engendré, non pas créé, consubstantiel au Père, et par qui tout a été fait.<br>Pour nous, les hommes, et pour notre salut, il est descendu des cieux.<br><i class=\"rub\">(On s’agenouille en disant le verset suivant :)</i> Il a pris chair de la Vierge Marie par l’Esprit Saint, et s’est fait homme.<br>Cruciﬁé aussi pour nous, il a souffert sous Ponce Pilate et a été enseveli. Il est ressuscité le troisième jour, conformément aux Écritures.<br>Et il est monté au ciel : il siège à la droite du Père. Il reviendra dans la gloire pour juger les vivants et les morts ; et son règne n’aura pas de ﬁn.<br>Je crois en l’Esprit Saint, qui est Seigneur et qui donne la vie ; il procède du Père et du Fils. Avec le Père et le Fils, il reçoit même adoration et même gloire ; il a parlé par les prophètes.<br>Je crois l’Église, qui est une, sainte, catholique et apostolique. Je reconnais un seul baptême pour la rémission des péchés. Et j’attends la résurrection des morts. ✠ Et la vie du monde à venir. Ainsi soit-il."]
  };
  // Messes de semaine : prières au bas de l'autel (dépliables) et prière avant la communion (Ordinaire, Divinum Officium)
  var AUTEL=["In nómine Patris, <span class=\"ast\">✠</span> et Fílii, et Spíritus Sancti. Amen.<br><span class=\"do-rubr\"><i>S.</i></span> Introíbo ad altáre Dei.<br><span class=\"do-rubr\"><i>M.</i></span> Ad Deum, qui lætíficat juventútem meam.<br><span class=\"do-rubr\"><i>S.</i></span> Júdica me, Deus, et discérne causam meam de gente non sancta: ab hómine iníquo et dolóso érue me.<br><span class=\"do-rubr\"><i>M.</i></span> Quia tu es, Deus, fortitúdo mea: quare me repulísti, et quare tristis incédo, dum afflígit me inimícus?<br><span class=\"do-rubr\"><i>S.</i></span> Emítte lucem tuam et veritátem tuam: ipsa me deduxérunt, et adduxérunt in montem sanctum tuum et in tabernácula tua.<br><span class=\"do-rubr\"><i>M.</i></span> Et introíbo ad altáre Dei: ad Deum, qui lætíficat juventútem meam.<br><span class=\"do-rubr\"><i>S.</i></span> Confitébor tibi in cíthara, Deus, Deus meus: quare tristis es, ánima mea, et quare contúrbas me?<br><span class=\"do-rubr\"><i>M.</i></span> Spera in Deo, quóniam adhuc confitébor illi: salutáre vultus mei, et Deus meus.<br><span class=\"do-rubr\"><i>S.</i></span> Glória Patri, et Fílio, et Spirítui Sancto.<br><span class=\"do-rubr\"><i>M.</i></span> Sicut erat in princípio, et nunc, et semper: et in sǽcula sæculórum. Amen.<br><span class=\"do-rubr\"><i>S.</i></span> Introíbo ad altáre Dei.<br><span class=\"do-rubr\"><i>M.</i></span> Ad Deum, qui lætíficat juventútem meam.<br><span class=\"do-rubr\"><i>℣.</i></span> Adjutórium nostrum <span class=\"ast\">✠</span> in nómine Dómini.<br><span class=\"do-rubr\"><i>℟.</i></span> Qui fecit cælum et terram.<br>Confíteor Deo omnipoténti, beátæ Maríæ semper Vírgini, beáto Michaéli Archángelo, beáto Joánni Baptístæ, sanctis Apóstolis Petro et Paulo, ómnibus Sanctis, et vobis, fratres: quia peccávi nimis cogitatióne, verbo et ópere: <i class=\"rub\">(Percutit sibi pectus ter, dicens:)</i> mea culpa, mea culpa, mea máxima culpa. Ideo precor beátam Maríam semper Vírginem, beátum Michaélem Archángelum, beátum Joánnem Baptístam, sanctos Apóstolos Petrum et Paulum, omnes Sanctos, et vos, fratres, oráre pro me ad Dóminum, Deum nostrum.<br><span class=\"do-rubr\"><i>M.</i></span> Misereátur tui omnípotens Deus, et, dimíssis peccátis tuis, perdúcat te ad vitam ætérnam.<br><span class=\"do-rubr\"><i>S.</i></span> Amen.<br><span class=\"do-rubr\"><i>M.</i></span> Confíteor Deo omnipoténti, beátæ Maríæ semper Vírgini, beáto Michaéli Archángelo, beáto Joánni Baptístæ, sanctis Apóstolis Petro et Paulo, ómnibus Sanctis, et tibi, pater: quia peccávi nimis cogitatióne, verbo et ópere: mea culpa, mea culpa, mea máxima culpa. Ideo precor beátam Maríam semper Vírginem, beátum Michaélem Archángelum, beátum Joánnem Baptístam, sanctos Apóstolos Petrum et Paulum, omnes Sanctos, et te, pater, oráre pro me ad Dóminum, Deum nostrum.<br><span class=\"do-rubr\"><i>S.</i></span> Misereátur vestri omnípotens Deus, et, dimíssis peccátis vestris, perdúcat vos ad vitam ætérnam.<br><span class=\"do-rubr\"><i>℟.</i></span> Amen.<br><span class=\"do-rubr\"><i>S.</i></span> Indulgéntiam, <span class=\"ast\">✠</span> absolutiónem et remissiónem peccatórum nostrórum tríbuat nobis omnípotens et miséricors Dóminus.<br><span class=\"do-rubr\"><i>℟.</i></span> Amen.<br><span class=\"do-rubr\"><i>℣.</i></span> Deus, tu convérsus vivificábis nos.<br><span class=\"do-rubr\"><i>℟.</i></span> Et plebs tua lætábitur in te.<br><span class=\"do-rubr\"><i>℣.</i></span> Osténde nobis, Dómine, misericórdiam tuam.<br><span class=\"do-rubr\"><i>℟.</i></span> Et salutáre tuum da nobis.<br><span class=\"do-rubr\"><i>℣.</i></span> Dómine, exáudi oratiónem meam.<br><span class=\"do-rubr\"><i>℟.</i></span> Et clamor meus ad te véniat.<br><span class=\"do-rubr\"><i>℣.</i></span> Dóminus vobíscum.<br><span class=\"do-rubr\"><i>℟.</i></span> Et cum spíritu tuo.<br>Orémus, <i class=\"rub\">(ei ascendens ad Altare, dicit secreto: )</i><br>Aufer a nobis, quǽsumus, Dómine, iniquitátes nostras: ut ad Sancta sanctórum puris mereámur méntibus introíre. Per Christum, Dóminum nostrum. Amen.<br>Orámus te, Dómine, per mérita Sanctórum tuórum, <i class=\"rub\">(Osculatur Altare in medio)</i> quorum relíquiæ hic sunt, et ómnium Sanctórum: ut indulgére dignéris ómnia peccáta mea. Amen.", "Au nom du Père et du Fils, <span class=\"ast\">✠</span> et du Saint-Esprit. Ainsi soit-il.<br><span class=\"do-rubr\"><i>S.</i></span> J'entrerai à l'autel de Dieu.<br><span class=\"do-rubr\"><i>M.</i></span> Au Dieu qui réjouit ma jeunesse.<br><span class=\"do-rubr\"><i>S.</i></span> Jugez-moi, ô Dieu, et séparez ma cause de celle d'une nation qui n'est pas sainte; délivrez-moi de l'homme méchant et trompeur.<br><span class=\"do-rubr\"><i>M.</i></span> Car Vous êtes ma force, ô Dieu; pourquoi m'avez-vous repoussé, et pourquoi dois-je marcher attristé, pendant que l'ennemi m'afflige ?<br><span class=\"do-rubr\"><i>S.</i></span> Envoyez Votre lumière et Votre vérité: elles me conduiront et m'amèneront à Votre montagne sainte et à Vos tabernacles.<br><span class=\"do-rubr\"><i>M.</i></span> Et j'entrerai à l'autel de Dieu, au Dieu qui réjouit ma jeunesse.<br><span class=\"do-rubr\"><i>S.</i></span> Je Vous louerai sur la harpe, ô Dieu, mon Dieu. Pourquoi es-tu triste, mon âme ? et pourquoi me troubles-tu ?<br><span class=\"do-rubr\"><i>M.</i></span> Espère en Dieu, car je Le louerai encore, Lui, le salut de mon visage et mon Dieu.<br><span class=\"do-rubr\"><i>S.</i></span> Gloire au Père et au Fils, et au Saint-Esprit.<br><span class=\"do-rubr\"><i>M.</i></span> Comme il était au commencement, maintenant et toujours, et dans les siècles des siècles. Ainsi soit-il.<br><span class=\"do-rubr\"><i>S.</i></span> J'entrerai à l'autel de Dieu.<br><span class=\"do-rubr\"><i>M.</i></span> Au Dieu qui réjouit ma jeunesse.<br><span class=\"do-rubr\"><i>℣.</i></span> Notre secours <span class=\"ast\">✠</span> est dans le Nom du Seigneur.<br><span class=\"do-rubr\"><i>℟.</i></span> Qui a fait le ciel et la terre.<br>Je confesse à Dieu tout-puissant, à la bienheureuse Marie toujours vierge, à saint Michel Archange, à saint Jean-Baptiste, aux saints apôtres Pierre et Paul, à tous les saints, et à vous mes frères, que j’ai beaucoup péché, en pensée, en parole et par action. <i class=\"rub\">(Le prêtre se frappe trois fois la poitrine, disant :)</i> C’est ma faute, c’est ma faute, c’est ma très grande faute. C’est pourquoi je supplie la bienheureuse Marie toujours vierge, saint Michel Archange, saint Jean-Baptiste, les saints apôtres Pierre et Paul, tous les saints et vous, mes frères, de prier pour moi le Seigneur notre Dieu.<br><span class=\"do-rubr\"><i>M.</i></span> Que le Dieu tout-puissant vous fasse miséricorde, qu’il vous pardonne vos péchés et vous conduise à la vie éternelle.<br><span class=\"do-rubr\"><i>S.</i></span> Ainsi soit-il.<br><span class=\"do-rubr\"><i>M.</i></span> Je confesse à Dieu tout-puissant, à la bienheureuse Marie toujours vierge, à saint Michel Archange, à saint Jean-Baptiste, aux saints apôtres Pierre et Paul, à tous les saints, et à vous mes frères, que j’ai beaucoup péché, en pensée, en parole et par action. <i class=\"rub\">(On se frappe trois fois la poitrine en disant :)</i> C’est ma faute, c’est ma faute, c’est ma très grande faute. C’est pourquoi je supplie la bienheureuse Marie toujours vierge, saint Michel Archange, saint Jean-Baptiste, les saints apôtres Pierre et Paul, tous les saints et vous, mes frères, de prier pour moi le Seigneur notre Dieu.<br><span class=\"do-rubr\"><i>S.</i></span> Que le Dieu tout-puissant vous fasse miséricorde, qu’il vous pardonne vos péchés et vous conduise à la vie éternelle.<br><span class=\"do-rubr\"><i>℟.</i></span> Ainsi soit-il.<br><span class=\"do-rubr\"><i>S.</i></span> Que le Seigneur tout-puissant et miséricordieux nous accorde <span class=\"ast\">✠</span> le pardon, l’absolution et la rémission de nos péchés.<br><span class=\"do-rubr\"><i>℟.</i></span> Ainsi soit-il.<br><span class=\"do-rubr\"><i>℣.</i></span> Dieu, tournez-vous vers nous et donnez-nous la vie.<br><span class=\"do-rubr\"><i>℟.</i></span> Et votre peuple se réjouira en vous.<br><span class=\"do-rubr\"><i>℣.</i></span> Montrez-nous, Seigneur, votre miséricorde.<br><span class=\"do-rubr\"><i>℟.</i></span> Et accordez-nous votre salut.<br><span class=\"do-rubr\"><i>℣.</i></span> Seigneur, exaucez ma prière.<br><span class=\"do-rubr\"><i>℟.</i></span> Et que mon cri parvienne jusqu’à vous.<br><span class=\"do-rubr\"><i>℣.</i></span> Le Seigneur soit avec vous.<br><span class=\"do-rubr\"><i>℟.</i></span> Et avec votre esprit.<br>Prions, <i class=\"rub\">(Le prêtre monte à l’autel, en disant à voix basse :)</i><br>Enlevez nos fautes, Seigneur, nous vous en prions, aﬁn que nous puissions pénétrer jusqu’au Saint des Saints avec une âme pure. Par le Christ notre Seigneur. Ainsi soit-il.<br>Nous vous prions, Seigneur, par les mérites de vos saints <i class=\"rub\">(le prêtre baise le milieu de l’autel)</i> dont nous conservons ici les reliques, et de tous les saints, de daigner me pardonner tous mes péchés. Ainsi soit-il."];
  var AVANT_COMMUNION=["<span class=\"do-rubr\"><i>S.</i></span> Ecce Agnus Dei, ecce, qui tollit peccáta mundi.<br><span class=\"do-rubr\"><i>S.</i></span> Dómine, non sum dignus, ut intres sub tectum meum, sed tantum dic verbo, et sanábitur ánima mea. <i class=\"rub\">(ter)</i>", "<span class=\"do-rubr\"><i>S.</i></span> Voici l’Agneau de Dieu, voici celui qui enlève les péchés du monde.<br><span class=\"do-rubr\"><i>S.</i></span> Seigneur, je ne suis pas digne que vous entriez sous mon toit, mais dites seulement une parole et mon âme sera guérie. <i class=\"rub\">(trois fois)</i>"];
  function ordinaire(nom){
    var t=ORDINAIRE[nom]; if(!t) return "";
    return '<details class="ord"><summary>'+nom+'</summary>'+versets(t[0],t[1])+'</details>';
  }
  // Découpe une ligne « antienne – psaume – antienne » en trois morceaux
  var RE_ANT=/<span class="do-rubr"><i>Ant\.<\/i><\/span>\s*/;
  function troisParts(t){
    var p=t.split(RE_ANT); if(p.length<3) return null;
    var debut=p[1].search(/<br>/); if(debut<0) return null;
    return {avant:p[0], ouv:p[1].slice(0,debut), corps:p.slice(1,-1).join('<span class="do-rubr"><i>Ant.</i></span> ').slice(debut), ferm:p[p.length-1]};
  }
  // Messe : mise en forme de chaque partie (ligne par ligne, latin et français alignés)
  var CHANTS=["introitus","graduale","tractus","sequentia","offertorium","communio"];
  var ORAISONS=["oratio","secreta","postcommunio","commemoratio"];
  var RE_CONCL=/^(Per (D[óo]minum|e[úu]ndem)|Qui (vivis|tecum)|Par (notre|Notre|le même)|Vous qui vivez|Lui qui)/;
  function texteDe(h){ return String(h).replace(/<[^>]+>/g,"").trim(); }
  function lignesMesse(cle,la,fr){
    var L=la.split(/\s*<br>\s*/), F=fr.split(/\s*<br>\s*/), sous="";
    if(L.length===F.length){
      if(cle==="introitus"){                                     // l'antienne n'est pas réécrite après le Gloria Patri
        for(var i=0;i<F.length;i++) if(/^℟\.\s*Comme il était/.test(texteDe(F[i]))&&i<F.length-1){
          L=L.slice(0,i+1).concat(['<i class="rub">Repetitur antiphona.</i>']);
          F=F.slice(0,i+1).concat(['<i class="rub">On reprend l’antienne.</i>']); break; }
      }
      if(ORAISONS.indexOf(cle)>=0){                              // conclusion abrégée, sans le ℟ final
        for(var k=0;k<F.length;k++) if(RE_CONCL.test(texteDe(L[k]))||RE_CONCL.test(texteDe(F[k]))){
          var court=function(h){ return texteDe(h).split(/\s+/).slice(0,3).join(" ").replace(/[,:;]$/,"")+"…"; };
          L=L.slice(0,k).concat([court(L[k])]); F=F.slice(0,k).concat([court(F[k])]); break; }
      }
      if(cle==="prefatio"&&F.length>1&&/^<span class="do-rubr"><i>[^<]*<\/i><\/span>$/.test(F[0].trim())){
        sous=texteDe(F[0]); L=L.slice(1); F=F.slice(1);          // « de la Sainte Trinité » passe dans le titre
      }
    }
    return [L.join("<br>"),F.join("<br>"),sous];
  }
  function corpsTextes(d,quoi,greg,j){
    var office=quoi!=="messe"; SOURCES=[];
    // Lectures données le dimanche et aux fêtes de 1re classe
    var dimanche=new Date(j+"T12:00:00Z").getUTCDay()===0 || d.rang===1 || /^1/.test(d.classe||"");
    var texte=office?versets:cols;
    var lignesGreg=(greg&&greg.lignes)||[];
    var blocs=quoi==="messe"?(d.messes||[]):[d];
    if(quoi==="messe"&&d.principal>0){ blocs=[blocs[d.principal]].concat(blocs.filter(function(x,i){return i!==d.principal;})); }
    var html='<p class="fete">'+esc(frTitre(d.titre_fr||d.titre))+(d.classe?' · '+esc(d.classe):'')+'</p>';
    blocs.forEach(function(b){
      if(blocs.length>1) html+='<h2>'+esc(frTitre(b.titre_fr||b.titre))+'</h2>';
      var parties=[];
      if(!office&&!dimanche&&b===blocs[0])                                     // en semaine : prières au bas de l'autel, avant l'Introït
        parties.push({titre:"",corps:'<details class="ord"><summary>Prières au bas de l\'autel</summary>'+versets(AUTEL[0],AUTEL[1])+'</details>'});
      (b.lignes||[]).forEach(function(l,n){
        var la=l[0]||"", fr=l[1]||"", titre=null, cle="", m=fr.match(RE_TITRE), ml=la.match(RE_TITRE);
        if(m){ cle=norm(m[1]); fr=fr.slice(m[0].length); if(ml) la=la.slice(ml[0].length); titre=NOMS_PARTIES[cle]||m[1]; }
        if(/^Prières fériales/.test(fr.replace(/<[^>]+>/g,""))) return;
        var corps="";
        if(!office){
          // Messe : Gloria / Credo dépliables (rien s'ils sont omis) ; lectures seulement le dimanche, en français
          if(cle==="gloria"||cle==="credo"){
            if(!/omit/i.test(la.replace(/<[^>]+>/g,""))) parties.push({titre:"",corps:ordinaire(cle==="gloria"?"Gloria":"Credo")});
            return;
          }
          if(cle==="lectio"||cle==="evangelium"){
            if(dimanche){
              var lect=clair(fr,false).split(/\s*<br>\s*/).filter(function(x){            // l'annonce latine (Léctio…, Sequéntia…) est retirée
                return !/^\s*(L[ée]ctio|Sequ[ée]ntia|In[ií]tium)\b/i.test(x.replace(/<[^>]+>/g,"").replace(/[✠+]/g,""));
              }).join("<br>");
              parties.push({titre:titre,corps:'<div class="lecture" lang="fr">'+lect+'</div>'});
            }
            return;
          }
          if(cle==="communio"&&!dimanche)                                       // en semaine : Ecce Agnus Dei, Domine non sum dignus
            parties.push({titre:"Prière avant la communion",corps:versets(AVANT_COMMUNION[0],AVANT_COMMUNION[1])});
          var r=lignesMesse(cle,clair(la,false),clair(fr,false));
          corps=versets(r[0],r[1]);
          if(cle==="prefatio"){ parties.push({titre:titre,corps:corps,replie:r[2]||""}); return; }
          if(CHANTS.indexOf(cle)>=0) corps='<div class="chant">'+corps+'</div>';
        } else {
          var g=lignesGreg.length===(b.lignes||[]).length?piecesGregoriennes(lignesGreg[n]):{antiennes:[],hymne:null};
          if(g.hymne){                                  // capitule | partition de l'hymne | hymne et verset
            var rf=/<span class="do-rubr"><i>Hymne<\/i><\/span>(\s*<br>)?/, rl=/<span class="do-rubr"><i>Hymnus<\/i><\/span>(\s*<br>)?/;
            var cf=fr.search(rf), cl=la.search(rl);
            if(cf>=0&&cl>=0){
              // partition de l'hymne, puis seulement sa traduction française ; le verset qui suit reste en deux colonnes
              var hl=la.slice(cl).replace(rl,""), hf=fr.slice(cf).replace(rf,""), rv=/<span class="do-rubr"><i>℣\.<\/i><\/span>/;
              var vl=hl.search(rv), vf=hf.search(rv);
              var strophesFr=vf>=0?hf.slice(0,vf):hf, versetFr=vf>=0?hf.slice(vf):"", versetLa=vl>=0?hl.slice(vl):"";
              var tradHymne=clair(strophesFr,true).replace(/(\s*<br>\s*)+$/,"");
              corps=texte(clair(la.slice(0,cl),true),clair(fr.slice(0,cf),true))+'<p class="sous">Hymne</p>'+partition(g.hymne)+
                    (sansTexte(tradHymne)?"":'<p class="trad-ant trad-hymne" lang="fr">'+tradHymne+'</p>')+
                    texte(clair(versetLa,true),clair(versetFr,true));
            } else corps=texte(clair(la,true),clair(fr,true))+partition(g.hymne);
          } else if(troisParts(fr)&&troisParts(la)){      // antienne – psaume – antienne : un groupe bien séparé
            var a=g.antiennes, pf=troisParts(fr), pl=troisParts(la);
            var trad=function(t){ var x=clair(t,true).replace(/\s*[†‡]\s*/g," ").trim(); return sansTexte(x)?"":'<p class="trad-ant" lang="fr">'+x+'</p>'; };
            // titre du psaume (« Psaume 109 ») sorti des colonnes, en tête du groupe
            var RE_TP=/^\s*<br>\s*<span class="do-rubr"><i>([^<]+)<\/i><\/span>\s*(\[\d+\])?\s*(?=<br>)/;
            var tf=pf.corps.match(RE_TP), titrePs=tf?tf[1]:"";
            var corpsFr=tf?pf.corps.replace(RE_TP,""):pf.corps, corpsLa=(tf&&RE_TP.test(pl.corps))?pl.corps.replace(RE_TP,""):pl.corps;
            var ant=function(i,la_,fr_){ return a.length?partition(a[i])+trad(fr_):texte(clair(la_,true),clair(fr_,true)); };
            corps=texte(clair(pl.avant,true),clair(pf.avant,true))+
                  '<div class="psaume">'+ant(0,pl.ouv,pf.ouv)+
                  (titrePs?'<p class="ps-titre">'+esc(titrePs.replace(/\s*;.*$/,""))+'</p>':'')+
                  texte(clair(corpsLa,true),clair(corpsFr,true))+
                  ant(a.length-1,pl.ferm,pf.ferm)+'</div>';
          } else if(g.antiennes.length){
            corps=partition(g.antiennes[0])+texte(clair(la,true),clair(fr,true))+(g.antiennes.length>1?partition(g.antiennes[g.antiennes.length-1]):"");
          } else corps=texte(clair(la,true),clair(fr,true));
        }
        if(titre===null&&parties.length){ parties[parties.length-1].corps+=corps; return; }
        parties.push({titre:titre||"",corps:corps});
      });
      parties.forEach(function(p){
        if(sansTexte(p.corps)&&!/class="(partition|ord)"/.test(p.corps)) return;   // rien quand il n'y a rien
        if(p.replie!==undefined){ html+='<details class="ord"><summary>'+esc(p.titre)+(p.replie?' <span class="sous-titre">— '+esc(p.replie)+'</span>':'')+'</summary>'+p.corps+'</details>'; return; }
        html+=(p.titre?'<h3>'+esc(p.titre)+'</h3>':'')+p.corps;
      });
    });
    return html;
  }
  // Dessine les partitions dans la fenêtre (moteur Exsurge de l'app Messe), et les redessine si la largeur change
  function dessinerPartitions(doc,sources){
    var boites=[].slice.call(doc.querySelectorAll(".partition")); if(!boites.length) return;
    var win=doc.defaultView;
    // place réservée d'avance (estimée d'après le nombre de notes et la largeur) : le texte ne saute pas quand la partition arrive
    boites.forEach(function(b){
      var src=sources[+b.dataset.n]||"", notes=(src.split("%%")[1]||src).match(/\(/g), n=notes?notes.length:20;
      var parLigne=Math.max(8,Math.floor((b.clientWidth||600)/27)), lignes=Math.max(1,Math.ceil(n/parLigne));
      b.style.minHeight=Math.min(1600,lignes*72)+"px";
    });
    function une(boite){
      var ex=win.exsurge, src=sources[+boite.dataset.n];
      return new Promise(function(fin){
        try{
          var ctxt=new ex.ChantContext();
          ctxt.lyricTextFont=ctxt.dropCapTextFont=ctxt.annotationTextFont="'EB Garamond', serif";
          ctxt.lyricTextSize*=1.2; ctxt.spaceBetweenSystems=0;
          var tete=(src.match(/^annotation:\s*([^;]*);/m)||[])[1], lettrine=!/initial-style:\s*0/.test(src);
          var score=new ex.ChantScore(ctxt,ex.Gabc.createMappingsFromSource(ctxt,src),lettrine);
          if(lettrine&&tete) score.annotation=new ex.Annotation(ctxt,tete);
          score.performLayoutAsync(ctxt,function(){ score.layoutChantLines(ctxt,Math.max(240,boite.clientWidth),function(){
            boite.innerHTML=score.createSvg(ctxt); boite.style.minHeight=""; boite.classList.add("prete"); fin(); }); });
        }catch(e){ boite.remove(); fin(); }
      });
    }
    function toutes(){ return boites.reduce(function(p,b){ return p.then(function(){ return b.isConnected?une(b):null; }); },Promise.resolve()); }
    function lancer(){
      toutes(); var largeur=doc.documentElement.clientWidth, attente;
      win.addEventListener("resize",function(){ clearTimeout(attente); attente=setTimeout(function(){
        if(Math.abs(doc.documentElement.clientWidth-largeur)>20){ largeur=doc.documentElement.clientWidth; toutes(); } },300); });
    }
    if(win.exsurge) return lancer();
    var sc=doc.createElement("script"); sc.src=APP+"exsurge.js"; sc.onload=lancer;
    sc.onerror=function(){ boites.forEach(function(b){ b.remove(); }); };   // pas de partitions : le texte reste
    doc.head.appendChild(sc);
  }
  function ouvrirTextes(j,quoi){
    var w=null;   // dans l'app : toujours par-dessus la page
    var date=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(j+"T12:00:00Z"));
    var nom=quoi==="messe"?"Propre de la messe":quoi==="Laudes"?"Laudes":"Vêpres";
    var chargement='<p class="info">Chargement…</p>';
    var afficherDans;
    if(w){                                              // fenêtre ouverte
      w.document.open(); w.document.write(pageTextes(nom,date,chargement,false)); w.document.close();
      afficherDans=function(corps,titre,apres){ w.document.querySelector("main").innerHTML=corps; if(titre) w.document.title=nom+" — "+titre; if(apres) apres(w.document); };
      try{w.focus();}catch(e){}
    } else {                                            // fenêtre bloquée : affichage par-dessus la page
      var ov=document.createElement("div");
      ov.setAttribute("role","dialog"); ov.setAttribute("aria-label",nom);
      ov.style.cssText="position:fixed;inset:0;z-index:2147483000;background:#fffdf8";
      var fr=document.createElement("iframe"); fr.title=nom;
      fr.style.cssText="border:0;width:100%;height:100%;display:block";
      ov.appendChild(fr); document.body.appendChild(ov);
      var defil=document.documentElement.style.overflow; document.documentElement.style.overflow="hidden";
      var fermer=function(){ ov.remove(); document.documentElement.style.overflow=defil; document.removeEventListener("keydown",echap); };
      var echap=function(e){ if(e.key==="Escape") fermer(); };
      document.addEventListener("keydown",echap);
      afficherDans=function(corps,titre,apres){
        fr.srcdoc=pageTextes(nom,date,corps,true);
        fr.onload=function(){ try{ var b=fr.contentDocument.getElementById("fermer"); b.onclick=fermer; b.focus();
          fr.contentDocument.addEventListener("keydown",echap); if(apres) apres(fr.contentDocument); }catch(e){} };
      };
      afficherDans(chargement);
    }
    var a=j.slice(0,4), md=j.slice(5);
    var url=quoi==="messe"?APP+"data/messe/"+a+"/"+md+".json":APP+"data/breviaire/"+a+"/"+md+"/"+quoi+".json";
    var urlGreg=quoi==="Vespera"?APP+"data/breviaire/"+a+"/"+md+"/Vespera-gregorien.json":null;
    var greg=urlGreg?fetch(urlGreg).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}):Promise.resolve(null);
    chargerTitres().then(function(){return Promise.all([fetch(url).then(function(r){if(!r.ok) throw 0;return r.json();}),greg]);})
      .then(function(t){ var d=t[0], corps=corpsTextes(d,quoi,t[1],j), src=SOURCES.slice();
        afficherDans(corps,frTitre(d.titre_fr||d.titre),function(doc){ dessinerPartitions(doc,src); }); })
      .catch(function(){ afficherDans('<p class="info">Les textes de ce jour ne sont pas disponibles.</p>'); });
  }
  // Renvoie null (masqué) ou la description de l'événement
  function classer(brut){
    var t=norm(brut);
    if(CONFIG.masquer.some(function(r){return r.test(t);})) return null;
    var titre=brut;
    CONFIG.anonymiser.forEach(function(a){ if(a[0].test(t)) titre=a[1]; });
    var annule=/^pas de messe/.test(t);
    var messe=!annule && /messe/.test(t);
    return {
      titre:titre, messe:messe, annule:annule,
      mention:!messe?"":/paul vi/.test(t)?"Paul VI":/anticipee/.test(t)?"anticipée":"Missel traditionnel",
      spe:!CONFIG.reguliers.some(function(r){return r.test(t);}),
      alerte:CONFIG.changements.some(function(r){return r.test(t);}),
      plage:/^(adoration|confessions?)\b/.test(t),
      lien:CONFIG.liens.filter(function(l){return l[0].test(t);})[0]||null
    };
  }
  function ranger(items,debut,fin){
    for(var j=debut;j<fin;j=ajout(j,1)) cache[j]={heures:[],fetes:[],alertesJour:[]};   // on repart de zéro : jamais de doublon
    items.forEach(function(ev){
      if(ev.status==="cancelled") return;
      var k=classer(ev.summary); if(!k) return;
      if(ev.start.date){                                   // journée entière
        for(var j=ev.start.date;j<ev.end.date;j=ajout(j,1)) if(j>=debut&&j<fin){
          if(k.alerte){                                    // « Pas de… » sur la journée : dans la liste, en tête
            if(!cache[j].heures.some(function(h){return h.journee&&h.t===k.titre;}))
              cache[j].heures.push({d:new Date(j+"T00:00:00"),f:new Date(ajout(j,1)+"T00:00:00"),t:k.titre,k:k,journee:true});
          } else if(cache[j].fetes.indexOf(k.titre)<0) cache[j].fetes.push(k.titre);
        }
      } else {
        var d=new Date(ev.start.dateTime), j2=cleJour(d);
        var f=ev.end&&ev.end.dateTime?new Date(ev.end.dateTime):null;
        if(!f||f<=d) f=new Date(d.getTime()+60*60000);    // durée inconnue : 1 h
        if(j2>=debut&&j2<fin) cache[j2].heures.push({d:d,f:f,t:k.titre,k:k,lieu:ev.location});
      }
    });
    // Dates du catéchumène (rencontres, scrutins, fraternité…), mises en avant
    (opts.mesDates?opts.mesDates():[]).forEach(function(ev){
      var j=String(ev.date||"").slice(0,10); if(!(j>=debut&&j<fin)) return;
      var k={titre:ev.titre,messe:false,annule:false,mention:"",spe:true,alerte:false,plage:!!ev.heure_fin,lien:null,perso:true};
      if(/^\d{1,2}:\d{2}$/.test(ev.heure_debut||"")){
        var d=new Date(j+"T"+("0"+ev.heure_debut).slice(-5)+":00"), f=/^\d{1,2}:\d{2}$/.test(ev.heure_fin||"")?new Date(j+"T"+("0"+ev.heure_fin).slice(-5)+":00"):new Date(d.getTime()+60*60000);
        cache[j].heures.push({d:d,f:f,t:ev.titre,k:k,lieu:ev.lieu});
      } else cache[j].heures.push({d:new Date(j+"T00:00:00"),f:new Date(ajout(j,1)+"T00:00:00"),t:ev.titre,k:k,lieu:ev.lieu,journee:true});
    });
    for(var j3=debut;j3<fin;j3=ajout(j3,1)){charges[j3]=true;cache[j3].heures.sort(function(a,b){return a.d-b.d;});}
  }
  // Hors connexion : les derniers événements reçus restent sur le téléphone
  function garder(debut,fin,items){ try{ var l=JSON.parse(localStorage.getItem("cg-agenda")||"[]").filter(function(x){return !(x.debut===debut&&x.fin===fin);}); l.unshift({debut:debut,fin:fin,items:items}); localStorage.setItem("cg-agenda",JSON.stringify(l.slice(0,8))); }catch(e){} }
  function garde(debut,fin){ try{ var l=JSON.parse(localStorage.getItem("cg-agenda")||"[]"), vus={}, tout=[];
      l.forEach(function(x){ if(x.fin>debut&&x.debut<fin) x.items.forEach(function(ev){ var c=ev.summary+"|"+JSON.stringify(ev.start); if(!vus[c]){vus[c]=1;tout.push(ev);} }); });
      return l.length?tout:null; }catch(e){ return null; } }
  function charger(centre){
    var debut=ajout(centre,-3), fin=ajout(centre,8);
    if(demo) return Promise.resolve(ranger(donneesDemo(),debut,fin));
    var url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(CONFIG.calendarId)+"/events"+
      "?key="+encodeURIComponent(CONFIG.apiKey)+"&singleEvents=true&orderBy=startTime&maxResults=500&timeZone="+TZ+
      "&timeMin="+ajout(debut,-1)+"T00:00:00Z&timeMax="+ajout(fin,1)+"T00:00:00Z"+
      "&fields="+encodeURIComponent("items(summary,location,start,end,status)");
    var ctrl=window.AbortController?new AbortController():null;
    var minuterie=setTimeout(function(){ if(ctrl) ctrl.abort(); },8000);   // pas de réponse en 8 s → secours
    return fetch(url,ctrl?{signal:ctrl.signal}:{})
      .then(function(r){clearTimeout(minuterie);if(!r.ok) throw new Error("HTTP "+r.status);return r.json();})
      .then(function(d){ ranger(d.items||[],debut,fin); horsLigne=false; R.querySelector(".cg-hl").hidden=true; garder(debut,fin,d.items||[]); })
      .catch(function(e){ clearTimeout(minuterie); var g=garde(debut,fin); if(!g) throw e; ranger(g,debut,fin); R.querySelector(".cg-hl").hidden=false; });
  }
  /* ---------- Ligne résumé ---------- */
  function messesDu(j){ return (cache[j]||{heures:[]}).heures.filter(function(h){return h.k.messe;}); }
  function listeMesses(ms,now){
    return ms.map(function(h){
      return '<span class="'+(h.f<now?"fini":"")+'"><b>'+heure(h.d)+'</b>'+(h.k.mention?' <span class="q">('+h.k.mention+')</span>':'')+'</span>';
    }).join('<span class="sep"> · </span>');
  }
  function nomJour(j){
    if(j===aujourdhui) return "aujourd'hui";
    if(j===ajout(aujourdhui,1)) return "demain";
    return new Intl.DateTimeFormat("fr-FR",{weekday:"long",timeZone:"UTC"}).format(new Date(j+"T12:00:00Z"));
  }
  function prochaineApres(j0,now){
    for(var i=0;i<8;i++){
      var j=ajout(j0,i), m=messesDu(j).filter(function(h){return h.d>now;})[0];
      if(m) return nomJour(j)+" "+heure(m.d)+(m.k.mention?" ("+m.k.mention+")":"");
    }
    return "";
  }
  function majResume(){
    if(horsLigne) return;
    var now=new Date(), txt="", jr=aujourdhui;
    var auj=messesDu(aujourdhui), restantes=auj.filter(function(h){return h.f>now;});
    if(restantes.length){
      txt=(auj.length>1?"Messes":"Messe")+" aujourd'hui : "+listeMesses(auj,now);
    } else if(auj.length){                                   // le soir : messes de demain
      jr=ajout(aujourdhui,1);
      var dem=messesDu(jr);
      if(dem.length) txt=(dem.length>1?"Messes":"Messe")+" demain : "+listeMesses(dem,now);
      else { var p=prochaineApres(ajout(aujourdhui,2),now); txt="Pas de messe demain"+(p?' <span class="q">— prochaine : '+p+'</span>':""); }
    } else {
      var p2=prochaineApres(aujourdhui,now);
      txt="Pas de messe aujourd'hui"+(p2?' <span class="q">— prochaine : '+p2+'</span>':"");
    }
    // En cours maintenant
    var live=(cache[aujourdhui]||{heures:[]}).heures.filter(function(h){return !h.journee&&!h.k.alerte&&h.d<=now&&now<h.f;})
      .map(function(h){return esc(h.t)+" en cours · jusqu'à "+heure(h.f);});
    prochain.innerHTML=
      (live.length?'<span class="cg-live">'+live.join(" — ")+'</span>':"")+
      txt;
  }
  /* ---------- Carte du jour ---------- */
  function afficher(){
    if(horsLigne) return;
    var d=new Date(jour+"T12:00:00Z");
    var lib=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(d);
    $(".cg-num").textContent=(jour===aujourdhui?"Aujourd'hui, ":jour===ajout(aujourdhui,1)?"Demain, ":"")+lib;
    btnAuj.hidden=(jour===aujourdhui);
    if(!charges[jour]){
      liste.classList.add("ch");
      if(!enCours[jour]){ var jc=jour; enCours[jc]=true; charger(jc).then(function(){delete enCours[jc]; afficher();}).catch(function(e){delete enCours[jc]; erreur(e);}); }
      return;
    }
    liste.classList.remove("ch");
    var c=cache[jour], now=new Date();
    var fj=feteDu(jour);
    $(".cg-fetes").innerHTML=[htmlFete(fj)].concat(c.fetes.map(function(t){ var k=classer(t)||{}; return k.lien?titreAvecLien({t:t,k:k}):esc(t); })).filter(Boolean).join(" · ");
    var html=demo?'<li class="cg-demo">Aperçu avec des données d\'exemple — l\'agenda réel s\'affiche sur le site publié</li>':"";
    var items=filtre==="messes"?c.heures.filter(function(h){return h.k.messe||h.k.annule;}):c.heures;
    R.querySelectorAll(".cg-filtre button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.f===filtre);});
    html+=items.length?items.map(function(h){
      var encours=!h.journee&&h.d<=now&&now<h.f, passe=h.f<=now;
      var cl=(h.k.perso?"perso ":"")+(h.k.spe?"spe ":"")+(h.k.annule?"annule ":"")+(h.k.alerte?"alerte ":"")+(encours?"encours ":"")+(passe?"passe":"");
      return '<li class="'+cl+'"><time'+(h.journee?' class="jr">Journée':'>'+heure(h.d)+(h.k.plage?' – '+heure(h.f):''))+'</time><span>'+titreAvecLien(h)+
        (h.k.mention==="Missel traditionnel"?' <em class="trad">(Missel traditionnel)</em>':'')+
        lienTextes(h,jour)+
        (h.k.perso?'<em class="cg-perso">pour vous</em>':'')+
        (encours?'<em class="cg-badge">en cours</em>':'')+
        (h.k.spe&&h.lieu?'<span class="lieu">'+esc(h.lieu)+'</span>':'')+'</span></li>';
    }).join(""):'<li class="cg-info">'+(filtre==="messes"?"Aucune messe ce jour.":"Aucun office prévu ce jour.")+'</li>';
    liste.innerHTML=html;
    liste.classList.toggle("plages",items.some(function(h){return h.k.plage;}));   // colonne large seulement s'il y a des plages horaires
    if(sens){ liste.classList.remove("g","d"); void liste.offsetWidth; liste.classList.add(sens<0?"g":"d"); sens=0; }
    majResume();
  }
  var ICO_GROUPE='<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 3C6.9 3 3 6.6 3 11.1c0 2.4 1.1 4.5 3 6L5.3 21l4-2.1c.9.2 1.8.3 2.7.3 5.1 0 9-3.6 9-8.1S17.1 3 12 3zm-4 9.3a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm4 0a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm4 0a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4z"></path></svg>';
  function titreAvecLien(h){
    var L=h.k.lien, t=esc(h.t);
    if(!L) return t;
    if(L[2]==="don") return '<a class="cg-lienpage" href="'+esc(L[1])+'" target="_blank" rel="noopener">'+t+' <span aria-hidden="true">›</span></a>';
    if(L[2]==="page") return '<a class="cg-lienpage" href="'+esc(L[1])+'">'+t+' <span aria-hidden="true">›</span></a>';
    return t+' <a class="cg-groupe" href="'+esc(L[1])+'" target="_blank" rel="noopener">'+ICO_GROUPE+'Groupe WhatsApp</a>';
  }
  /* ---------- Secours si Google ne répond pas ---------- */
  function erreur(e){
    console.warn("Agenda paroissial :",e);
    if(!/croix-glorieuse\.org$/.test(location.hostname)&&!demo){demo=true;cache={};charges={};afficher();return;}
    liste.classList.remove("ch");
    liste.innerHTML='<li class="cg-info">Agenda indisponible pour le moment (pas de connexion ?). <a href="'+CONFIG.pageSecours+'" target="_blank" rel="noopener">Horaires sur le site</a></li>';
  }
  /* ---------- Ouverture : clic (épingle) ou survol (ordinateur) ---------- */
  function ouvrir(o){ /* dans l'app, l'agenda reste ouvert */ }
  resume.addEventListener("click",function(){
    if(R.classList.contains("ouvert")&&epingle){epingle=false;ouvrir(false);}   // 2e clic : referme
    else {epingle=true;ouvrir(true);}                                          // 1er clic : ouvre et garde ouvert
  });
  if(window.matchMedia&&matchMedia("(hover:hover) and (pointer:fine)").matches){
    var tm;
    R.addEventListener("mouseenter",function(){clearTimeout(tm);ouvrir(true);});
    R.addEventListener("mouseleave",function(){if(!epingle) tm=setTimeout(function(){ouvrir(false);},400);});
  }
  // Les textes s'ouvrent dans une fenêtre à part (un nouvel onglet sur téléphone)
  liste.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest("a.cg-textes"); if(!a) return;
    e.preventDefault(); ouvrirTextes(a.dataset.j,a.dataset.q);
  });
  /* ---------- Navigation : boutons, glisser, clavier ---------- */
  function aller(n){ sens=n===0?(jour>aujourdhui?-1:1):n; jour=n===0?aujourdhui:ajout(jour,n); afficher(); }
  $(".cg-prec").addEventListener("click",function(){aller(-1);});
  $(".cg-suiv").addEventListener("click",function(){aller(1);});
  btnAuj.addEventListener("click",function(){aller(0);});
  R.querySelectorAll(".cg-filtre button").forEach(function(b){
    b.addEventListener("click",function(){
      filtre=b.dataset.f; try{localStorage.setItem("cg-filtre",filtre);}catch(e){}
      afficher();
    });
  });
  var x0=null,y0=null, p=$(".cg-interieur");
  p.addEventListener("touchstart",function(e){x0=e.touches[0].clientX;y0=e.touches[0].clientY;},{passive:true});
  p.addEventListener("touchend",function(e){
    if(x0===null) return;
    var dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5) aller(dx<0?1:-1);
  });
  // Flèches ← → : seulement quand le bloc est ouvert et que la souris ou le focus est dessus
  document.addEventListener("keydown",function(e){
    if(!R.classList.contains("ouvert")||e.altKey||e.ctrlKey||e.metaKey) return;
    if(!(R.matches(":hover")||R.contains(document.activeElement))) return;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||"")) return;
    if(e.key==="ArrowLeft"){aller(-1);e.preventDefault();}
    else if(e.key==="ArrowRight"){aller(1);e.preventDefault();}
    else if(e.key==="Escape"){epingle=false;ouvrir(false);}
  });
  // Mise à jour chaque minute (en cours, messes passées, changement de jour)
  setInterval(function(){
    if(horsLigne) return;
    if(cleJour(new Date())!==aujourdhui){aujourdhui=cleJour(new Date());jour=aujourdhui;}
    afficher();
  },60000);
  function donneesDemo(){
    var a=aujourdhui,out=[];
    function e(j,h,t,l,h2){out.push({summary:t,location:l,start:{dateTime:ajout(a,j)+"T"+h+":00+01:00"},end:h2?{dateTime:ajout(a,j)+"T"+h2+":00+01:00"}:undefined});}
    function f(j,t){out.push({summary:t,start:{date:ajout(a,j)},end:{date:ajout(a,j+1)}});}
    f(0,"1er vendredi du mois");
    e(0,"07:40","Laudes");e(0,"12:15","Messe");e(0,"15:00","Adoration",null,"18:00");e(0,"18:00","Vêpres");
    e(0,"18:30","Pas de Messe");e(0,"19:00","Confession",null,"20:00");e(0,"21:30","Conférence Alsatia","Salle paroissiale");e(2,"11:30","Patronage");e(2,"19:30","Enseignement Etudiants et Jeunes professionnels");e(2,"20:00","Catéchisme élémentaire pour les adultes");
    f(1,"St Florent");f(3,"Pas de catéchisme (vacances scolaires)");e(1,"09:45","Quête chauffage et entretien");f(2,"Quête chauffage et entretien");
    e(1,"07:40","Laudes");e(1,"08:00","Adoration",null,"08:55");e(1,"08:00","Confession",null,"09:00");e(1,"09:00","Messe");
    e(1,"14:00","Baptême Jean Dupont");e(1,"15:45","Chapelet du 1er samedi du mois");
    e(1,"17:00","Messe anticipée (missel de Paul VI)");
    e(2,"07:40","Laudes");e(2,"09:00","Messe");e(2,"10:30","Grand'Messe");
    e(2,"18:00","Vêpres et Salut du Saint Sacrement");e(2,"19:00","Messe");
    return out;
  }
  chargerTitres().then(chargerCalendrier).then(afficher);
  afficher();
  return { element:R, rafraichir:function(){ cache={}; charges={}; afficher(); } };
};
})();
