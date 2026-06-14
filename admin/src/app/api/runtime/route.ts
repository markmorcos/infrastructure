import { NextResponse } from "next/server";
import { getAllRuntime } from "@/lib/k8s";

export async function GET() {
  try {
    return NextResponse.json(await getAllRuntime());
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to read runtime" }, { status: 500 });
  }
}
