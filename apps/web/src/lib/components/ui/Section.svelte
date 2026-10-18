<script lang="ts">
	import type { Snippet } from 'svelte'

	let { title, actions, children }: { title: string; actions?: Snippet; children?: Snippet } = $props()
</script>

<section>
	<div class="head">
		<h3>{title}</h3>
		{@render actions?.()}
	</div>
	<div class="content">{@render children?.()}</div>
</section>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-heading);
	}
	.content {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
</style>
