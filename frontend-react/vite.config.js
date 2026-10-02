import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8080' },
        '/actuator': { target: env.VITE_PROXY_TARGET || 'http://localhost:8080' },
      },
    },
    build: {
      outDir: '../backend-dotnet/src/Soopi.Api/wwwroot',
      emptyOutDir: true,
    },
  };
});
