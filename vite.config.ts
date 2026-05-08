import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site at https://<user>.github.io/<repo>/, so asset URLs
// must be prefixed with the repo path. The deploy workflow sets VITE_BASE to that
// path; locally `npm run dev` runs at "/" because the env var is unset.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5173 },
});
