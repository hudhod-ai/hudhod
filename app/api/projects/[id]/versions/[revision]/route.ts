import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/server/auth/context";
import {
  getVersion,
  softDeleteVersion,
} from "@/server/services/versions.service";
import { toProblemResponse } from "@/server/http/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revision: string }> },
) {
  try {
    const auth = await getAuthContext();
    const { id, revision } = await params;
    const version = await getVersion(id, Number(revision), auth.userId);

    return NextResponse.json(version);
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revision: string }> },
) {
  try {
    const auth = await getAuthContext();
    const { id, revision } = await params;
    const version = await softDeleteVersion(id, Number(revision), auth.userId);

    return NextResponse.json(version);
  } catch (error) {
    return toProblemResponse(error);
  }
}
