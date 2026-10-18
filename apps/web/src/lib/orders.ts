import { stringValidator } from 'svstate'
import { toMinorUnits } from './format'

/** A line as typed into the form: quantity and unit price stay text until submit (unit price in major units, e.g. "12.50"). */
export interface LineDraft {
	productCode: string
	productName: string
	quantity: string
	unitPrice: string
}

export const emptyLine = (): LineDraft => ({ productCode: '', productName: '', quantity: '1', unitPrice: '' })

// mirrors the caps in order-api's contract: quantity <= 100000, unit price <= 1000000.00
const MAX_QUANTITY = 100_000
const MAX_UNIT_PRICE_MINOR = 100_000_000

const priceError = (text: string) => {
	const minor = toMinorUnits(text)

	return minor < 1 ? 'Must be positive' : minor > MAX_UNIT_PRICE_MINOR ? 'Too large' : ''
}

export const validateLine = (line: LineDraft) => ({
	productCode: stringValidator(line.productCode).prepare('trim').required().getError(),
	productName: stringValidator(line.productName).prepare('trim').required().getError(),
	quantity:
		stringValidator(line.quantity)
			.prepare('trim')
			.required()
			.regexp(/^[1-9]\d*$/, 'Whole number, at least 1')
			.getError() || (Number(line.quantity) > MAX_QUANTITY ? `At most ${MAX_QUANTITY}` : ''),
	unitPrice:
		stringValidator(line.unitPrice)
			.prepare('trim')
			.required()
			.regexp(/^\d+([.,]\d{1,2})?$/, 'Amount like 12.50')
			.getError() || priceError(line.unitPrice)
})

export const lineInput = (line: LineDraft) => ({
	productCode: line.productCode.trim(),
	productName: line.productName.trim(),
	quantity: Number(line.quantity),
	unitPrice: toMinorUnits(line.unitPrice)
})

export const orderTotal = (order: { details: { netValue: number }[] }) =>
	order.details.reduce((sum, d) => sum + d.netValue, 0)
