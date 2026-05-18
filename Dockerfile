FROM rust:1.84-slim-bookworm AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY client/Cargo.toml client/Cargo.lock* ./client/
RUN mkdir -p client/src && \
    echo "fn main() {}" > client/src/main.rs && \
    cd client && cargo build --release || true
COPY client client
RUN cd client && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -r -u 1001 -m x402
COPY --from=builder /app/client/target/release/s2_http /usr/local/bin/x402-relay
COPY --from=builder /app/client/target/release/s3_relay /usr/local/bin/x402-batch
USER x402
ENTRYPOINT ["x402-relay"]
