import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByEmail, createUser } from "@/lib/auth/user-repository";
import { logUsageEvent } from "@/lib/admin/usage-repository";

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

function isValidEmail(email: string): boolean {
  // Simple RFC-ish pattern — full validation is at the DB unique constraint level
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const { email, password, name } = body as Partial<RegisterBody>;

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "email, password, and name are required", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email address", code: "INVALID_EMAIL" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters", code: "WEAK_PASSWORD" },
      { status: 400 }
    );
  }

  const existing = await getUserByEmail(email.toLowerCase());
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists", code: "EMAIL_TAKEN" },
      { status: 409 }
    );
  }

  // 12 rounds balances security and latency for a web request
  const password_hash = await bcrypt.hash(password, 12);

  await createUser({ email: email.toLowerCase(), password_hash, name: name.trim() });

  await logUsageEvent("USER_REGISTER", { email: email.toLowerCase() }).catch(() => undefined);

  return NextResponse.json({ success: true }, { status: 201 });
}
