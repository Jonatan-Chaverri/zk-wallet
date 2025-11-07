#!/bin/bash
set -e

# Load environment variables
set -a
source .env
set +a

cargo stylus deploy \
  --endpoint="$RPC_URL" \
  --private-key="$ACCOUNT_PRIVATE_KEY"