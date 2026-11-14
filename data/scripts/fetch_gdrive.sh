#!/bin/bash
# Download Google Drive files by id into a folder, one at a time.
#   ./fetch_gdrive.sh ../raw/cellebrite-2023 <id> [<id> ...]
# Needs gdown (pipx install gdown). Drive does not allow resuming these files and
# blocks anonymous downloads of a file for a while after heavy use. Refused files
# are skipped and listed at the end; retry them in a few hours, or download them in
# a signed-in browser instead.
set -u
dir="$1"; shift
mkdir -p "$dir"
failed=""
for id in "$@"; do
  echo "[$(date +%T)] $id"
  before=$(ls "$dir" | grep -vc '\.part$')
  ( cd "$dir" && gdown "https://drive.google.com/uc?id=$id" 2>&1 | tr '\r' '\n' | grep -v '%|' | tail -3 )
  after=$(ls "$dir" | grep -vc '\.part$')
  if [ "$after" -le "$before" ]; then
    echo "[$(date +%T)] FAILED $id: Drive refused or the download broke. Skipping."
    failed="$failed $id"
    find "$dir" -name '*.part' -delete
    continue
  fi
  find "$dir" -name '*.part' -delete
  echo "[$(date +%T)] OK $id"
done
echo "[$(date +%T)] finished. Failed:${failed:- none}"; ls -la "$dir"
[ -z "$failed" ]
