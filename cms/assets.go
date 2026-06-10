package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const maxUploadBytes = 10 << 20 // 10 MB

// assetStore wraps the MinIO client plus the bucket/URL configuration. The
// CMS talks to MinIO directly (S3_ENDPOINT, e.g. m720q:9000); the public URL
// it stores points at the CDN ingress in front of the same bucket.
type assetStore struct {
	client        *minio.Client
	bucket        string
	publicBaseURL string
}

// newAssetStore builds the MinIO client from S3_* env vars and makes sure the
// bucket exists with anonymous read, so served URLs work without credentials.
// Returns (nil, err) when S3 is not configured; the CMS then runs with
// uploads disabled instead of failing to boot.
func newAssetStore() (*assetStore, error) {
	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	if endpoint == "" || accessKey == "" || secretKey == "" {
		return nil, errors.New("S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY not set")
	}
	bucket := getenv("S3_BUCKET", "cms")
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: os.Getenv("S3_SECURE") == "true",
	})
	if err != nil {
		return nil, err
	}
	a := &assetStore{
		client:        client,
		bucket:        bucket,
		publicBaseURL: strings.TrimRight(getenv("S3_PUBLIC_BASE_URL", "https://cdn.morcos.tech"), "/"),
	}
	go a.ensureBucket()
	return a, nil
}

// ensureBucket creates the bucket and opens anonymous downloads. Best-effort:
// failures are logged, not fatal, since the bucket is usually provisioned
// out-of-band anyway.
func (a *assetStore) ensureBucket() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	exists, err := a.client.BucketExists(ctx, a.bucket)
	if err != nil {
		log.Printf("assets: bucket check: %v", err)
		return
	}
	if !exists {
		if err := a.client.MakeBucket(ctx, a.bucket, minio.MakeBucketOptions{}); err != nil {
			log.Printf("assets: make bucket: %v", err)
			return
		}
	}
	policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`, a.bucket)
	if err := a.client.SetBucketPolicy(ctx, a.bucket, policy); err != nil {
		log.Printf("assets: set bucket policy: %v", err)
	}
}

var allowedImageTypes = map[string]string{
	"image/jpeg":    ".jpg",
	"image/png":     ".png",
	"image/webp":    ".webp",
	"image/svg+xml": ".svg",
}

var unsafeFilenameRe = regexp.MustCompile(`[^a-z0-9._-]+`)

func sanitizeFilename(name string) string {
	name = strings.ToLower(path.Base(name))
	name = unsafeFilenameRe.ReplaceAllString(name, "-")
	name = strings.Trim(name, "-.")
	if name == "" {
		name = "datei"
	}
	return name
}

// uploadFromRequest reads the multipart "file" field, validates it as an
// image, stores it in MinIO under {site}/{random}-{filename}, and records it.
func (s *Server) uploadFromRequest(r *http.Request, site Site) (Asset, error) {
	if s.assets == nil {
		return Asset{}, errors.New("uploads are not configured (S3_* env missing)")
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		return Asset{}, errors.New("upload too large or invalid (max 10 MB)")
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		return Asset{}, errors.New("missing file")
	}
	defer file.Close()
	return s.assets.put(r.Context(), s.store, site, file, header)
}

func (a *assetStore) put(ctx context.Context, store *Store, site Site, file multipart.File, header *multipart.FileHeader) (Asset, error) {
	if header.Size > maxUploadBytes {
		return Asset{}, errors.New("file too large (max 10 MB)")
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	head = head[:n]
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return Asset{}, err
	}
	contentType := http.DetectContentType(head)
	if strings.HasSuffix(strings.ToLower(header.Filename), ".svg") &&
		(strings.HasPrefix(contentType, "text/xml") || strings.HasPrefix(contentType, "text/plain")) {
		contentType = "image/svg+xml"
	}
	if _, ok := allowedImageTypes[contentType]; !ok {
		return Asset{}, fmt.Errorf("unsupported file type %s — allowed: JPG, PNG, WebP, SVG", contentType)
	}

	suffix := make([]byte, 6)
	_, _ = rand.Read(suffix)
	objectKey := fmt.Sprintf("%s/%s-%s", site.Key, hex.EncodeToString(suffix), sanitizeFilename(header.Filename))

	if _, err := a.client.PutObject(ctx, a.bucket, objectKey, file, header.Size,
		minio.PutObjectOptions{ContentType: contentType, CacheControl: "public, max-age=31536000, immutable"}); err != nil {
		return Asset{}, fmt.Errorf("upload failed: %w", err)
	}

	return store.CreateAsset(ctx, Asset{
		SiteID:      site.ID,
		ObjectKey:   objectKey,
		URL:         fmt.Sprintf("%s/%s/%s", a.publicBaseURL, a.bucket, objectKey),
		Filename:    header.Filename,
		ContentType: contentType,
		SizeBytes:   header.Size,
	})
}

// deleteAsset removes the object from MinIO (best-effort) and the DB row.
func (s *Server) deleteAsset(ctx context.Context, asset Asset) error {
	if s.assets != nil {
		if err := s.assets.client.RemoveObject(ctx, s.assets.bucket, asset.ObjectKey, minio.RemoveObjectOptions{}); err != nil {
			log.Printf("assets: remove object %s: %v", asset.ObjectKey, err)
		}
	}
	return s.store.DeleteAsset(ctx, asset.ID)
}
