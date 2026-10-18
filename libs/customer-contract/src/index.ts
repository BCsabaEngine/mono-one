import { z } from 'zod'

export const customerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime()
})
export type Customer = z.infer<typeof customerSchema>

export const getCustomerInput = z.object({ id: z.uuid() })
export type GetCustomerInput = z.infer<typeof getCustomerInput>

/** Port implemented by apps/customer-service, consumed by the router in customer-api. */
export interface CustomersService {
  get(id: string): Promise<Customer>
}
