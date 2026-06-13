<!-- SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant -->

# Security Policy

Do not include secrets, access tokens, private source code, or undisclosed
vulnerability details in a public issue.

For security reports, use GitHub private vulnerability reporting when it is
enabled for the repository:

<https://github.com/AlfaPC11/adfmt-vscode/security/advisories/new>

The extension starts the executable configured by `adfmt.executablePath` and
passes the current document through standard input. Only use executable paths
and workspaces that you trust.
