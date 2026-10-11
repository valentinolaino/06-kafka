-- Una base por servicio: ninguno lee la base de otro (sección 07 del PDF).
-- crm-analytics usa una base propia para su event_log.
CREATE DATABASE activation_db;
CREATE DATABASE billing_db;
CREATE DATABASE provisioning_db;
CREATE DATABASE notification_db;
CREATE DATABASE crm_analytics_db;
