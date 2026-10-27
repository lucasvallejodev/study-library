export const Patterns = {
  htmlImageAlt: /\balt="([^"]*)"/,
  htmlImageAsset: /<img\b[^>]*\bsrc="\.\.\/(assets\/[^"]+)"[^>]*>/g,
  httpUrlPrefix: /^https?:\/\//,
  lineBreak: /\n/g,
  lineBreakRun: /\n+/g,
  markdownImageAsset: /!\[([^\]]*)\]\(\.\.\/(assets\/[^)\s]+)(?:\s[^)]*)?\)/g,
  trailingSlash: /\/$/,
};

export const isHttpUrl = (text: string): boolean => Patterns.httpUrlPrefix.test(text);
