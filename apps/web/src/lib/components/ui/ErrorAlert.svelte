<script lang="ts">
	import { Alert } from 'flowbite-svelte'

	let { message }: { message: string } = $props()
</script>

<Alert color="danger">{message}</Alert>
