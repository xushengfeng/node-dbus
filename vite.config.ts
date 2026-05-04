import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [dts({ tsconfigPath: "./tsconfig.build.json" })],
	build: {
		lib: {
			entry: path.resolve(__dirname, "src/index.ts"),
			name: "NodeDBus",
			fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
			formats: ["es", "cjs"],
		},
		rollupOptions: {
			// make sure to externalize deps that shouldn't be bundled
			// into your library
			external: ["myde-unix-socket", "child_process", "fs", "path", "events"],
			output: {
				// Provide global variables to use in the UMD build
				// for externalized deps
				globals: {},
			},
		},
	},
});
