# Backroom cruising research: Part 5 parallel handover

Canonical queue (READ-ONLY): research/cruising/part5/master_queue.json
Full original evidence: research/cruising/cross_source_alignment_2026-11-06.json and original eight scrape files plus supplemental archives.

## Four non-overlapping workers
A: indexes 1-293, progress research/cruising/part5/tracker_A.json, batches research/cruising/part5/A/
B: indexes 294-586, progress research/cruising/part5/tracker_B.json, batches research/cruising/part5/B/
C: indexes 587-879, progress research/cruising/part5/tracker_C.json, batches research/cruising/part5/C/
D: indexes 880-1172, progress research/cruising/part5/tracker_D.json, batches research/cruising/part5/D/

## Workflow
1. Read canonical queue and OWN tracker, inspect any already committed section batch files, continue at next_index; never restart from initial range after checkpoints.
2. Check each candidate across eight source websites: Gays-Cruising.com, gay-szene.net, Planet Randy, The Gay Passport, Splashd, Popcorn.dating, Squirt.org, CruisingGays. Supplement with official and other independent sources as needed.
3. Record per-source states: linked page matched, searched-no-match, unavailable/blocked, or not checked; do not label an inaccessible website as no match. Preserve original exact URLs, notes, and verification dates.
4. Separate proof that a location exists, historic/undated directory mentions, and credible dated evidence of actual cruising within 12 months (cutoff for this cycle 2025-11-06). Do not invent times, coordinates, crowds or recent activity.
5. Collect evidence for EVERY candidate, even commercial or access-sensitive places, without deleting records during research. Flag concerns. No live/public listings or events modifications.
6. After each five completed entries, commit unique batch file FIRST (e.g. A/batch_0001_0005.json), then fetch OWN tracker for its CURRENT blob SHA and update its progress/cursor/checkpoints. Read back to verify. End-of-range final fewer than 5 may be checkpointed.
7. Only edit your own letter folder and tracker. Never edit master_queue.json, shared README, shared master research, original archives, or another chat's files.

## GitHub concurrency and error recovery
- Other chats committing to the same branch is normal when writing distinct paths. Never use force push.
- On update SHA mismatch, 409, or 422: fetch OWN tracker again; reconcile latest content; retry with fresh SHA (up to 3 attempts). Do not blindly replay a failed update.
- On existing batch path: read it; verify queue IDs and payload. If it is already your successful commit, use it and advance tracker. If it contains differing data, stop rather than overwrite and write a separate correction file if necessary.
- On temporary 5xx/busy error: verify whether the attempted write actually committed before retry; then retry conservatively. Follow Retry-After or rate limit guidance; do not spam requests or falsely claim success.
- If batch committed but tracker update failed/interrupted: next chat reads saved batch, verifies matching five IDs, and repairs the tracker without repeating the work.
- If GitHub remains unavailable, provide the batch artifact and last CONFIRMED commit in chat for recovery, without marking uncommitted work as saved.
- If two chats accidentally use same section: stop writes and reconcile ownership, do not overwrite.

## New chat handover
Before stopping, report assigned section, total completed and remaining, latest saved batch paths, last committed ID, next_index and next_id, blockers, and any unresolved GitHub write failure.
At start, read queue and OWN tracker from GitHub, then last batch for confirmation.
