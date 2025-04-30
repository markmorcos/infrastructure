<script lang="ts">
  import { fly } from "svelte/transition";
</script>

<section
  id="contact"
  class="section"
  in:fly={{ y: 50, duration: 800, delay: 600 }}
>
  <h2>Get in touch</h2>
  <div class="contact-info">
    <a href="mailto:mark.yehia@gmail.com" class="contact-link">📧 Email me</a>
    <a href="https://github.com/markmorcos" target="_blank" class="contact-link"
      >💻 GitHub</a
    >
    <a
      href="https://linkedin.com/in/markmorcos"
      target="_blank"
      class="contact-link">🔗 LinkedIn</a
    >
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
</style>
