# Stage 1: Build Go Binary
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o eggless-server .

# Stage 2: Minimal Runtime Image
FROM alpine:3.19

WORKDIR /app
RUN apk --no-cache add ca-certificates

COPY --from=builder /app/eggless-server .

EXPOSE 8080

CMD ["./eggless-server"]
