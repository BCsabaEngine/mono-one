<script lang="ts">
	import { Badge, Card } from 'flowbite-svelte'
	import type { Snippet } from 'svelte'

	let { title, badge, actions, children }: { title: string; badge?: string; actions?: Snippet; children?: Snippet } = $props()
</script>

<Card size="xl" shadow="xs">
	<div class="card-body">
	<div class="top">
		<div class="name">
			<strong>{title}</strong>
			{#if badge}<Badge color="gray">{badge}</Badge>{/if}
		</div>
		<div class="actions">{@render actions?.()}</div>
	</div>
	<div class="body">{@render children?.()}</div>
	</div>
</Card>

<style>
	.card-body {
		padding: 0.75rem 1rem;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-heading);
	}
	.actions {
		display: flex;
		gap: 0.375rem;
	}
	.body {
		margin-top: 0.375rem;
		font-size: 0.875rem;
	}
</style>
