// SPDX-License-Identifier: BSD-3-Clause AND LicenseRef-Alfa-Patent-Grant

import { readFileSync, writeFileSync } from "node:fs";

const schemaUrl = new URL("../schemas/adfmt.schema.json", import.meta.url);
const groups = [
  ["IndentWidth", "Indent.Width"],
  ["ContinuationIndentWidth", "Indent.ContinuationWidth"],
  ["TabWidth", "Indent.TabWidth"],
  ["UseTab", "Indent.Style"],
  [
    "AlignSwitchStatements",
    "IndentCaseLabels",
    "Indent.AlignSwitchStatements",
    "Indent.CaseLabels",
  ],
  ["OutdentAttributes", "Indent.OutdentAttributes"],
  ["SingleIndent", "Indent.SingleContinuationIndent"],
  ["BraceStyle", "Braces.Default"],
  ["DeclarationBraceStyle", "Braces.Declarations"],
  ["AggregateBraceStyle", "Braces.Aggregates"],
  ["EnumBraceStyle", "Braces.Enums"],
  ["FunctionBraceStyle", "Braces.Functions"],
  ["FunctionLiteralBraceStyle", "Braces.FunctionLiterals"],
  ["ControlBraceStyle", "Braces.ControlStatements"],
  ["SpaceAfterCast", "Spacing.AfterCast"],
  ["SpaceAfterKeywords", "Spacing.AfterKeywords"],
  ["SpaceBeforeFunctionParameters", "Spacing.BeforeFunctionParameters"],
  ["SelectiveImportSpace", "Spacing.SelectiveImports"],
  [
    "SpaceBeforeAssociativeArrayColon",
    "Spacing.BeforeAssociativeArrayColon",
  ],
  ["SpaceBeforeNamedArgumentColon", "Spacing.BeforeNamedArgumentColon"],
  ["SpaceBeforeBraces", "Spacing.BeforeBraces"],
  ["SpaceAroundBinaryOperators", "Spacing.AroundBinaryOperators"],
  ["KeepLineBreaks", "Wrapping.KeepExistingLineBreaks"],
  [
    "SplitOperatorAtLineEnd",
    "BinaryOperatorBreakStyle",
    "Wrapping.SplitOperatorAtLineEnd",
    "Wrapping.BinaryOperators",
  ],
  ["ReflowPropertyChains", "Wrapping.ReflowPropertyChains"],
  ["TemplateConstraintStyle", "Wrapping.TemplateConstraints"],
  [
    "SingleTemplateConstraintIndent",
    "Wrapping.SingleTemplateConstraintIndent",
  ],
  ["WrappingNewlinePenalty", "Wrapping.NewlinePenalty"],
  ["WrappingLongLinePenalty", "Wrapping.LongLinePenalty"],
  ["CompactLabeledStatements", "Statements.CompactLabels"],
];

function requires(path) {
  const [top, nested] = path.split(".");
  if (!nested) {
    return { required: [top] };
  }
  return {
    required: [top],
    properties: { [top]: { required: [nested] } },
  };
}

const rules = groups.flatMap((group) =>
  group.flatMap((left, index) =>
    group.slice(index + 1).map((right) => ({
      not: { allOf: [requires(left), requires(right)] },
    })),
  ),
);

const schema = JSON.parse(readFileSync(schemaUrl, "utf8"));
const expected = `${JSON.stringify({ ...schema, allOf: rules }, null, 2)}\n`;
const check = process.argv.includes("--check");

if (check) {
  if (readFileSync(schemaUrl, "utf8") !== expected) {
    console.error("schemas/adfmt.schema.json is not generated consistently");
    process.exit(1);
  }
} else {
  writeFileSync(schemaUrl, expected);
}
