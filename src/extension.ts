// SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import { runAdfmt } from "./runner.js";

const output = vscode.window.createOutputChannel("adfmt");
const defaultConfiguration = `# yaml-language-server: $schema=https://raw.githubusercontent.com/AlfaPC11/adfmt-vscode/v0.3.0/schemas/adfmt.schema.json
BasedOnStyle: Alfa
`;

interface AdfmtSettings {
  executablePath: string;
  arguments: string[];
  timeout: number;
  maxOutputBytes: number;
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
      const arguments_ =
        document.uri.scheme === "file"
          ? [...settings.arguments, "--stdin-filename", document.uri.fsPath]
          : settings.arguments;
      trace(
        settings,
        `Running ${resolveExecutablePath(settings.executablePath)} ${arguments_.join(" ")}`.trimEnd(),
      );
      const { stdout, stderr } = await runAdfmt(
        toRunnerSettings(settings, arguments_),
        document.getText(),
        workingDirectory,
        token,
        (message) => trace(settings, message),
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
      [
        { language: "d", scheme: "file" },
        { language: "d", scheme: "untitled" },
      ],
      new AdfmtFormattingProvider(),
    ),
    vscode.commands.registerCommand("adfmt.checkInstallation", async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      const settings = readSettings(uri);
      const cancellation = new vscode.CancellationTokenSource();
      try {
        const result = await runAdfmt(
          toRunnerSettings(settings, ["--version"]),
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
      } catch (error: unknown) {
        if (
          !(error instanceof vscode.FileSystemError) ||
          error.code !== "FileNotFound"
        ) {
          throw error;
        }
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
    maxOutputBytes: configuration.get("maxOutputBytes", 32 * 1024 * 1024),
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
  if (executionError.code === "EOUTPUTLIMIT") {
    return `adfmt exceeded the configured output limit: ${detail}`;
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
      argument.startsWith("--in-place=") ||
      argument === "--stdin-filename" ||
      argument.startsWith("--stdin-filename="),
  );
}

function toRunnerSettings(
  settings: AdfmtSettings,
  arguments_: string[],
): Pick<
  AdfmtSettings,
  "executablePath" | "timeout" | "maxOutputBytes"
> & { arguments: string[] } {
  return {
    executablePath: resolveExecutablePath(settings.executablePath),
    arguments: arguments_,
    timeout: settings.timeout,
    maxOutputBytes: settings.maxOutputBytes,
  };
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
