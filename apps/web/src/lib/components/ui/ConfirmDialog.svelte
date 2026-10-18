<script lang="ts">
	import { errorMessage } from '#lib/forms.ts'
	import FormBody from './FormBody.svelte'
	import FormModal from './FormModal.svelte'

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Delete',
		onconfirm
	}: { open?: boolean; title: string; message: string; confirmLabel?: string; onconfirm: () => Promise<void> } = $props()

	let busy = $state(false)
	let error = $state('')

	const confirm = async () => {
		busy = true
		error = ''

		try {
			await onconfirm()
			open = false
		} catch (e) {
			error = errorMessage(e)
		} finally {
			busy = false
		}
	}
</script>

<FormModal bind:open {title} size="xs">
	<FormBody submitLabel={confirmLabel} submitColor="danger" {busy} {error} onsubmit={confirm} oncancel={() => (open = false)}>
		<p>{message}</p>
	</FormBody>
</FormModal>

<style>
	p {
		margin: 0;
	}
</style>
