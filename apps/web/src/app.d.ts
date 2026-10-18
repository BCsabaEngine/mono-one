declare global {
	namespace App {
		interface Locals {
			/** Raw end-user JWT loaded from Redis for this request, if logged in. */
			jwt?: string
			sessionId?: string
		}
	}
}

export {}
