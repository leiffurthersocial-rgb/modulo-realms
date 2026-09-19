import type { EnemyDef } from "../enemies";

/**
 * Greek attacks must remain meaningful even against original equipment that
 * has been reforged dozens of times. This is a minimum share of maximum health,
 * not extra/true damage: Game applies it after armour, before the usual brace,
 * shield, wards and absorption. Dodging or leaving the warning still avoids it.
 * Raw damage remains the stronger threat for normally equipped characters.
 */
export function aegeanMinimumHit(
  def: Pick<EnemyDef, "id" | "role">,
  power = 1,
): number {
  if (!def.id.startsWith("aegean_") || !Number.isFinite(power)) return 0;
  const share = def.id === "aegean_leonidas" ? 0.12
    : def.role === "boss" ? 0.1
      : def.role === "elite" ? 0.05
        : def.role === "brute" ? 0.04 : 0.03;
  return Math.min(0.45, share * Math.max(0, power));
}
