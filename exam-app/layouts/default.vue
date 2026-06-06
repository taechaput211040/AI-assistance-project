<script setup>
const chatOpen = useState('chat-open', () => true)
</script>

<template>
  <div class="app" :class="{ 'chat-open': chatOpen }">
    <NuxtLoadingIndicator color="#7a9b56" :height="4" />
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">G</div>
        <div>
          <b>Game Insight Suite</b>
          <small>Data &amp; Tools</small>
        </div>
      </div>
      <nav class="nav">
        <NuxtLink to="/dashboard"><span class="ic">📊</span> Dashboard <span class="num">01</span></NuxtLink>
        <NuxtLink to="/gacha"><span class="ic">🎰</span> Gacha Simulator <span class="num">02</span></NuxtLink>
        <NuxtLink to="/restaurant"><span class="ic">🍜</span> Restaurant Finder <span class="num">03</span></NuxtLink>
      </nav>
      <div class="side-foot">
        Built with Nuxt 3 · Vue 3<br />
        Deployed on Vercel
      </div>
    </aside>
    <main class="main">
      <slot />
    </main>
    <AiChat />
  </div>
</template>
<!-- end -->
