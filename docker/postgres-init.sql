-- one instance, one database per service (the services never read each other's tables)
CREATE DATABASE mono_customer;
CREATE DATABASE mono_order;
CREATE DATABASE mono_document;
