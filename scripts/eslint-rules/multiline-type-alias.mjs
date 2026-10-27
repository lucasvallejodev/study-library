/**
 * Local ESLint rule: a `type X = { ... }` alias with three or more members is written one
 * member per line. The fix only inserts the line breaks after `{` and before `}`; Prettier
 * (objectWrap: preserve) then keeps the literal expanded and reflows the members.
 *
 * Parameter type annotations are deliberately not covered: Prettier collapses those, so a
 * rule there would fight the formatter.
 */
const MultilineTypeAliasRule = {
  create(context) {
    const minMembers = context.options[0]?.minMembers ?? 3;
    const sourceCode = context.sourceCode;

    return {
      'TSTypeAliasDeclaration > TSTypeLiteral'(node) {
        const members = node.members;

        if (members.length < minMembers) return;
        const open = sourceCode.getFirstToken(node);
        const close = sourceCode.getLastToken(node);
        const first = members[0];
        const last = members[members.length - 1];
        const needsOpen = open.loc.end.line === first.loc.start.line;
        const needsClose = close.loc.start.line === last.loc.end.line;

        if (!needsOpen && !needsClose) return;
        context.report({
          data: { count: members.length },
          fix(fixer) {
            const fixes = [];

            if (needsOpen) fixes.push(fixer.insertTextAfter(open, '\n'));
            if (needsClose) fixes.push(fixer.insertTextBefore(close, '\n'));

            return fixes;
          },
          messageId: 'expand',
          node,
        });
      },
    };
  },
  meta: {
    docs: { description: 'Type aliases with three or more members go one member per line.' },
    fixable: 'whitespace',
    messages: { expand: 'Write this {{count}}-member type alias with one member per line.' },
    schema: [{ properties: { minMembers: { minimum: 1, type: 'integer' } }, type: 'object' }],
    type: 'layout',
  },
};

export default MultilineTypeAliasRule;
