<script lang="ts">
	import { Drawer, Drawerhead, Spinner } from 'flowbite-svelte'
	import type { Snippet } from 'svelte'

	let {
		open = $bindable(false),
		title,
		subtitle,
		loading = false,
		actions,
		children
	}: {
		open?: boolean
		title: string
		subtitle?: string
		loading?: boolean
		actions?: Snippet
		children?: Snippet
	} = $props()
</script>

<Drawer bind:open placement="right" style="width: min(34rem, 100vw)">
	<Drawerhead onclick={() => (open = false)}>
		<div class="title">
			<h2>{title}</h2>
			{#if subtitle}<p>{subtitle}</p>{/if}
		</div>
	</Drawerhead>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
	{#if loading}
		<div class="loading"><Spinner size="8" /></div>
	{:else}
		<div class="body">{@render children?.()}</div>
	{/if}
</Drawer>

<style>
	.title h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-heading);
	}
	.title p {
		margin: 0.125rem 0 0;
		font-size: 0.875rem;
		color: var(--color-body-subtle);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.75rem 0 1rem;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.loading {
		display: flex;
		justify-content: center;
		padding: 3rem 0;
	}
</style>
