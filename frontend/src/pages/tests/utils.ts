interface ApiErrorPayload {
  error?:
    | {
        message?: string;
      }
    | string;
  message?: string;
}

export async function getResponseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = await response.text();
  if (!body) {
    return fallback;
  }

  try {
    const data = JSON.parse(body) as ApiErrorPayload;
    const nestedMessage = typeof data.error === 'object' ? data.error.message : null;
    const stringMessage = typeof data.error === 'string' ? data.error : null;
    return nestedMessage || data.message || stringMessage || fallback;
  } catch {
    return body.length < 200 && !body.startsWith('<') ? body : fallback;
  }
}
