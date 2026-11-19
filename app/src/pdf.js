// Fabrique un PDF A4 fidèle à partir du HTML d'un formulaire (rendu image haute définition).
import h2cUrl from 'html2canvas/dist/html2canvas.min.js?url'

export async function htmlVersPdf(html) {
  const { jsPDF } = await import('jspdf')
  const cadre = document.createElement('iframe')
  Object.assign(cadre.style, { position: 'fixed', left: '-10000px', top: '0', width: '794px', height: '1123px', border: '0' })
  document.body.appendChild(cadre)
  try {
    await new Promise((ok) => {
      cadre.onload = ok
      // html2canvas est chargé DANS le cadre, pour un rendu identique à l'aperçu
      cadre.srcdoc = html.replace('</head>', `<style>body{background:#fff!important}.page{box-shadow:none!important;margin:0!important}</style><script src="${new URL(h2cUrl, location.href).href}"></script></head>`)
    })
    const doc = cadre.contentDocument
    await Promise.all([...doc.images].map((im) => (im.complete ? null : new Promise((ok) => { im.onload = ok; im.onerror = ok }))))
    if (doc.fonts?.ready) await doc.fonts.ready
    const page = doc.querySelector('.page') || doc.body
    const canvas = await cadre.contentWindow.html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 794 })
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const h = Math.min(297, (canvas.height * 210) / canvas.width)
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, h)
    return { base64: pdf.output('datauristring').split(',')[1], blob: pdf.output('blob') }
  } finally {
    cadre.remove()
  }
}

export function telechargerBlob(blob, nom) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nom; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
