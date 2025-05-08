import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SALT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)`,
      [email, hashedPassword]
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.log(error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      // unique_violation
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
