# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }


from genlayer import *
import json


# ---------------------------------------------------------------- Constants

N = 15
RACK_SIZE = 7
BINGO_BONUS = 50
CENTRE_R = 7
CENTRE_C = 7

VALID_WORD_MODES = ("classic", "themed", "custom")
VALID_THEMES = ("none", "crypto", "genlayer")

LETTER_POINTS = {
    "A": 1, "B": 3, "C": 3, "D": 2, "E": 1, "F": 4, "G": 2,
    "H": 4, "I": 1, "J": 8, "K": 5, "L": 1, "M": 3, "N": 1,
    "O": 1, "P": 3, "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1,
    "V": 4, "W": 4, "X": 8, "Y": 4, "Z": 10,
}

# . = normal
# l = double letter
# L = triple letter
# w = double word
# W = triple word
# * = centre, treated as double word
PREMIUM = [
    "W..l...W...l..W",
    ".w...L...L...w.",
    "..w...l.l...w..",
    "l..w...l...w..l",
    "....w.....w....",
    ".L...L...L...L.",
    "..l...l.l...l..",
    "W..l...*...l..W",
    "..l...l.l...l..",
    ".L...L...L...L.",
    "....w.....w....",
    "l..w...l...w..l",
    "..w...l.l...w..",
    ".w...L...L...w.",
    "W..l...W...l..W",
]

CRYPTO_WORDS = (
    "TOKEN", "ROLLUP", "BRIDGE", "ORACLE", "VALIDATOR", "CONSENSUS",
    "STAKING", "WALLET", "CHAIN", "NODE", "BLOCK", "HASH", "NONCE",
    "MERKLE", "ZERO", "PROOF", "SHARD", "SLASH", "YIELD", "VAULT",
    "SWAP", "POOL", "FORK", "LEDGER", "AIRDROP", "BURN", "MINT",
    "COIN", "CRYPTO", "DEFI", "DAO", "NFT", "GWEI", "ROOT", "STATE",
    "TRIE", "KECCAK", "SEED", "ADDRESS", "SMART", "CONTRACT", "GAS",
    "SIGNATURE", "LIQUIDITY", "STABLECOIN", "SETTLEMENT", "ESCROW",
)

GENLAYER_WORDS = (
    "GENLAYER", "VALIDATOR", "CONSENSUS", "GREYBOX", "PROMPT",
    "EQUIVALENCE", "INTELLIGENT", "CONTRACT", "NONDET", "PYTHON",
    "GENVM", "STUDIO", "STUDIONET", "REFEREE", "AGENT", "REASONING",
    "DETERMINISTIC", "VERIFIABLE", "WORD", "WORDCOURT", "COURT",
    "TRUST", "TILE", "SCRABBLE", "SCORE", "CHALLENGE", "SETTLEMENT",
    "BOARD", "RACK", "BAG", "PLAY", "MOVE", "PASS", "EXCHANGE",
    "BINGO", "COMMITMENT", "ORACLE", "CHAIN", "BLOCK", "PROVE",
    "PROOF", "NODE", "ROUND", "FINALITY", "LLM",
)


# ---------------------------------------------------------------- Helpers

def _sender() -> str:
    return str(gl.message.sender_address).lower()


def _key(row: int, col: int) -> str:
    return str(row) + "," + str(col)


def _inside(row: int, col: int) -> bool:
    return row >= 0 and row < N and col >= 0 and col < N


def _dumps(value) -> str:
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def _load(storage_map, game_id: str) -> dict:
    raw = storage_map.get(game_id)
    if raw is None or len(raw) == 0:
        raise gl.vm.UserError("GAME_NOT_FOUND")
    return json.loads(raw)


def _load_optional(storage_map, game_id: str):
    raw = storage_map.get(game_id)
    if raw is None or len(raw) == 0:
        return None
    return json.loads(raw)


def _premium(row: int, col: int) -> str:
    code = PREMIUM[row][col]
    if code == "l":
        return "double_letter"
    if code == "L":
        return "triple_letter"
    if code == "w":
        return "double_word"
    if code == "W":
        return "triple_word"
    if code == "*":
        return "centre"
    return "normal"


def _new_game(
    game_id: str,
    creator: str,
    word_mode: str,
    theme: str,
    max_players: int,
    rack_commitment: str,
) -> dict:
    return {
        "game_id": game_id,
        "ruleset": "wordcourt_scrabble_style",
        "creator": creator,
        "status": "waiting",

        # WordCourt modes:
        # classic = open English words
        # themed = curated crypto/genlayer dictionaries
        # custom = flexible community/event mode
        "word_mode": word_mode,
        "theme": theme,

        "max_players": max_players,
        "players": [creator],
        "current_turn_index": 0,

        # Public board as key-value map:
        # "7,7": {"letter":"C","owner":"0x...","turn":1,"blank":false}
        "board": {},

        "scores": {creator: 0},

        # Private racks and bag live in Supabase.
        # GenLayer stores commitments only.
        "rack_commitments": {creator: rack_commitment},
        "tile_bag_commitment": "",

        "move_count": 0,
        "pass_count": 0,

        "last_move": None,
        "move_history": [],

        "pending_challenge": None,
        "challenge_history": [],

        "winner": None,
        "end_reason": None,
        "final_racks_commitment": "",
    }


def _highest_scorer(game: dict, exclude: str = "") -> str:
    best = ""
    best_score = -100000000000
    for player in game["players"]:
        if player == exclude:
            continue
        score = int(game["scores"].get(player, 0))
        if best == "" or score > best_score:
            best = player
            best_score = score
    return best


def _parse_placements(placements_json: str) -> list:
    try:
        arr = json.loads(placements_json)
    except Exception:
        raise gl.vm.UserError("PLACEMENTS_JSON_INVALID")

    if not isinstance(arr, list):
        raise gl.vm.UserError("PLACEMENTS_NOT_LIST")
    if len(arr) < 1 or len(arr) > RACK_SIZE:
        raise gl.vm.UserError("PLACEMENT_COUNT_INVALID")

    out = []
    seen = {}

    for item in arr:
        if not isinstance(item, dict):
            raise gl.vm.UserError("PLACEMENT_NOT_OBJECT")

        row = int(item.get("row", -1))
        col = int(item.get("col", -1))
        letter = str(item.get("letter", "")).upper()
        blank = bool(item.get("blank", item.get("is_blank", False)))

        if not _inside(row, col):
            raise gl.vm.UserError("COORD_OUT_OF_RANGE")
        if len(letter) != 1 or letter < "A" or letter > "Z":
            raise gl.vm.UserError("LETTER_INVALID")

        k = _key(row, col)
        if k in seen:
            raise gl.vm.UserError("DUPLICATE_COORD")
        seen[k] = True

        out.append({
            "row": row,
            "col": col,
            "letter": letter,
            "blank": blank,
        })

    return out


def _parse_claimed_words(claimed_words_json: str) -> list:
    if len(claimed_words_json) == 0:
        return []

    try:
        arr = json.loads(claimed_words_json)
    except Exception:
        raise gl.vm.UserError("CLAIMED_WORDS_JSON_INVALID")

    if not isinstance(arr, list):
        raise gl.vm.UserError("CLAIMED_WORDS_NOT_LIST")

    out = []
    for item in arr:
        word = str(item).upper()
        if len(word) > 0:
            out.append(word)
    return out


def _same_word_set(a: list, b: list) -> bool:
    aa = []
    bb = []

    for w in a:
        aa.append(str(w).upper())
    for w in b:
        bb.append(str(w).upper())

    aa.sort()
    bb.sort()

    if len(aa) != len(bb):
        return False

    for i in range(len(aa)):
        if aa[i] != bb[i]:
            return False

    return True


def _check_line(placements: list) -> bool:
    rows = {}
    cols = {}

    for p in placements:
        rows[str(p["row"])] = True
        cols[str(p["col"])] = True

    horizontal = len(rows.keys()) == 1
    vertical = len(cols.keys()) == 1

    if not horizontal and not vertical:
        raise gl.vm.UserError("NOT_LINE")

    return horizontal


def _check_no_gaps(placements: list, board: dict, horizontal: bool):
    placed = {}

    for p in placements:
        placed[_key(p["row"], p["col"])] = True

    if horizontal:
        row = placements[0]["row"]
        cols = []
        for p in placements:
            cols.append(p["col"])

        start = min(cols)
        end = max(cols)

        for col in range(start, end + 1):
            k = _key(row, col)
            if k not in board and k not in placed:
                raise gl.vm.UserError("GAP_IN_WORD")
    else:
        col = placements[0]["col"]
        rows = []
        for p in placements:
            rows.append(p["row"])

        start = min(rows)
        end = max(rows)

        for row in range(start, end + 1):
            k = _key(row, col)
            if k not in board and k not in placed:
                raise gl.vm.UserError("GAP_IN_WORD")


def _board_is_empty(board: dict) -> bool:
    return len(board.keys()) == 0


def _first_move_crosses_centre(placements: list) -> bool:
    for p in placements:
        if int(p["row"]) == CENTRE_R and int(p["col"]) == CENTRE_C:
            return True
    return False


def _connects_to_existing_board(placements: list, board: dict) -> bool:
    for p in placements:
        row = int(p["row"])
        col = int(p["col"])

        neighbours = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1],
        ]

        for n in neighbours:
            if _inside(n[0], n[1]) and _key(n[0], n[1]) in board:
                return True

    return False


def _overlay_board(board: dict, placements: list, owner: str, move_number: int) -> dict:
    after = {}

    for k in board:
        after[k] = board[k]

    for p in placements:
        after[_key(p["row"], p["col"])] = {
            "letter": p["letter"],
            "owner": owner,
            "turn": move_number,
            "blank": bool(p.get("blank", False)),
        }

    return after


def _walk_word(board_after: dict, start_row: int, start_col: int, dr: int, dc: int) -> list:
    row = start_row
    col = start_col

    while _inside(row - dr, col - dc) and _key(row - dr, col - dc) in board_after:
        row -= dr
        col -= dc

    cells = []

    while _inside(row, col) and _key(row, col) in board_after:
        cells.append({"row": row, "col": col})
        row += dr
        col += dc

    return cells


def _word_from_cells(board_after: dict, cells: list) -> str:
    text = ""

    for cell in cells:
        tile = board_after[_key(cell["row"], cell["col"])]
        text += tile["letter"]

    return text


def _word_already_added(words: list, candidate: dict) -> bool:
    for w in words:
        if w["word"] == candidate["word"] and _dumps(w["cells"]) == _dumps(candidate["cells"]):
            return True
    return False


def _formed_words(board: dict, placements: list, owner: str, move_number: int) -> list:
    after = _overlay_board(board, placements, owner, move_number)
    horizontal = _check_line(placements)

    words = []

    # Main word
    if horizontal:
        row = placements[0]["row"]
        start_col = min([p["col"] for p in placements])
        main_cells = _walk_word(after, row, start_col, 0, 1)
        main_axis = "row"
    else:
        col = placements[0]["col"]
        start_row = min([p["row"] for p in placements])
        main_cells = _walk_word(after, start_row, col, 1, 0)
        main_axis = "col"

    if len(main_cells) >= 2:
        words.append({
            "word": _word_from_cells(after, main_cells),
            "cells": main_cells,
            "axis": main_axis,
        })

    # Cross words
    for p in placements:
        if horizontal:
            cross_cells = _walk_word(after, p["row"], p["col"], 1, 0)
            axis = "col"
        else:
            cross_cells = _walk_word(after, p["row"], p["col"], 0, 1)
            axis = "row"

        if len(cross_cells) >= 2:
            candidate = {
                "word": _word_from_cells(after, cross_cells),
                "cells": cross_cells,
                "axis": axis,
            }
            if not _word_already_added(words, candidate):
                words.append(candidate)

    return words


def _score_word(board_before: dict, board_after: dict, placements: list, word: dict) -> int:
    placed = {}

    for p in placements:
        placed[_key(p["row"], p["col"])] = p

    total = 0
    word_multiplier = 1

    for cell in word["cells"]:
        row = int(cell["row"])
        col = int(cell["col"])
        k = _key(row, col)
        tile = board_after[k]

        letter_score = 0 if bool(tile.get("blank", False)) else int(LETTER_POINTS.get(tile["letter"], 0))

        # Premium squares apply only to newly placed tiles.
        if k in placed and k not in board_before:
            prem = _premium(row, col)

            if prem == "double_letter":
                letter_score *= 2
            elif prem == "triple_letter":
                letter_score *= 3
            elif prem == "double_word" or prem == "centre":
                word_multiplier *= 2
            elif prem == "triple_word":
                word_multiplier *= 3

        total += letter_score

    return total * word_multiplier


def _score_move(board_before: dict, placements: list, owner: str, move_number: int, words: list) -> int:
    board_after = _overlay_board(board_before, placements, owner, move_number)
    total = 0

    for word in words:
        total += _score_word(board_before, board_after, placements, word)

    if len(placements) == RACK_SIZE:
        total += BINGO_BONUS

    return total


def _valid_themed_word(word: str, theme: str) -> bool:
    w = word.upper()

    if theme == "crypto":
        return w in CRYPTO_WORDS

    if theme == "genlayer":
        return w in GENLAYER_WORDS

    return False


def _valid_open_word(word: str, word_mode: str) -> bool:
    w = word.upper()

    prompt = (
        "You are the word judge for a Scrabble-style game called WordCourt. "
        "The selected mode is " + word_mode + ". "
        "Judge this word: " + w + ". "
        "For classic mode, allow normal valid English words. "
        "For custom mode, allow reasonable community/event words, but reject random nonsense. "
        "Reject proper nouns unless the custom mode clearly allows community terms. "
        "Reject abbreviations, hyphenated words, offensive slurs, and non-words. "
        "The word must be between 2 and 15 letters. "
        "Return exactly YES or NO."
    )

    def leader_fn():
        out = gl.nondet.exec_prompt(prompt)
        text = str(out).strip().upper()
        if text.startswith("YES"):
            return "YES"
        return "NO"

    def validator_fn(leaders_res) -> bool:
        if not isinstance(leaders_res, gl.vm.Return):
            return False
        theirs = str(leaders_res.calldata).strip().upper()
        mine = leader_fn()
        return theirs == mine

    result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
    return str(result).strip().upper() == "YES"


def _word_valid(word: str, word_mode: str, theme: str) -> bool:
    w = word.upper()

    if len(w) < 2 or len(w) > 15:
        return False

    if word_mode == "themed":
        return _valid_themed_word(w, theme)

    # classic and custom are open/unlimited valid-word modes.
    return _valid_open_word(w, word_mode)


def _all_words_valid(words: list, word_mode: str, theme: str) -> bool:
    for item in words:
        word = item["word"] if isinstance(item, dict) else str(item)
        if not _word_valid(word, word_mode, theme):
            return False
    return True


# ---------------------------------------------------------------- Contract

class WordCourt(gl.Contract):
    games: TreeMap[str, str]
    player_stats: TreeMap[str, str]
    recent_games: TreeMap[str, str]
    open_games: TreeMap[str, str]
    total_games: u256

    def __init__(self) -> None:
        self.games = TreeMap[str, str]()
        self.player_stats = TreeMap[str, str]()
        self.recent_games = TreeMap[str, str]()
        self.open_games = TreeMap[str, str]()
        self.total_games = u256(0)

    # -------------------------------------------------------------- Write API

    @gl.public.write
    def create_game(
        self,
        game_id: str,
        word_mode: str,
        theme: str,
        max_players: u256,
        rack_commitment: str,
    ) -> str:
        if len(game_id) == 0:
            raise gl.vm.UserError("GAME_ID_REQUIRED")
        if self.games.get(game_id) is not None:
            raise gl.vm.UserError("GAME_EXISTS")
        if word_mode not in VALID_WORD_MODES:
            raise gl.vm.UserError("WORD_MODE_INVALID")
        if theme not in VALID_THEMES:
            raise gl.vm.UserError("THEME_INVALID")
        if word_mode == "themed" and theme == "none":
            raise gl.vm.UserError("THEMED_MODE_REQUIRES_THEME")
        if word_mode != "themed" and theme != "none":
            raise gl.vm.UserError("THEME_ONLY_ALLOWED_FOR_THEMED_MODE")

        mp = int(max_players)
        if mp < 2 or mp > 4:
            raise gl.vm.UserError("MAX_PLAYERS_INVALID")
        if len(rack_commitment) == 0:
            raise gl.vm.UserError("RACK_COMMITMENT_REQUIRED")

        sender = _sender()
        game = _new_game(game_id, sender, word_mode, theme, mp, rack_commitment)

        self.games[game_id] = _dumps(game)
        self.open_games[game_id] = game_id
        self.total_games = u256(int(self.total_games) + 1)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": "waiting",
            "creator": sender,
            "word_mode": word_mode,
            "theme": theme,
        })

    @gl.public.write
    def join_game(self, game_id: str, rack_commitment: str) -> str:
        game = _load(self.games, game_id)
        if game["status"] != "waiting":
            raise gl.vm.UserError("NOT_JOINABLE")

        sender = _sender()

        if sender in game["players"]:
            raise gl.vm.UserError("ALREADY_JOINED")
        if len(game["players"]) >= int(game["max_players"]):
            raise gl.vm.UserError("GAME_FULL")
        if len(rack_commitment) == 0:
            raise gl.vm.UserError("RACK_COMMITMENT_REQUIRED")

        game["players"].append(sender)
        game["rack_commitments"][sender] = rack_commitment
        game["scores"][sender] = 0

        if len(game["players"]) >= int(game["max_players"]):
            self._remove_open_game(game_id)

        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": game["status"],
            "players": game["players"],
        })

    @gl.public.write
    def commit_tile_bag(self, game_id: str, bag_commitment: str) -> str:
        game = _load(self.games, game_id)
        sender = _sender()

        if sender != game["creator"]:
            raise gl.vm.UserError("ONLY_CREATOR")
        if game["status"] != "waiting":
            raise gl.vm.UserError("NOT_WAITING")
        if len(bag_commitment) == 0:
            raise gl.vm.UserError("BAG_COMMITMENT_REQUIRED")

        game["tile_bag_commitment"] = bag_commitment
        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "tile_bag_commitment": bag_commitment,
        })

    @gl.public.write
    def commit_rack(self, game_id: str, rack_commitment: str) -> str:
        game = _load(self.games, game_id)
        sender = _sender()

        if sender not in game["players"]:
            raise gl.vm.UserError("NOT_A_PLAYER")
        if game["status"] not in ["waiting", "active"]:
            raise gl.vm.UserError("RACK_COMMIT_NOT_ALLOWED")
        if len(rack_commitment) == 0:
            raise gl.vm.UserError("RACK_COMMITMENT_REQUIRED")

        game["rack_commitments"][sender] = rack_commitment
        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "player": sender,
            "rack_commitment": rack_commitment,
        })

    @gl.public.write
    def start_game(self, game_id: str) -> str:
        game = _load(self.games, game_id)
        sender = _sender()

        if sender != game["creator"]:
            raise gl.vm.UserError("ONLY_CREATOR")
        if game["status"] != "waiting":
            raise gl.vm.UserError("NOT_WAITING")
        if len(game["players"]) < 2:
            raise gl.vm.UserError("NEED_AT_LEAST_TWO_PLAYERS")
        if len(game["tile_bag_commitment"]) == 0:
            raise gl.vm.UserError("BAG_NOT_COMMITTED")

        game["status"] = "active"
        game["current_turn_index"] = 0
        self._remove_open_game(game_id)
        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": "active",
            "current_turn": game["players"][0],
        })

    @gl.public.write
    def submit_move(
        self,
        game_id: str,
        placements_json: str,
        claimed_words_json: str,
        claimed_score: u256,
        next_rack_commitment: str,
    ) -> str:
        game = _load(self.games, game_id)

        if game["status"] != "active":
            raise gl.vm.UserError("NOT_ACTIVE")
        if game["pending_challenge"] is not None:
            raise gl.vm.UserError("CHALLENGE_PENDING")

        sender = _sender()
        players = game["players"]

        if players[int(game["current_turn_index"])] != sender:
            raise gl.vm.UserError("NOT_YOUR_TURN")
        if len(next_rack_commitment) == 0:
            raise gl.vm.UserError("RACK_COMMITMENT_REQUIRED")

        placements = _parse_placements(placements_json)
        board = game["board"]

        for p in placements:
            if _key(p["row"], p["col"]) in board:
                raise gl.vm.UserError("OVERWRITE_FORBIDDEN")

        horizontal = _check_line(placements)
        _check_no_gaps(placements, board, horizontal)

        if _board_is_empty(board):
            if not _first_move_crosses_centre(placements):
                raise gl.vm.UserError("FIRST_MOVE_MUST_CROSS_CENTRE")
        else:
            if not _connects_to_existing_board(placements, board):
                raise gl.vm.UserError("NOT_CONNECTED")

        next_move_number = int(game["move_count"]) + 1
        formed = _formed_words(board, placements, sender, next_move_number)

        if len(formed) == 0:
            raise gl.vm.UserError("NO_WORD_FORMED")

        words_only = []
        for item in formed:
            words_only.append(item["word"])

        if not _all_words_valid(formed, game["word_mode"], game["theme"]):
            raise gl.vm.UserError("INVALID_WORD")

        official_score = _score_move(board, placements, sender, next_move_number, formed)
        user_claimed_score = int(claimed_score)

        if user_claimed_score != official_score:
            raise gl.vm.UserError("CLAIMED_SCORE_MISMATCH")

        claimed_words = _parse_claimed_words(claimed_words_json)
        if len(claimed_words) > 0 and not _same_word_set(claimed_words, words_only):
            raise gl.vm.UserError("CLAIMED_WORDS_MISMATCH")

        board_after = _overlay_board(board, placements, sender, next_move_number)

        game["board"] = board_after
        game["scores"][sender] = int(game["scores"].get(sender, 0)) + official_score
        game["rack_commitments"][sender] = next_rack_commitment
        game["move_count"] = next_move_number
        game["pass_count"] = 0

        move_record = {
            "move_number": next_move_number,
            "player": sender,
            "type": "play_word",
            "placements": placements,
            "formed_words": words_only,
            "word_details": formed,
            "official_score": official_score,
            "claimed_score": user_claimed_score,
            "rack_commitment_after": next_rack_commitment,
            "status": "accepted",
        }

        game["last_move"] = move_record
        game["move_history"].append(move_record)
        game["current_turn_index"] = (int(game["current_turn_index"]) + 1) % len(players)

        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "official_score": official_score,
            "formed_words": words_only,
            "next_turn": game["players"][int(game["current_turn_index"])],
        })

    @gl.public.write
    def challenge_move(self, game_id: str, move_number: u256, reason: str) -> str:
        game = _load(self.games, game_id)

        if game["status"] != "active":
            raise gl.vm.UserError("NOT_ACTIVE")
        if len(reason) == 0:
            raise gl.vm.UserError("REASON_REQUIRED")
        if game["pending_challenge"] is not None:
            raise gl.vm.UserError("CHALLENGE_ALREADY_PENDING")

        sender = _sender()

        if sender not in game["players"]:
            raise gl.vm.UserError("NOT_A_PLAYER")

        target_number = int(move_number)
        target = None

        for m in game["move_history"]:
            if int(m.get("move_number", -1)) == target_number and m.get("type") == "play_word":
                target = m

        if target is None:
            raise gl.vm.UserError("MOVE_NOT_FOUND")
        if target["player"] == sender:
            raise gl.vm.UserError("CANNOT_CHALLENGE_OWN_MOVE")

        challenge_id = "ch_" + str(len(game["challenge_history"]) + 1)

        game["pending_challenge"] = {
            "challenge_id": challenge_id,
            "challenger": sender,
            "challenged_player": target["player"],
            "move_number": target_number,
            "reason": reason,
            "status": "open",
        }
        game["status"] = "challenge_pending"

        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "challenge_id": challenge_id,
            "status": "challenge_pending",
        })

    @gl.public.write
    def resolve_challenge(self, game_id: str, challenge_id: str) -> str:
        game = _load(self.games, game_id)

        if game["status"] != "challenge_pending":
            raise gl.vm.UserError("NO_OPEN_CHALLENGE")

        ch = game["pending_challenge"]

        if ch is None:
            raise gl.vm.UserError("NO_PENDING_CHALLENGE")
        if ch["challenge_id"] != challenge_id:
            raise gl.vm.UserError("CHALLENGE_ID_MISMATCH")

        target_number = int(ch["move_number"])
        target = None

        for m in game["move_history"]:
            if int(m.get("move_number", -1)) == target_number:
                target = m

        if target is None:
            raise gl.vm.UserError("MOVE_NOT_FOUND")

        word_items = []
        for w in target.get("formed_words", []):
            word_items.append({"word": w})

        valid = _all_words_valid(word_items, game["word_mode"], game["theme"])

        if valid:
            ch["status"] = "failed"
            ch["result"] = "challenge_failed"
            ch["invalid_words"] = []
            target["status"] = "confirmed_after_failed_challenge"

            challenger = ch["challenger"]
            if game["players"][int(game["current_turn_index"])] == challenger:
                game["current_turn_index"] = (int(game["current_turn_index"]) + 1) % len(game["players"])

            outcome = "CHALLENGE_FAILED"
        else:
            ch["status"] = "succeeded"
            ch["result"] = "challenge_succeeded"
            ch["invalid_words"] = target.get("formed_words", [])
            target["status"] = "removed_after_successful_challenge"

            challenged_player = target["player"]
            game["scores"][challenged_player] = int(game["scores"].get(challenged_player, 0)) - int(target.get("official_score", 0))

            new_board = {}
            for k in game["board"]:
                tile = game["board"][k]
                if int(tile.get("turn", 0)) != target_number:
                    new_board[k] = tile
            game["board"] = new_board

            for i in range(len(game["players"])):
                if game["players"][i] == challenged_player:
                    game["current_turn_index"] = i

            outcome = "CHALLENGE_SUCCEEDED"

        game["challenge_history"].append(ch)
        game["pending_challenge"] = None
        game["status"] = "active"

        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "challenge_id": challenge_id,
            "outcome": outcome,
        })

    @gl.public.write
    def pass_turn(self, game_id: str, next_rack_commitment: str) -> str:
        game = _load(self.games, game_id)

        if game["status"] != "active":
            raise gl.vm.UserError("NOT_ACTIVE")
        if game["pending_challenge"] is not None:
            raise gl.vm.UserError("CHALLENGE_PENDING")

        sender = _sender()
        players = game["players"]

        if players[int(game["current_turn_index"])] != sender:
            raise gl.vm.UserError("NOT_YOUR_TURN")
        if len(next_rack_commitment) == 0:
            raise gl.vm.UserError("RACK_COMMITMENT_REQUIRED")

        next_move_number = int(game["move_count"]) + 1

        game["rack_commitments"][sender] = next_rack_commitment
        game["move_count"] = next_move_number
        game["pass_count"] = int(game["pass_count"]) + 1

        record = {
            "move_number": next_move_number,
            "player": sender,
            "type": "pass",
            "official_score": 0,
            "rack_commitment_after": next_rack_commitment,
        }

        game["last_move"] = record
        game["move_history"].append(record)

        if int(game["pass_count"]) >= 2 * len(players):
            self._complete_game(game, "consecutive_full_round_passes")
        else:
            game["current_turn_index"] = (int(game["current_turn_index"]) + 1) % len(players)

        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": game["status"],
        })

    @gl.public.write
    def record_exchange(self, game_id: str, exchange_commitment: str, next_rack_commitment: str) -> str:
        game = _load(self.games, game_id)

        if game["status"] != "active":
            raise gl.vm.UserError("NOT_ACTIVE")
        if game["pending_challenge"] is not None:
            raise gl.vm.UserError("CHALLENGE_PENDING")

        sender = _sender()
        players = game["players"]

        if players[int(game["current_turn_index"])] != sender:
            raise gl.vm.UserError("NOT_YOUR_TURN")
        if len(exchange_commitment) == 0:
            raise gl.vm.UserError("EXCHANGE_COMMITMENT_REQUIRED")
        if len(next_rack_commitment) == 0:
            raise gl.vm.UserError("RACK_COMMITMENT_REQUIRED")

        next_move_number = int(game["move_count"]) + 1

        game["rack_commitments"][sender] = next_rack_commitment
        game["move_count"] = next_move_number
        game["pass_count"] = 0

        record = {
            "move_number": next_move_number,
            "player": sender,
            "type": "exchange",
            "exchange_commitment": exchange_commitment,
            "official_score": 0,
            "rack_commitment_after": next_rack_commitment,
        }

        game["last_move"] = record
        game["move_history"].append(record)
        game["current_turn_index"] = (int(game["current_turn_index"]) + 1) % len(players)

        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": game["status"],
        })

    @gl.public.write
    def forfeit_game(self, game_id: str) -> str:
        return self.resign_game(game_id)

    @gl.public.write
    def resign_game(self, game_id: str) -> str:
        game = _load(self.games, game_id)

        if game["status"] not in ["active", "challenge_pending"]:
            raise gl.vm.UserError("NOT_ACTIVE")

        sender = _sender()

        if sender not in game["players"]:
            raise gl.vm.UserError("NOT_A_PLAYER")

        game["scores"][sender] = -1000000000
        self._complete_game(game, "resignation:" + sender)
        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": "completed",
            "winner": game["winner"],
        })

    @gl.public.write
    def end_game(self, game_id: str, final_racks_commitment: str) -> str:
        game = _load(self.games, game_id)

        if game["status"] not in ["active", "challenge_pending"]:
            raise gl.vm.UserError("NOT_ACTIVE")

        sender = _sender()

        if sender not in game["players"]:
            raise gl.vm.UserError("NOT_A_PLAYER")
        if len(final_racks_commitment) == 0:
            raise gl.vm.UserError("FINAL_RACKS_COMMITMENT_REQUIRED")

        game["final_racks_commitment"] = final_racks_commitment
        self._complete_game(game, "manual_final_settlement")
        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": "completed",
            "winner": game["winner"],
        })

    @gl.public.write
    def cancel_game(self, game_id: str) -> str:
        game = _load(self.games, game_id)
        sender = _sender()

        if sender != game["creator"]:
            raise gl.vm.UserError("ONLY_CREATOR")
        if game["status"] != "waiting":
            raise gl.vm.UserError("ONLY_CANCEL_BEFORE_START")

        game["status"] = "cancelled"
        game["end_reason"] = "cancelled_by_creator"
        self._remove_open_game(game_id)
        self._save_game(game_id, game)

        return _dumps({
            "accepted": True,
            "game_id": game_id,
            "status": "cancelled",
        })

    # --------------------------------------------------------------- View API

    @gl.public.view
    def get_total_games(self) -> u256:
        return self.total_games

    @gl.public.view
    def get_game(self, game_id: str) -> str:
        raw = self.games.get(game_id)
        if raw is None:
            return ""
        return raw

    @gl.public.view
    def get_status(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None:
            return "NOT_FOUND"
        return game["status"]

    @gl.public.view
    def get_board(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None:
            return "{}"
        return _dumps(game["board"])

    @gl.public.view
    def get_scores(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None:
            return "{}"
        return _dumps(game["scores"])

    @gl.public.view
    def get_current_turn(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None:
            return ""
        if game["status"] != "active":
            return ""
        return game["players"][int(game["current_turn_index"])]

    @gl.public.view
    def get_move_history(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None:
            return "[]"
        return _dumps(game["move_history"])

    @gl.public.view
    def get_last_move(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None or game["last_move"] is None:
            return ""
        return _dumps(game["last_move"])

    @gl.public.view
    def get_challenges(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None:
            return "[]"
        return _dumps(game["challenge_history"])

    @gl.public.view
    def get_pending_challenge(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None or game["pending_challenge"] is None:
            return ""
        return _dumps(game["pending_challenge"])

    @gl.public.view
    def get_winner(self, game_id: str) -> str:
        game = _load_optional(self.games, game_id)
        if game is None:
            return ""
        winner = game.get("winner")
        return "" if winner is None else winner

    @gl.public.view
    def get_player_stats(self, player: str) -> str:
        key = player.lower()
        raw = self.player_stats.get(key)
        if raw is None:
            return _dumps(self._default_stats(key))
        return raw

    @gl.public.view
    def get_leaderboard(self, limit: u256) -> str:
        entries = []

        for _, raw in self.player_stats.items():
            entries.append(json.loads(raw))

        entries.sort(key=self._rank_key, reverse=True)
        return _dumps(entries[:int(limit)])

    @gl.public.view
    def get_recent_games(self, limit: u256) -> str:
        entries = []

        for _, raw in self.recent_games.items():
            entries.append(json.loads(raw))

        entries.sort(key=lambda item: int(item.get("move_count", 0)), reverse=True)
        return _dumps(entries[:int(limit)])

    @gl.public.view
    def get_open_games(self, limit: u256) -> str:
        entries = []

        for _, game_id in self.open_games.items():
            raw = self.games.get(game_id)
            if raw is not None:
                entries.append(json.loads(raw))

        return _dumps(entries[:int(limit)])

    @gl.public.view
    def preview_move(self, game_id: str, placements_json: str) -> str:
        game = _load(self.games, game_id)
        placements = _parse_placements(placements_json)
        board = game["board"]

        for p in placements:
            if _key(p["row"], p["col"]) in board:
                raise gl.vm.UserError("OVERWRITE_FORBIDDEN")

        horizontal = _check_line(placements)
        _check_no_gaps(placements, board, horizontal)

        if _board_is_empty(board):
            if not _first_move_crosses_centre(placements):
                raise gl.vm.UserError("FIRST_MOVE_MUST_CROSS_CENTRE")
        else:
            if not _connects_to_existing_board(placements, board):
                raise gl.vm.UserError("NOT_CONNECTED")

        next_move_number = int(game["move_count"]) + 1
        formed = _formed_words(board, placements, _sender(), next_move_number)
        score = _score_move(board, placements, _sender(), next_move_number, formed)

        words_only = []
        for item in formed:
            words_only.append(item["word"])

        return _dumps({
            "formed_words": words_only,
            "word_details": formed,
            "official_score": score,
        })

    # ------------------------------------------------------------ Internals

    def _save_game(self, game_id: str, game: dict):
        self.games[game_id] = _dumps(game)

    def _remove_open_game(self, game_id: str):
        if game_id in self.open_games:
            del self.open_games[game_id]

    def _complete_game(self, game: dict, reason: str):
        game["status"] = "completed"
        game["end_reason"] = reason
        game["winner"] = _highest_scorer(game)
        self._update_stats(game)
        self._add_recent_game(game)

    def _add_recent_game(self, game: dict):
        key = game["game_id"] + ":" + str(int(game["move_count"]))
        self.recent_games[key] = _dumps(game)

    def _default_stats(self, player: str) -> dict:
        return {
            "player": player,
            "games_played": 0,
            "wins": 0,
            "losses": 0,
            "total_score": 0,
            "highest_score": 0,
            "rank_points": 1000,
            "last_result": "",
        }

    def _load_stats(self, player: str) -> dict:
        key = player.lower()
        raw = self.player_stats.get(key)

        if raw is None:
            return self._default_stats(key)

        return json.loads(raw)

    def _update_stats(self, game: dict):
        winner = game["winner"]

        for player in game["players"]:
            key = player.lower()
            stats = self._load_stats(key)
            score = int(game["scores"].get(player, 0))

            stats["games_played"] += 1
            stats["total_score"] += score
            stats["highest_score"] = max(int(stats["highest_score"]), score)

            if player == winner:
                stats["wins"] += 1
                stats["rank_points"] += 25
                stats["last_result"] = "win"
            else:
                stats["losses"] += 1
                stats["rank_points"] = max(0, int(stats["rank_points"]) - 10)
                stats["last_result"] = "loss"

            self.player_stats[key] = _dumps(stats)

    def _rank_key(self, item: dict):
        games = int(item["games_played"])
        avg_score = int(item["total_score"]) / games if games > 0 else 0

        return (
            int(item["rank_points"]),
            int(item["wins"]),
            avg_score,
            int(item["highest_score"]),
            games,
        )