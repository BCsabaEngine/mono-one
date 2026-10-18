<script lang="ts">
	import '../app.css'
	import type { LayoutProps } from './$types'
	import ToastHost from '#lib/components/ui/ToastHost.svelte'

	let { children }: LayoutProps = $props()
</script>

<svelte:head>
	<title>mono-one</title>
</svelte:head>

{@render children()}
<ToastHost />
