<!-- SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant -->

# adfmt for VS Code

VS Code integration for Alfa's D Formatter.

The repository includes the version-matched `adfmt-0.3.0.vsix` package for
offline installation and release verification.

## Features

- Formats D documents with `adfmt`.
- Registers `.d` files as the `d` language even when no separate D extension
  is installed.
- Selects `alfa.adfmt` as the default D formatter. Format-on-save remains an
  explicit user or workspace choice.
- Recognizes extensionless `.adfmt` files as YAML.
- Provides validation, completion, and hover documentation for `.adfmt`
  through the Red Hat YAML extension.
- Uses the nearest `.adfmt` file because the formatter runs with the source
  document's directory as its working directory.
- Creates or opens a project `.adfmt` file with the
  `adfmt: Create or Open Configuration` command.
- Rejects in-place CLI arguments that are incompatible with VS Code's
  standard-input formatting protocol.
- Stops formatter processes that exceed the configurable timeout.
- Limits retained formatter output and handles early stdin closure safely.
- Passes the real source path to adfmt so filename-specific EditorConfig rules
  behave the same in VS Code and the CLI.
- Detects the default Inno Setup installation at
  `%LOCALAPPDATA%\Programs\adfmt\adfmt.exe` on Windows.

## Requirements

Install `adfmt` and make it available on `PATH`. Alternatively, set:

```json
{
  "adfmt.executablePath": "/absolute/path/to/adfmt"
}
```

The Red Hat YAML extension is installed automatically as an extension
dependency.

For full D syntax highlighting, completion, diagnostics, and navigation,
install [code-d](https://marketplace.visualstudio.com/items?itemName=webfreak.code-d).
Keep `d.enableFormatting` disabled when using adfmt so code-d's dfmt integration
does not compete with this formatter.

## Settings

- `adfmt.executablePath`: executable path or command name.
- `adfmt.arguments`: additional command-line arguments.
- `adfmt.formatTimeout`: formatting timeout in milliseconds.
- `adfmt.maxOutputBytes`: memory limit for each formatter output stream.
- `adfmt.trace.server`: output-channel logging level.

## Commands

- `adfmt: Check Installation`: verifies that the configured executable starts.
- `adfmt: Create or Open Configuration`: creates a minimal `.adfmt` in the
  selected workspace folder, or opens the existing file.
- `adfmt: Show Output`: opens formatter diagnostics.

## License

The extension is licensed under `BSD-3-Clause`. The additional
`LicenseRef-Alfa-Patent-Grant` terms are in [PATENTS](PATENTS).

Copyright 2026 Alfa. Alfa is an individual maintainer, not an organization or
team.
