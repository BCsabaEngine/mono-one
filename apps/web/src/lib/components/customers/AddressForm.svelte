<script lang="ts">
	import { createSvState, stringValidator } from 'svstate'
	import { untrack } from 'svelte'
		import type { Address } from '@api/customer'
	import FormBody from '#lib/components/ui/FormBody.svelte'
	import SelectField from '#lib/components/ui/SelectField.svelte'
	import TextField from '#lib/components/ui/TextField.svelte'
	import { ADDRESS_TYPES, EU_COUNTRIES } from '#lib/customers.ts'
	import { blankToNull, capitalize } from '#lib/format.ts'
	import { trpc } from '#lib/trpc.ts'

	let {
		customerId,
		address,
		onsaved,
		oncancel
	}: { customerId: number; address?: Address; onsaved: () => void; oncancel: () => void } = $props()

	const types = ADDRESS_TYPES.map(t => ({ name: capitalize(t), value: t }))
	const countries = EU_COUNTRIES.map(c => ({ name: c, value: c }))

	let submitted = $state(false)

	const {
		data,
		execute,
		validate,
		state: { errors, actionInProgress, actionError }
	} = createSvState(
		untrack(() => ({
			type: address?.type ?? 'hq',
			name: address?.name ?? '',
			country: address?.country ?? 'HU',
			zip: address?.zip ?? '',
			city: address?.city ?? '',
			address: address?.address ?? ''
		})),
		{
			validator: s => ({
				type: stringValidator(s.type).required().in([...ADDRESS_TYPES]).getError(),
				country: stringValidator(s.country).required().in([...EU_COUNTRIES]).getError(),
				zip: stringValidator(s.zip).prepare('trim').required().getError(),
				city: stringValidator(s.city).prepare('trim').required().getError(),
				address: stringValidator(s.address).prepare('trim').required().getError()
			}),
			action: async () => {
				const fields = {
					type: data.type as Address['type'],
					name: blankToNull(data.name),
					country: data.country as Address['country'],
					zip: data.zip.trim(),
					city: data.city.trim(),
					address: data.address.trim()
				}

				if (address) await trpc.addresses.update.mutate({ id: address.id, ...fields })
				else await trpc.addresses.add.mutate({ customerId, ...fields })

				onsaved()
			}
		}
	)

	const submit = () => {
		submitted = true
		if (!validate().hasErrors) void execute()
	}
</script>

<FormBody busy={$actionInProgress} error={$actionError?.message} onsubmit={submit} {oncancel}>
	<SelectField label="Type" bind:value={data.type} options={types} error={submitted ? $errors?.type : ''} />
	<TextField label="Name (optional)" bind:value={data.name} />
	<SelectField label="Country" bind:value={data.country} options={countries} error={submitted ? $errors?.country : ''} />
	<TextField label="ZIP" bind:value={data.zip} error={submitted ? $errors?.zip : ''} />
	<TextField label="City" bind:value={data.city} error={submitted ? $errors?.city : ''} />
	<TextField label="Address" bind:value={data.address} error={submitted ? $errors?.address : ''} />
</FormBody>
