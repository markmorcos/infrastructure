import jwt from "jsonwebtoken";

// Mint a deployment token identical in shape to `token.sh encode <project>`:
// an HS256 JWT carrying only `sub`, signed with the cluster JWT_SECRET, no expiry.
// deploy.sh verifies the signature against the same secret.
export function mintDeploymentToken(project: string): string {
  return jwt.sign({ sub: project }, process.env.JWT_SECRET as string, {
    algorithm: "HS256",
  });
}

export interface DecodedToken {
  sub: string | null;
  valid: boolean;
}

// Decode a deployment token for display: `valid` reflects signature verification,
// `sub` is surfaced even when verification fails so a stale/foreign token is visible.
export function decodeDeploymentToken(token: string): DecodedToken {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;
    return { sub: typeof payload.sub === "string" ? payload.sub : null, valid: true };
  } catch {
    try {
      const payload = jwt.decode(token) as jwt.JwtPayload | null;
      return {
        sub: payload && typeof payload.sub === "string" ? payload.sub : null,
        valid: false,
      };
    } catch {
      return { sub: null, valid: false };
    }
  }
}
