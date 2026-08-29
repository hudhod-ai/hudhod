import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/server/auth/context";
import { getVersion } from "@/server/services/versions.service";
import { getStorageProvider } from "@/server/storage";
import { NotFoundError, toProblemResponse } from "@/server/http/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revision: string }> },
) {
  try {
    const auth = await getAuthContext();
    const { id, revision } = await params;
    const version = await getVersion(id, Number(revision), auth.userId);

    const storage = getStorageProvider();
    const hasObject = await storage.exists({
      bucket: version.storageBucket,
      key: version.storageKey,
    });

    if (!hasObject) {
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
