//go:build e2e

package main

// A self-booting Postgres harness for the end-to-end suite. It locates the
// installed initdb/postgres binaries and spins up a throwaway cluster in a temp
// dir on a random port, then tears it down. When the suite runs as root (where
// postgres refuses to start) it drops to the `postgres` system user for both
// initdb and the server. If no binaries are available the whole suite skips.
//
// Run with:  go test -tags e2e ./...
// Override with an external database:  TEST_DATABASE_URL=postgres://... go test -tags e2e ./...

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"syscall"
	"testing"
	"time"
)

const testAdminToken = "e2e-admin-token"

// testDSN is the connection string every e2e test dials. Empty means "skip".
var testDSN string

func TestMain(m *testing.M) {
	var stop func()
	if dsn := os.Getenv("TEST_DATABASE_URL"); dsn != "" {
		testDSN = dsn
	} else if pg, err := startEmbeddedPostgres(); err != nil {
		fmt.Fprintf(os.Stderr, "e2e: postgres unavailable, tests will skip: %v\n", err)
	} else {
		testDSN, stop = pg.dsn, pg.stop
	}
	code := m.Run()
	if stop != nil {
		stop()
	}
	os.Exit(code)
}

type embeddedPG struct {
	dsn  string
	cmd  *exec.Cmd
	base string
}

// findPGBin resolves a Postgres binary from PATH or the usual Debian/Ubuntu and
// source install locations.
func findPGBin(name string) (string, error) {
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}
	for _, glob := range []string{
		"/usr/lib/postgresql/*/bin/" + name,
		"/usr/local/pgsql/bin/" + name,
		"/opt/homebrew/opt/postgresql*/bin/" + name,
	} {
		if m, _ := filepath.Glob(glob); len(m) > 0 {
			return m[len(m)-1], nil // highest version sorts last
		}
	}
	return "", fmt.Errorf("%q not found on PATH or known install dirs", name)
}

func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func startEmbeddedPostgres() (*embeddedPG, error) {
	initdb, err := findPGBin("initdb")
	if err != nil {
		return nil, err
	}
	postgresBin, err := findPGBin("postgres")
	if err != nil {
		return nil, err
	}

	base, err := os.MkdirTemp("", "exp-e2e-")
	if err != nil {
		return nil, err
	}
	data := filepath.Join(base, "data")

	// postgres refuses to run as root; drop to the postgres system user.
	var cred *syscall.Credential
	if os.Geteuid() == 0 {
		u, err := user.Lookup("postgres")
		if err != nil {
			os.RemoveAll(base)
			return nil, fmt.Errorf("running as root and no postgres user available: %w", err)
		}
		uid, _ := strconv.Atoi(u.Uid)
		gid, _ := strconv.Atoi(u.Gid)
		if err := os.Chown(base, uid, gid); err != nil {
			os.RemoveAll(base)
			return nil, fmt.Errorf("chown temp dir to postgres: %w", err)
		}
		cred = &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid)}
	}

	newCmd := func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(name, args...)
		cmd.Dir = base
		if cred != nil {
			cmd.SysProcAttr = &syscall.SysProcAttr{Credential: cred}
		}
		return cmd
	}

	// trust auth on a throwaway cluster; --no-sync/fsync=off trade durability we
	// don't need for speed.
	if out, err := newCmd(initdb, "-D", data, "-U", "postgres", "-A", "trust", "--no-sync", "-E", "UTF8").CombinedOutput(); err != nil {
		os.RemoveAll(base)
		return nil, fmt.Errorf("initdb: %v\n%s", err, out)
	}

	port, err := freePort()
	if err != nil {
		os.RemoveAll(base)
		return nil, err
	}

	cmd := newCmd(postgresBin, "-D", data, "-p", strconv.Itoa(port), "-k", data,
		"-h", "127.0.0.1", "-c", "fsync=off", "-c", "log_min_messages=fatal")
	if err := cmd.Start(); err != nil {
		os.RemoveAll(base)
		return nil, fmt.Errorf("start postgres: %w", err)
	}

	dsn := fmt.Sprintf("postgres://postgres@127.0.0.1:%d/postgres?sslmode=disable", port)
	pg := &embeddedPG{dsn: dsn, cmd: cmd, base: base}

	deadline := time.Now().Add(25 * time.Second)
	var lastErr error
	for time.Now().Before(deadline) {
		if db, err := sql.Open("postgres", dsn); err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			lastErr = db.PingContext(ctx)
			cancel()
			db.Close()
			if lastErr == nil {
				return pg, nil
			}
		} else {
			lastErr = err
		}
		time.Sleep(200 * time.Millisecond)
	}
	pg.stop()
	return nil, fmt.Errorf("postgres did not become ready: %v", lastErr)
}

func (p *embeddedPG) stop() {
	if p.cmd != nil && p.cmd.Process != nil {
		_ = p.cmd.Process.Signal(syscall.SIGQUIT) // fast shutdown
		done := make(chan struct{})
		go func() { _, _ = p.cmd.Process.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			_ = p.cmd.Process.Kill()
		}
	}
	os.RemoveAll(p.base)
}
