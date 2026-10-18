<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import { resolve } from '$app/paths'
	import type { LayoutProps } from './$types'
	import NavBar from '#lib/components/NavBar.svelte'
	import { notifyError } from '#lib/toast.svelte.ts'
	import { errorMessage } from '#lib/forms.ts'
	import { trpc } from '#lib/trpc.ts'

	let { data, children }: LayoutProps = $props()

	const links = [
		{ href: '/customers', label: 'Customers' },
		{ href: '/orders', label: 'Orders' }
	]

	const logout = async () => {
		try {
			await trpc.auth.logout.mutate()
			await invalidateAll()
			await goto(resolve('/login'))
		} catch (e) {
			notifyError(errorMessage(e))
		}
	}
</script>

<NavBar {links} user={data.user} onlogout={logout} />
<main>{@render children()}</main>

<style>
	main {
		max-width: 80rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}
</style>
