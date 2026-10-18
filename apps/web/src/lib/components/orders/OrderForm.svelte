<script lang="ts">
	import { createSvState, stringValidator } from 'svstate'
	import { Button } from 'flowbite-svelte'
	import { PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons'
	import type { Customer } from '@api/customer'
	import type { Order } from '@api/order'
	import FormBody from '#lib/components/ui/FormBody.svelte'
	import IconButton from '#lib/components/ui/IconButton.svelte'
	import SelectField from '#lib/components/ui/SelectField.svelte'
	import TextField from '#lib/components/ui/TextField.svelte'
	import { addressLabel } from '#lib/customers.ts'
	import { blankToNull } from '#lib/format.ts'
	import { emptyLine, lineInput, validateLine } from '#lib/orders.ts'
	import { trpc } from '#lib/trpc.ts'
	import OrderLineFields from './OrderLineFields.svelte'

	let { customers, onsaved, oncancel }: { customers: Customer[]; onsaved: (order: Order) => void; oncancel: () => void } = $props()

	const customerOptions = $derived(customers.map(c => ({ name: `${c.code} · ${c.name}`, value: String(c.id) })))
	const addressesOf = (customerId: string) =>
		(customers.find(c => String(c.id) === customerId)?.addresses ?? []).map(a => ({ name: addressLabel(a), value: String(a.id) }))

	let submitted = $state(false)

	const {
		data,
		execute,
		validate,
		state: { errors, actionInProgress, actionError }
	} = createSvState(
		{ customerId: '', addressId: '', title: '', comment: '', lines: [emptyLine()] },
		{
			validator: s => ({
				customerId: stringValidator(s.customerId).required().getError(),
				addressId: stringValidator(s.addressId).required().getError(),
				title: stringValidator(s.title).prepare('trim').required().getError(),
				lines: s.lines.map(validateLine)
			}),
			// choosing another customer offers that customer's addresses (first one preselected)
			pathEffect: { customerId: () => (data.addressId = addressesOf(data.customerId)[0]?.value ?? '') },
			action: async () => {
				onsaved(
					await trpc.orders.create.mutate({
						customerId: Number(data.customerId),
						deliveryAddressId: Number(data.addressId),
						title: data.title.trim(),
						comment: blankToNull(data.comment),
						details: data.lines.map(lineInput)
					})
				)
			}
		}
	)

	const addresses = $derived(addressesOf(data.customerId))

	const submit = () => {
		submitted = true
		if (!validate().hasErrors) void execute()
	}
</script>

<FormBody submitLabel="Place order" busy={$actionInProgress} error={$actionError?.message} onsubmit={submit} {oncancel}>
	<TextField label="Title" bind:value={data.title} error={submitted ? $errors?.title : ''} />
	<SelectField label="Customer" bind:value={data.customerId} options={customerOptions} error={submitted ? $errors?.customerId : ''} />
	<SelectField
		label="Delivery address"
		bind:value={data.addressId}
		options={addresses}
		disabled={!data.customerId}
		placeholder={data.customerId && !addresses.length ? 'The customer has no address' : 'Choose ...'}
		error={submitted ? $errors?.addressId : ''}
	/>
	<TextField label="Comment" multiline bind:value={data.comment} />

	{#each data.lines as _, i (i)}
		<fieldset>
			<legend>
				Line {i + 1}
				{#if data.lines.length > 1}
					<IconButton label="Remove line" color="danger" onclick={() => data.lines.splice(i, 1)}><TrashBinOutline size="sm" /></IconButton>
				{/if}
			</legend>
			<OrderLineFields bind:line={data.lines[i]} errors={submitted ? $errors?.lines?.[i] : undefined} />
		</fieldset>
	{/each}
	<Button color="alternative" size="sm" onclick={() => data.lines.push(emptyLine())}><PlusOutline size="sm" class="me-1" />Add line</Button>
</FormBody>

<style>
	fieldset {
		margin: 0;
		padding: 0.75rem;
		border: 1px solid var(--color-default);
		border-radius: 0.5rem;
	}
	legend {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.25rem;
		font-weight: 500;
		color: var(--color-heading);
	}
</style>
