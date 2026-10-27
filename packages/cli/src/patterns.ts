export const Patterns = {
  httpUrlPrefix: /^https?:\/\//,
  lineBreak: /\n/g,
  lineBreakRun: /\n+/g,
  trailingSlash: /\/$/,
};

export const isHttpUrl = (text: string): boolean => Patterns.httpUrlPrefix.test(text);
