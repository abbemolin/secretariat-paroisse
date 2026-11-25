import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'], globIgnores: ['{premiere-communion,profession-de-foi,demande-bapteme,demande-mariage,bapteme-adulte,confirmation-adulte,accord-bapteme,certificat-parrain,confirmation-jeunes,depot,lettre-recommandation,fraternite,rejoindre,retraite,paiement,livres,formulaires}/**'] },
      includeAssets: ['logo.png', 'logo-128.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Secrétariat – La Croix glorieuse',
        short_name: 'Secrétariat',
        description: 'Secrétariat de la paroisse La Croix glorieuse',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#faf7f2',
        theme_color: '#521a22',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // Raccourcis (appui long sur l'icône, Android)
        shortcuts: [
          { name: 'Bréviaire', short_name: 'Bréviaire', url: './#/breviaire', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Intentions de messe — Aujourd\'hui', short_name: 'Intentions', url: './#/intentions', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Bible', short_name: 'Bible', url: './#/bible', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] }
        ]
      }
    })
  ]
})
