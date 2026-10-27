'use client';

import { useEffect, useId, useState } from 'react';

import { Patterns } from '../patterns';
import { type PageTheme, usePageTheme } from './use-page-theme';

const MermaidThemes: Record<PageTheme, 'dark' | 'neutral'> = {
  dark: 'dark',
  light: 'neutral',
};

type Rendering = { error: string } | { svg: string } | null;

async function renderDiagram(id: string, code: string, theme: PageTheme): Promise<Rendering> {
  const { default: mermaid } = await import('mermaid');

  mermaid.initialize({
    securityLevel: 'strict',
    startOnLoad: false,
    theme: MermaidThemes[theme],
  });

  try {
    return await mermaid.render(id, code);
  } catch (error) {
    return { error: (error as Error).message };
  }
}

function useDiagram(code: string): Rendering {
  const id = `mermaid-${useId().replace(Patterns.nonIdCharacter, '')}`;
  const theme = usePageTheme();
  const [rendering, setRendering] = useState<Rendering>(null);

  useEffect(() => {
    let current = true;

    void renderDiagram(id, code, theme).then(result => {
      if (current) setRendering(result);
    });

    return () => {
      current = false;
    };
  }, [id, code, theme]);

  return rendering;
}

export function MermaidDiagram({ code }: { code: string }) {
  const rendering = useDiagram(code);

  if (rendering && 'svg' in rendering) {
    return (
      <div
        className="not-prose my-3 flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: rendering.svg }}
      />
    );
  }

  return (
    <figure className="my-3">
      <pre>
        <code>{code}</code>
      </pre>
      {rendering && 'error' in rendering && (
        <figcaption className="text-xs text-red-600">
          Diagram could not be drawn: {rendering.error}
        </figcaption>
      )}
    </figure>
  );
}
