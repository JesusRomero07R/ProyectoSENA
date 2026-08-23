export const API_URL = "http://localhost:8000";

export function getAuthHeaders() {
    const token = localStorage.getItem("token");
    if (!token) return { "Content-Type": "application/json" };
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}

export async function fetchJSON(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    // Merge auth headers if not explicitly disabled
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    
    // Si body es FormData, el navegador debe settear el Content-Type automáticamente,
    // así que lo removemos explícitamente.
    const isFormData = options.body instanceof FormData || (options.body && typeof options.body === 'object' && options.body.constructor && options.body.constructor.name === 'FormData');
    if (isFormData) {
        delete headers['Content-Type'];
        delete headers['content-type'];
    }
    
    const finalOptions = { ...options, headers };
    
    try {
        const response = await window.fetch(url, finalOptions);
        
        if (response.status === 401) {
            // Token expirado o inválido
            localStorage.removeItem("token");
            window.location.href = window.location.pathname.includes('/pages/') 
                ? '../index.html' 
                : 'index.html';
            throw new Error("No autorizado");
        }
        
        return response;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error;
    }
}
