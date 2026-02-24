import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getSavedRoutes, createSavedRoute } from "@/lib/user/route-repository";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const routes = await getSavedRoutes(session.user.id);
  return NextResponse.json({ routes });
}

interface SaveRouteBody {
  name: string;
  origin_address: string;
  origin_lat: string;
  origin_lng: string;
  destination_address: string;
  destination_lat: string;
  destination_lng: string;
  is_favorite?: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const {
    name,
    origin_address,
    origin_lat,
    origin_lng,
    destination_address,
    destination_lat,
    destination_lng,
    is_favorite = false,
  } = body as Partial<SaveRouteBody>;

  if (!name || !origin_address || !origin_lat || !origin_lng || !destination_address || !destination_lat || !destination_lng) {
    return NextResponse.json(
      { error: "Missing required fields", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  const saved = await createSavedRoute(session.user.id, {
    name: name.trim(),
    origin_address,
    origin_lat,
    origin_lng,
    destination_address,
    destination_lat,
    destination_lng,
    is_favorite,
  });

  return NextResponse.json({ route: saved }, { status: 201 });
}
