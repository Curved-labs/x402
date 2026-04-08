.PHONY: build test lint format clean check

build:
	cargo build --release

check:
	cargo check --workspace

test:
	cargo test

test-all:
	cargo test -- --include-ignored

lint:
	cargo clippy --workspace -- -W warnings

format:
	cargo fmt --all

format-check:
	cargo fmt --all -- --check

clean:
	cargo clean

web-dev:
	cd web && npm run dev

web-build:
	cd web && npm run build
