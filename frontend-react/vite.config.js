import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080';
  const cacheKey = new URL(proxyTarget).host.replace(/[^a-zA-Z0-9]/g, '_');
  return {
    cacheDir: `node_modules/.vite-${cacheKey}`,
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: proxyTarget },
        '/actuator': { target: proxyTarget },
      },
    },
    build: {
      outDir: '../backend-dotnet/src/Soopi.Api/wwwroot',
      emptyOutDir: true,
    },
  };
});
