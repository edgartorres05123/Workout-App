import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // O service worker novo toma conta logo e a página recarrega sozinha (ver src/main.jsx)
      registerType: 'autoUpdate',
      injectRegister: false,
      // Os ícones já entram na pré-cache pelo globPatterns (evita entradas repetidas)
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Workout App',
        short_name: 'Workout',
        description: 'Registo pessoal de treinos de ginásio',
        lang: 'pt-PT',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#121212',
        theme_color: '#121212',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Só o "esqueleto" da app: HTML, JS, CSS, ícones e fontes
        globPatterns: ['**/*.{html,js,css,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // A versão nova ativa-se logo e toma conta das páginas abertas (que depois recarregam)
        skipWaiting: true,
        clientsClaim: true,
        // Os pedidos ao Supabase vão SEMPRE à rede e nunca ficam em cache
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
