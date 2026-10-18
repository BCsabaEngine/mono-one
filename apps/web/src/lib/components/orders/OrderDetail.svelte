<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons'
	import type { Customer } from '@api/customer'
	import type { Order, OrderDetail } from '@api/order'
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte'
	import DataTable from '#lib/components/ui/DataTable.svelte'
	import FormModal from '#lib/components/ui/FormModal.svelte'
	import IconButton from '#lib/components/ui/IconButton.svelte'
	import InfoList from '#lib/components/ui/InfoList.svelte'
	import Section from '#lib/components/ui/Section.svelte'
	import { addressLabel } from '#lib/customers.ts'
	import { formatDateTime, formatMoney } from '#lib/format.ts'
	import { orderTotal } from '#lib/orders.ts'
	import { notify } from '#lib/toast.svelte.ts'
	import { trpc } from '#lib/trpc.ts'
	import AddLineForm from './AddLineForm.svelte'

	let { order, customer, canEdit, onchanged }: { order: Order; customer?: Customer; canEdit: boolean; onchanged: () => void } = $props()

	const address = $derived(customer?.addresses.find(a => a.id === order.deliveryAddressId))

	const columns = [
		{ header: 'Product', value: (d: OrderDetail) => `${d.productCode} · ${d.productName}` },
		{ header: 'Qty', value: (d: OrderDetail) => d.quantity, align: 'end' as const },
		{ header: 'Unit price', value: (d: OrderDetail) => formatMoney(d.unitPrice), align: 'end' as const },
		{ header: 'Net', value: (d: OrderDetail) => formatMoney(d.netValue), align: 'end' as const }
	]

	let addOpen = $state(false)
	let deleteOpen = $state(false)
	let deleting = $state<OrderDetail>()

	const askDelete = (line: OrderDetail) => ((deleting = line), (deleteOpen = true))

	const lineAdded = () => {
		addOpen = false
		notify('Line added')
		onchanged()
	}

	const removeLine = async () => {
		if (!deleting) return

		await trpc.orderDetails.delete.mutate({ id: deleting.id })
		notify('Line deleted')
		onchanged()
	}
</script>

<InfoList
	items={[
		{ label: 'Order', value: `#${order.id}` },
		{ label: 'Title', value: order.title },
		{ label: 'Customer', value: customer ? `${customer.code} · ${customer.name}` : `#${order.customerId}` },
		{ label: 'Delivery', value: address ? addressLabel(address) : 'Address no longer available' },
		{ label: 'Comment', value: order.comment },
		{ label: 'Total', value: formatMoney(orderTotal(order)) },
		{ label: 'Created', value: formatDateTime(order.createdAt) },
		{ label: 'Updated', value: formatDateTime(order.updatedAt) }
	]}
/>

<Section title="Lines">
	{#snippet actions()}
		{#if canEdit}
			<Button size="xs" onclick={() => (addOpen = true)}><PlusOutline size="sm" class="me-1" />Add line</Button>
		{/if}
	{/snippet}
	<DataTable rows={order.details} {columns} emptyText="No lines">
		{#snippet actions(line)}
			{#if canEdit}
				<IconButton label="Delete line" color="danger" onclick={() => askDelete(line)}><TrashBinOutline size="sm" /></IconButton>
			{/if}
		{/snippet}
	</DataTable>
</Section>

<FormModal bind:open={addOpen} title="Add line to order #{order.id}">
	<AddLineForm orderId={order.id} onsaved={lineAdded} oncancel={() => (addOpen = false)} />
</FormModal>
<ConfirmDialog bind:open={deleteOpen} title="Delete line" message="Delete line {deleting?.productCode} · {deleting?.productName}?" onconfirm={removeLine} />
