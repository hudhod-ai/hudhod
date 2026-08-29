import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/server/auth/context";
import { toProblemResponse } from "@/server/http/errors";
import { updateProjectSchema } from "@/server/schemas/common";
import {
  getProjectById,
  softDeleteProject,
  updateProject,
} from "@/server/services/projects.service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    const { id } = await params;
    const project = await getProjectById(id, auth.userId);

    return NextResponse.json(project);
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProjectSchema.parse(body);

    const project = await updateProject(id, auth.userId, {
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
    });

    return NextResponse.json(project);
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext();
    const { id } = await params;
    const project = await softDeleteProject(id, auth.userId);

    return NextResponse.json(project);
  } catch (error) {
    return toProblemResponse(error);
  }
}
