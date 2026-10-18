<script lang="ts">
	import { Helper, Input, Label, Textarea } from 'flowbite-svelte'

	let {
		label,
		value = $bindable(''),
		error,
		multiline = false,
		type = 'text',
		placeholder,
		autocomplete,
		inputmode
	}: {
		label: string
		value?: string
		error?: string
		multiline?: boolean
		type?: 'text' | 'email' | 'password' | 'tel'
		placeholder?: string
		autocomplete?: 'username' | 'current-password' | 'off'
		inputmode?: 'numeric' | 'decimal'
	} = $props()

	const id = $props.id()
</script>

<div>
	<Label for={id} color={error ? 'red' : undefined}>{label}</Label>
	{#if multiline}
		<Textarea {id} bind:value rows={3} style="width: 100%" />
	{:else}
		<Input {id} bind:value {type} {placeholder} {autocomplete} {inputmode} color={error ? 'red' : 'default'} />
	{/if}
	{#if error}<Helper color="danger">{error}</Helper>{/if}
</div>
