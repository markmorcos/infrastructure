<script lang="ts">
  import { fly } from "svelte/transition";
</script>

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

  .skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .skill-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 1rem;
    padding: 2rem;
    transition: transform 0.3s ease;
  }

  .skill-card:hover {
    transform: translateY(-5px);
  }

  .icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .skill-card h3 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
    color: #f8fafc;
  }

  .skill-card p {
    color: #94a3b8;
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .skills-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
