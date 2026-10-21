import { z } from 'zod'
import { deletedSchema, id, idInput, idsInput, text } from '@lib/zod'
import { ADDRESS_TYPES, CONTACT_TYPES, EU_COUNTRIES } from './domain'

export { ADDRESS_TYPES, CONTACT_TYPES, EU_COUNTRIES }

export { deletedSchema, idInput as deleteInput }

const timestamps = {
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable() // null = active (soft delete)
}

export const addressTypeSchema = z.enum(ADDRESS_TYPES)
export const contactTypeSchema = z.enum(CONTACT_TYPES)
export const countrySchema = z.enum(EU_COUNTRIES)

export const addressSchema = z.object({
  id,
  customerId: id,
  type: addressTypeSchema,
  name: z.string().nullable(),
  country: countrySchema,
  zip: z.string(),
  city: z.string(),
  address: z.string(),
  ...timestamps
})
export type Address = z.infer<typeof addressSchema>

export const contactSchema = z.object({
  id,
  customerId: id,
  type: contactTypeSchema,
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  ...timestamps
})
export type Contact = z.infer<typeof contactSchema>

/** A soft-deleted customer is still returned, with `deletedAt` set. Children are the active ones (deleting a customer leaves them untouched). */
export const customerSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  comment: z.string().nullable(),
  addresses: z.array(addressSchema),
  contacts: z.array(contactSchema),
  ...timestamps
})
export type Customer = z.infer<typeof customerSchema>

export const getCustomerInput = idInput
export type GetCustomerInput = z.infer<typeof getCustomerInput>

/** The few customer fields a document needs, with the one address asked for (null when it is not an active address of the customer). A soft-deleted customer is still summarized. */
export const customerSummarySchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  address: addressSchema.nullable()
})
export type CustomerSummary = z.infer<typeof customerSummarySchema>

export const customerSummaryInput = z.object({ id, addressId: id })
export type CustomerSummaryInput = z.infer<typeof customerSummaryInput>

export const listCustomersInput = idsInput
export type ListCustomersInput = z.infer<typeof listCustomersInput>

// optional columns: `null` clears the value on update, omitted leaves it as it is
const customerFields = { code: text, name: text, comment: text.nullish() }
export const addCustomerInput = z.object(customerFields)
export type AddCustomerInput = z.infer<typeof addCustomerInput>

export const updateCustomerInput = z
  .object({ id })
  .extend(z.object(customerFields).partial().shape)
export type UpdateCustomerInput = z.infer<typeof updateCustomerInput>

const addressFields = {
  type: addressTypeSchema,
  name: text.nullish(),
  country: countrySchema,
  zip: text,
  city: text,
  address: text
}
export const addAddressInput = z.object({ customerId: id, ...addressFields })
export type AddAddressInput = z.infer<typeof addAddressInput>

export const addressBelongsInput = z.object({ customerId: id, addressId: id })
export type AddressBelongsInput = z.infer<typeof addressBelongsInput>

export const addressBelongsSchema = z.object({ belongs: z.boolean() })
export type AddressBelongs = z.infer<typeof addressBelongsSchema>

export const updateAddressInput = z
  .object({ id })
  .extend(z.object(addressFields).partial().shape)
export type UpdateAddressInput = z.infer<typeof updateAddressInput>

const contactFields = {
  type: contactTypeSchema,
  name: text,
  phone: text.nullish(),
  email: z.email().nullish()
}
export const addContactInput = z.object({ customerId: id, ...contactFields })
export type AddContactInput = z.infer<typeof addContactInput>

export const updateContactInput = z
  .object({ id })
  .extend(z.object(contactFields).partial().shape)
export type UpdateContactInput = z.infer<typeof updateContactInput>

/** Ports implemented by apps/customer-service, consumed by the router in customer-api. */
export interface CustomersService {
  get(id: number): Promise<Customer>
  /** Unknown ids are omitted; the result follows the order of `ids`. */
  list(ids: number[]): Promise<Customer[]>
  /** One query: name, code and the requested address of the customer; NOT_FOUND when the customer does not exist. */
  summary(input: CustomerSummaryInput): Promise<CustomerSummary>
  add(input: AddCustomerInput): Promise<Customer>
  update(input: UpdateCustomerInput): Promise<Customer>
  /** Soft delete of the customer only (its addresses and contacts stay as they are); idempotent. */
  delete(id: number): Promise<{ id: number }>
}

export interface AddressesService {
  /** Whether `addressId` is an active address of `customerId`; NOT_FOUND when the customer is missing or soft-deleted. */
  belongsTo(input: AddressBelongsInput): Promise<AddressBelongs>
  add(input: AddAddressInput): Promise<Address>
  update(input: UpdateAddressInput): Promise<Address>
  /** Soft delete; idempotent. */
  delete(id: number): Promise<{ id: number }>
}

export interface ContactsService {
  add(input: AddContactInput): Promise<Contact>
  update(input: UpdateContactInput): Promise<Contact>
  /** Soft delete; idempotent. */
  delete(id: number): Promise<{ id: number }>
}
