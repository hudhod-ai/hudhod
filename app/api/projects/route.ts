import { NextRequest, NextResponse } from "next/server";

import {
  createProject,
  listProjectsForOwner,
} from "@/server/services/projects.service";
import { getAuthContext } from "@/server/auth/context";
import { createProjectSchema } from "@/server/schemas/common";
import { toProblemResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const auth = await getAuthContext();
    const projects = await listProjectsForOwner(auth.userId);

    return NextResponse.json({ projects, total: projects.length });
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    const body = await request.json();
    const parsed = createProjectSchema.parse(body);

    const project = await createProject({
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description ?? null,
      ownerId: auth.userId,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return toProblemResponse({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid JSON body.",
      });
    }

    return toProblemResponse(error);
  }
}
