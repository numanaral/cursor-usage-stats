/**
 * Enforces braces and explicit return for multi-line arrow functions.
 * Allows single-line arrow functions to omit braces (implicit return).
 */
const rule = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Require braces for multi-line arrow functions, allow implicit return for single-line",
      category: "Stylistic Issues",
    },
    fixable: "code",
    schema: [],
    messages: {
      requireBraces:
        "Multi-line arrow function must use braces and explicit return.",
    },
  },

  create: (context) => {
    const sourceCode = context.getSourceCode();

    return {
      ArrowFunctionExpression: (node) => {
        const { body } = node;

        // Skip if already has braces (BlockStatement).
        if (body.type === "BlockStatement") {
          return;
        }

        // Check if the body spans multiple lines.
        const bodyStartLine = body.loc?.start.line;
        const bodyEndLine = body.loc?.end.line;
        const arrowLine = node.loc?.start.line;

        if (!bodyStartLine || !bodyEndLine || !arrowLine) {
          return;
        }

        // Check if body spans multiple lines OR if arrow and body are on different lines.
        const bodyIsMultiLine = bodyEndLine > bodyStartLine;
        const arrowOnDifferentLine = arrowLine !== bodyStartLine;
        const isMultiLine = bodyIsMultiLine || arrowOnDifferentLine;

        const isJSX = body.type === "JSXElement" || body.type === "JSXFragment";
        const isObject = body.type === "ObjectExpression";

        // Always require explicit return for JSX and objects (even single-line).
        const requiresBraces = isMultiLine || isJSX || isObject;

        if (requiresBraces) {
          context.report({
            node: body,
            messageId: "requireBraces",
            fix: (fixer) => {
              const bodyText = sourceCode.getText(body);

              // Get the token before the body (should be => or a paren after =>).
              const tokenBefore = sourceCode.getTokenBefore(body);
              const arrowToken =
                tokenBefore?.value === "("
                  ? sourceCode.getTokenBefore(tokenBefore)
                  : tokenBefore;

              // Check if body is wrapped in parentheses after the arrow.
              const codeAfterArrow = sourceCode
                .getText()
                .slice(arrowToken.range[1], body.range[1]);
              const hasOuterParens = codeAfterArrow.trim().startsWith("(");

              // Determine the range to replace.
              let rangeStart = arrowToken.range[1]; // Start after =>
              let rangeEnd = body.range[1]; // End of body

              // If there are outer parens, include the closing paren.
              if (hasOuterParens) {
                const tokenAfter = sourceCode.getTokenAfter(body);
                if (tokenAfter?.value === ")") {
                  rangeEnd = tokenAfter.range[1];
                }
              }

              // For JSX, objects, or code wrapped in parens, wrap in parens after return.
              if (isJSX || isObject || hasOuterParens) {
                // For single-line JSX/objects, format on one line.
                if (!isMultiLine && !hasOuterParens) {
                  return fixer.replaceTextRange(
                    [rangeStart, rangeEnd],
                    ` {\n  return ${bodyText};\n}`,
                  );
                }

                return fixer.replaceTextRange(
                  [rangeStart, rangeEnd],
                  ` {\n  return (${bodyText});\n}`,
                );
              }

              // For non-JSX multi-line code.
              return fixer.replaceTextRange(
                [rangeStart, rangeEnd],
                ` {\n  return ${bodyText};\n}`,
              );
            },
          });
        }
      },
    };
  },
};

export default rule;
