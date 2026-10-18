<script lang="ts">
	import { onMount } from 'svelte'
	import { DEMO_CUSTOMER_ID } from '#lib/demo.ts'
	import { trpc } from '#lib/trpc.ts'

	let log = $state<string[]>([])

	const show = (label: string, value: unknown) => (log = [`${label}: ${JSON.stringify(value)}`, ...log])

	const run = (label: string, fn: () => Promise<unknown>) =>
		fn().then(
			v => show(label, v),
			e => show(`${label} failed`, e.message)
		)

	const login = () => run('login', () => trpc.auth.login.mutate({ email: 'hello@mono.hu', password: 'hello' })) // seeded starter user (pnpm seed)
	const getUser = () => run('users.get', () => trpc.users.get.query({ id: 1 }))
	const getCustomer = () => run('customers.get', () => trpc.customers.get.query({ id: DEMO_CUSTOMER_ID }))
	const placeOrder = () =>
		run('orders.place', () => trpc.orders.place.mutate({ customerId: DEMO_CUSTOMER_ID, totalCents: 1990 }))
	const getDocument = () =>
		run('documents.get', async () => {
			const order = await trpc.orders.place.mutate({ customerId: DEMO_CUSTOMER_ID, totalCents: 500 })

			await new Promise(r => setTimeout(r, 300)) // the document is created by the order.placed event

			return trpc.documents.get.query({ orderId: order.id })
		})

	onMount(() => {
		const sub = trpc.live.orderPlaced.subscribe(undefined, {
			onData: e => show('live order.placed', e),
			onError: () => undefined // not logged in yet
		})
		return () => sub.unsubscribe()
	})
</script>

<main>
	<h1>mono-one</h1>
	<p>SvelteKit BFF calling customer-service, order-service, document-service and system-service over tRPC.</p>
	<div>
		<button onclick={login}>1. Login as hello@mono.hu</button>
		<button onclick={getUser}>users.get</button>
		<button onclick={getCustomer}>customers.get</button>
		<button onclick={placeOrder}>orders.place</button>
		<button onclick={getDocument}>place order, then documents.get</button>
	</div>
	<pre>{log.join('\n')}</pre>
</main>
