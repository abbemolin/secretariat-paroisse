// Gabarit de la newsletter : copie exacte de newsletter.html (AppMesse) — genAnnonceHTML et genEmailHTML.
import { escHtml } from './semaine.js'

export const NL_DOCTYPE = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">'
// Séparateur entre deux annonces
export const NL_SEP_HTML = `<table data-nl-sep="1" cellspacing="0" cellpadding="0" border="0" width="100%" style="table-layout:fixed;width:100%"><tbody><tr><td style="border-top:1px solid #E0D3C1;"></td></tr></tbody></table>`

/** Objet du mail : « Annonces paroissiales — semaine du … au … » */
export function sujetNewsletter(lundi) {
  const l = new Date(lundi + 'T12:00:00'), dim = new Date(l); dim.setDate(l.getDate() + 6)
  const opts = { day: 'numeric', month: 'long' }
  return `Annonces paroissiales — semaine du ${l.toLocaleDateString('fr-FR', opts)} au ${dim.toLocaleDateString('fr-FR', opts)}`
}

export function genAnnonceHTML(a) {
  // Style C — titre bleu en grand, image petite à droite, bouton pill discret

  const prioBadge = a.prioritaire
    ? `<div style="display:inline-block;font-size:10px;font-weight:bold;letter-spacing:.15em;text-transform:uppercase;color:#023199;margin-bottom:5px;">À la une</div><br>`
    : '';

  const eventHtml = a.event_date
    ? `<div style="font-size:13px;color:#8b2020;font-style:italic;margin-bottom:8px;">${new Date(a.event_date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}${a.event_heure?' à '+a.event_heure.slice(0,5):''}</div>`
    : '';

  const descHtml = a.description
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#333;">${escHtml(a.description).replace(/\n/g,'<br>')}</p>`
    : '';

  const lienHtml = a.lien
    ? `<table data-nl-bouton="1" cellpadding="0" cellspacing="0" border="0"><tbody><tr>
        <td style="border:1px solid #023199;border-radius:20px;padding:5px 16px;">
          <a href="${escHtml(a.lien)}" target="_blank" style="color:#023199;text-decoration:none;font-size:13px;font-weight:bold;font-family:Palatino,Georgia,serif;">${escHtml(a.lien_label||'En savoir plus')}</a>
        </td>
       </tr></tbody></table>`
    : '';

  const imgPart = a.image_url
    ? `<td width="90" valign="top" style="width:90px;padding:16px 16px 16px 0;">
        <img src="${escHtml(a.image_url)}" width="90" height="90" border="0"
          style="display:block;width:90px;height:90px;object-fit:cover;border-radius:8px;" alt="${escHtml(a.titre)}"/>
      </td>`
    : '';

  const textWidth = a.image_url ? 'calc(100% - 106px)' : '100%';

  return `<table data-annonce-id="${escHtml(String(a.id))}" cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%"
    style="table-layout:fixed;width:100%;background:#ffffff;border-bottom:2px solid #EADFCC;">
    <tbody><tr>
      <td style="padding:16px 20px;">
        <table cellspacing="0" cellpadding="0" border="0" width="100%"><tbody><tr>
          <td valign="top">
            ${prioBadge}
            <h3 style="margin:0 0 5px;font-family:Palatino,Georgia,serif;font-size:18px;color:#023199;line-height:1.3;">${escHtml(a.titre)}</h3>
            ${eventHtml}
            ${descHtml}
            ${lienHtml}
          </td>
          ${imgPart}
        </tr></tbody></table>
      </td>
    </tr></tbody></table>`;
}

export function genEmailHTML(calendrierHtml, annoncesActives) {
  // Section toujours présente (masquée si vide) pour pouvoir y ajouter une annonce dans l'aperçu
  let annoncesSection = '';
  {
    const annonceItems = annoncesActives.map(genAnnonceHTML).join(NL_SEP_HTML);
    const vide = annoncesActives.length === 0;
    annoncesSection = `<div data-nl-zone="annonces"${vide ? ' data-nl-hidden="1" style="display:none"' : ''}>
      <!-- SECTION INFORMATIONS -->
      <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%"><tbody><tr>
        <td style="background-color:#FFFFFF;padding-top:20px;padding-bottom:10px;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tbody><tr>
            <th width="100%" style="font-weight:normal" valign="top">
              <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%"><tbody><tr>
                <td valign="top" style="padding-right:15px;padding-left:15px">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tbody><tr>
                    <td align="left" style="color:#333333;font-family:Palatino;font-size:16px;line-height:1.6;word-break:break-word;text-align:left;padding-top:15px;valign:top">
                      <h1 style="margin:0;color:#302e2f;font-family:Palatino;font-size:28px;text-align:center;">INFORMATIONS</h1>
                    </td>
                  </tr></tbody></table>
                </td>
              </tr></tbody></table>
            </th>
          </tr></tbody></table>
        </td>
      </tr></tbody></table>
      <!-- Annonces -->
      <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%"><tbody><tr>
        <td data-nl-annonces-liste="1" style="background-color:#FFFFFF;padding-top:0;padding-bottom:20px;">
          ${annonceItems}
        </td>
      </tr></tbody></table>
      </div>`;
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Annonces paroissiales</title>
<style type="text/css">
body { background-color:#FBFBF9; margin:0; padding:0; font-family:Palatino,Georgia,serif; }
table td { border-collapse:collapse; }
img { outline:none; text-decoration:none; border:none; }
a { color:#023199; text-decoration:none; }
p, h1, h2, h3 { margin:0; }
</style>
</head>
<body bgcolor="#FBFBF9" style="background-color:#FBFBF9;">
<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="background-color:#FBFBF9;width:100%"><tbody><tr><td>

<!-- Wrapper : 600px max, fluide sur téléphone (table fantôme pour Outlook) -->
<!--[if mso]><table width="600" align="center" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td><![endif]-->
<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" style="table-layout:fixed;width:100%;max-width:600px;margin:0 auto;"><tbody><tr><td style="background-color:#FBFBF9;">

<!-- Lien miroir -->
<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%"><tbody><tr>
  <td style="color:#333333;font-family:Palatino;font-size:16px;line-height:1.6;text-align:center;padding:20px 30px;">
    <p style="margin:0"><a href="{{ mirror }}" style="color:#023199;"><span style="font-size:12px;"><u>Afficher dans le navigateur</u></span></a></p>
  </td>
</tr></tbody></table>

<!-- Header blanc : social + logo + bouton -->
<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%;background:#fff;"><tbody>
<tr>
  <td style="padding-top:12px;padding-bottom:3px;text-align:center;">
    <p style="margin:0;text-align:center;"><a href="https://chat.whatsapp.com/BWfpf5rkl5WJX1rIuRb1kq" style="font-size:13px;color:#555555;text-decoration:none;">Suivez la paroisse sur Instagram et rejoignez la communauté <strong style="color:#023199;">WhatsApp</strong></a></p>
  </td>
</tr>
<tr>
  <td align="center" style="padding:15px 0;">
    <a href="https://www.instagram.com/paroissesaintlouis/" target="_blank" style="color:#023199;"><img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/instagram_32px.png" width="32" border="0" style="display:inline-block;"/></a>
    &nbsp;&nbsp;
    <a href="https://chat.whatsapp.com/BWfpf5rkl5WJX1rIuRb1kq" target="_blank" style="color:#023199;"><img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/whatsapp_32px.png" width="32" border="0" style="display:inline-block;"/></a>
  </td>
</tr>
<tr>
  <td align="center" style="padding-bottom:15px;">
    <a href="https://www.croix-glorieuse.org/" target="_blank"><img src="https://img.mailinblue.com/4217578/images/content_library/original/65d519ffb78af54a7e910476.png" width="208" border="0" style="display:block;margin:0 auto;"/></a>
  </td>
</tr>
<tr>
  <td align="center" style="padding-bottom:15px;">
    <a href="https://www.croix-glorieuse.org/horaires" target="_blank" style="font-style:normal;font-weight:bold;line-height:1.15;text-decoration:none;display:inline-block;background-color:#023199;border-radius:20px;padding:12px 20px;font-size:15px;font-family:Palatino,Georgia,serif;color:#fff;">Voir le calendrier complet</a>
  </td>
</tr>
<tr>
  <td style="padding:0 15px;"><table width="100%" height="1" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #E0D3C1;font-size:1px;line-height:1px;"><tbody><tr><td height="0"></td></tr></tbody></table></td>
</tr>
</tbody></table>

${annoncesSection}

<!-- SECTION CALENDRIER -->
<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%"><tbody><tr>
  <td style="background-color:#FFFFFF;padding-top:20px;padding-bottom:10px;">
    <table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>
      <td align="left" style="text-align:left;padding:0 15px 15px;">
        <h1 style="margin:0;color:#302e2f;font-family:Palatino;font-size:28px;text-align:center;">CALENDRIER</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:0 15px 20px;">
        <div data-nl-zone="calendrier">${calendrierHtml}</div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom:20px;">
        <a href="https://www.instagram.com/paroissesaintlouis/" target="_blank"><img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/instagram_32px.png" width="32" border="0" style="display:inline-block;"/></a>
        &nbsp;&nbsp;
        <a href="https://www.croix-glorieuse.org" target="_blank"><img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/website_32px.png" width="32" border="0" style="display:inline-block;"/></a>
        &nbsp;&nbsp;
        <a href="https://chat.whatsapp.com/BWfpf5rkl5WJX1rIuRb1kq" target="_blank"><img src="https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/whatsapp_32px.png" width="32" border="0" style="display:inline-block;"/></a>
      </td>
    </tr>
    </tbody></table>
  </td>
</tr></tbody></table>

<!-- Footer -->
<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%;background:#fbfbf9;"><tbody><tr>
  <td style="padding:25px 20px;text-align:center;">
    <strong style="font-family:Palatino;font-size:14px;color:#100D0D;">Paroisse personnelle La Croix glorieuse à Strasbourg</strong><br>
    <span style="font-family:Palatino;font-size:14px;color:#100D0D;">&nbsp;</span><br>
    <strong style="font-family:Palatino;font-size:14px;color:#100D0D;">2 quai Charles Frey 67000 Strasbourg</strong>
  </td>
</tr></tbody></table>
<table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" style="table-layout:fixed;width:100%;background:#FBFBF9;"><tbody><tr>
  <td style="padding:15px;text-align:center;">
    <a href="{{ unsubscribe }}" target="_blank" style="font-family:Palatino;font-size:14px;color:#023199;text-decoration:none;">Se désinscrire</a>
  </td>
</tr></tbody></table>

</td></tr></tbody></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></tbody></table>
</body></html>`;
}
