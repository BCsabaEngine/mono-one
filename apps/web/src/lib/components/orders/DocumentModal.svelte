<script lang="ts">
	import { Button, Modal, Spinner } from 'flowbite-svelte'
	import { DownloadOutline, FileCopyOutline } from 'flowbite-svelte-icons'
	import ErrorAlert from '#lib/components/ui/ErrorAlert.svelte'
	import { errorMessage } from '#lib/forms.ts'
	import { notify } from '#lib/toast.svelte.ts'
	import { trpc } from '#lib/trpc.ts'

	type Doc = Awaited<ReturnType<typeof trpc.documents.generateOrderDocument.query>>

	let { open = $bindable(false), orderId }: { open?: boolean; orderId?: number } = $props()

	let doc = $state<Doc>()
	let error = $state('')

	// rendered on demand by document-service every time the dialog opens
	$effect(() => {
		if (!open || !orderId) return

		doc = undefined
		error = ''

		trpc.documents.generateOrderDocument.query({ orderId }).then(
			result => (doc = result),
			e => (error = errorMessage(e))
		)
	})

	const download = () => {
		if (!doc) return

		const url = URL.createObjectURL(new Blob([doc.content], { type: doc.contentType }))
		const link = Object.assign(document.createElement('a'), { href: url, download: doc.filename })

		link.click()
		URL.revokeObjectURL(url)
	}

	const copy = async () => {
		if (!doc) return

		await navigator.clipboard.writeText(doc.content)
		notify('Copied to clipboard')
	}
</script>

<Modal bind:open title={doc?.filename ?? 'Order document'} size="lg">
	{#if error}
		<ErrorAlert message={error} />
	{:else if doc}
		<pre>{doc.content}</pre>
	{:else}
		<div class="loading"><Spinner size="8" /></div>
	{/if}
	{#snippet footer()}
		<Button disabled={!doc} onclick={download}><DownloadOutline size="sm" class="me-1" />Download .md</Button>
		<Button color="alternative" disabled={!doc} onclick={copy}><FileCopyOutline size="sm" class="me-1" />Copy</Button>
		<Button color="alternative" onclick={() => (open = false)}>Close</Button>
	{/snippet}
</Modal>

<style>
	pre {
		margin: 0;
		max-height: 60vh;
		overflow: auto;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 0.8125rem;
		color: var(--color-heading);
	}
	.loading {
		display: flex;
		justify-content: center;
		padding: 2rem 0;
	}
</style>
