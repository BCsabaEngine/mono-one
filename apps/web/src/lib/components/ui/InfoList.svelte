<script lang="ts">
	let { items }: { items: { label: string; value?: string | number | null }[] } = $props()
</script>

<dl>
	{#each items as item (item.label)}
		<dt>{item.label}</dt>
		<dd>{item.value ?? '—'}</dd>
	{/each}
</dl>

<style>
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.375rem 1rem;
		margin: 0;
	}
	dt {
		color: var(--color-body-subtle);
	}
	dd {
		margin: 0;
		color: var(--color-heading);
		overflow-wrap: anywhere;
		white-space: pre-line;
	}
</style>
