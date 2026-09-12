import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generateId(): string {
  return crypto.randomUUID();
}

/** Reads the favored team's side off an odds string like "SEA -3.5" (the
 * format ESPN's odds field is stored in — see game-sync-core.ts). Returns
 * null if odds are missing or the abbreviation doesn't match either team. */
export function favoredSide(
  odds: string | null | undefined,
  homeAbbr: string,
  awayAbbr: string
): "home" | "away" | null {
  if (!odds) return null;
  const favorite = odds.trim().split(/\s+/)[0]?.toUpperCase();
  if (favorite === homeAbbr.toUpperCase()) return "home";
  if (favorite === awayAbbr.toUpperCase()) return "away";
  return null;
}

export function getTeamLogoUrl(abbreviation: string, logoFromApi?: string): string {
  // Use ESPN CDN for logos - external source to avoid hosting copyrighted content
  return logoFromApi || `https://a.espncdn.com/i/teamlogos/nfl/500/${abbreviation.toLowerCase()}.png`;
}

export function formatGameDate(date: Date): string {
  return date.toLocaleString("en-us", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatGameTime(date: Date): string {
  return date.toLocaleString("en-us", {
    hour: "numeric",
    minute: "numeric",
  });
}

export function getSeasonTypeName(seasonType: number): string {
  switch (seasonType) {
    case 1:
      return "Preseason";
    case 2:
      return "Regular Season";
    case 3:
      return "Postseason";
    default:
      return "Regular Season";
  }
}

// `seed` should be something stable and unique per user (username or id) so
// the generated avatar stays the same across page loads, the way GitHub's
// and Discord's default avatars do — falling back to `name` at call sites
// where nothing more stable is on hand is an acceptable trade-off (it only
// risks two users with the same display name getting the same avatar).
export function getAvatarUrl(seed: string, avatar?: string | null): string {
  if (avatar) {
    return avatar; // Will be R2 URL in production
  }
  // .png (not .svg) avoids Next/Image's dangerouslyAllowSVG restriction on
  // remote SVG sources.
  return `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(seed)}`;
}

// Hash password using the Web Crypto API (available in Node without a package)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    data,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(hash);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const combined = Uint8Array.from(atob(storedHash), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const storedHashBytes = combined.slice(16);

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    data,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(hash);

  if (hashArray.length !== storedHashBytes.length) return false;
  return hashArray.every((byte, i) => byte === storedHashBytes[i]);
}
