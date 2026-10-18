<script lang="ts">
	import { Toast, ToastContainer } from 'flowbite-svelte'
	import { toasts } from '#lib/toast.svelte.ts'

	let host = $state<HTMLElement>()

	// dialogs (the side panel, modals) live in the browser's top layer; a popover is the only way to show toasts above them
	$effect(() => {
		if (!host || !toasts.length) return

		host.hidePopover()
		host.showPopover() // re-shown on every change so it lands above dialogs opened since
	})
</script>

<div popover="manual" bind:this={host}>
	<ToastContainer position="top-right">
		{#each toasts as toast (toast.id)}
			<Toast color={toast.color}>{toast.message}</Toast>
		{/each}
	</ToastContainer>
</div>

<style>
	div[popover] {
		position: fixed;
		inset: 0;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: visible;
		pointer-events: none;
	}
	div[popover] :global(*) {
		pointer-events: auto;
	}
</style>
