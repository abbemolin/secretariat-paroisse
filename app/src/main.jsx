import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
// Polices servies par l'appli elle-même (plus d'attente de Google à l'ouverture) — les mêmes qu'avant
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './index.css'
import App from './App.jsx'
import { appliquerAffichage } from './affichage.js'
import { chargerCacheLocal } from './api.js'

appliquerAffichage()

// Les copies gardées sur l'appareil sont lues avant le premier affichage (affichage instantané, hors connexion)
chargerCacheLocal().finally(() => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
))
