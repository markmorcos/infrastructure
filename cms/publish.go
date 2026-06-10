package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// githubConfig holds the fine-grained PAT used to fire repository_dispatch
// events on publish. Empty token = dispatch disabled (publish still works).
type githubConfig struct {
	token string
}

// publishSite copies all drafts to published, snapshots the result, and fires
// the site's GitHub rebuild dispatch. The dispatch is best-effort: content is
// published even when GitHub is unreachable, and the caller surfaces a
// warning instead of failing.
func (s *Server) publishSite(ctx context.Context, site Site) (dispatched bool, err error) {
	sections, err := s.store.ListSections(ctx, site.ID)
	if err != nil {
		return false, err
	}
	drafts, err := s.store.SiteContent(ctx, site.ID, true)
	if err != nil {
		return false, err
	}
	snapshot := map[string]any{}
	for _, locale := range site.Locales {
		snapshot[locale] = assembleDict(sections, drafts, locale)
	}
	snapshotJSON, _ := json.Marshal(snapshot)

	publishID, err := s.store.PublishSite(ctx, site.ID, snapshotJSON)
	if err != nil {
		return false, err
	}

	if err := s.github.dispatch(ctx, site); err != nil {
		log.Printf("publish %s: dispatch: %v", site.Key, err)
		return false, nil
	}
	if err := s.store.MarkDispatched(ctx, publishID); err != nil {
		log.Printf("publish %s: mark dispatched: %v", site.Key, err)
	}
	return true, nil
}

// dispatch fires a repository_dispatch event so the site's CI rebuilds it
// with the freshly published content.
func (g githubConfig) dispatch(ctx context.Context, site Site) error {
	if site.GitHubRepo == "" || site.DispatchEvent == "" {
		return fmt.Errorf("site has no github_repo/dispatch_event configured")
	}
	if g.token == "" {
		return fmt.Errorf("GITHUB_TOKEN is not configured")
	}
	body, _ := json.Marshal(map[string]any{
		"event_type":     site.DispatchEvent,
		"client_payload": map[string]any{"site": site.Key},
	})
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.github.com/repos/"+site.GitHubRepo+"/dispatches", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+g.token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("github dispatch: unexpected status %s", resp.Status)
	}
	return nil
}
