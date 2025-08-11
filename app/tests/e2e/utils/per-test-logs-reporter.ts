// A Playwright reporter that writes stdout/stderr emitted during a test
// to per-test files under the configured outputDir, so logs are never interleaved.
// Files: <outputDir>/per-test-logs/<project>/<file>/<test-title-slug>/retry-<n>.(out|err).log

import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult, FullConfig } from '@playwright/test/reporter';

type Streams = { out: fs.WriteStream; err: fs.WriteStream; all: fs.WriteStream };

function toSlug(parts: string[]): string {
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 180);
}

export default class PerTestLogsReporter implements Reporter {
  private outputDir: string = '';
  private streamsByKey = new Map<string, Streams>();
  private globalStreams: Streams | undefined;
  private index: Array<{
    project: string;
    file: string;
    line: number;
    title: string;
    retry: number;
    logDir: string;
    out: string;
    err: string;
    all: string;
    status?: TestResult['status'];
  }> = [];
  private failed: Array<{
    project: string;
    file: string;
    line: number;
    title: string;
    retry: number;
    logDir: string;
    out: string;
    err: string;
    all: string;
  }> = [];

  onBegin(config: FullConfig): void {
    const firstProject = config.projects?.[0];
    this.outputDir = firstProject?.outputDir || path.join(process.cwd(), 'test-results');
    const perTestDir = path.join(this.outputDir, 'per-test-logs');
    fs.mkdirSync(perTestDir, { recursive: true });
    // Global streams capture stdout/stderr not associated with any specific test
    this.globalStreams = {
      out: fs.createWriteStream(path.join(perTestDir, `global.out.log`)),
      err: fs.createWriteStream(path.join(perTestDir, `global.err.log`)),
      all: fs.createWriteStream(path.join(perTestDir, `global.all.log`)),
    };
  }

  private openStreams(test: TestCase, result: TestResult): Streams {
    const key = `${test.id}-r${result.retry}`;
    let streams = this.streamsByKey.get(key);
    if (streams) return streams;

    const project = test.parent.project()?.name || 'project';
    const file = test.location.file.replace(/\\/g, '/');
    const line = test.location.line;
    const titleSlug = toSlug([test.title]);

    const perTestDir = path.join(
      this.outputDir,
      'per-test-logs',
      project,
      'by-file',
      ...file.split('/'),
      `L${line}`,
      titleSlug
    );
    fs.mkdirSync(perTestDir, { recursive: true });

    const outPath = path.join(perTestDir, `retry-${result.retry}.out.log`);
    const errPath = path.join(perTestDir, `retry-${result.retry}.err.log`);
    const allPath = path.join(perTestDir, `retry-${result.retry}.all.log`);
    streams = {
      out: fs.createWriteStream(outPath),
      err: fs.createWriteStream(errPath),
      all: fs.createWriteStream(allPath),
    };
    this.streamsByKey.set(key, streams);
    // Write per-test metadata for quick inspection
    try {
      const meta = {
        project,
        file,
        line,
        title: test.title,
        id: test.id,
        retry: result.retry,
        logDir: perTestDir,
        out: outPath,
        err: errPath,
        all: allPath,
      };
      fs.writeFileSync(path.join(perTestDir, 'meta.json'), JSON.stringify(meta, null, 2));
    } catch {}
    this.index.push({
      project,
      file,
      line,
      title: test.title,
      retry: result.retry,
      logDir: perTestDir,
      out: outPath,
      err: errPath,
      all: allPath,
    });
    return streams;
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult): void {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const streams = test && result ? this.openStreams(test, result) : this.globalStreams;
    streams?.out.write(data);
    streams?.all.write(Buffer.concat([Buffer.from('[stdout] '), data]));
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult): void {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const streams = test && result ? this.openStreams(test, result) : this.globalStreams;
    streams?.err.write(data);
    streams?.all.write(Buffer.concat([Buffer.from('[stderr] '), data]));
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = `${test.id}-r${result.retry}`;
    const streams = this.streamsByKey.get(key);
    if (streams) {
      try { streams.out.end(); } catch {}
      try { streams.err.end(); } catch {}
      try { streams.all.end(); } catch {}
      this.streamsByKey.delete(key);
    }
    const project = test.parent.project()?.name || 'project';
    const file = test.location.file.replace(/\\/g, '/');
    const line = test.location.line;
    const entry = this.index.find(i => i.title === test.title && i.file === file && i.line === line && i.retry === result.retry && i.project === project);
    if (entry) {
      entry.status = result.status;
      if (result.status !== 'passed') {
        this.failed.push({
          project: entry.project,
          file: entry.file,
          line: entry.line,
          title: entry.title,
          retry: entry.retry,
          logDir: entry.logDir,
          out: entry.out,
          err: entry.err,
          all: entry.all,
        });
        // eslint-disable-next-line no-console
        console.error(`logs [${result.status}] ${project}:${path.basename(file)}#L${line} "${test.title}" -> ${path.relative(process.cwd(), entry.logDir)}`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`logs [${result.status}] ${project}:${path.basename(file)}#L${line} "${test.title}" -> ${path.relative(process.cwd(), entry.logDir)}`);
      }
    }
  }

  onEnd(): void | Promise<void> {
    try { this.globalStreams?.out.end(); } catch {}
    try { this.globalStreams?.err.end(); } catch {}
    const perTestRoot = path.join(this.outputDir, 'per-test-logs');
    try {
      fs.writeFileSync(path.join(perTestRoot, 'index.json'), JSON.stringify(this.index, null, 2));
    } catch {}
    try {
      fs.writeFileSync(path.join(perTestRoot, 'latest-failed.json'), JSON.stringify(this.failed, null, 2));
    } catch {}
    // Also emit a quick human-readable summary
    try {
      const lines: string[] = [];
      lines.push(`# Per-test logs summary`);
      for (const e of this.index) {
        const status = e.status ?? 'unknown';
        lines.push(`- [${status}] ${e.project}:${path.basename(e.file)}#L${e.line} "${e.title}" -> ${path.relative(process.cwd(), e.logDir)}`);
      }
      fs.writeFileSync(path.join(perTestRoot, 'index.md'), lines.join('\n'));
    } catch {}
  }
}


