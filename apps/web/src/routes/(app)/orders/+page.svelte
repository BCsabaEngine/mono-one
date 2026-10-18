<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { FileLinesOutline, PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons'
	import { onMount } from 'svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import type { Customer } from '@api/customer'
	import type { Order } from '@api/order'
	import type { PageProps } from './$types'
	import DocumentModal from '#lib/components/orders/DocumentModal.svelte'
	import OrderDetail from '#lib/components/orders/OrderDetail.svelte'
	import OrderForm from '#lib/components/orders/OrderForm.svelte'
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte'
	import DataTable from '#lib/components/ui/DataTable.svelte'
	import ErrorAlert from '#lib/components/ui/ErrorAlert.svelte'
	import FormModal from '#lib/components/ui/FormModal.svelte'
	import IconButton from '#lib/components/ui/IconButton.svelte'
	import PageHeader from '#lib/components/ui/PageHeader.svelte'
	import SidePanel from '#lib/components/ui/SidePanel.svelte'
	import { loadAllCustomers } from '#lib/customers.ts'
	import { formatDateTime, formatMoney } from '#lib/format.ts'
	import { errorMessage } from '#lib/forms.ts'
	import { orderTotal } from '#lib/orders.ts'
	import { can } from '#lib/permissions.ts'
	import { notify } from '#lib/toast.svelte.ts'
	import { trpc } from '#lib/trpc.ts'

	const PAGE_SIZE = 50

	let { data }: PageProps = $props()

	const canPlace = $derived(can(data.user, 'order.place'))
	const canDocument = $derived(can(data.user, 'document.read'))

	let orders = $state<Order[]>([])
	let hasMore = $state(false)
	let loading = $state(true)
	let error = $state('')

	// active customers (for the new order form) plus whatever else the listed orders refer to, e.g. soft-deleted customers
	let activeCustomers = $state<Customer[]>([])
	const customers = new SvelteMap<number, Customer>()

	let selected = $state<Order>()
	let detailOpen = $state(false)
	let detailLoading = $state(false)

	let formOpen = $state(false)
	let deleteOpen = $state(false)
	let deleting = $state<Order>()
	let documentOpen = $state(false)
	let documentOrderId = $state<number>()

	const customerLabel = (order: Order) => {
		const customer = customers.get(order.customerId)

		return customer ? `${customer.code} · ${customer.name}` : `#${order.customerId}`
	}

	const columns = [
		{ header: 'Order', value: (o: Order) => `#${o.id}` },
		{ header: 'Title', value: (o: Order) => o.title },
		{ header: 'Customer', value: customerLabel },
		{ header: 'Lines', value: (o: Order) => o.details.length, align: 'end' as const },
		{ header: 'Total', value: (o: Order) => formatMoney(orderTotal(o)), align: 'end' as const },
		{ header: 'Created', value: (o: Order) => formatDateTime(o.createdAt) }
	]

	const rememberCustomers = async (list: Order[]) => {
		const missing = [...new Set(list.map(o => o.customerId))].filter(id => !customers.has(id))
		if (!missing.length) return

		for (const customer of await trpc.customers.byIds.query({ ids: missing })) customers.set(customer.id, customer)
	}

	const loadOrders = async (append = false) => {
		try {
			const page = await trpc.orders.list.query({ limit: PAGE_SIZE, offset: append ? orders.length : 0 })

			await rememberCustomers(page)
			orders = append ? [...orders, ...page] : page
			hasMore = page.length === PAGE_SIZE
			error = ''
		} catch (e) {
			error = errorMessage(e)
		} finally {
			loading = false
		}
	}

	const loadCustomers = async () => {
		activeCustomers = await loadAllCustomers()
		for (const customer of activeCustomers) customers.set(customer.id, customer)
	}

	const loadSelected = async (id: number) => {
		selected = await trpc.orders.get.query({ id })
	}

	const select = async (order: Order) => {
		selected = order
		detailOpen = true
		detailLoading = true

		try {
			await loadSelected(order.id)
		} catch (e) {
			detailOpen = false
			error = errorMessage(e)
		} finally {
			detailLoading = false
		}
	}

	// lines added or deleted in the panel refresh both the panel and the list row
	const reloadAfterChange = async () => {
		if (selected) await loadSelected(selected.id)
		await loadOrders()
	}

	const created = async (order: Order) => {
		formOpen = false
		notify(`Order #${order.id} placed`)
		await loadOrders()
	}

	const askDelete = (order: Order) => ((deleting = order), (deleteOpen = true))

	const remove = async () => {
		if (!deleting) return

		await trpc.orders.delete.mutate({ id: deleting.id })
		if (selected?.id === deleting.id) detailOpen = false

		notify(`Order #${deleting.id} deleted`)
		await loadOrders()
	}

	const showDocument = (order: Order) => ((documentOrderId = order.id), (documentOpen = true))

	onMount(() => {
		void loadOrders()
		void loadCustomers().catch(e => (error = errorMessage(e)))

		// order-service announces new orders (also those of other users) through the web BFF
		const subscription = trpc.live.orderPlaced.subscribe(undefined, {
			onData: () => void loadOrders(),
			onError: () => undefined
		})

		return () => subscription.unsubscribe()
	})
</script>

<svelte:head><title>Orders · mono-one</title></svelte:head>

<PageHeader title="Orders" subtitle="Newest first">
	{#snippet actions()}
		{#if canPlace}
			<Button onclick={() => (formOpen = true)}><PlusOutline size="sm" class="me-1" />New order</Button>
		{/if}
	{/snippet}
</PageHeader>

{#if error}<ErrorAlert message={error} />{/if}

<DataTable rows={orders} {columns} {loading} selectedId={detailOpen ? selected?.id : undefined} emptyText="No orders yet" onselect={select}>
	{#snippet actions(order)}
		{#if canDocument}
			<IconButton label="Generate document" onclick={() => showDocument(order)}><FileLinesOutline size="sm" /></IconButton>
		{/if}
		{#if canPlace}
			<IconButton label="Delete order" color="danger" onclick={() => askDelete(order)}><TrashBinOutline size="sm" /></IconButton>
		{/if}
	{/snippet}
</DataTable>

{#if hasMore}
	<div class="more"><Button color="alternative" onclick={() => loadOrders(true)}>Load more</Button></div>
{/if}

<SidePanel bind:open={detailOpen} title={selected ? `Order #${selected.id}` : 'Order'} subtitle={selected?.title} loading={detailLoading}>
	{#snippet actions()}
		{#if selected}
			{#if canDocument}
				<Button size="sm" color="alternative" onclick={() => selected && showDocument(selected)}><FileLinesOutline size="sm" class="me-1" />Generate document</Button>
			{/if}
			{#if canPlace}
				<Button size="sm" color="danger" onclick={() => selected && askDelete(selected)}><TrashBinOutline size="sm" class="me-1" />Delete</Button>
			{/if}
		{/if}
	{/snippet}
	{#if selected}
		<OrderDetail order={selected} customer={customers.get(selected.customerId)} canEdit={canPlace} onchanged={reloadAfterChange} />
	{/if}
</SidePanel>

<FormModal bind:open={formOpen} title="New order" size="lg">
	<OrderForm customers={activeCustomers} onsaved={created} oncancel={() => (formOpen = false)} />
</FormModal>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete order"
	message="Delete order #{deleting?.id} ({deleting?.title})? This cannot be undone."
	onconfirm={remove}
/>

<DocumentModal bind:open={documentOpen} orderId={documentOrderId} />

<style>
	.more {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}
</style>
