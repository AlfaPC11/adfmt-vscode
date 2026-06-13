<!-- SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant -->

# adfmt for VS Code

VS Code integration for Alfa's D Formatter.

## Features

- Formats D documents with `adfmt`.
- Registers `.d` files as the `d` language even when no separate D extension
  is installed.
- Enables `editor.formatOnSave` and selects `alfa.adfmt` as the default D
  formatter unless the user or workspace overrides those settings.
- Recognizes extensionless `.adfmt` files as YAML.
- Provides validation, completion, and hover documentation for `.adfmt`
  through the Red Hat YAML extension.
- Uses the nearest `.adfmt` file because the formatter runs with the source
  document's directory as its working directory.

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
- `adfmt.trace.server`: output-channel logging level.

## Commands

- `adfmt: Check Installation`: verifies that the configured executable starts.
- `adfmt: Show Output`: opens formatter diagnostics.

## License

The extension is licensed under `BSD-3-Clause`. The additional
`LicenseRef-Alfa-Patent-Grant` terms are in [PATENTS](PATENTS).

Copyright 2026 Alfa. Alfa is an individual maintainer, not an organization or
team.
