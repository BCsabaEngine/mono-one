-- one instance, one database per service (the services never read each other's tables)
CREATE DATABASE customer_db;
CREATE DATABASE order_db;
CREATE DATABASE document_db;
