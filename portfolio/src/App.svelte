<script lang="ts">
  import { fade, fly } from "svelte/transition";
</script>

<main>
  <div class="container" in:fade={{ duration: 1000 }}>
    <!-- Hero Section -->
    <section class="hero" in:fly={{ y: 50, duration: 800 }}>
      <h1>Mark Morcos</h1>
      <p class="subtitle">Senior Software Engineer</p>
      <div class="cta-buttons">
        <a href="#projects" class="cta-button primary">View my work</a>
        <a href="#contact" class="cta-button secondary">Get in touch</a>
      </div>
    </section>

    <!-- Skills Section -->
    <section
      id="skills"
      class="section"
      in:fly={{ y: 50, duration: 800, delay: 200 }}
    >
      <h2>Skills and expertise</h2>
      <div class="skills-grid">
        <div class="skill-card">
          <div class="icon">💻</div>
          <h3>Frontend</h3>
          <p>React, Node, Rails, TypeScript, HTML/CSS</p>
        </div>
        <div class="skill-card">
          <div class="icon">⚙️</div>
          <h3>Backend</h3>
          <p>Node.js, Python, SQL, REST APIs</p>
        </div>
        <div class="skill-card">
          <div class="icon">☁️</div>
          <h3>Cloud and DevOps</h3>
          <p>AWS, Docker, Kubernetes, CI/CD</p>
        </div>
      </div>
    </section>

    <!-- Projects Section -->
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

    <!-- Contact Section -->
    <section
      id="contact"
      class="section"
      in:fly={{ y: 50, duration: 800, delay: 600 }}
    >
      <h2>Get in touch</h2>
      <div class="contact-info">
        <a href="mailto:mark.yehia@gmail.com" class="contact-link"
          >📧 Email me</a
        >
        <a
          href="https://github.com/markmorcos"
          target="_blank"
          class="contact-link">💻 GitHub</a
        >
        <a
          href="https://linkedin.com/in/markmorcos"
          target="_blank"
          class="contact-link">🔗 LinkedIn</a
        >
      </div>
    </section>
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

  .section {
    padding: 2rem 0;
  }

  h2 {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 3rem;
    color: #f8fafc;
  }

  .skills-grid,
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .skill-card,
  .project-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 1rem;
    padding: 2rem;
    transition: transform 0.3s ease;
  }

  .skill-card:hover,
  .project-card:hover {
    transform: translateY(-5px);
  }

  .icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .skill-card h3,
  .project-card h3 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
    color: #f8fafc;
  }

  .skill-card p,
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

  .contact-info {
    display: flex;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .contact-link {
    color: #f8fafc;
    text-decoration: none;
    font-size: 1.25rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    transition: background 0.3s ease;
  }

  .contact-link:hover {
    background: rgba(255, 255, 255, 0.1);
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

    .skills-grid,
    .projects-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
