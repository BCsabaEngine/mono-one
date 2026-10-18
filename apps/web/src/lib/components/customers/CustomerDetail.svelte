<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { EditOutline, PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons'
	import type { Address, Contact, Customer } from '@api/customer'
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte'
	import FormModal from '#lib/components/ui/FormModal.svelte'
	import IconButton from '#lib/components/ui/IconButton.svelte'
	import InfoList from '#lib/components/ui/InfoList.svelte'
	import ItemCard from '#lib/components/ui/ItemCard.svelte'
	import Section from '#lib/components/ui/Section.svelte'
	import { addressLabel } from '#lib/customers.ts'
	import { capitalize, formatDateTime } from '#lib/format.ts'
	import { notify } from '#lib/toast.svelte.ts'
	import { trpc } from '#lib/trpc.ts'
	import AddressForm from './AddressForm.svelte'
	import ContactForm from './ContactForm.svelte'

	let { customer, canEdit, onchanged }: { customer: Customer; canEdit: boolean; onchanged: () => void } = $props()

	let addressOpen = $state(false)
	let editedAddress = $state<Address>()
	let contactOpen = $state(false)
	let editedContact = $state<Contact>()
	let confirmOpen = $state(false)
	let removal = $state<{ what: 'address' | 'contact'; id: number }>()

	const editAddress = (address?: Address) => ((editedAddress = address), (addressOpen = true))
	const editContact = (contact?: Contact) => ((editedContact = contact), (contactOpen = true))
	const askRemove = (what: 'address' | 'contact', id: number) => ((removal = { what, id }), (confirmOpen = true))

	// closes the form dialog, then lets the page reload the customer
	const saved = (close: () => void) => () => {
		close()
		onchanged()
	}

	const remove = async () => {
		if (!removal) return

		if (removal.what === 'address') await trpc.addresses.delete.mutate({ id: removal.id })
		else await trpc.contacts.delete.mutate({ id: removal.id })

		notify(`${capitalize(removal.what)} deleted`)
		onchanged()
	}
</script>

<InfoList
	items={[
		{ label: 'Code', value: customer.code },
		{ label: 'Name', value: customer.name },
		{ label: 'Comment', value: customer.comment },
		{ label: 'Created', value: formatDateTime(customer.createdAt) },
		{ label: 'Updated', value: formatDateTime(customer.updatedAt) }
	]}
/>

<Section title="Addresses">
	{#snippet actions()}
		{#if canEdit}
			<Button size="xs" onclick={() => editAddress()}><PlusOutline size="sm" class="me-1" />Add</Button>
		{/if}
	{/snippet}
	{#each customer.addresses as address (address.id)}
		<ItemCard title={address.name ?? capitalize(address.type)} badge={address.name ? address.type : undefined}>
			{#snippet actions()}
				{#if canEdit}
					<IconButton label="Edit address" onclick={() => editAddress(address)}><EditOutline size="sm" /></IconButton>
					<IconButton label="Delete address" color="danger" onclick={() => askRemove('address', address.id)}><TrashBinOutline size="sm" /></IconButton>
				{/if}
			{/snippet}
			{addressLabel(address)}
		</ItemCard>
	{:else}
		<p class="muted">No addresses</p>
	{/each}
</Section>

<Section title="Contacts">
	{#snippet actions()}
		{#if canEdit}
			<Button size="xs" onclick={() => editContact()}><PlusOutline size="sm" class="me-1" />Add</Button>
		{/if}
	{/snippet}
	{#each customer.contacts as contact (contact.id)}
		<ItemCard title={contact.name} badge={contact.type}>
			{#snippet actions()}
				{#if canEdit}
					<IconButton label="Edit contact" onclick={() => editContact(contact)}><EditOutline size="sm" /></IconButton>
					<IconButton label="Delete contact" color="danger" onclick={() => askRemove('contact', contact.id)}><TrashBinOutline size="sm" /></IconButton>
				{/if}
			{/snippet}
			{[contact.phone, contact.email].filter(Boolean).join(' · ') || '—'}
		</ItemCard>
	{:else}
		<p class="muted">No contacts</p>
	{/each}
</Section>

<FormModal bind:open={addressOpen} title={editedAddress ? 'Edit address' : 'New address'}>
	<AddressForm customerId={customer.id} address={editedAddress} onsaved={saved(() => (addressOpen = false))} oncancel={() => (addressOpen = false)} />
</FormModal>
<FormModal bind:open={contactOpen} title={editedContact ? 'Edit contact' : 'New contact'}>
	<ContactForm customerId={customer.id} contact={editedContact} onsaved={saved(() => (contactOpen = false))} oncancel={() => (contactOpen = false)} />
</FormModal>
<ConfirmDialog bind:open={confirmOpen} title="Delete {removal?.what}" message="Delete this {removal?.what}? This cannot be undone." onconfirm={remove} />

<style>
	.muted {
		margin: 0;
		color: var(--color-body-subtle);
	}
</style>
