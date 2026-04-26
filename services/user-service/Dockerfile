# ---- Build Stage ----
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install git for Go modules if needed
RUN apk add --no-cache git

# Copy go.mod and go.sum first for better caching
COPY go.mod ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the Go binary
RUN CGO_ENABLED=0 GOOS=linux go build -o user-service ./cmd/main.go

# ---- Final Stage ----
FROM alpine:3.19

# Create a non-root user
RUN adduser -D -g '' appuser

WORKDIR /app

# Copy the binary from the builder
COPY --from=builder /app/user-service .

# Copy any required config files (e.g., .env)
COPY .env .env

USER appuser

EXPOSE 8089

ENTRYPOINT ["./user-service"]