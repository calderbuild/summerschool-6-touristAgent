import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { A11Y_CLAIMS, DATA_CLAIMS } from "../legal";

// Resolved from this file, not from the working directory: the suite has to give
// the same answer whether it is run from mvp-demo or from the repository root.
const APP = resolve(fileURLToPath(import.meta.url), "../../..");
const at = (...parts: string[]) => join(APP, ...parts);

/**
 * The privacy page tells the reader how to check it. These run the checks, so a
 * claim cannot quietly stop being true: the page would be lying and this fails.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

describe("the privacy and accessibility page", () => {
  it("is written in all three languages, with no empty string", () => {
    for (const claim of [...DATA_CLAIMS, ...A11Y_CLAIMS]) {
      for (const lang of ["en", "fr", "zh"] as const) {
        expect(claim.title[lang].trim().length).toBeGreaterThan(0);
        expect(claim.body[lang].trim().length).toBeGreaterThan(0);
        if (claim.check) expect(claim.check[lang].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("still has nothing that logs, which is what the page claims", () => {
    const files = [...walk(at("app")), ...walk(at("lib")), ...walk(at("components"))];
    const logging = files.filter((f) =>
      /console\.(log|error|warn|info|debug|trace)\(/.test(readFileSync(f, "utf8")),
    );
    expect(logging).toEqual([]);
  });

  it("still sends your words to exactly one place", () => {
    const chat = readFileSync(at("app", "api", "chat", "route.ts"), "utf8");
    const hosts = [...chat.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((m) => m[1]);
    // Whatever else this file calls, the only host that can receive a message is
    // the model's. A new host here needs a sentence on the page before it ships.
    expect(new Set(hosts)).toEqual(new Set(["api.deepseek.com", "api.open-meteo.com"]));
  });

  it("still sets the permissions policy the page quotes", () => {
    const config = readFileSync(at("next.config.ts"), "utf8");
    const quoted = DATA_CLAIMS.flatMap((c) => (c.check ? [c.check.en] : [])).find((s) =>
      s.startsWith("Permissions-Policy:"),
    );
    expect(quoted).toBeDefined();
    const value = quoted!.replace("Permissions-Policy: ", "").trim();
    expect(config).toContain(value);
  });
});
