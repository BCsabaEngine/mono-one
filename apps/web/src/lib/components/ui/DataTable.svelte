<script lang="ts" module>
	export interface Column<R> {
		header: string
		value: (row: R) => string | number
		align?: 'end'
	}
</script>

<script lang="ts" generics="T extends { id: number }">
	import { Spinner, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell } from 'flowbite-svelte'
	import type { Snippet } from 'svelte'

	let {
		rows,
		columns,
		selectedId,
		loading = false,
		emptyText = 'Nothing here yet',
		onselect,
		actions
	}: {
		rows: T[]
		columns: Column<T>[]
		selectedId?: number
		loading?: boolean
		emptyText?: string
		onselect?: (row: T) => void
		actions?: Snippet<[T]>
	} = $props()
</script>

<div class="data-table">
	<Table hoverable={!!onselect}>
		<TableHead>
			{#each columns as column (column.header)}
				<TableHeadCell class={column.align === 'end' ? 'end' : ''}>{column.header}</TableHeadCell>
			{/each}
			{#if actions}<TableHeadCell><span class="sr-only">Actions</span></TableHeadCell>{/if}
		</TableHead>
		<TableBody>
			{#each rows as row (row.id)}
				<TableBodyRow
					aria-selected={row.id === selectedId}
					tabindex={onselect ? 0 : undefined}
					onclick={() => onselect?.(row)}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && onselect?.(row)}
				>
					{#each columns as column (column.header)}
						<TableBodyCell class={column.align === 'end' ? 'end' : ''}>{column.value(row)}</TableBodyCell>
					{/each}
					{#if actions}
						<TableBodyCell>
							<!-- the row opens the detail panel; its buttons must not -->
							<div class="row-actions" role="presentation" onclick={e => e.stopPropagation()} onkeydown={e => e.stopPropagation()}>
								{@render actions(row)}
							</div>
						</TableBodyCell>
					{/if}
				</TableBodyRow>
			{:else}
				<TableBodyRow>
					<TableBodyCell colspan={columns.length + (actions ? 1 : 0)}>
						<div class="empty">
							{#if loading}<Spinner size="6" />{:else}{emptyText}{/if}
						</div>
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
</div>

<style>
	.data-table :global(table) {
		width: 100%;
	}
	.data-table :global(tbody tr[aria-selected='true']) {
		background: var(--color-brand-softer);
	}
	.data-table :global(tbody tr[tabindex]) {
		cursor: pointer;
	}
	.data-table :global(.end) {
		text-align: end;
	}
	.row-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.375rem;
	}
	.empty {
		display: flex;
		justify-content: center;
		padding: 1.5rem 0;
		color: var(--color-body-subtle);
	}
</style>
