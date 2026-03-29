import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL })

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.detail || 'An error occurred'
    throw new Error(message)
  }
)

export default api
export { BASE_URL }
