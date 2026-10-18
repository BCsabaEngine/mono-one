<script lang="ts">
	import { Modal } from 'flowbite-svelte'
	import type { ComponentProps, Snippet } from 'svelte'

	/** Dialog shell for the form components: their content is mounted only while open, so every opening starts from fresh form state. */
	let {
		open = $bindable(false),
		title,
		size = 'sm',
		children
	}: { open?: boolean; title: string; size?: ComponentProps<typeof Modal>['size']; children?: Snippet } = $props()
</script>

<Modal bind:open {title} {size} outsideclose={false}>
	{@render children?.()}
</Modal>
