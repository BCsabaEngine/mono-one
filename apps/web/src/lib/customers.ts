// the path aliases only apply to .ts files (the tsconfig `include` does not cover .svelte), so components take these values from here;
// `@domain/*` is the dependency-free lists file: `@api/customer` would pull the service router (and node:crypto) into the browser in dev
export { ADDRESS_TYPES, CONTACT_TYPES, EU_COUNTRIES } from '@domain/customer'
import type { Address, Customer } from '@api/customer'
import { trpc } from './trpc'

/** The web router pages customers in windows of ids (see `customers.page`); this walks all windows. */
export const loadAllCustomers = async () => {
	const customers: Customer[] = []

	for (let page = 0; page < 1000; page++) {
		const result = await trpc.customers.page.query({ page })
		customers.push(...result.customers)
		if (!result.hasMore) break
	}

	return customers
}

export const addressLabel = (a: Address) => `${a.zip} ${a.city}, ${a.address} (${a.country})`
