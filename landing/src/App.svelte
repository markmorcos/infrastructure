<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";

  let showContent = false;

  onMount(() => {
    setTimeout(() => {
      showContent = true;
    }, 500);
  });
</script>

<main>
  <div class="container" in:fade={{ duration: 1000 }}>
    {#if showContent}
      <div class="content" in:fly={{ y: 50, duration: 800 }}>
        <h1>Home Server</h1>
        <p class="subtitle">Your personal cloud</p>

        <div class="features">
          <div class="feature" in:fly={{ y: 50, duration: 800, delay: 200 }}>
            <div class="icon">🏠</div>
            <h3>Self-Hosted</h3>
            <p>Complete control over your data</p>
          </div>

          <div class="feature" in:fly={{ y: 50, duration: 800, delay: 400 }}>
            <div class="icon">⚡</div>
            <h3>Powerful</h3>
            <p>Run multiple services seamlessly</p>
          </div>

          <div class="feature" in:fly={{ y: 50, duration: 800, delay: 600 }}>
            <div class="icon">🔒</div>
            <h3>Secure</h3>
            <p>Your data stays with you</p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
  }

  .content {
    text-align: center;
    max-width: 800px;
  }

  h1 {
    font-size: 4rem;
    font-weight: 800;
    margin: 0;
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 1.5rem;
    color: #94a3b8;
    margin: 1rem 0 3rem;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    margin-top: 4rem;
  }

  .feature {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 1rem;
    padding: 2rem;
    transition: transform 0.3s ease;
  }

  .feature:hover {
    transform: translateY(-5px);
  }

  .icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .feature h3 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
    color: #f8fafc;
  }

  .feature p {
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 3rem;
    }

    .subtitle {
      font-size: 1.25rem;
    }

    .features {
      grid-template-columns: 1fr;
    }
  }
</style>
