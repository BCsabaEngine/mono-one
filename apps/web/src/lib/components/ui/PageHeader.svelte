<script lang="ts">
	import type { Snippet } from 'svelte'

	let { title, subtitle, actions }: { title: string; subtitle?: string; actions?: Snippet } = $props()
</script>

<header>
	<div>
		<h1>{title}</h1>
		{#if subtitle}<p>{subtitle}</p>{/if}
	</div>
	<div class="actions">{@render actions?.()}</div>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}
	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-heading);
	}
	p {
		margin: 0.25rem 0 0;
		color: var(--color-body-subtle);
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
</style>
