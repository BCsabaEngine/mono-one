# Domains

The product is split into four business domains. Each is owned by one service and keeps its own data.

| Domain    | Owns                                                                     | Example capability                |
| --------- | ------------------------------------------------------------------------ | --------------------------------- |
| System    | users and their permissions                                              | sign a user in                    |
| Customers | customers with addresses and contacts                                    | look up a customer                |
| Orders    | orders with their detail lines                                           | place an order for a customer     |
| Documents | documents generated on request from other domains' data (stores nothing) | generate the document of an order |

## Order flow (current example)

1. A user signs in (System checks the credentials and the user's permissions) and places an order for a customer.
2. Orders checks that the customer and the chosen delivery address exist and stores the order with its detail lines (product, quantity, unit price, net value). Orders can be listed, soft deleted, and detail lines added or removed.
3. Orders announces that the order was placed.
4. The user's screen is notified live that an order was placed.
5. Later, on request, Documents reads the order and its customer and generates the order document (markdown now, PDF later).

Announcements are best effort. Anything that must never be lost is requested explicitly instead of being announced; documents are such an explicit request and are not created from announcements.

> The domains (apart from System) and this flow are placeholders used to prove the platform end to end. Replace them with the real domains.
