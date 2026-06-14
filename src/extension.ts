// SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";

const output = vscode.window.createOutputChannel("adfmt");
const defaultConfiguration = `# yaml-language-server: $schema=https://raw.githubusercontent.com/AlfaPC11/adfmt-vscode/main/schemas/adfmt.schema.json
BasedOnStyle: Alfa
`;

interface AdfmtSettings {
  executablePath: string;
  arguments: string[];
  timeout: number;
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
    const invalidArgument = findIncompatibleArgument(settings.arguments);
    if (invalidArgument) {
      const message =
        `adfmt.arguments cannot contain '${invalidArgument}' because VS Code ` +
        "formats through standard input.";
      output.appendLine(message);
      void vscode.window.showErrorMessage(message);
      return [];
    }
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
        const executable = resolveExecutablePath(settings.executablePath);
        output.appendLine(`Found ${executable}: ${version}`);
        void vscode.window.showInformationMessage(
          `adfmt is available: ${version}`,
        );
      } catch (error: unknown) {
        const message = formatExecutionError(error, settings.executablePath);
        output.appendLine(message);
        output.show(true);
        void vscode.window.showErrorMessage(message);
      } finally {
        cancellation.dispose();
      }
    }),
    vscode.commands.registerCommand("adfmt.createConfiguration", async () => {
      const folder = await selectConfigurationFolder();
      if (!folder) {
        return;
      }

      const configurationUri = vscode.Uri.joinPath(folder.uri, ".adfmt");
      try {
        await vscode.workspace.fs.stat(configurationUri);
      } catch {
        await vscode.workspace.fs.writeFile(
          configurationUri,
          Buffer.from(defaultConfiguration, "utf8"),
        );
      }
      const document = await vscode.workspace.openTextDocument(configurationUri);
      await vscode.window.showTextDocument(document);
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
    timeout: configuration.get("formatTimeout", 15_000),
    trace: configuration.get<AdfmtSettings["trace"]>("trace.server", "off"),
  };
}

async function selectConfigurationFolder(): Promise<
  vscode.WorkspaceFolder | undefined
> {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const activeFolder = activeUri
    ? vscode.workspace.getWorkspaceFolder(activeUri)
    : undefined;
  const folders = vscode.workspace.workspaceFolders ?? [];

  if (activeFolder || folders.length === 1) {
    return activeFolder ?? folders[0];
  }
  if (folders.length === 0) {
    void vscode.window.showErrorMessage(
      "Open a folder or workspace before creating .adfmt.",
    );
    return undefined;
  }
  return vscode.window.showWorkspaceFolderPick({
    placeHolder: "Select the folder where .adfmt will be created",
  });
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
    return (
      `adfmt executable '${executable}' was not found. Install adfmt, open a ` +
      "new terminal after installation, or set adfmt.executablePath."
    );
  }
  if (executionError.code === "ETIMEDOUT") {
    return `adfmt exceeded the configured formatting timeout: ${detail}`;
  }
  return `adfmt failed: ${detail || String(error)}`;
}

function findIncompatibleArgument(arguments_: string[]): string | undefined {
  return arguments_.find(
    (argument) =>
      argument === "--inplace" ||
      argument === "--in-place" ||
      argument === "-i" ||
      argument.startsWith("--inplace=") ||
      argument.startsWith("--in-place="),
  );
}

function resolveExecutablePath(configuredPath: string): string {
  if (
    process.platform !== "win32" ||
    configuredPath !== "adfmt" ||
    !process.env.LOCALAPPDATA
  ) {
    return configuredPath;
  }

  const installedPath = join(
    process.env.LOCALAPPDATA,
    "Programs",
    "adfmt",
    "adfmt.exe",
  );
  return existsSync(installedPath) ? installedPath : configuredPath;
}

function runAdfmt(
  settings: AdfmtSettings,
  source: string,
  workingDirectory: string | undefined,
  token: vscode.CancellationToken,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const executable = resolveExecutablePath(settings.executablePath);
    const startedAt = Date.now();
    trace(
      settings,
      `Running ${executable} ${settings.arguments.join(" ")}`.trimEnd(),
    );
    const child = spawn(executable, settings.arguments, {
      cwd: workingDirectory,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        cancellation.dispose();
        const error = new Error(
          `${settings.timeout} ms`,
        ) as NodeJS.ErrnoException;
        error.code = "ETIMEDOUT";
        reject(error);
      }
    }, settings.timeout);
    const cancellation = token.onCancellationRequested(() => child.kill());

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      cancellation.dispose();
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      cancellation.dispose();
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      trace(settings, `adfmt completed in ${Date.now() - startedAt} ms`);
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
