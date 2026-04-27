export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { 
    ...options, 
    headers: { 'Content-Type': 'application/json', ...options?.headers } 
  });
  
  if (!res.ok) {
    let errorMessage = `API Error ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      errorMessage = await res.text() || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
}
