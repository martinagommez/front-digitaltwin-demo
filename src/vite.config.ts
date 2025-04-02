import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["agent-builder-app-front-2.azurewebsites.net"]
  }
})

// 5173 → Default Vite dev server (local development only).
// 3000 → Common port for local development but not required for Azure.
// 80 or 8080 → Best choice for Azure Web App (production).