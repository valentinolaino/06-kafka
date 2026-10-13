# TP6 — POC: Activación de Servicios con Kafka

Prueba de concepto de una **saga por coreografía** para la activación de un plan de servicios.
Un cliente contrata un plan desde una UI; a partir de **un solo evento** en Kafka reaccionan
facturación, aprovisionamiento, notificación y registro en CRM, **sin que ningún servicio llame
directamente a otro**.

Demuestra fan-out, compensación ante fallos, e idempotencia, reintentos y DLQ con PostgreSQL.

**Stack:** NestJS + `@nestjs/microservices` · Apache Kafka (KRaft) · React + Vite · PostgreSQL · Docker Compose.

> Trabajo práctico de **Programación Avanzada (2026)**.

## Levantar el proyecto

Desde `activation-poc/`:

```powershell
docker compose up -d --build
```

| Acceso                | Dirección             |
| --------------------- | --------------------- |
| Demo UI               | http://localhost:5173 |
| Kafka UI              | http://localhost:8080 |
| Mailhog (emails)      | http://localhost:8025 |
| activation-api (REST) | http://localhost:3000 |

## Documentación

La documentación completa está en [`activation-poc/docs/`](activation-poc/docs):

- [`architecture.md`](activation-poc/docs/architecture.md) — arquitectura, servicios, topics, contrato de
  eventos, flujos, garantías de entrega, modelo de datos y decisiones de diseño.
- [`demo-script.md`](activation-poc/docs/demo-script.md) — guion de la demo (5 escenarios) y problemas frecuentes.

## Licencia

GNU General Public License v3.0 — ver [`LICENSE`](LICENSE).
