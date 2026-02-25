import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByEmail, createUser } from "@/lib/auth/user-repository";
import { logUsageEvent } from "@/lib/admin/usage-repository";
import { checkRateLimit, getClientIp, isBodyTooLarge } from "@/lib/middleware/rate-limit";

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
  if (isBodyTooLarge(req, 1_024)) {
    return NextResponse.json(
      { error: "Request body too large", code: "PAYLOAD_TOO_LARGE" },
      { status: 413 }
    );
  }

  // 5 registrations per IP per hour — prevents mass account creation and bcrypt DoS.
  // Fail open if Redis is unavailable so legitimate registrations still succeed.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rl:register:${ip}`, 5, 3600).catch(() => ({ allowed: true }));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

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
    // Return the same shape as a successful registration — do not confirm whether the
    // email is registered. The rate limit (5/hr per IP) is the primary enumeration guard.
    return NextResponse.json({ success: true }, { status: 200 });
  }

  // 12 rounds balances security and latency for a web request
  const password_hash = await bcrypt.hash(password, 12);

  const newUser = await createUser({ email: email.toLowerCase(), password_hash, name: name.trim() });

  // Log userId, not email — avoid storing PII in the append-only usage_events table
  await logUsageEvent("USER_REGISTER", { userId: newUser.id }, newUser.id).catch(() => undefined);

  return NextResponse.json({ success: true }, { status: 201 });
}
