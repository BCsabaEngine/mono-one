<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { FileLinesOutline, PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons'
	import { onMount, untrack } from 'svelte'
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

	// the server load delivers the first page and its customers; without it (services unreachable) the page loads in the browser
	let orders = $state<Order[]>(untrack(() => data.initial?.orders ?? []))
	let hasMore = $state(untrack(() => data.initial?.hasMore ?? false))
	let loading = $state(untrack(() => !data.initial))
	let error = $state('')

	// active customers (for the new order form) plus whatever else the listed orders refer to, e.g. soft-deleted customers
	let activeCustomers = $state<Customer[]>([])
	const customers = new SvelteMap<number, Customer>(untrack(() => data.initial?.customers.map(c => [c.id, c] as const)))

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

			orders = append ? [...orders, ...page] : page
			hasMore = page.length === PAGE_SIZE
			loading = false
			error = ''

			// the labels fill in as the customers arrive (the map is reactive), the table does not wait for them
			await rememberCustomers(page)
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

	// a fresh order replaces its row in the list, or becomes the first row when it is new; the list mirrors the server's newest-first order, so "load more" offsets stay right
	const upsert = (order: Order) =>
		(orders = orders.some(o => o.id === order.id)
			? orders.map(o => (o.id === order.id ? order : o))
			: [order, ...orders])

	const loadSelected = async (id: number) => {
		selected = await trpc.orders.get.query({ id })
		upsert(selected)
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
	}

	const created = async (order: Order) => {
		formOpen = false
		notify(`Order #${order.id} placed`)
		upsert(order)
		await rememberCustomers([order])
	}

	// the order.placed event of any user: fetch only that order, unless it is in the list already (our own order arrives twice)
	const placed = async (orderId: number) => {
		if (orders.some(o => o.id === orderId)) return

		const order = await trpc.orders.get.query({ id: orderId })

		upsert(order)
		await rememberCustomers([order])
	}

	const askDelete = (order: Order) => ((deleting = order), (deleteOpen = true))

	const remove = async () => {
		if (!deleting) return

		await trpc.orders.delete.mutate({ id: deleting.id })
		if (selected?.id === deleting.id) detailOpen = false

		orders = orders.filter(o => o.id !== deleting?.id)
		notify(`Order #${deleting.id} deleted`)
	}

	const showDocument = (order: Order) => ((documentOrderId = order.id), (documentOpen = true))

	// the new order form needs the active customers; loaded when it opens, not with the page
	const openForm = () => {
		formOpen = true
		void loadCustomers().catch(e => (error = errorMessage(e)))
	}

	onMount(() => {
		if (!data.initial) void loadOrders()

		// order-service announces new orders (also those of other users) through the web BFF
		const subscription = trpc.live.orderPlaced.subscribe(undefined, {
			onData: ({ orderId }) => void placed(orderId).catch(() => undefined),
			onError: () => undefined
		})

		return () => subscription.unsubscribe()
	})
</script>

<svelte:head><title>Orders · mono-one</title></svelte:head>

<PageHeader title="Orders" subtitle="Newest first">
	{#snippet actions()}
		{#if canPlace}
			<Button onclick={openForm}><PlusOutline size="sm" class="me-1" />New order</Button>
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
