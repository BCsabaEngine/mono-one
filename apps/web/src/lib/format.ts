/** Money is stored in minor units (cents). */
export const formatMoney = (minor: number) =>
	(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatDateTime = (iso: string) =>
	new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

/** "12.5" -> 1250; NaN when the text is not a plain decimal number. */
export const toMinorUnits = (text: string) =>
	/^\d+([.,]\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text.trim().replace(',', '.')) * 100) : NaN

export const fromMinorUnits = (minor: number) => (minor / 100).toFixed(2)

export const blankToNull = (text: string) => text.trim() || null

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
