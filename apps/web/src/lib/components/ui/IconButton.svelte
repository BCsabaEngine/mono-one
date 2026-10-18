<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import type { ComponentProps } from 'svelte'

	let { label, children, ...rest }: { label: string } & ComponentProps<typeof Button> = $props()
</script>

<Button size="xs" color="alternative" aria-label={label} title={label} {...rest}>
	{@render children?.()}
</Button>
