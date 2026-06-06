// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  devServer: { port: 5000 },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Game Insight Suite',
      htmlAttrs: { lang: 'th' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Player Feedback Insight Report, Gacha Simulator, Restaurant Finder' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Pixelify+Sans:wght@400;500;600;700&family=Press+Start+2P&display=swap' }
      ]
    }
  }
})
