<script lang="ts">
	import { createSvState } from 'svstate'
	import FormBody from '#lib/components/ui/FormBody.svelte'
	import { emptyLine, lineInput, validateLine } from '#lib/orders.ts'
	import { trpc } from '#lib/trpc.ts'
	import OrderLineFields from './OrderLineFields.svelte'

	let { orderId, onsaved, oncancel }: { orderId: number; onsaved: () => void; oncancel: () => void } = $props()

	let submitted = $state(false)

	const {
		data,
		execute,
		validate,
		state: { errors, actionInProgress, actionError }
	} = createSvState(
		{ line: emptyLine() },
		{
			validator: s => ({ line: validateLine(s.line) }),
			action: async () => {
				await trpc.orderDetails.add.mutate({ orderId, ...lineInput(data.line) })
				onsaved()
			}
		}
	)

	const submit = () => {
		submitted = true
		if (!validate().hasErrors) void execute()
	}
</script>

<FormBody submitLabel="Add line" busy={$actionInProgress} error={$actionError?.message} onsubmit={submit} {oncancel}>
	<OrderLineFields bind:line={data.line} errors={submitted ? $errors?.line : undefined} />
</FormBody>
