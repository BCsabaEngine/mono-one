<script lang="ts">
	import { Button, Search } from 'flowbite-svelte'
	import { EditOutline, PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons'
	import { onMount, untrack } from 'svelte'
	import type { Customer } from '@api/customer'
	import type { PageProps } from './$types'
	import CustomerDetail from '#lib/components/customers/CustomerDetail.svelte'
	import CustomerForm from '#lib/components/customers/CustomerForm.svelte'
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte'
	import DataTable from '#lib/components/ui/DataTable.svelte'
	import ErrorAlert from '#lib/components/ui/ErrorAlert.svelte'
	import FormModal from '#lib/components/ui/FormModal.svelte'
	import IconButton from '#lib/components/ui/IconButton.svelte'
	import PageHeader from '#lib/components/ui/PageHeader.svelte'
	import SidePanel from '#lib/components/ui/SidePanel.svelte'
	import { loadAllCustomers } from '#lib/customers.ts'
	import { formatDateTime } from '#lib/format.ts'
	import { errorMessage } from '#lib/forms.ts'
	import { can } from '#lib/permissions.ts'
	import { notify } from '#lib/toast.svelte.ts'
	import { trpc } from '#lib/trpc.ts'

	let { data }: PageProps = $props()

	const canEdit = $derived(can(data.user, 'customer.admin'))

	// the server load delivers the first list; without it (services unreachable) the list loads in the browser
	let customers = $state<Customer[]>(untrack(() => data.customers ?? []))
	let loading = $state(untrack(() => !data.customers))
	let error = $state('')
	let search = $state('')

	let selected = $state<Customer>()
	let detailOpen = $state(false)
	let detailLoading = $state(false)

	let formOpen = $state(false)
	let edited = $state<Customer>()
	let deleteOpen = $state(false)
	let deleting = $state<Customer>()

	const visible = $derived(
		customers.filter(c => `${c.code} ${c.name}`.toLowerCase().includes(search.trim().toLowerCase()))
	)

	const columns = [
		{ header: 'Code', value: (c: Customer) => c.code },
		{ header: 'Name', value: (c: Customer) => c.name },
		{ header: 'City', value: (c: Customer) => c.addresses[0]?.city ?? '—' },
		{ header: 'Updated', value: (c: Customer) => formatDateTime(c.updatedAt) }
	]

	const loadList = async () => {
		try {
			customers = await loadAllCustomers()
			error = ''
		} catch (e) {
			error = errorMessage(e)
		} finally {
			loading = false
		}
	}

	// the fresh customer also replaces its row in the list, so a change needs no reload of all customers
	const patchRow = (customer: Customer) => (customers = customers.map(c => (c.id === customer.id ? customer : c)))

	const loadSelected = async (id: number) => {
		selected = await trpc.customers.get.query({ id })
		patchRow(selected)
	}

	const select = async (customer: Customer) => {
		selected = customer
		detailOpen = true
		detailLoading = true

		try {
			await loadSelected(customer.id)
		} catch (e) {
			detailOpen = false
			notifyFailure(e)
		} finally {
			detailLoading = false
		}
	}

	const notifyFailure = (e: unknown) => (error = errorMessage(e))

	// a change made in the detail panel (address, contact) refreshes both the panel and the list row
	const reloadAfterChange = async () => {
		if (selected) await loadSelected(selected.id)
	}

	const openForm = (customer?: Customer) => ((edited = customer), (formOpen = true))

	const askDelete = (customer: Customer) => ((deleting = customer), (deleteOpen = true))

	const saved = async (customer: Customer) => {
		formOpen = false
		notify(edited ? 'Customer saved' : 'Customer created')
		if (edited && selected?.id === customer.id) selected = customer

		if (edited) patchRow(customer)
		else customers = [...customers, customer] // new ids are the highest, the list is in id order
	}

	const remove = async () => {
		if (!deleting) return

		await trpc.customers.delete.mutate({ id: deleting.id })
		if (selected?.id === deleting.id) detailOpen = false

		customers = customers.filter(c => c.id !== deleting?.id)
		notify(`Customer ${deleting.code} deleted`)
	}

	onMount(() => {
		if (!data.customers) void loadList()
	})
</script>

<svelte:head><title>Customers · mono-one</title></svelte:head>

<PageHeader title="Customers" subtitle="{customers.length} active customers">
	{#snippet actions()}
		<Search bind:value={search} placeholder="Search code or name" size="md" />
		{#if canEdit}
			<Button onclick={() => openForm()}><PlusOutline size="sm" class="me-1" />New customer</Button>
		{/if}
	{/snippet}
</PageHeader>

{#if error}<ErrorAlert message={error} />{/if}

<DataTable
	rows={visible}
	{columns}
	{loading}
	selectedId={detailOpen ? selected?.id : undefined}
	emptyText={search ? 'No customer matches the search' : 'No customers yet'}
	onselect={select}
>
	{#snippet actions(customer)}
		{#if canEdit}
			<IconButton label="Edit customer" onclick={() => openForm(customer)}><EditOutline size="sm" /></IconButton>
			<IconButton label="Delete customer" color="danger" onclick={() => askDelete(customer)}><TrashBinOutline size="sm" /></IconButton>
		{/if}
	{/snippet}
</DataTable>

<SidePanel bind:open={detailOpen} title={selected?.name ?? 'Customer'} subtitle={selected?.code} loading={detailLoading}>
	{#snippet actions()}
		{#if selected && canEdit}
			<Button size="sm" color="alternative" onclick={() => selected && openForm(selected)}><EditOutline size="sm" class="me-1" />Edit</Button>
			<Button size="sm" color="danger" onclick={() => selected && askDelete(selected)}><TrashBinOutline size="sm" class="me-1" />Delete</Button>
		{/if}
	{/snippet}
	{#if selected}
		<CustomerDetail customer={selected} {canEdit} onchanged={reloadAfterChange} />
	{/if}
</SidePanel>

<FormModal bind:open={formOpen} title={edited ? 'Edit customer' : 'New customer'}>
	<CustomerForm customer={edited} onsaved={saved} oncancel={() => (formOpen = false)} />
</FormModal>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete customer"
	message="Delete customer {deleting?.code} ({deleting?.name})? Their existing orders stay, but the customer can no longer be used for new ones."
	onconfirm={remove}
/>
