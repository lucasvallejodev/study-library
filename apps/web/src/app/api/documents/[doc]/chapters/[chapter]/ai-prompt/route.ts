import { type AiPromptOptions, chapterAiPrompt, passageAiPrompt } from '@/lib/ai-prompt';
import { getAnnotation, listAnnotations, loadChapter } from '@/lib/data';
import { route } from '@/lib/http';
import { publicOrigin } from '@/lib/origin';
import { searchParamsOf } from '@/lib/search-params';

type Ctx = { params: Promise<{ chapter: string; doc: string }> };

const MarkdownHeaders = { 'content-type': 'text/markdown; charset=utf-8' };

export const GET = route(async (req: Request, { params }: Ctx) => {
  const { chapter, doc } = await params;
  const annotationId = searchParamsOf(req).get('annotation');
  const loaded = await loadChapter(doc, chapter);
  const annotations = (await listAnnotations({ chapterId: chapter, documentId: doc })).reverse();

  const options: AiPromptOptions = {
    annotations,
    chapter: loaded.chapter,
    doc: loaded.doc,
    markdown: loaded.markdown,
    origin: publicOrigin(req),
  };

  const prompt = annotationId
    ? passageAiPrompt(options, await getAnnotation(annotationId))
    : chapterAiPrompt(options);

  return new Response(prompt, { headers: MarkdownHeaders });
});
