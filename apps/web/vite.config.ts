import adapter from '@sveltejs/adapter-node'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { createLogger, defineConfig } from 'vite'

// dev server only (NODE_ENV defaults to development, like the services' pretty logs): show the percent-encoded query of SvelteKit's request lines decoded, e.g. the tRPC `input=%7B...%7D`
const decodeQuery = (msg: string) =>
	msg.replace(/(?:%[0-9A-Fa-f]{2})+/g, s => {
		try {
			return decodeURIComponent(s)
		} catch {
			return s
		}
	})

const readableLogger = () => {
	const logger = createLogger()

	return {
		...logger,
		info: (msg, options) => logger.info(decodeQuery(msg), options),
		error: (msg, options) => logger.error(decodeQuery(msg), options)
	} satisfies typeof logger
}

export default defineConfig(({ command }) => ({
	...(command === 'serve' &&
		(process.env.NODE_ENV ?? 'development') === 'development' && { customLogger: readableLogger() }),
	plugins: [
		tailwindcss(), // build engine for flowbite-svelte only
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
	// svstate's dist uses extensionless relative imports, which Node's native ESM loader rejects in dev SSR; let Vite resolve them
	ssr: { noExternal: ['svstate'] },
	clearScreen: false, // keep the output of the other apps visible
	server: { port: 3000 }
}))
