import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/peerjs": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        ws: true,
        headers: {
          Connection: "upgrade",
          Upgrade: "websocket",
        },
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("PeerJS proxy error:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("PeerJS Request:", req.method, req.url);
            proxyReq.setHeader("Origin", "http://localhost:5173");
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("PeerJS Response:", proxyRes.statusCode, req.url);
          });
          proxy.on("upgrade", (req, socket, head) => {
            console.log("PeerJS WebSocket upgrade requested");
          });
        },
      },
    },
  },
});
