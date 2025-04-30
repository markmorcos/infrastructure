<script lang="ts">
  import { fade } from "svelte/transition";
  import Hero from "./lib/components/Hero.svelte";
  import Skills from "./lib/components/Skills.svelte";
  import Projects from "./lib/components/Projects.svelte";
  import Contact from "./lib/components/Contact.svelte";
</script>

<main>
  <div class="container" in:fade={{ duration: 1000 }}>
    <Hero />
    <Skills />
    <Projects />
    <Contact />
  </div>
</main>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
</style>
