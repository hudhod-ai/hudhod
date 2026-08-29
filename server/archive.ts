import { createHash } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { createGzip } from "node:zlib";
import tar from "tar-stream";

export type ProjectFileMap = Record<string, string>;

export async function createProjectArchive(
  files: ProjectFileMap,
): Promise<Buffer> {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  const output = new PassThrough();
  const gzip = createGzip();

  output.on("data", (chunk) => {
    chunks.push(Buffer.from(chunk));
  });

  gzip.pipe(output);
  pack.pipe(gzip);

  for (const [name, contents] of Object.entries(files)) {
    const entry = pack.entry({
      name,
      size: Buffer.byteLength(contents, "utf8"),
    });
    entry.end(contents);
  }

  pack.finalize();

  return new Promise<Buffer>((resolve, reject) => {
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
  });
}

export async function calculateChecksum(buffer: Buffer): Promise<string> {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function countArchiveEntries(buffer: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const input = Readable.from(buffer);
    const extract = tar.extract();

    extract.on("entry", () => {
      count += 1;
    });

    extract.on("finish", () => resolve(count));
    extract.on("error", reject);

    input.pipe(extract);
  });
}
