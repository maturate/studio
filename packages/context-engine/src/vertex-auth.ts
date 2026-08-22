import { GoogleAuth } from "google-auth-library";

/**
 * Vertex AI auth — service account via GOOGLE_APPLICATION_CREDENTIALS, or
 * `gcloud auth application-default login` for local dev, or a metadata
 * server in GCP. Mirrors packages/workflow-engine's copy of this helper;
 * kept duplicated rather than adding a cross-package dependency for one
 * function.
 */
let cachedAuth: GoogleAuth | undefined;

export function getVertexProjectId(): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error("Missing required environment variable: GOOGLE_CLOUD_PROJECT");
  return projectId;
}

export function getVertexLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || "global";
}

export async function getVertexAccessToken(): Promise<string> {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  }
  const client = await cachedAuth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error(
      "Could not obtain a Vertex AI access token. Set GOOGLE_APPLICATION_CREDENTIALS to a service account key file, or run `gcloud auth application-default login`.",
    );
  }
  return token;
}

export function vertexModelUrl(model: string, method: string): string {
  const project = getVertexProjectId();
  const location = getVertexLocation();
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:${method}`;
}
