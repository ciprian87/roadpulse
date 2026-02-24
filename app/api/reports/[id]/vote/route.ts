import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { voteOnReport } from "@/lib/community/report-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { vote } = body as { vote?: string };
  if (vote !== "up" && vote !== "down") {
    return NextResponse.json(
      { error: 'vote must be "up" or "down"', code: "INVALID_VOTE" },
      { status: 400 }
    );
  }

  const result = await voteOnReport(id, session.user.id, vote);
  return NextResponse.json(result);
}
