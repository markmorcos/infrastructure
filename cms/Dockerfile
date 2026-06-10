# Cross-compile to the target arch on the build platform (no QEMU). CI already
# runs one native runner per arch, so BUILDPLATFORM == TARGETPLATFORM there.
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /cms .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /cms /cms
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/cms"]
