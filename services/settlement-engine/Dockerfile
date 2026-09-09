FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN go build -o /out/settlement-engine ./cmd/settlement-engine

FROM alpine:3.20
COPY --from=build /out/settlement-engine /usr/local/bin/settlement-engine
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/settlement-engine"]
