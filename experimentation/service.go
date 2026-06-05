package main

import "context"

// provisionProject creates a project together with a default "production"
// environment and a client SDK key for it — the minimum needed for a client to
// connect immediately after creation.
func (s *Server) provisionProject(ctx context.Context, key, name string) (Project, Environment, string, error) {
	p, err := s.store.CreateProject(ctx, key, name)
	if err != nil {
		return Project{}, Environment{}, "", err
	}
	env, err := s.store.CreateEnvironment(ctx, p.ID, "production", "Production")
	if err != nil {
		return p, Environment{}, "", err
	}
	sdkKey, err := s.store.CreateSDKKey(ctx, p.ID, env.ID)
	return p, env, sdkKey, err
}

// provisionEnvironment creates an environment plus a client SDK key for it.
func (s *Server) provisionEnvironment(ctx context.Context, projectID, key, name string) (Environment, string, error) {
	env, err := s.store.CreateEnvironment(ctx, projectID, key, name)
	if err != nil {
		return Environment{}, "", err
	}
	sdkKey, err := s.store.CreateSDKKey(ctx, projectID, env.ID)
	return env, sdkKey, err
}
