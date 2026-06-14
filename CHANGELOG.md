<!-- SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant -->

# Changelog

All notable changes to this extension are documented here.

## 0.2.2 - 2026-06-14

- Added schema support for aggregate, enum, and function-literal brace styles.
- Added the readable binary-operator wrapping direction option.
- Made `.adfmt` named values PascalCase and case-sensitive.
- Added a command that creates or opens a workspace `.adfmt` file.
- Added a configurable timeout for formatter processes.
- Rejected in-place arguments that conflict with stdin-based editor formatting.
- Added automatic discovery of the default Windows Inno Setup installation.
- Improved execution tracing and missing-executable guidance.

## 0.2.0 - 2026-06-13

- Added Marketplace publication metadata and support documentation.
- Added BSD-3-Clause licensing and Alfa's separate patent grant.
- Added commands for checking the adfmt installation and showing output.
- Declared workspace trust and virtual workspace limitations.
- Kept adfmt as the default formatter for D with format-on-save enabled.
- Kept `.adfmt` YAML recognition, validation, completion, and hover support.

## 0.1.1 - 2026-06-13

- Registered `.d` files with the D language identifier when no other D
  extension is installed.

## 0.1.0 - 2026-06-13

- Initial formatter integration.
