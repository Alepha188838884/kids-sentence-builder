#!/usr/bin/env bash
set -euo pipefail

for i in $(seq 0 19); do
  file="dist/images/${i}.webp"
  if [ ! -f "$file" ]; then
    echo "Missing image: $file"
    exit 1
  fi
done

echo "All expected images are present in dist/images (0.webp - 19.webp)."
