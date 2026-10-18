<script lang="ts">
	import { Helper, Label, Select } from 'flowbite-svelte'

	let {
		label,
		value = $bindable(),
		options,
		error,
		placeholder = 'Choose ...',
		disabled = false
	}: {
		label: string
		value?: string
		options: { name: string; value: string }[]
		error?: string
		placeholder?: string
		disabled?: boolean
	} = $props()

	const id = $props.id()
</script>

<div>
	<Label for={id} color={error ? 'red' : undefined}>{label}</Label>
	<Select {id} bind:value items={options} {placeholder} {disabled} />
	{#if error}<Helper color="danger">{error}</Helper>{/if}
</div>
