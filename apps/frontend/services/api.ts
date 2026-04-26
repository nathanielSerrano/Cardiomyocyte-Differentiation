// Use localhost (10.0.2.2 for Android Emulator) for local development
// or your machine's local IP for physical device testing.
const BASE_URL = "https://red-dogs-fold.loca.lt/api/v1"; 

const HEADERS = {
  "Content-Type": "application/json",
  "bypass-tunnel-reminder": "true",
};

export async function login(user: string, password: string) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      user,
      password,
      created_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    // Backend often returns 'detail' for HTTPExceptions
    // Fallback to a generic message if 'detail' is not present
    throw new Error(errorData.detail || "Login failed");
  }

  return res.json();
}

export async function register(user: string, password: string, projectName: string) {
  const res = await fetch(`${BASE_URL}/register?project_name=${encodeURIComponent(projectName)}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      user,
      password,
      created_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Registration failed");
  }

  return res.json();
}

export async function getUploadUrl(s3Key: string) {
  const res = await fetch(`${BASE_URL}/upload-url?s3_key=${s3Key}`, { headers: HEADERS });
  return res.json();
}

export async function createPrediction(token: string, data: any) {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: {
      ...HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function getDownloadUrl(s3Key: string) {
  const res = await fetch(`${BASE_URL}/download-url?s3_key=${s3Key}`, { headers: HEADERS });
  return res.json();
}