import { leaSections, type SeedSection } from "../seed";

// The "therapist" preset: the section schemas a practitioner site is seeded with
// (currently the same structure the renderer expects) plus neutral, editable
// placeholder copy in de + en. Spawning a site upserts these sections and imports
// this content so the new site renders a complete — but obviously generic — page
// the owner then customizes. No personal or legal specifics here; legal sections
// prompt the owner to fill in their own details.

export const THERAPIST_SECTIONS: SeedSection[] = leaSections();

// importDict payload shape: { [locale]: Dict }. Mirrors the renderer's Dict; the
// flattened `general` section contributes nav/cta/moreAbout at the top level.
export const therapistContent: Record<string, Record<string, unknown>> = {
  de: {
    nav: [
      { id: "ueber", label: "Über mich" },
      { id: "angebot", label: "Angebot" },
      { id: "themen", label: "Themen" },
      { id: "kosten", label: "Ablauf & Kosten" },
      { id: "termine", label: "Termine" },
      { id: "kontakt", label: "Kontakt" },
    ],
    cta: "Termin anfragen",
    moreAbout: "Mehr über mich",
    hero: {
      eyebrow: "Beratung & Begleitung",
      title: "Raum für das, was Sie gerade bewegt.",
      lead: "Beschreiben Sie hier in ein, zwei Sätzen, wie Sie arbeiten und wen Sie begleiten. Diesen Text können Sie jederzeit bearbeiten.",
      note: "Ihr Name · Ihre Qualifikation",
      meta: ["Online & vor Ort", "Sprache(n)", "Erstgespräch unverbindlich"],
    },
    forWho: {
      eyebrow: "Für wen",
      body: "Schildern Sie kurz, an wen sich Ihr Angebot richtet und in welchen Situationen Menschen zu Ihnen kommen.",
    },
    aboutTeaser: {
      eyebrow: "Über mich",
      body: "Ein kurzer Satz über Sie und Ihre Arbeit — die ausführliche Version steht auf der Über-mich-Seite.",
      link: "Mehr über mich",
    },
    homeTopics: {
      eyebrow: "Themen",
      title: "Womit ich Sie begleite.",
      chips: ["Thema eins", "Thema zwei", "Thema drei", "Thema vier", "Thema fünf", "Thema sechs"],
      link: "Alle Themen ansehen",
    },
    homeSteps: {
      eyebrow: "So läuft es ab",
      title: "In drei ruhigen Schritten.",
      steps: [
        { n: "01", title: "Erstgespräch", body: "Ein kurzes, unverbindliches Kennenlernen." },
        { n: "02", title: "Anliegen klären", body: "Wir klären gemeinsam Ihr Anliegen und Ihre Ziele." },
        { n: "03", title: "Gemeinsam weitergehen", body: "Regelmäßige Gespräche, in Ihrem Tempo." },
      ],
    },
    ctaBand: { text: "Bereit für den ersten Schritt?", cta: "Termin anfragen" },
    about: {
      eyebrow: "Über mich",
      title: "Über mich",
      bio: [
        "Stellen Sie sich hier vor: Wer sind Sie, und wie sind Sie zu Ihrer Arbeit gekommen?",
        "Beschreiben Sie Ihren Ansatz und die Methoden, mit denen Sie arbeiten.",
        "Erzählen Sie, was Ihnen in der Begleitung wichtig ist. Trennen Sie Absätze mit einer Leerzeile.",
      ],
      qualTitle: "Qualifikationen",
      quals: [
        "Ihr Abschluss — Ihre Hochschule",
        "Weitere Aus- oder Weiterbildung",
        "Sprachen: …",
      ],
      values: [
        { icon: "shield", label: "Vertraulich" },
        { icon: "leaf", label: "Ressourcenorientiert" },
        { icon: "heart", label: "Auf Augenhöhe" },
      ],
    },
    services: {
      eyebrow: "Angebot",
      title: "Mein Angebot",
      cards: [
        { icon: "video", name: "Einzelberatung — online", body: "Beschreiben Sie dieses Angebot in ein, zwei Sätzen.", badge: "Online" },
        { icon: "sparkle", name: "Kennenlern-Gespräch", body: "Ein erstes, unverbindliches Gespräch zum Kennenlernen.", badge: "Unverbindlich" },
      ],
      disclaimer: "Optionaler Hinweis, z. B. dass Beratung keine ärztliche oder psychotherapeutische Behandlung ersetzt.",
    },
    topics: {
      eyebrow: "Themen",
      title: "Womit ich Sie begleite",
      lead: "Ein kurzer einleitender Satz zu Ihren Schwerpunkten.",
      items: [
        { icon: "compass", title: "Thema eins", body: "Ein, zwei Sätze zu diesem Thema." },
        { icon: "leaf", title: "Thema zwei", body: "Ein, zwei Sätze zu diesem Thema." },
        { icon: "heart", title: "Thema drei", body: "Ein, zwei Sätze zu diesem Thema." },
        { icon: "sparkle", title: "Thema vier", body: "Ein, zwei Sätze zu diesem Thema." },
      ],
      safety: "Optionaler Sicherheitshinweis für akute Krisen (z. B. Notruf 112 / Telefonseelsorge 0800 111 0 111).",
    },
    fees: {
      eyebrow: "Ablauf & Kosten",
      title: "Ablauf & Kosten",
      ablaufTitle: "So läuft es ab",
      steps: [
        { n: "01", title: "Kennenlernen", body: "Ein kurzes, unverbindliches Erstgespräch." },
        { n: "02", title: "Anliegen klären", body: "Wir klären gemeinsam Ihr Anliegen und Ihre Ziele." },
        { n: "03", title: "Sitzungen", body: "Regelmäßige Gespräche, in Ihrem Tempo." },
      ],
      costTitle: "Kosten",
      cost: "Beschreiben Sie hier Ihre Preise und Konditionen (z. B. Dauer, Ausfallregelung).",
      priceFigure: "—",
      priceUnit: "pro Sitzung",
      insuranceTitle: "Krankenkasse",
      insurance: "Optionaler Hinweis zur Kostenübernahme durch Krankenkassen.",
    },
    booking: {
      eyebrow: "Termine",
      title: "Termin anfragen",
      intro: "Wählen Sie einen Zeitraum, der Ihnen passt — ich melde mich zur Bestätigung. Bitte teilen Sie hier noch keine sensiblen Daten.",
      schedulerLabel: "Online-Kalender",
      schedulerNote: "Hier wird Ihr Buchungskalender eingebettet (cal.com-Link in den Einstellungen).",
      formTitle: "Oder Anfrage per Formular",
      fields: { name: "Name", email: "E-Mail", times: "Bevorzugte Zeiten", message: "Kurze Nachricht" },
      timesPlaceholder: "z. B. werktags vormittags",
      consent: "Ich habe die Datenschutzerklärung gelesen und bin mit der Verarbeitung meiner Angaben zur Kontaktaufnahme einverstanden.",
      submit: "Anfrage senden",
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Kontakt",
      lead: "Schreiben Sie mir ein paar Zeilen — ich melde mich bei Ihnen.",
      notice: "Bitte schreiben Sie keine vertraulichen oder sensiblen Informationen in das Formular. Nutzen Sie es nur für eine erste Kontaktaufnahme.",
      fields: { name: "Name", email: "E-Mail", phone: "Telefon (optional)", message: "Nachricht" },
      consent: "Ich habe die Datenschutzerklärung gelesen und bin mit der Verarbeitung meiner Angaben zur Kontaktaufnahme einverstanden.",
      submit: "Nachricht senden",
      submitting: "Wird gesendet …",
      errSubmit: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      errEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      errConsent: "Bitte bestätigen Sie die Datenschutzerklärung.",
      successTitle: "Danke — Ihre Nachricht ist angekommen.",
      successBody: "Ich antworte i.d.R. innerhalb von 2 Werktagen.",
      sideTitle: "So erreichen Sie mich",
      side: [
        { icon: "mail", label: "ihre@e-mail.de" },
        { icon: "phone", label: "Ihre Telefonnummer" },
        { icon: "mapPin", label: "Online · Ihr Ort" },
        { icon: "calendar", label: "Antwort i.d.R. innerhalb von 2 Werktagen" },
      ],
    },
    faq: {
      eyebrow: "Häufige Fragen",
      title: "Häufige Fragen",
      items: [
        { q: "Erste Beispiel-Frage?", a: "Ihre Antwort hier." },
        { q: "Zweite Beispiel-Frage?", a: "Ihre Antwort hier." },
        { q: "Dritte Beispiel-Frage?", a: "Ihre Antwort hier." },
      ],
    },
    impressum: {
      eyebrow: "Rechtliches",
      title: "Impressum",
      rows: [
        ["Name", "Ihr Name"],
        ["E-Mail", "ihre@e-mail.de"],
        ["Telefon", "Ihre Telefonnummer"],
        ["Berufsbezeichnung", "Ihre Berufsbezeichnung"],
        ["Tätigkeit", "Ihre Tätigkeit"],
      ],
      note: "Bitte ergänzen Sie hier die nach § 5 DDG / § 18 MStV erforderlichen Angaben.",
    },
    datenschutz: {
      eyebrow: "Rechtliches",
      title: "Datenschutzerklärung",
      intro: "Platzhalter — bitte durch einen geprüften Datenschutztext ersetzen.",
      sections: [
        { h: "1. Verantwortliche Stelle", b: "Ihr Name und Ihre Kontaktdaten (siehe Impressum)." },
        { h: "2. Erhebung & Verarbeitung", b: "Welche Daten Sie zu welchem Zweck verarbeiten." },
        { h: "3. Ihre Rechte", b: "Auskunft, Berichtigung, Löschung, Widerruf der Einwilligung." },
      ],
    },
    footer: {
      tagline: "Beratung & Begleitung · online und vor Ort",
      legal: ["Impressum", "Datenschutz"],
      safety: "Optionaler Sicherheitshinweis. In akuten Krisen wählen Sie bitte den Notruf 112 oder die Telefonseelsorge: 0800 111 0 111.",
    },
  },

  en: {
    nav: [
      { id: "ueber", label: "About" },
      { id: "angebot", label: "Services" },
      { id: "themen", label: "Topics" },
      { id: "kosten", label: "How it works & Fees" },
      { id: "termine", label: "Booking" },
      { id: "kontakt", label: "Contact" },
    ],
    cta: "Request an appointment",
    moreAbout: "More about me",
    hero: {
      eyebrow: "Counselling & support",
      title: "Space for what's on your mind right now.",
      lead: "Describe in a sentence or two how you work and who you support. You can edit this text anytime.",
      note: "Your name · Your qualification",
      meta: ["Online & in person", "Language(s)", "No-obligation intro call"],
    },
    forWho: {
      eyebrow: "Who it's for",
      body: "Briefly say who your offering is for and the situations people come to you with.",
    },
    aboutTeaser: {
      eyebrow: "About me",
      body: "A short line about you and your work — the full version lives on the About page.",
      link: "More about me",
    },
    homeTopics: {
      eyebrow: "Topics",
      title: "What I can support you with.",
      chips: ["Topic one", "Topic two", "Topic three", "Topic four", "Topic five", "Topic six"],
      link: "See all topics",
    },
    homeSteps: {
      eyebrow: "How it works",
      title: "In three calm steps.",
      steps: [
        { n: "01", title: "Intro call", body: "A short, no-obligation conversation." },
        { n: "02", title: "Clarify your concern", body: "We clarify your concern and goals together." },
        { n: "03", title: "Move forward together", body: "Regular sessions, at your pace." },
      ],
    },
    ctaBand: { text: "Ready for the first step?", cta: "Request an appointment" },
    about: {
      eyebrow: "About me",
      title: "About me",
      bio: [
        "Introduce yourself here: who are you, and how did you come to this work?",
        "Describe your approach and the methods you work with.",
        "Share what matters to you in supporting people. Separate paragraphs with a blank line.",
      ],
      qualTitle: "Qualifications",
      quals: [
        "Your degree — your university",
        "Further training or certification",
        "Languages: …",
      ],
      values: [
        { icon: "shield", label: "Confidential" },
        { icon: "leaf", label: "Resource-oriented" },
        { icon: "heart", label: "At eye level" },
      ],
    },
    services: {
      eyebrow: "Services",
      title: "What I offer",
      cards: [
        { icon: "video", name: "Individual session — online", body: "Describe this offering in a sentence or two.", badge: "Online" },
        { icon: "sparkle", name: "Intro call", body: "A first, no-obligation conversation to get to know each other.", badge: "No obligation" },
      ],
      disclaimer: "Optional note, e.g. that counselling is not a substitute for medical or psychotherapeutic treatment.",
    },
    topics: {
      eyebrow: "Topics",
      title: "What I can support you with",
      lead: "A short introductory line about your focus areas.",
      items: [
        { icon: "compass", title: "Topic one", body: "A sentence or two about this topic." },
        { icon: "leaf", title: "Topic two", body: "A sentence or two about this topic." },
        { icon: "heart", title: "Topic three", body: "A sentence or two about this topic." },
        { icon: "sparkle", title: "Topic four", body: "A sentence or two about this topic." },
      ],
      safety: "Optional safety note for acute crises (e.g. emergency services 112 / a local helpline).",
    },
    fees: {
      eyebrow: "How it works & fees",
      title: "How it works & fees",
      ablaufTitle: "How it works",
      steps: [
        { n: "01", title: "Getting to know each other", body: "A short, no-obligation intro call." },
        { n: "02", title: "Clarifying your concern", body: "We clarify your concern and goals together." },
        { n: "03", title: "Sessions", body: "Regular sessions, at your pace." },
      ],
      costTitle: "Fees",
      cost: "Describe your pricing and terms here (e.g. session length, cancellation policy).",
      priceFigure: "—",
      priceUnit: "per session",
      insuranceTitle: "Health insurance",
      insurance: "Optional note about insurance coverage.",
    },
    booking: {
      eyebrow: "Booking",
      title: "Request an appointment",
      intro: "Choose a time that suits you — I'll get back to you to confirm. Please don't share any sensitive details here.",
      schedulerLabel: "Online calendar",
      schedulerNote: "Your booking calendar will be embedded here (set the cal.com link in settings).",
      formTitle: "Or request via form",
      fields: { name: "Name", email: "Email", times: "Preferred times", message: "Short message" },
      timesPlaceholder: "e.g. weekday mornings",
      consent: "I have read the privacy policy and consent to my details being processed for the purpose of getting in touch.",
      submit: "Send request",
    },
    contact: {
      eyebrow: "Contact",
      title: "Contact",
      lead: "Write me a few lines — I'll get back to you.",
      notice: "Please don't include confidential or sensitive information in the form. Use it only to make initial contact.",
      fields: { name: "Name", email: "Email", phone: "Phone (optional)", message: "Message" },
      consent: "I have read the privacy policy and consent to my details being processed for the purpose of getting in touch.",
      submit: "Send message",
      submitting: "Sending …",
      errSubmit: "Something went wrong. Please try again.",
      errEmail: "Please enter a valid email address.",
      errConsent: "Please confirm the privacy policy.",
      successTitle: "Thank you — your message has arrived.",
      successBody: "I usually reply within 2 working days.",
      sideTitle: "How to reach me",
      side: [
        { icon: "mail", label: "you@example.com" },
        { icon: "phone", label: "Your phone number" },
        { icon: "mapPin", label: "Online · your location" },
        { icon: "calendar", label: "Reply usually within 2 working days" },
      ],
    },
    faq: {
      eyebrow: "FAQ",
      title: "FAQ",
      items: [
        { q: "First example question?", a: "Your answer here." },
        { q: "Second example question?", a: "Your answer here." },
        { q: "Third example question?", a: "Your answer here." },
      ],
    },
    impressum: {
      eyebrow: "Legal",
      title: "Imprint",
      rows: [
        ["Name", "Your name"],
        ["Email", "you@example.com"],
        ["Phone", "Your phone number"],
        ["Professional title", "Your professional title"],
        ["Activity", "Your activity"],
      ],
      note: "Please add the details required in your jurisdiction here.",
    },
    datenschutz: {
      eyebrow: "Legal",
      title: "Privacy policy",
      intro: "Placeholder — please replace with a reviewed privacy policy.",
      sections: [
        { h: "1. Controller", b: "Your name and contact details (see Imprint)." },
        { h: "2. Collection & processing", b: "Which data you process and for what purpose." },
        { h: "3. Your rights", b: "Access, rectification, erasure, withdrawal of consent." },
      ],
    },
    footer: {
      tagline: "Counselling & support · online and in person",
      legal: ["Imprint", "Privacy"],
      safety: "Optional safety note. In an acute crisis, please call your local emergency number or a helpline.",
    },
  },
};
