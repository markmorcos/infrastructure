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
			Name:          "Lea Pfaffeneder",
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
	step := []Field{f("n", fieldText, "Number"), f("title", fieldText, "Title"), f("body", fieldTextarea, "Text")}
	return []Section{
		{Key: "general", Title: "General", PageGroup: "General", Localized: true, Flatten: true, Fields: []Field{
			group("nav", fieldList, "Navigation", ro("id", fieldText, "ID (fixed)"), f("label", fieldText, "Label")),
			f("cta", fieldText, "Main button (e.g. “Request an appointment”)"),
			f("moreAbout", fieldText, "“More about me” link"),
		}},
		{Key: "media", Title: "Images", PageGroup: "General", Localized: false, Fields: []Field{
			f("portraitUrl", fieldImage, "Portrait photo"),
		}},
		{Key: "footer", Title: "Footer", PageGroup: "General", Localized: true, Fields: []Field{
			f("tagline", fieldText, "Tagline"),
			f("legal", fieldStringlist, "Legal links (one per line)"),
			f("safety", fieldTextarea, "Safety notice"),
		}},

		{Key: "hero", Title: "Hero", PageGroup: "Home", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("lead", fieldTextarea, "Lead text"),
			f("note", fieldText, "Name line"),
			f("meta", fieldStringlist, "Bullet points (one per line)"),
		}},
		{Key: "forWho", Title: "Who it's for", PageGroup: "Home", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("body", fieldTextarea, "Text"),
		}},
		{Key: "aboutTeaser", Title: "About teaser", PageGroup: "Home", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("body", fieldTextarea, "Text"),
			f("link", fieldText, "Link text"),
		}},
		{Key: "homeTopics", Title: "Topics (home)", PageGroup: "Home", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("chips", fieldStringlist, "Topic chips (one per line)"),
			f("link", fieldText, "Link text"),
		}},
		{Key: "homeSteps", Title: "Steps (home)", PageGroup: "Home", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			group("steps", fieldList, "Steps", step...),
		}},
		{Key: "ctaBand", Title: "Call-to-action banner", PageGroup: "Home", Localized: true, Fields: []Field{
			f("text", fieldText, "Text"),
			f("cta", fieldText, "Button"),
		}},

		{Key: "about", Title: "About", PageGroup: "About", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("bio", fieldParagraphs, "Bio (separate paragraphs with a blank line)"),
			f("qualTitle", fieldText, "Qualifications title"),
			f("quals", fieldStringlist, "Qualifications (one per line)"),
			group("values", fieldList, "Values", ro("icon", fieldText, "Icon (fixed)"), f("label", fieldText, "Label")),
		}},

		{Key: "services", Title: "Services", PageGroup: "Services", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			group("cards", fieldList, "Service cards",
				ro("icon", fieldText, "Icon (fixed)"),
				f("name", fieldText, "Name"),
				f("body", fieldTextarea, "Description"),
				f("badge", fieldText, "Badge")),
			f("disclaimer", fieldTextarea, "Disclaimer"),
		}},

		{Key: "topics", Title: "Topics", PageGroup: "Topics", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("lead", fieldTextarea, "Lead text"),
			group("items", fieldList, "Topics",
				ro("icon", fieldText, "Icon (fixed)"),
				f("title", fieldText, "Title"),
				f("body", fieldTextarea, "Text")),
			f("safety", fieldTextarea, "Safety notice"),
		}},

		{Key: "fees", Title: "Process & fees", PageGroup: "Fees", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("ablaufTitle", fieldText, "Process title"),
			group("steps", fieldList, "Steps", step...),
			f("costTitle", fieldText, "Fees title"),
			f("cost", fieldTextarea, "Fees text"),
			f("priceFigure", fieldText, "Price (e.g. 45 €)"),
			f("priceUnit", fieldText, "Unit (e.g. 50 minutes)"),
			f("insuranceTitle", fieldText, "Insurance title"),
			f("insurance", fieldTextarea, "Insurance text"),
		}},

		{Key: "booking", Title: "Booking", PageGroup: "Booking", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("intro", fieldTextarea, "Intro"),
			f("schedulerLabel", fieldText, "Calendar label"),
			f("schedulerNote", fieldText, "Calendar note"),
			f("formTitle", fieldText, "Form title"),
			group("fields", fieldObject, "Form fields",
				f("name", fieldText, "Name"),
				f("email", fieldText, "Email"),
				f("times", fieldText, "Preferred times"),
				f("message", fieldText, "Message")),
			f("timesPlaceholder", fieldText, "Times placeholder"),
			f("consent", fieldTextarea, "Consent text"),
			f("submit", fieldText, "Submit button"),
		}},

		{Key: "contact", Title: "Contact", PageGroup: "Contact", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("lead", fieldTextarea, "Lead text"),
			f("notice", fieldTextarea, "Notice"),
			group("fields", fieldObject, "Form fields",
				f("name", fieldText, "Name"),
				f("email", fieldText, "Email"),
				f("phone", fieldText, "Phone"),
				f("message", fieldText, "Message")),
			f("consent", fieldTextarea, "Consent text"),
			f("submit", fieldText, "Submit button"),
			f("errEmail", fieldText, "Email error message"),
			f("errConsent", fieldText, "Consent error message"),
			f("successTitle", fieldText, "Success title"),
			f("successBody", fieldText, "Success text"),
			f("sideTitle", fieldText, "Sidebar title"),
			group("side", fieldList, "Sidebar", ro("icon", fieldText, "Icon (fixed)"), f("label", fieldText, "Text")),
		}},

		{Key: "faq", Title: "FAQ", PageGroup: "FAQ", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			group("items", fieldList, "Questions", f("q", fieldText, "Question"), f("a", fieldTextarea, "Answer")),
		}},

		{Key: "impressum", Title: "Imprint (Impressum)", PageGroup: "Legal", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			group("rows", fieldPairs, "Entries"),
			f("note", fieldTextarea, "Note"),
		}},
		{Key: "datenschutz", Title: "Privacy policy", PageGroup: "Legal", Localized: true, Fields: []Field{
			f("eyebrow", fieldText, "Eyebrow"),
			f("title", fieldText, "Title"),
			f("intro", fieldTextarea, "Intro"),
			group("sections", fieldList, "Sections", f("h", fieldText, "Heading"), f("b", fieldTextarea, "Text")),
		}},
	}
}
