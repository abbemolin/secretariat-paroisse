import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
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
