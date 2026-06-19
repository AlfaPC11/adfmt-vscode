// SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const output = `adfmt-${packageJson.version}.vsix`;
const result = spawnSync(
  executable,
  ["exec", "vsce", "package", "--no-dependencies", "--out", output],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
