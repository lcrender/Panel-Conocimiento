import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["invite", "email", "signup", "recovery", "magiclink", "email_change"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
  }

  return NextResponse.redirect(new URL("/", url.origin));
}
