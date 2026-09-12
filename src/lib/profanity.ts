import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// obscenity's transformer-based matching catches compound/obfuscated variants
// (e.g. "fuckt4rd", "wordsbeforefuckandafter") that a plain word-boundary
// wordlist check misses, while still avoiding false positives on ordinary
// words that merely contain a blocked substring ("assess", "bananas").
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function containsProfanity(text: string): boolean {
  // obscenity's transformers handle repeated/leetspeak/unicode obfuscation
  // within a word, but not arbitrary whitespace inserted between letters
  // ("f u c k") — so also check the text with all whitespace stripped.
  return matcher.hasMatch(text) || matcher.hasMatch(text.replace(/\s+/g, ""));
}
