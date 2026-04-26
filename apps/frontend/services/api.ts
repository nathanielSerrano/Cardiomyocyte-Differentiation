const BASE_URL = "(copy paste npx localtunnel --port 8000 output here)"; 

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
    throw new Error(errorData.detail || "Login failed");
  }

  return res.json();
}

export async function register(user: string, password: string, projectName: string) {
  const res = await fetch(`${BASE_URL}/register?project_name=${encodeURIComponent(projectName)}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      user: user,
      password: password,
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

export async function uploadFileToS3(presignedUrl: string, fileUri: string) {
  try {
    const response = await FileSystem.uploadAsync(presignedUrl, fileUri, {
      httpMethod: 'PUT',
      // No headers needed, the legacy API defaults to binary for PUT!
    });

    if (response.status !== 200) {
      console.error("AWS S3 Rejection Details:", response.body); 
      throw new Error(`S3 Upload failed with status ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error("FileSystem Upload Error:", error);
    throw new Error("Failed to upload the TIFF file to S3.");
  }
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

  if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Prediction request failed: ${errorText}`);
  }
  return res.json();
}

export async function getDownloadUrl(s3Key: string) {
  const res = await fetch(`${BASE_URL}/download-url?s3_key=${s3Key}`, { headers: HEADERS });
  return res.json();
}

/**
 * Fetches the recent predictions for the logged-in user.
 * Maps to: GET /predictions
 */
export const getPredictions = async (token: string, limit: number = 10) => {
  const response = await fetch(`${BASE_URL}/predictions?limit=${limit}`, {
    method: 'GET',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.status}`);
  }

  return await response.json(); // Returns List[PredictionResponse]
};

/**
 * Fetches the logged-in user's details and active projects.
 * Maps to: GET /user-info
 */
export const getUserInfo = async (token: string) => {
  const response = await fetch(`${BASE_URL}/user-info`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      // Force React Native to always get the latest project list
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }

  return await response.json(); 
};

/**
 * Creates a new project and automatically adds the user to it.
 * Maps to: POST /create-project?project_name=...
 */
export const createProject = async (token: string, projectName: string) => {
  const response = await fetch(`${BASE_URL}/create-project?project_name=${encodeURIComponent(projectName)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) throw new Error("Failed to create project");
  return await response.json();
};

/**
 * Joins an existing project by ID.
 * Maps to: POST /join-project?project_id=...
 */
export const joinProject = async (token: string, projectId: number) => {
  const response = await fetch(`${BASE_URL}/join-project?project_id=${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) throw new Error("Failed to join project");
  return await response.json();
};

/**
 * Leaves an existing project by ID.
 * Maps to: POST /leave-project?project_id=...
 */
export const leaveProject = async (token: string, projectId: number) => {
  const response = await fetch(`${BASE_URL}/leave-project?project_id=${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) throw new Error("Failed to leave project");
  return await response.json();
};