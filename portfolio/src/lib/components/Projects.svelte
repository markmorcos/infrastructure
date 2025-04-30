<script lang="ts">
  import { fly } from "svelte/transition";
</script>

<section
  id="projects"
  class="section"
  in:fly={{ y: 50, duration: 800, delay: 400 }}
>
  <h2>Featured projects</h2>
  <div class="projects-grid">
    <div class="project-card">
      <h3>Home Server</h3>
      <p>A self-hosted cloud solution for personal data management</p>
      <a
        href="https://github.com/markmorcos/home-server"
        target="_blank"
        class="project-link">View project →</a
      >
    </div>
    <div class="project-card">
      <h3>Portfolio Website</h3>
      <p>This modern, responsive portfolio built with Svelte</p>
      <a
        href="https://github.com/markmorcos/home-server/portfolio"
        target="_blank"
        class="project-link">View project →</a
      >
    </div>
  </div>
</section>

<style>
  .section {
    padding: 2rem 0;
  }

  h2 {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 3rem;
    color: #f8fafc;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .project-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 1rem;
    padding: 2rem;
    transition: transform 0.3s ease;
  }

  .project-card:hover {
    transform: translateY(-5px);
  }

  .project-card h3 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
    color: #f8fafc;
  }

  .project-card p {
    color: #94a3b8;
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  .project-link {
    color: #60a5fa;
    text-decoration: none;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .projects-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
