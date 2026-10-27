const AllowedCommentPatterns = [
  /^\s*eslint-/,
  /^\s*eslint /,
  /^\s*@ts-/,
  /^\s*keep order/,
  /^\s*@vitest-environment/,
];

const ExportDeclarationTypes = new Set(['ExportDefaultDeclaration', 'ExportNamedDeclaration']);

const isDocComment = comment => comment.type === 'Block' && comment.value.startsWith('*');

const isToolDirective = comment =>
  AllowedCommentPatterns.some(pattern => pattern.test(comment.value));

/**
 * Start offsets of the doc comments that sit directly above a top-level export, so they
 * can be told apart from floating `/** … *\/` blocks.
 */
const exportDocCommentStarts = (program, sourceCode) =>
  new Set(
    program.body
      .filter(node => ExportDeclarationTypes.has(node.type))
      .map(node => sourceCode.getCommentsBefore(node).at(-1))
      .filter(comment => comment && isDocComment(comment))
      .map(comment => comment.range[0])
  );

const NoCommentsRule = {
  create(context) {
    const [{ allowExportDocComments = false } = {}] = context.options;
    const { sourceCode } = context;

    return {
      Program(program) {
        const allowedDocStarts = allowExportDocComments
          ? exportDocCommentStarts(program, sourceCode)
          : new Set();

        for (const comment of sourceCode.getAllComments()) {
          if (isToolDirective(comment) || allowedDocStarts.has(comment.range[0])) continue;

          const messageId =
            allowExportDocComments && isDocComment(comment) ? 'floatingDocComment' : 'comment';

          context.report({ loc: comment.loc, messageId });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        'Code explains itself through names; comments are reserved for tool directives, `keep order` markers and, where enabled, TSDoc on exported declarations.',
    },
    messages: {
      comment:
        'Comments are not allowed. Express the intent with a descriptive constant, function or type name instead.',
      floatingDocComment:
        'A TSDoc comment must sit directly above an exported declaration. Anything else is expressed with names, helpers or types.',
    },
    schema: [
      {
        additionalProperties: false,
        properties: { allowExportDocComments: { type: 'boolean' } },
        type: 'object',
      },
    ],
    type: 'suggestion',
  },
};

export default NoCommentsRule;
