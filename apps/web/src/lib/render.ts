import "server-only";
import rehypeShiki from "@shikijs/rehype";
import type { Element, Root, Text } from "hast";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export type RenderedChapter = {
  html: string;
  /** Concatenated text nodes: identical to the article's textContent in the browser. */
  text: string;
};

const schema: Schema = {
  ...defaultSchema,
  clobberPrefix: "",
  clobber: [],
  tagNames: [...(defaultSchema.tagNames ?? []), "figure", "figcaption", "mark", "abbr", "cite", "small", "u"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "id"],
    img: ["src", "alt", "title", "width", "height"],
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
};

/** Point relative asset paths (../assets/x.png) at the asset route for this document. */
function rewriteAssets(docId: string) {
  return () => (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      for (const prop of ["src", "href"] as const) {
        const value = node.properties?.[prop];
        if (typeof value === "string" && /^(\.\.\/)?assets\//.test(value)) {
          (node.properties as Record<string, unknown>)[prop] = `/api/assets/${docId}/${value.replace(/^\.\.\//, "")}`;
        }
      }
      if (node.tagName === "img") {
        node.properties.loading = "lazy";
        node.properties.decoding = "async";
      }
      if (node.tagName === "a" && typeof node.properties?.href === "string" && /^https?:/.test(node.properties.href)) {
        node.properties.target = "_blank";
        node.properties.rel = ["noreferrer"];
      }
    });
  };
}

function collectText(tree: Root): string {
  let text = "";
  visit(tree, "text", (node: Text) => {
    text += node.value;
  });
  return text;
}

const cache = new Map<string, RenderedChapter>();
const CACHE_LIMIT = 200;

/** Markdown -> reader HTML. Cached by content hash, so edits invalidate automatically. */
export async function renderChapter(docId: string, markdown: string, cacheKey?: string): Promise<RenderedChapter> {
  const key = cacheKey ? `${docId}:${cacheKey}` : undefined;
  if (key && cache.has(key)) return cache.get(key)!;

  let text = "";
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rewriteAssets(docId))
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeShiki, { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false, fallbackLanguage: "text" })
    .use(() => (tree: Root) => {
      text = collectText(tree);
    })
    .use(rehypeStringify)
    .process(markdown);

  const result = { html: String(file), text };
  if (key) {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
  }
  return result;
}
