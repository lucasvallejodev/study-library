import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { badRequest, HttpStatus, route } from '@/lib/http';
import { enqueueJob, type JobRow } from '@/lib/jobs';
import { isImportableFileName } from '@/lib/patterns';
import { slugify, tempDir } from '@study/core';
import { isUrl } from '@study/ingest';

type ImportOptions = Record<string, unknown>;

type JsonImportRequest = {
  id?: string;
  tocDepth?: number;
  url?: string;
};

const UPLOADS_DIR = 'uploads';

const formText = (form: FormData, name: string): string | undefined => {
  const value = form.get(name);

  return typeof value === 'string' ? value : undefined;
};

const formOptions = (form: FormData): ImportOptions => {
  const id = formText(form, 'id');
  const tocDepth = formText(form, 'tocDepth');

  return {
    ...(id ? { id } : {}),
    ...(tocDepth ? { tocDepth: Number(tocDepth) } : {}),
  };
};

const jsonOptions = ({ id, tocDepth }: JsonImportRequest): ImportOptions => ({
  ...(id ? { id } : {}),
  ...(tocDepth ? { tocDepth } : {}),
});

const accepted = (job: JobRow): Response => NextResponse.json(job, { status: HttpStatus.accepted });

const uploadPath = async (fileName: string): Promise<string> => {
  const dir = path.join(tempDir(), UPLOADS_DIR);

  await mkdir(dir, { recursive: true });

  const extension = path.extname(fileName).toLowerCase();
  const baseName = slugify(path.basename(fileName, extension));

  return path.join(dir, `${Date.now()}-${baseName}${extension}`);
};

const queueFile = async (file: File, options: ImportOptions): Promise<Response> => {
  if (!isImportableFileName(file.name)) {
    badRequest('Upload an .epub, .mobi, .azw, .azw3, .html or .md file');
  }

  const target = await uploadPath(file.name);

  await writeFile(target, Buffer.from(await file.arrayBuffer()));

  const job = await enqueueJob({
    input: target,
    inputType: 'file',
    options,
    originalName: file.name,
  });

  return accepted(job);
};

const queueUrl = async (url: string, options: ImportOptions): Promise<Response> => {
  if (!isUrl(url)) badRequest('URL must start with http:// or https://');

  const job = await enqueueJob({
    input: url,
    inputType: 'url',
    options,
  });

  return accepted(job);
};

const importFromForm = async (req: Request): Promise<Response> => {
  const form = await req.formData();
  const options = formOptions(form);
  const file = form.get('file');
  const url = formText(form, 'url');

  if (file instanceof File && file.size > 0) return queueFile(file, options);
  if (url) return queueUrl(url, options);

  return badRequest('Provide a file or a url');
};

const importFromJson = async (req: Request): Promise<Response> => {
  const body = (await req.json()) as JsonImportRequest;

  if (!body.url) badRequest('Provide a url');

  return queueUrl(body.url, jsonOptions(body));
};

const isMultipart = (req: Request): boolean =>
  (req.headers.get('content-type') ?? '').includes('multipart/form-data');

export const POST = route(async (req: Request) =>
  isMultipart(req) ? importFromForm(req) : importFromJson(req)
);
