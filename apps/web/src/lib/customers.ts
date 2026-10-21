// the path aliases only apply to .ts files (the tsconfig `include` does not cover .svelte), so components take these values from here;
// `@domain/*` is the dependency-free lists file: `@api/customer` would pull the service router (and node:crypto) into the browser in dev
export { ADDRESS_TYPES, CONTACT_TYPES, EU_COUNTRIES } from '@domain/customer'
import type { Address, Customer } from '@api/customer'
import { trpc } from './trpc'

/** Windows fetched at once: `httpBatchLink` merges them into one HTTP request. */
const WINDOWS_PER_ROUND = 4

type CustomerWindow = { customers: Customer[]; hasMore: boolean }

/** The web router pages customers in windows of ids (see `customers.page`); this walks all windows, a few per round trip. */
export const walkCustomerWindows = async (fetchWindow: (page: number) => Promise<CustomerWindow>) => {
	const customers: Customer[] = []

	for (let page = 0; page < 1000; page += WINDOWS_PER_ROUND) {
		const windows = await Promise.all(Array.from({ length: WINDOWS_PER_ROUND }, (_, i) => fetchWindow(page + i)))
		customers.push(...windows.flatMap(w => w.customers))

		// a window that is not full is the last one: the ones after it are empty
		if (windows.some(w => !w.hasMore)) break
	}

	return customers
}

export const loadAllCustomers = () => walkCustomerWindows(page => trpc.customers.page.query({ page }))

export const addressLabel = (a: Address) => `${a.zip} ${a.city}, ${a.address} (${a.country})`
