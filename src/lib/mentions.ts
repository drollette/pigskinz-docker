/** Escapes regex special characters in a literal string. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches `@<username>` directly against a known candidate list rather than
 * extracting a `\w`-only token -- usernames aren't restricted to a single
 * word (e.g. "Roast Beef DLUX"), so splitting on whitespace would cut a
 * multi-word username off at its first space and never match it. Longest
 * candidate first, so a short username that prefixes a longer one can't
 * shadow it. */
function matchMentionAt(body: string, atIndex: number, sortedCandidates: string[]): string | null {
  const rest = body.slice(atIndex);
  for (const username of sortedCandidates) {
    if (new RegExp(`^@${escapeRegExp(username)}(?![a-zA-Z0-9_-])`, "i").test(rest)) {
      return username;
    }
  }
  return null;
}

/** Which of `candidateUsernames` are actually @mentioned in `body`. Used
 * server-side to decide who to notify. */
export function findMentionedUsernames(body: string, candidateUsernames: string[]): Set<string> {
  const sorted = [...new Set(candidateUsernames)].sort((a, b) => b.length - a.length);
  const matched = new Set<string>();
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "@") continue;
    const match = matchMentionAt(body, i, sorted);
    if (match) matched.add(match.toLowerCase());
  }
  return matched;
}

/** Splits `body` into plain-text and @mention segments (preserving the
 * original casing/spacing of each mention as typed) for highlighting. Used
 * client-side so the highlight only ever covers a mention that actually
 * matched a real target. */
export function splitMessageForMentions(
  body: string,
  candidateUsernames: string[]
): { text: string; isMention: boolean }[] {
  const sorted = [...new Set(candidateUsernames)].sort((a, b) => b.length - a.length);
  const segments: { text: string; isMention: boolean }[] = [];
  let plainStart = 0;
  let cursor = 0;

  while (cursor < body.length) {
    if (body[cursor] === "@") {
      const match = matchMentionAt(body, cursor, sorted);
      if (match) {
        if (cursor > plainStart) segments.push({ text: body.slice(plainStart, cursor), isMention: false });
        const matchedText = body.slice(cursor, cursor + 1 + match.length);
        segments.push({ text: matchedText, isMention: true });
        cursor += matchedText.length;
        plainStart = cursor;
        continue;
      }
    }
    cursor++;
  }
  if (plainStart < body.length) segments.push({ text: body.slice(plainStart), isMention: false });
  return segments;
}
