import { NextResponse } from "next/server";

import { buildOpenApiDocument } from "@/server/openapi/registry";

export async function GET() {
  const document = buildOpenApiDocument();

  return NextResponse.json(document, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
