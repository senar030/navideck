#!/usr/bin/env node
// Erzeugt eine lokale Xcode-Arbeitskopie außerhalb des Nextcloud-Ordners.
//
// Xcode schreibt beim Öffnen/Bauen ständig in Navideck.xcodeproj. Liegt das
// Projekt in einem synchronisierten Ordner, legt Nextcloud Duplikate an und
// leert irgendwann die project.pbxproj. Deshalb wird hier eine Kopie unter
// ~/Developer/navideck-ios erzeugt und dort das Projekt generiert.
//
// Aufruf:
//   node scripts/ios-workdir.mjs           # Kopie erzeugen/aktualisieren
//   node scripts/ios-workdir.mjs --open    # zusätzlich in Xcode öffnen

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repoRoot, "ios");
const target = process.argv[2]?.startsWith("-")
  ? path.join(homedir(), "Developer", "navideck-ios")
  : process.argv[2] ?? path.join(homedir(), "Developer", "navideck-ios");

if (!existsSync(source)) {
  console.error(`ios/ nicht gefunden: ${source}`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });

execFileSync(
  "rsync",
  [
    "-a",
    "--delete",
    "--exclude",
    "Navideck*.xcodeproj",
    "--exclude",
    "build",
    "--exclude",
    "DerivedData",
    `${source}/`,
    `${target}/`,
  ],
  { stdio: "inherit" },
);

try {
  applyTeam(target);
  execFileSync("xcodegen", ["generate"], { cwd: target, stdio: "inherit" });
} catch {
  console.error(
    "xcodegen fehlt. Installieren mit: brew install xcodegen",
  );
  process.exit(1);
}

// Das eigene Signing-Team bleibt lokal (nicht im Repo): entweder per
// Umgebungsvariable NAVIDECK_TEAM oder in der Datei .ios-team im Repo-Root.
function applyTeam(dir) {
  const file = path.join(repoRoot, ".ios-team");
  const team = process.env.NAVIDECK_TEAM ?? (existsSync(file) ? readFileSync(file, "utf8").trim() : "");
  if (!team) return;

  const yml = path.join(dir, "project.yml");
  const text = readFileSync(yml, "utf8").replace(
    /DEVELOPMENT_TEAM: "[^"]*"/,
    `DEVELOPMENT_TEAM: "${team}"`,
  );
  writeFileSync(yml, text);
  console.log(`Signing-Team gesetzt: ${team}`);
}

const project = path.join(target, "Navideck.xcodeproj");
console.log(`\nXcode-Arbeitskopie: ${target}`);
console.log(`Projekt:            ${project}`);

if (process.argv.includes("--open")) {
  execFileSync("open", ["-a", "Xcode", project], { stdio: "inherit" });
  console.log("Xcode wird geöffnet …");
}
