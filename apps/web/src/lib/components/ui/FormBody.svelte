<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import type { ComponentProps, Snippet } from 'svelte'
	import ErrorAlert from './ErrorAlert.svelte'

	let {
		submitLabel = 'Save',
		submitColor = 'brand',
		busy = false,
		error,
		onsubmit,
		oncancel,
		children
	}: {
		submitLabel?: string
		submitColor?: ComponentProps<typeof Button>['color']
		busy?: boolean
		error?: string
		onsubmit: () => void
		oncancel: () => void
		children?: Snippet
	} = $props()
</script>

<form
	novalidate
	onsubmit={e => {
		e.preventDefault()
		onsubmit()
	}}
>
	{@render children?.()}
	{#if error}<ErrorAlert message={error} />{/if}
	<div class="buttons">
		<Button color="alternative" disabled={busy} onclick={oncancel}>Cancel</Button>
		<Button type="submit" color={submitColor} loading={busy}>{submitLabel}</Button>
	</div>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}
</style>
