// SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant

import { spawn } from "node:child_process";
import { dirname } from "node:path";
import * as vscode from "vscode";

const output = vscode.window.createOutputChannel("adfmt");

interface AdfmtSettings {
  executablePath: string;
  arguments: string[];
  trace: "off" | "messages" | "verbose";
}

class AdfmtFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[]> {
    const settings = readSettings(document.uri);
    const workingDirectory =
      document.uri.scheme === "file"
        ? dirname(document.uri.fsPath)
        : vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;

    trace(settings, `Formatting ${document.uri.toString()}`);

    try {
      const { stdout, stderr } = await runAdfmt(
        settings,
        document.getText(),
        workingDirectory,
        token,
      );
      if (stderr && settings.trace === "verbose") {
        output.appendLine(stderr.trimEnd());
      }
      if (token.isCancellationRequested || stdout === document.getText()) {
        return [];
      }

      const entireDocument = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
      );
      return [vscode.TextEdit.replace(entireDocument, stdout)];
    } catch (error: unknown) {
      const message = formatExecutionError(error, settings.executablePath);
      output.appendLine(message);
      output.show(true);
      void vscode.window.showErrorMessage(message);
      return [];
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    output,
    vscode.languages.registerDocumentFormattingEditProvider(
      { language: "d", scheme: "*" },
      new AdfmtFormattingProvider(),
    ),
    vscode.commands.registerCommand("adfmt.checkInstallation", async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      const settings = readSettings(uri);
      const cancellation = new vscode.CancellationTokenSource();
      try {
        const result = await runAdfmt(
          { ...settings, arguments: ["--version"] },
          "",
          workspaceDirectory(uri),
          cancellation.token,
        );
        const version = result.stdout.trim() || "version unknown";
        output.appendLine(`Found ${settings.executablePath}: ${version}`);
        void vscode.window.showInformationMessage(`adfmt is available: ${version}`);
      } catch (error: unknown) {
        const message = formatExecutionError(error, settings.executablePath);
        output.appendLine(message);
        output.show(true);
        void vscode.window.showErrorMessage(message);
      } finally {
        cancellation.dispose();
      }
    }),
    vscode.commands.registerCommand("adfmt.showOutput", () => output.show(true)),
  );
}

export function deactivate(): void {}

function readSettings(uri?: vscode.Uri): AdfmtSettings {
  const configuration = vscode.workspace.getConfiguration("adfmt", uri);
  return {
    executablePath: configuration.get("executablePath", "adfmt"),
    arguments: configuration.get<string[]>("arguments", []),
    trace: configuration.get<AdfmtSettings["trace"]>("trace.server", "off"),
  };
}

function workspaceDirectory(uri?: vscode.Uri): string | undefined {
  if (!uri) {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
  return uri.scheme === "file"
    ? dirname(uri.fsPath)
    : vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
}

function trace(settings: AdfmtSettings, message: string): void {
  if (settings.trace !== "off") {
    output.appendLine(message);
  }
}

function formatExecutionError(error: unknown, executable: string): string {
  const executionError = error as NodeJS.ErrnoException & { stderr?: string };
  const detail = executionError.stderr?.trim() || executionError.message;
  if (executionError.code === "ENOENT") {
    return `adfmt executable '${executable}' was not found. Install adfmt or set adfmt.executablePath.`;
  }
  return `adfmt failed: ${detail || String(error)}`;
}

function runAdfmt(
  settings: AdfmtSettings,
  source: string,
  workingDirectory: string | undefined,
  token: vscode.CancellationToken,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(settings.executablePath, settings.arguments, {
      cwd: workingDirectory,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const cancellation = token.onCancellationRequested(() => child.kill());

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      cancellation.dispose();
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      if (token.isCancellationRequested) {
        resolve({ stdout: source, stderr: stderrText });
      } else if (code === 0) {
        resolve({ stdout: stdoutText, stderr: stderrText });
      } else {
        const error = new Error(
          `process exited with code ${String(code)}${signal ? ` (${signal})` : ""}`,
        ) as NodeJS.ErrnoException & { stderr: string };
        error.stderr = stderrText;
        reject(error);
      }
    });

    child.stdin.end(source);
  });
}
