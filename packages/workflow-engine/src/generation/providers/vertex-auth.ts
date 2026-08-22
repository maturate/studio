import { GoogleAuth } from "google-auth-library";

/**
 * Vertex AI / Gemini Enterprise Agent Platform auth — service account via
 * GOOGLE_APPLICATION_CREDENTIALS (a key file path), or `gcloud auth
 * application-default login` for local dev, or a metadata server in GCP.
 * GoogleAuth auto-discovers whichever is available; we don't need to know
 * which.
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

/** Builds a publisher-model URL for the `google` publisher on Vertex AI. `location` defaults to the app-wide setting but can be overridden — Veo, for instance, isn't available at "global" and needs a real region regardless of the default. */
export function vertexModelUrl(model: string, method: string, location: string = getVertexLocation()): string {
  const project = getVertexProjectId();
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:${method}`;
}
