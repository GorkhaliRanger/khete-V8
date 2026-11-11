import { NextRequest } from "next/server";
import { passwordFlowFailure, passwordFlowResponse, passwordFlowService, requirePasswordFlowOrigin } from "@/lib/admin-password-flow-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { requirePasswordFlowOrigin(request); return passwordFlowResponse(await (await passwordFlowService(request)).cancel()); }
  catch (error) { return passwordFlowFailure(error); }
}
