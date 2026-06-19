// SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant

import assert from "node:assert/strict";
import test from "node:test";
import {
  type CancellationTokenLike,
  runAdfmt,
  type RunnerSettings,
} from "../src/runner.js";

const token: CancellationTokenLike = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => undefined }),
};

function nodeSettings(
  script: string,
  overrides: Partial<RunnerSettings> = {},
): RunnerSettings {
  return {
    executablePath: process.execPath,
    arguments: ["-e", script],
    timeout: 5_000,
    maxOutputBytes: 1024 * 1024,
    ...overrides,
  };
}

test("returns formatted standard output", async () => {
  const result = await runAdfmt(
    nodeSettings("process.stdin.pipe(process.stdout)"),
    "module example;\n",
    undefined,
    token,
  );
  assert.equal(result.stdout, "module example;\n");
});

test("handles EPIPE without an uncaught process error", async () => {
  await assert.rejects(
    runAdfmt(
      nodeSettings("process.exit(2)"),
      "x".repeat(8 * 1024 * 1024),
      undefined,
      token,
    ),
    /standard input|code 2/,
  );
});

test("terminates a formatter that exceeds the output limit", async () => {
  await assert.rejects(
    runAdfmt(
      nodeSettings("process.stdout.write(Buffer.alloc(4096))", {
        maxOutputBytes: 1024,
      }),
      "",
      undefined,
      token,
    ),
    (error: NodeJS.ErrnoException) => error.code === "EOUTPUTLIMIT",
  );
});

test("terminates a formatter after the timeout", async () => {
  await assert.rejects(
    runAdfmt(
      nodeSettings("setTimeout(() => {}, 10_000)", { timeout: 50 }),
      "",
      undefined,
      token,
    ),
    (error: NodeJS.ErrnoException) => error.code === "ETIMEDOUT",
  );
});
