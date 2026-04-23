const BASE_URL = "http://YOUR_IP:8000";

export async function login(user: string, password: string) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user,
      password,
      created_at: new Date().toISOString(),
    }),
  });

  return res.json();
}

export async function getUploadUrl(s3Key: string) {
  const res = await fetch(`${BASE_URL}/upload-url?s3_key=${s3Key}`);
  return res.json();
}

export async function createPrediction(token: string, data: any) {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function getDownloadUrl(s3Key: string) {
  const res = await fetch(`${BASE_URL}/download-url?s3_key=${s3Key}`);
  return res.json();
}