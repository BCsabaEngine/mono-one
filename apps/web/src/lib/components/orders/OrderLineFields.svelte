<script lang="ts">
	import TextField from '#lib/components/ui/TextField.svelte'
	import type { LineDraft } from '#lib/orders.ts'

	let { line = $bindable(), errors }: { line: LineDraft; errors?: Partial<Record<keyof LineDraft, string>> } = $props()
</script>

<div class="line">
	<TextField label="Product code" bind:value={line.productCode} error={errors?.productCode} />
	<TextField label="Product name" bind:value={line.productName} error={errors?.productName} />
	<TextField label="Quantity" inputmode="numeric" bind:value={line.quantity} error={errors?.quantity} />
	<TextField label="Unit price" inputmode="decimal" placeholder="12.50" bind:value={line.unitPrice} error={errors?.unitPrice} />
</div>

<style>
	.line {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
</style>
