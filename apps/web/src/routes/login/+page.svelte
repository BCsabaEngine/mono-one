<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { Button, Card } from 'flowbite-svelte'
	import { createSvState, stringValidator } from 'svstate'
	import ErrorAlert from '#lib/components/ui/ErrorAlert.svelte'
	import TextField from '#lib/components/ui/TextField.svelte'
	import { trpc } from '#lib/trpc.ts'

	let submitted = $state(false)

	const {
		data,
		execute,
		validate,
		state: { errors, actionInProgress, actionError }
	} = createSvState(
		{ email: '', password: '' },
		{
			validator: s => ({
				email: stringValidator(s.email).prepare('trim').required().email().getError(),
				password: stringValidator(s.password).required().getError()
			}),
			action: async () => {
				await trpc.auth.login.mutate({ email: data.email.trim(), password: data.password })
				await invalidateAll()
				await goto(resolve('/(app)/customers'))
			}
		}
	)

	const submit = (e: SubmitEvent) => {
		e.preventDefault()
		submitted = true
		if (!validate().hasErrors) void execute()
	}
</script>

<svelte:head><title>Sign in · mono-one</title></svelte:head>

<div class="center">
	<Card size="md" shadow="md">
		<form onsubmit={submit} novalidate>
			<div class="brand">
				<img src="/icon-192.png" alt="" width="56" height="56" />
				<h1>Sign in to mono-one</h1>
			</div>
			<TextField label="Email" type="email" autocomplete="username" bind:value={data.email} error={submitted ? $errors?.email : ''} />
			<TextField label="Password" type="password" autocomplete="current-password" bind:value={data.password} error={submitted ? $errors?.password : ''} />
			{#if $actionError}<ErrorAlert message={$actionError.message} />{/if}
			<Button type="submit" loading={$actionInProgress}>Sign in</Button>
		</form>
	</Card>
</div>

<style>
	.center {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 2rem;
	}
	.brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	h1 {
		margin: 0;
		font-size: 1.375rem;
		font-weight: 600;
		color: var(--color-heading);
	}
</style>
