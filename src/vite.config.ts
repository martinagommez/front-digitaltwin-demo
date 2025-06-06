import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: ["digitwins-agentic-app-front-3.azurewebsites.net","localhost"]
    }
})

// 5173 → Default Vite dev server (local development only).
// 3000 → Common port for local development but not required for Azure.
// 80 or 8080 → Best choice for Azure Web App (production).