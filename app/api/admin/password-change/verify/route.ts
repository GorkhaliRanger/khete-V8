import { NextRequest } from "next/server";
import { passwordFlowBody, passwordFlowFailure, passwordFlowResponse, passwordFlowService, requirePasswordFlowOrigin } from "@/lib/admin-password-flow-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { requirePasswordFlowOrigin(request); const body = await passwordFlowBody(request); return passwordFlowResponse(await (await passwordFlowService(request)).verify(body.code)); }
  catch (error) { return passwordFlowFailure(error); }
}
