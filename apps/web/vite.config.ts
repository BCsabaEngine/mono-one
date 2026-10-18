import adapter from '@sveltejs/adapter-node'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			adapter: adapter({ out: '../../dist/apps/web' })
		})
	],
	resolve: { tsconfigPaths: true },
	build: {
		sourcemap: false, // SvelteKit defaults the server build to true; no .map files in dist
		// `@api/<svc>` also exports the owning service's router; web only needs the contract, so drop the router modules from the bundle
		rolldownOptions: { treeshake: { moduleSideEffects: id => !/libs\/[^/]+-api\/src\/server\.ts$/.test(id) } }
	},
	clearScreen: false, // keep the output of the other apps visible
	server: { port: 3000 }
})
