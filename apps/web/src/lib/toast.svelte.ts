export interface ToastItem {
	id: number
	message: string
	color: 'success' | 'danger'
}

export const toasts = $state<ToastItem[]>([])

let nextId = 0

const dismiss = (id: number) => {
	const i = toasts.findIndex(t => t.id === id)
	if (i >= 0) toasts.splice(i, 1)
}

const show = (message: string, color: ToastItem['color']) => {
	const id = ++nextId
	toasts.push({ id, message, color })
	setTimeout(() => dismiss(id), 4000)
}

export const notify = (message: string) => show(message, 'success')
export const notifyError = (message: string) => show(message, 'danger')
