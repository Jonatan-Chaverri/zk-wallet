#!/bin/bash
set -e

# Load environment variables
set -a
source .env
set +a

DOCKER_DEFAULT_PLATFORM=linux/arm64 cargo stylus deploy \
  --wasm-file target/wasm32-unknown-unknown/release/user_wallet.wasm \
  --endpoint="$RPC_URL" \
  --private-key="$ACCOUNT_PRIVATE_KEY" \