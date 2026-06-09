package main

import (
	"context"
	"errors"
	"log"
)

// Schemas are developer-owned: they live here in code and are upserted on
// every boot, so deploying a schema change updates the forms in place while
// content stays in the database. When the site's Dict type changes, change
// the matching section here in the same commit.

func f(key, typ, label string) Field  { return Field{Key: key, Type: typ, Label: label} }
func ro(key, typ, label string) Field { return Field{Key: key, Type: typ, Label: label, ReadOnly: true} }
func group(key, typ, label string, subs ...Field) Field {
	return Field{Key: key, Type: typ, Label: label, Fields: subs}
}

// seed provisions the Lea site and refreshes its section schemas. Idempotent:
// the site is created once, schemas are upserted every boot.
func (s *Server) seed(ctx context.Context) error {
	site, err := s.store.GetSite(ctx, "lea")
	if errors.Is(err, errNotFound) {
		site, err = s.store.CreateSite(ctx, Site{
			Key:           "lea",
			Name:          "Lea — Psychologische Beratung",
			Locales:       []string{"de", "en"},
			DefaultLocale: "de",
			GitHubRepo:    "markmorcos/Lea",
			DispatchEvent: "cms-publish",
		})
		if err == nil {
			log.Printf("seeded site lea")
		}
	}
	if err != nil {
		return err
	}
	for i, sec := range leaSections() {
		sec.SiteID = site.ID
		sec.Position = i
		if err := s.store.UpsertSection(ctx, sec); err != nil {
			return err
		}
	}
	return nil
}

// leaSections mirrors the Dict type in the Lea repo's src/content/content.ts.
// One section per top-level key; `general` (flatten) holds the root scalars
// and `media` (non-localized) holds images shared across locales.
func leaSections() []Section {
	step := []Field{f("n", fieldText, "Nummer"), f("title", fieldText, "Titel"), f("body", fieldTextarea, "Text")}
	return []Section{
		{Key: "general", Title: "Allgemein", PageGroup: "Allgemein", Localized: true, Flatten: true, Fields: []Field{
			group("nav", fieldList, "Navigation", ro("id", fieldText, "ID (fest)"), f("label", fieldText, "Beschriftung")),
			f("cta", fieldText, "Haupt-Button (z. B. „Termin anfragen“)"),
			f("moreAbout", fieldText, "Link „Mehr über mich“"),
		}},
		{Key: "media", Title: "Bilder", PageGroup: "Allgemein", Localized: false, Fields: []Field{
			f("portraitUrl", fieldImage, "Portraitfoto"),
		}},
		{Key: "footer", Title: "Fußzeile", PageGroup: "Allgemein", Localized: true, Fields: []Field{
			f("tagline", fieldText, "Untertitel"),
			f("legal", fieldStringlist, "Rechtliche Links (eine pro Zeile)"),
			f("safety", fieldTextarea, "Sicherheitshinweis"),
		}},

		{Key: "hero", Title: "Startbereich (Hero)", PageGroup: "Startseite", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("lead", fieldTextarea, "Einleitung"),
			f("note", fieldText, "Namenszeile"),
			f("meta", fieldStringlist, "Stichpunkte (einer pro Zeile)"),
		}},
		{Key: "forWho", Title: "Für wen", PageGroup: "Startseite", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("body", fieldTextarea, "Text"),
		}},
		{Key: "aboutTeaser", Title: "Über mich (Teaser)", PageGroup: "Startseite", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("body", fieldTextarea, "Text"),
			f("link", fieldText, "Linktext"),
		}},
		{Key: "homeTopics", Title: "Themen (Startseite)", PageGroup: "Startseite", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("chips", fieldStringlist, "Themen-Chips (einer pro Zeile)"),
			f("link", fieldText, "Linktext"),
		}},
		{Key: "homeSteps", Title: "Ablauf (Startseite)", PageGroup: "Startseite", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			group("steps", fieldList, "Schritte", step...),
		}},
		{Key: "ctaBand", Title: "Aufruf-Banner", PageGroup: "Startseite", Localized: true, Fields: []Field{
			f("text", fieldText, "Text"),
			f("cta", fieldText, "Button"),
		}},

		{Key: "about", Title: "Über mich", PageGroup: "Über mich", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("bio", fieldParagraphs, "Über mich (Absätze durch Leerzeile trennen)"),
			f("qualTitle", fieldText, "Titel Qualifikationen"),
			f("quals", fieldStringlist, "Qualifikationen (eine pro Zeile)"),
			group("values", fieldList, "Werte", ro("icon", fieldText, "Symbol (fest)"), f("label", fieldText, "Beschriftung")),
		}},

		{Key: "services", Title: "Angebot", PageGroup: "Angebot", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			group("cards", fieldList, "Angebote",
				ro("icon", fieldText, "Symbol (fest)"),
				f("name", fieldText, "Name"),
				f("body", fieldTextarea, "Beschreibung"),
				f("badge", fieldText, "Badge")),
			f("disclaimer", fieldTextarea, "Hinweis"),
		}},

		{Key: "topics", Title: "Themen", PageGroup: "Themen", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("lead", fieldTextarea, "Einleitung"),
			group("items", fieldList, "Themen",
				ro("icon", fieldText, "Symbol (fest)"),
				f("title", fieldText, "Titel"),
				f("body", fieldTextarea, "Text")),
			f("safety", fieldTextarea, "Sicherheitshinweis"),
		}},

		{Key: "fees", Title: "Ablauf & Kosten", PageGroup: "Ablauf & Kosten", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("ablaufTitle", fieldText, "Titel Ablauf"),
			group("steps", fieldList, "Schritte", step...),
			f("costTitle", fieldText, "Titel Kosten"),
			f("cost", fieldTextarea, "Kosten-Text"),
			f("priceFigure", fieldText, "Preis (z. B. 45 €)"),
			f("priceUnit", fieldText, "Einheit (z. B. 50 Minuten)"),
			f("insuranceTitle", fieldText, "Titel Krankenkasse"),
			f("insurance", fieldTextarea, "Krankenkassen-Text"),
		}},

		{Key: "booking", Title: "Termine", PageGroup: "Termine", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("intro", fieldTextarea, "Einleitung"),
			f("schedulerLabel", fieldText, "Kalender-Beschriftung"),
			f("schedulerNote", fieldText, "Kalender-Hinweis"),
			f("formTitle", fieldText, "Titel Formular"),
			group("fields", fieldObject, "Formularfelder",
				f("name", fieldText, "Name"),
				f("email", fieldText, "E-Mail"),
				f("times", fieldText, "Bevorzugte Zeiten"),
				f("message", fieldText, "Nachricht")),
			f("timesPlaceholder", fieldText, "Platzhalter Zeiten"),
			f("consent", fieldTextarea, "Einwilligungstext"),
			f("submit", fieldText, "Absende-Button"),
		}},

		{Key: "contact", Title: "Kontakt", PageGroup: "Kontakt", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("lead", fieldTextarea, "Einleitung"),
			f("notice", fieldTextarea, "Hinweis"),
			group("fields", fieldObject, "Formularfelder",
				f("name", fieldText, "Name"),
				f("email", fieldText, "E-Mail"),
				f("phone", fieldText, "Telefon"),
				f("message", fieldText, "Nachricht")),
			f("consent", fieldTextarea, "Einwilligungstext"),
			f("submit", fieldText, "Absende-Button"),
			f("errEmail", fieldText, "Fehlermeldung E-Mail"),
			f("errConsent", fieldText, "Fehlermeldung Einwilligung"),
			f("successTitle", fieldText, "Erfolgsmeldung Titel"),
			f("successBody", fieldText, "Erfolgsmeldung Text"),
			f("sideTitle", fieldText, "Titel Seitenleiste"),
			group("side", fieldList, "Seitenleiste", ro("icon", fieldText, "Symbol (fest)"), f("label", fieldText, "Text")),
		}},

		{Key: "faq", Title: "Häufige Fragen", PageGroup: "FAQ", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			group("items", fieldList, "Fragen", f("q", fieldText, "Frage"), f("a", fieldTextarea, "Antwort")),
		}},

		{Key: "impressum", Title: "Impressum", PageGroup: "Rechtliches", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			group("rows", fieldPairs, "Angaben"),
			f("note", fieldTextarea, "Hinweis"),
		}},
		{Key: "datenschutz", Title: "Datenschutz", PageGroup: "Rechtliches", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Überzeile"),
			f("title", fieldText, "Titel"),
			f("intro", fieldTextarea, "Einleitung"),
			group("sections", fieldList, "Abschnitte", f("h", fieldText, "Überschrift"), f("b", fieldTextarea, "Text")),
		}},
	}
}
