# WordCourt - GenLayer Intelligent Contract

`wordcourt.py` is the GenLayer-refereed Scrabble contract. Public board, scoring,
word validation, challenge resolution, and winner settlement live here. Private
racks and the tile bag live in Supabase; only their commitments are stored here.

GenVM runner pin: **v0.2.16** (hash `1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`).

## Public API (12 main + 1 helper + 10 views)

### Writes
| Function | Caller | Effect |
|---|---|---|
| `create_game(game_id, max_players, rack_commitment)` | anyone | creates a `waiting` game; creator becomes player 0 |
| `set_dictionary_mode(game_id, mode)` | creator | optional; before `start_game`; one of `classic` / `crypto` / `genlayer` / `naija` / `custom` |
| `join_game(game_id, rack_commitment)` | any wallet | joins a `waiting` game (up to `max_players`) |
| `commit_tile_bag(game_id, tile_bag_commitment)` | creator | stores the bag commitment |
| `start_game(game_id)` | creator | requires bag committed + at least 2 players |
| `submit_move(game_id, placements_json, next_rack_commitment)` | current player | validates placement, words, scoring; advances turn |
| `challenge_last_move(game_id, reason)` | non-mover | opens a pending challenge against the last move |
| `resolve_challenge(game_id)` | any player | adjudicates: revert + score-back if any word is invalid, else challenger forfeits next turn |
| `pass_turn(game_id, next_rack_commitment)` | current player | advances turn; ends game on `2 * num_players` consecutive passes |
| `record_exchange(game_id, exchanged_count, next_rack_commitment)` | current player | records tile-exchange commitment; resets pass streak |
| `resign_game(game_id)` | any player | marks them lowest, completes the game |
| `end_game(game_id, reason)` | creator | force-finalises an active game |
| `cancel_game(game_id)` | creator | only valid while `waiting` |

### Views
`get_total_games`, `get_game`, `get_status`, `get_current_turn`, `get_scores`, `get_board`, `get_history`, `get_last_move`, `get_pending_challenge`, `get_winner`.

## Architecture notes (matches the project PDF)

- **Tile bag and racks** are server-managed by Supabase. Only their commitments
  (`bag_commitment`, `rack_commitment`) are stored on-chain for auditability.
  This is the right MVP trust model - upgrading to encrypted commitments or ZK
  proofs is a future hardening pass, not a launch requirement.
- **Word validation** is split:
  - `crypto` and `genlayer` modes: deterministic embedded sets, no LLM calls.
  - `classic`, `naija`, `custom`: `gl.vm.run_nondet_unsafe` runs an LLM check on
    every validator, and consensus is required. The contract never lets the LLM
    invent words - the prompt only accepts a strict YES / NO.
- **Scoring** is fully deterministic in-contract: letter multipliers apply only
  to newly placed tiles; word multipliers apply when a new tile sits on a DW/TW
  square; centre acts as DW for the first move; +50 bingo bonus for using all 7
  rack tiles in one move. Blank tiles score zero.

## Deployment - GenLayer Studio (easiest, no Docker)

1. Open https://studio.genlayer.com
2. Connect a StudioNet account. If it needs funding, claim from the StudioNet
   faucet inside Studio (1000 GEN is plenty).
3. Open a new contract tab and paste the full contents of `wordcourt.py`.
4. Click **Deploy**. The wallet popup will ask you to sign.
5. After confirmation, copy the deployed **contract address** (`0x...`) and
   paste it back to the chat so the frontend can be wired.

### If the deploy is rejected with `invalid_contract` or never registers

That means StudioNet is rejecting on source size (current build = ~21 KB).
The size limit moves between Studio releases; current safe-deploy ceiling is
empirical. Tell me, and I will trim by:
- shrinking the two embedded dictionaries,
- moving comment/docstring lines out,
- inlining one-line helpers.

The architectural shape will not change - only byte count.

## Deployment - CLI (alternative)

Requires `py -3.12` venv with `genlayer-py` and an operator private key with
StudioNet GEN. Reference script lives at `deploy/deploy_studionet.py` (not
required for the Studio UI path above).

## After deployment

Once you have the contract address:
1. Paste it back to the chat.
2. I update `apps/web/.env.local`:
   - `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=<your address>`
3. Phase 5 wires the frontend to it through `lib/genlayer/` (read/write helpers,
   wallet-signed calls via genlayer-js, contract event sync into Supabase).
