// SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant

import { spawn } from "node:child_process";

export interface DisposableLike {
  dispose(): void;
}

export interface CancellationTokenLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): DisposableLike;
}

export interface RunnerSettings {
  executablePath: string;
  arguments: string[];
  timeout: number;
  maxOutputBytes: number;
}

export interface RunnerResult {
  stdout: string;
  stderr: string;
}

type ExecutionError = NodeJS.ErrnoException & { stderr?: string };

export function runAdfmt(
  settings: RunnerSettings,
  source: string,
  workingDirectory: string | undefined,
  token: CancellationTokenLike,
  trace: (message: string) => void = () => undefined,
): Promise<RunnerResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(settings.executablePath, settings.arguments, {
      cwd: workingDirectory,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let stdinError: NodeJS.ErrnoException | undefined;

    const cancellation = token.onCancellationRequested(() => child.kill());
    const timeout = setTimeout(() => {
      const error = new Error(
        `${settings.timeout} ms`,
      ) as ExecutionError;
      error.code = "ETIMEDOUT";
      child.kill();
      rejectOnce(error);
    }, settings.timeout);

    function cleanup(): void {
      clearTimeout(timeout);
      cancellation.dispose();
    }

    function rejectOnce(error: unknown): void {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    }

    function collect(
      chunks: Buffer[],
      chunk: Buffer,
      streamName: "stdout" | "stderr",
    ): void {
      if (settled) {
        return;
      }
      if (streamName === "stdout") {
        stdoutBytes += chunk.length;
      } else {
        stderrBytes += chunk.length;
      }
      if (
        stdoutBytes > settings.maxOutputBytes ||
        stderrBytes > settings.maxOutputBytes
      ) {
        const error = new Error(
          `${streamName} exceeded ${settings.maxOutputBytes} bytes`,
        ) as ExecutionError;
        error.code = "EOUTPUTLIMIT";
        child.kill();
        rejectOnce(error);
        return;
      }
      chunks.push(chunk);
    }

    child.stdout.on("data", (chunk: Buffer) =>
      collect(stdout, chunk, "stdout"),
    );
    child.stderr.on("data", (chunk: Buffer) =>
      collect(stderr, chunk, "stderr"),
    );
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EPIPE") {
        stdinError = error;
        return;
      }
      rejectOnce(error);
    });
    child.on("error", rejectOnce);
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      trace(`adfmt completed in ${Date.now() - startedAt} ms`);
      if (token.isCancellationRequested) {
        resolve({ stdout: source, stderr: stderrText });
      } else if (code === 0 && !stdinError) {
        resolve({ stdout: stdoutText, stderr: stderrText });
      } else {
        const error = new Error(
          stdinError
            ? "formatter closed standard input before reading the document"
            : `process exited with code ${String(code)}${signal ? ` (${signal})` : ""}`,
        ) as ExecutionError;
        error.code = stdinError?.code;
        error.stderr = stderrText;
        reject(error);
      }
    });

    child.stdin.end(source);
  });
}
