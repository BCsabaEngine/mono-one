# Domains

The product is split into three business domains. Each is owned by one service and keeps its own data.

| Domain    | Owns                                    | Example capability                             |
| --------- | --------------------------------------- | ---------------------------------------------- |
| Customers | customer records (name, email)          | look up a customer                             |
| Orders    | orders and their status                 | place an order for a customer                  |
| Documents | documents generated for business events | retrieve the confirmation document of an order |

## Order flow (current example)

1. A logged-in user places an order for a customer.
2. Orders checks that the customer exists and stores the order as `placed`.
3. Orders announces that the order was placed.
4. Documents generates an order-confirmation document for it.
5. The user's screen is notified live that an order was placed.

Announcements are best effort: if the Documents domain is unavailable at that moment, the document is not created automatically. Anything that must never be lost is requested explicitly instead of being announced.

> The three domains and this flow are placeholders used to prove the platform end to end. Replace them with the real domains.
