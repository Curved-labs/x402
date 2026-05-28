.PHONY: build test lint format clean deploy

build:
	anchor build
	cd sdk && npm run build

test:
	cd sdk && npm run test:suite

test-all:
	cd sdk && npm run test:suite && npm run test:wallet

lint:
	cargo fmt --all -- --check
	cd sdk && npx tsc --noEmit

format:
	cargo fmt --all
	cd sdk && npx prettier --write "src/**/*.ts"

clean:
	rm -rf target sdk/dist

deploy:
	anchor deploy --provider.cluster devnet
