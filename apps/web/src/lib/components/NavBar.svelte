<script lang="ts">
	import { page } from '$app/state'
	import { Avatar, Dropdown, DropdownGroup, DropdownHeader, DropdownItem, NavBrand, NavHamburger, NavLi, NavUl, Navbar } from 'flowbite-svelte'

	export interface NavLink {
		href: string
		label: string
	}

	let {
		links,
		user,
		onlogout
	}: { links: NavLink[]; user: { name: string; email: string }; onlogout: () => void } = $props()

	const initials = $derived(
		user.name
			.split(/\s+/)
			.map(part => part[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	)
</script>

<Navbar fluid>
	<NavBrand href="/customers">
		<img src="/favicon-32.png" alt="" width="32" height="32" />
		<span class="brand">mono-one</span>
	</NavBrand>
	<div class="user">
		<Avatar id="user-menu" class="cursor-pointer">{initials}</Avatar>
		<NavHamburger />
	</div>
	<Dropdown triggeredBy="#user-menu">
		<DropdownHeader>
			<div class="name">{user.name}</div>
			<div class="email">{user.email}</div>
		</DropdownHeader>
		<DropdownGroup>
			<DropdownItem onclick={onlogout}>Sign out</DropdownItem>
		</DropdownGroup>
	</Dropdown>
	<NavUl activeUrl={page.url.pathname}>
		{#each links as link (link.href)}
			<NavLi href={link.href}>{link.label}</NavLi>
		{/each}
	</NavUl>
</Navbar>

<style>
	.brand {
		margin-inline-start: 0.5rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-heading);
	}
	.user {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.name {
		font-weight: 600;
		color: var(--color-heading);
	}
	.email {
		font-size: 0.875rem;
		color: var(--color-body-subtle);
	}
</style>
