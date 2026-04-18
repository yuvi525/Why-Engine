import { NextResponse } from "next/server";
import { getUser, getUserOrg } from "@/lib/auth";
import { revokeKey } from "@/lib/api-key-manager";

/**
 * DELETE /api/keys/[id] — revoke a specific API key.
 * Requires JWT. Only revokes keys belonging to the caller's org.
 */
export async function DELETE(request, { params }) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const orgId = await getUserOrg(user.id);
  if (!orgId) {
    return NextResponse.json({ error: "No organisation found for user." }, { status: 403 });
  }

  const keyId = params?.id;
  if (!keyId) {
    return NextResponse.json({ error: "Key ID required." }, { status: 400 });
  }

  const ok = await revokeKey(keyId, orgId);
  if (!ok) {
    return NextResponse.json({ error: "Key not found or already revoked." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, revoked: keyId });
}
