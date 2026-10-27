import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { repo } from './helpers';

export const FixtureBook = {
  author: 'Ada Example',
  bodyChapters: ['I: The Beginning', 'II: Two Stories', 'III: The End'],
  id: 'a-test-companion',
  title: 'A Test Companion',
};

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const PACKAGE_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:00000000-0000-4000-8000-000000000000</dc:identifier>
    <dc:title>${FixtureBook.title}</dc:title>
    <dc:creator>${FixtureBook.author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>A tiny book built by the tests.</dc:description>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="figure" href="images/figure.png" media-type="image/png"/>
    <item id="titlepage" href="text/titlepage.xhtml" media-type="application/xhtml+xml"/>
    <item id="part-1" href="text/part-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="text/chapter-2.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-3" href="text/chapter-3.xhtml" media-type="application/xhtml+xml"/>
    <item id="endnotes" href="text/endnotes.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="titlepage"/>
    <itemref idref="part-1"/>
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
    <itemref idref="chapter-3"/>
    <itemref idref="endnotes"/>
  </spine>
</package>`;

const NAV_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="text/titlepage.xhtml">Title Page</a></li>
      <li>
        <a href="text/part-1.xhtml">Part One</a>
        <ol>
          <li><a href="text/chapter-1.xhtml">I: The Beginning</a></li>
          <li>
            <a href="text/chapter-2.xhtml">II: Two Stories</a>
            <ol>
              <li><a href="text/chapter-2.xhtml#story-1">The First Story</a></li>
              <li><a href="text/chapter-2.xhtml#story-2">The Second Story</a></li>
            </ol>
          </li>
        </ol>
      </li>
      <li><a href="text/chapter-3.xhtml">III: The End</a></li>
      <li><a href="text/endnotes.xhtml">Endnotes</a></li>
    </ol>
  </nav>
</body>
</html>`;

const paragraphs = (topic: string): string =>
  Array.from(
    { length: 3 },
    (_unused, index) =>
      `<p>Paragraph ${index + 1} about ${topic}, written long enough to read like real prose in a chapter.</p>`
  ).join('\n');

const xhtml = (
  body: string,
  bodyType = 'bodymatter'
): string => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${FixtureBook.title}</title></head>
<body epub:type="${bodyType}">
${body}
</body>
</html>`;

const ContentFiles: Record<string, string> = {
  'OEBPS/text/chapter-1.xhtml': xhtml(`<section epub:type="chapter">
  <h2>I: The Beginning</h2>
  ${paragraphs('the beginning')}
  <p>A claim that needs a source.<a href="endnotes.xhtml#note-1" id="noteref-1" epub:type="noteref">1</a></p>
  <p>Fury said to<br/>a mouse, That he<br/>met in the house</p>
  <figure><img src="../images/figure.png" alt="A figure"/></figure>
</section>`),
  'OEBPS/text/chapter-2.xhtml': xhtml(`<section epub:type="chapter">
  <h2>II: Two Stories</h2>
  <section id="story-1"><h3>The First Story</h3>${paragraphs('the first story')}</section>
  <section id="story-2"><h3>The Second Story</h3>${paragraphs('the second story')}</section>
</section>`),
  'OEBPS/text/chapter-3.xhtml': xhtml(`<section epub:type="chapter">
  <h2>III: The End</h2>
  ${paragraphs('the end')}
</section>`),
  'OEBPS/text/endnotes.xhtml': xhtml(
    `<section epub:type="endnotes"><h2>Endnotes</h2><ol>
  <li id="note-1"><p>The source of the claim. <a href="chapter-1.xhtml#noteref-1" epub:type="backlink">↩</a></p></li>
</ol></section>`,
    'backmatter'
  ),
  'OEBPS/text/part-1.xhtml': xhtml(`<section epub:type="part"><h2>Part One</h2></section>`),
  'OEBPS/text/titlepage.xhtml': xhtml(
    `<section epub:type="titlepage"><h1>${FixtureBook.title}</h1><p>${FixtureBook.author}</p></section>`,
    'frontmatter'
  ),
};

export const writeFixtureEpub = async (): Promise<string> => {
  const image = await readFile(path.join(repo, 'fixtures/images/red.png'));
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', CONTAINER_XML);
  zip.file('OEBPS/content.opf', PACKAGE_OPF);
  zip.file('OEBPS/nav.xhtml', NAV_XHTML);
  zip.file('OEBPS/images/cover.png', image);
  zip.file('OEBPS/images/figure.png', image);

  for (const [file, content] of Object.entries(ContentFiles)) zip.file(file, content);

  const file = path.join(os.tmpdir(), `fixture-${Date.now()}.epub`);

  await writeFile(file, await zip.generateAsync({ type: 'nodebuffer' }));

  return file;
};
