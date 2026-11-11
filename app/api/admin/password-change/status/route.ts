import { NextRequest } from "next/server";
import { passwordFlowFailure, passwordFlowResponse, passwordFlowService } from "@/lib/admin-password-flow-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try { return passwordFlowResponse(await (await passwordFlowService(request)).status()); }
  catch (error) { return passwordFlowFailure(error); }
}
