#!/bin/bash
set -e

# Load environment variables
set -a
source .env
set +a

# Check if --test option is passed
if [[ "$1" == "--test" ]]; then
  cargo stylus check \
    --endpoint="$RPC_URL"
else
  cargo stylus deploy \
    --endpoint="$RPC_URL" \
    --private-key="$ACCOUNT_PRIVATE_KEY"
fi