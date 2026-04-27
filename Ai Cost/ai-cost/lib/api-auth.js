// lib/api-auth.js

export function validateApiKey(req) {
  try {
    const secretKey = process.env.INTERNAL_API_KEY;
    // Dev Mode Fallback: allow all if no key is configured
    if (!secretKey) return true;

    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return false;
    }

    const token = authHeader.split(" ")[1];
    return token === secretKey;
  } catch (err) {
    return false; // Fail safe
  }
}
