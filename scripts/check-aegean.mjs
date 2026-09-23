/** Serial regression runner: one bounded Node process at a time. No server or browser. */
import { buildSync } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), "modulo-aegean-"));
const checks = [
  "check-content",
  "check-npc-schedules",
  "check-casino",
  "check-ui-style",
  "check-aegean-content",
  "check-island-integration",
  "check-endgame-reforge",
  "check-primordial",
  "check-save-rejoin",
  "check-marine",
  "check-aegean-life",
  "check-aegean-world",
  "check-aegean-waypoints",
  "check-aegean-activity-scenes",
  "check-aegean-encounters",
  "check-aegean-damage",
  "check-aegean-calibration",
  "check-aegean-services",
  "check-aegean-ship-guidance",
  "check-aegean-integration",
  "check-aegean-active-world",
  "check-aegean-bestiary",
  "check-aegean-dungeons",
  "check-aegean-living-myths",
];
try {
  for (const name of checks) {
    console.log(`\n${name}`);
    const output = join(temporary, `${name}.mjs`);
    buildSync({
      entryPoints: [join(root, "scripts", `${name}.ts`)],
      outfile: output,
      bundle: true,
      platform: "node",
      format: "esm",
      logLevel: "warning",
    });
    const result = spawnSync(process.execPath, [output, ...(name === "check-aegean-life" ? ["--world"] : [])], {
      cwd: root,
      stdio: "inherit",
      timeout: 60000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`${name} failed (${result.status})`);
  }
  for (const name of ["check-legacy-mechanics", "check-legacy-art"]) {
    console.log(`\n${name}`);
    const parity = spawnSync(process.execPath, [join(root, `scripts/${name}.mjs`)], { cwd: root, stdio: "inherit", timeout: 60000 });
    if (parity.error) throw parity.error;
    if (parity.status !== 0) throw new Error(`${name} failed`);
  }
  console.log("\nAll Aegean and compatibility checks passed.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
