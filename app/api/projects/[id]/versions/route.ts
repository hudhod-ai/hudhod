import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/server/auth/context";
import { toProblemResponse } from "@/server/http/errors";
import { createProjectVersionSchema } from "@/server/schemas/common";
import {
  createVersionForProject,
  listVersionsForProject,
} from "@/server/services/versions.service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    const { id } = await params;
    const versions = await listVersionsForProject(id, auth.userId);

    return NextResponse.json({ versions, total: versions.length });
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const fields = createProjectVersionSchema.parse(Object.fromEntries(formData.entries()));

    if (!(file instanceof File)) {
      throw new Error("Missing file upload.");
    }

    const archive = Buffer.from(await file.arrayBuffer());

    const version = await createVersionForProject(id, auth.userId, {
      label: fields.label,
      description: fields.description ?? null,
      restoreFromVersionId: fields.restoreFromVersionId ?? null,
      archive,
      contentType: file.type || "application/json",
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    return toProblemResponse(error);
  }
}
