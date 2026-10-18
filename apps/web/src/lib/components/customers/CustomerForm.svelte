<script lang="ts">
	import { createSvState, stringValidator } from 'svstate'
	import { untrack } from 'svelte'
	import type { Customer } from '@api/customer'
	import FormBody from '#lib/components/ui/FormBody.svelte'
	import TextField from '#lib/components/ui/TextField.svelte'
	import { blankToNull } from '#lib/format.ts'
	import { trpc } from '#lib/trpc.ts'

	let { customer, onsaved, oncancel }: { customer?: Customer; onsaved: (customer: Customer) => void; oncancel: () => void } = $props()

	let submitted = $state(false)

	const {
		data,
		execute,
		validate,
		state: { errors, actionInProgress, actionError }
	} = createSvState(
		untrack(() => ({ code: customer?.code ?? '', name: customer?.name ?? '', comment: customer?.comment ?? '' })),
		{
			validator: s => ({
				code: stringValidator(s.code).prepare('trim').required().getError(),
				name: stringValidator(s.name).prepare('trim').required().getError()
			}),
			action: async () => {
				const fields = { code: data.code.trim(), name: data.name.trim(), comment: blankToNull(data.comment) }

				onsaved(
					customer
						? await trpc.customers.update.mutate({ id: customer.id, ...fields })
						: await trpc.customers.add.mutate(fields)
				)
			}
		}
	)

	const submit = () => {
		submitted = true
		if (!validate().hasErrors) void execute()
	}
</script>

<FormBody busy={$actionInProgress} error={$actionError?.message} onsubmit={submit} {oncancel}>
	<TextField label="Code" bind:value={data.code} error={submitted ? $errors?.code : ''} />
	<TextField label="Name" bind:value={data.name} error={submitted ? $errors?.name : ''} />
	<TextField label="Comment" multiline bind:value={data.comment} />
</FormBody>
