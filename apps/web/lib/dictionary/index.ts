/**
 * Local word-format validation.
 *
 * Does NOT validate against a word list — that is GenLayer's job (LLM-based).
 * These checks catch obviously malformed submissions before hitting the
 * GenLayer contract, saving the user a failed transaction fee.
 */

export const MIN_WORD_LENGTH = 2;
export const MAX_WORD_LENGTH = 15; // longest Scrabble word that fits on a 15×15 board

export type WordValidation =
  | { valid: true }
  | { valid: false; reason: string };

/** Checks word format only (length, characters). No dictionary lookup. */
export function validateWordFormat(word: string): WordValidation {
  if (!word || word.length < MIN_WORD_LENGTH) {
    return { valid: false, reason: `Word must be at least ${MIN_WORD_LENGTH} letters.` };
  }
  if (word.length > MAX_WORD_LENGTH) {
    return { valid: false, reason: `Word exceeds max length of ${MAX_WORD_LENGTH}.` };
  }
  if (!/^[A-Za-z]+$/.test(word)) {
    return { valid: false, reason: 'Word must contain only letters A–Z.' };
  }
  return { valid: true };
}

/** Validates all formed words in a move. Returns the first failure, or valid. */
export function validateFormedWords(words: string[]): WordValidation {
  if (words.length === 0) {
    return { valid: false, reason: 'No words formed. At least one word must be created.' };
  }
  for (const word of words) {
    const result = validateWordFormat(word);
    if (!result.valid) return result;
  }
  return { valid: true };
}
