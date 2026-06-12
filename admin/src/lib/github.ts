import { Octokit } from "@octokit/rest";
import _sodium from "libsodium-wrappers";

export const GITHUB_OWNER = "markmorcos";

let _octokit: Octokit | null = null;
export function octokit(): Octokit {
  if (!_octokit) _octokit = new Octokit({ auth: process.env.GITHUB_PAT });
  return _octokit;
}

// Accepts "owner/name" or a bare "name" (defaults owner to GITHUB_OWNER).
export function parseRepo(repo: string): { owner: string; repo: string } {
  const [a, b] = repo.split("/");
  return b ? { owner: a, repo: b } : { owner: GITHUB_OWNER, repo: a };
}

export interface RepoSecretInfo {
  name: string;
  updatedAt: string;
}

export async function listRepoSecrets(repoFull: string): Promise<RepoSecretInfo[]> {
  const { owner, repo } = parseRepo(repoFull);
  const res = await octokit().rest.actions.listRepoSecrets({
    owner,
    repo,
    per_page: 100,
  });
  return res.data.secrets.map((s) => ({ name: s.name, updatedAt: s.updated_at }));
}

// Encrypt with the repo's libsodium public key and upsert the Actions secret.
export async function putRepoSecret(
  repoFull: string,
  name: string,
  value: string
): Promise<void> {
  const { owner, repo } = parseRepo(repoFull);
  const { data: key } = await octokit().rest.actions.getRepoPublicKey({ owner, repo });

  await _sodium.ready;
  const sodium = _sodium;
  const keyBin = sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL);
  const valueBin = sodium.from_string(value);
  const encrypted = sodium.to_base64(
    sodium.crypto_box_seal(valueBin, keyBin),
    sodium.base64_variants.ORIGINAL
  );

  await octokit().rest.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: name,
    encrypted_value: encrypted,
    key_id: key.key_id,
  });
}
