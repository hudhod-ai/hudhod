import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/admin";
import { getAuthContext } from "@/server/auth/context";
import { NotFoundError, toProblemResponse } from "@/server/http/errors";
import { getVersion, getVersionForDownloadToken } from "@/server/services/versions.service";
import { getStorageProvider } from "@/server/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revision: string }> },
) {
  try {
    const { id, revision } = await params;
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const version = token
      ? await getVersionForDownloadToken(id, Number(revision), token)
      : await getVersion(id, Number(revision), (await getAuthContext()).userId);
    const storage = await getStorageProvider(token ? createAdminClient() : undefined);

    if (
      !(await storage.exists({
        bucket: version.storageBucket,
        key: version.storageKey,
      }))
    ) {
      throw new NotFoundError("Archived project snapshot not found.");
    }

    const archive = await storage.getObject({
      bucket: version.storageBucket,
      key: version.storageKey,
    });
    return new NextResponse(archive as unknown as BodyInit, {
      headers: {
        "Content-Type": version.contentType,
        "Content-Length": String(archive.length),
        "Content-Disposition": `attachment; filename="${version.storageKey.split("/").pop() ?? "project.json"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return toProblemResponse(error);
  }
}
