<script lang="ts">
  import { fly } from "svelte/transition";
</script>

<section class="hero" in:fly={{ y: 50, duration: 800 }}>
  <h1>Mark Morcos</h1>
  <p class="subtitle">Senior Software Engineer</p>
  <div class="cta-buttons">
    <a href="#projects" class="cta-button primary">View my work</a>
    <a href="#contact" class="cta-button secondary">Get in touch</a>
  </div>
</section>

<style>
  .hero {
    text-align: center;
    padding: 2rem 0;
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
    margin: 1rem 0 2rem;
  }

  .cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }

  .cta-button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-decoration: none;
    transition: transform 0.2s ease;
  }

  .cta-button:hover {
    transform: translateY(-2px);
  }

  .cta-button.primary {
    background: #3b82f6;
    color: white;
  }

  .cta-button.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 3rem;
    }

    .subtitle {
      font-size: 1.25rem;
    }

    .cta-buttons {
      flex-direction: column;
    }
  }
</style>
