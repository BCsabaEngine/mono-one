<script lang="ts">
	import { createSvState, stringValidator } from 'svstate'
	import { untrack } from 'svelte'
		import type { Contact } from '@api/customer'
	import FormBody from '#lib/components/ui/FormBody.svelte'
	import SelectField from '#lib/components/ui/SelectField.svelte'
	import TextField from '#lib/components/ui/TextField.svelte'
	import { CONTACT_TYPES } from '#lib/customers.ts'
	import { blankToNull, capitalize } from '#lib/format.ts'
	import { trpc } from '#lib/trpc.ts'

	let {
		customerId,
		contact,
		onsaved,
		oncancel
	}: { customerId: number; contact?: Contact; onsaved: () => void; oncancel: () => void } = $props()

	const types = CONTACT_TYPES.map(t => ({ name: capitalize(t), value: t }))

	let submitted = $state(false)

	const {
		data,
		execute,
		validate,
		state: { errors, actionInProgress, actionError }
	} = createSvState(
		untrack(() => ({
			type: contact?.type ?? 'sales',
			name: contact?.name ?? '',
			phone: contact?.phone ?? '',
			email: contact?.email ?? ''
		})),
		{
			validator: s => ({
				type: stringValidator(s.type).required().in([...CONTACT_TYPES]).getError(),
				name: stringValidator(s.name).prepare('trim').required().getError(),
				email: stringValidator(s.email).prepare('trim').email().getError()
			}),
			action: async () => {
				const fields = {
					type: data.type as Contact['type'],
					name: data.name.trim(),
					phone: blankToNull(data.phone),
					email: blankToNull(data.email)
				}

				if (contact) await trpc.contacts.update.mutate({ id: contact.id, ...fields })
				else await trpc.contacts.add.mutate({ customerId, ...fields })

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
	<TextField label="Name" bind:value={data.name} error={submitted ? $errors?.name : ''} />
	<TextField label="Phone (optional)" type="tel" bind:value={data.phone} />
	<TextField label="Email (optional)" type="email" bind:value={data.email} error={submitted ? $errors?.email : ''} />
</FormBody>
