# Guion de la demo

Cinco escenarios, cada uno demuestra un concepto de Kafka. Duración estimada: **15 minutos**.
Para entender cómo está armado todo, ver [`architecture.md`](architecture.md).

**Pantalla dividida:** Demo UI a la izquierda, Kafka UI a la derecha.

| # | Escenario | Qué se hace | Qué se ve | Concepto |
|---|---|---|---|---|
| 1 | Camino feliz | Contratar un plan sin fallo | Línea de tiempo con 4 eventos en verde; email en Mailhog | Fan-out: un evento, varias reacciones |
| 2 | Fallo y compensación | Contratar con fallo en provisioning | `ProvisioningFailed`, `ActivationFailed`, `BillingAccountCancelled`; email de error | Saga sin llamadas directas |
| 3 | Servicio caído | Detener notification, crear 3 activaciones, volver a levantarlo | Kafka UI muestra lag de 3; al volver, llegan los 3 emails | Offset: nadie pierde mensajes |
| 4 | Escalar | Levantar una segunda instancia de billing | Kafka UI reparte las 3 particiones entre 2 consumidores | Consumer group y particiones |
| 5 | Nuevo consumidor | Levantar un servicio loyalty con un group nuevo que lee desde el inicio | Procesa todo el historial sin tocar a los demás | Replay del log |

---

## Preparación

### Levantar todo

Desde la raíz del repositorio:

```powershell
docker compose up -d --build
```

La primera vez compila las imágenes y puede tardar varios minutos (depende de la conexión). Las veces
siguientes tarda segundos. Si la conexión es lenta o se corta, repetir el mismo comando retoma lo que
ya se descargó. También ayuda construir de a una imagen por vez:

```powershell
$env:COMPOSE_PARALLEL_LIMIT = 1
docker compose up -d --build
```

Verificar que todo esté arriba:

```powershell
docker compose ps
```

Tienen que figurar `running` los 5 servicios, `demo-ui`, `kafka`, `postgres`, `mailhog` y `kafka-ui`.
`kafka-init` aparece como `exited (0)`: creó los topics y terminó, es lo correcto.

> No dejar corriendo `pnpm dev:*` mientras se usa Docker. Comparten puertos (3000 y 5173) y consumer
> groups con los contenedores.

### Abrir las pantallas

| Qué | Dirección |
|---|---|
| Demo UI (izquierda) | http://localhost:5173 |
| Kafka UI (derecha) | http://localhost:8080 |
| Mailhog (emails) | http://localhost:8025 |

### Antes de empezar (opcional)

Si se quiere una demo "limpia" (sin actividades de pruebas anteriores), borrar todo y volver a levantar. Ojo:
esto borra los datos de PostgreSQL y los topics.

```powershell
docker compose --profile loyalty down -v
docker compose up -d
```

(Sin `--build`: las imágenes ya están construidas.) El `--profile loyalty` en el `down` es para que también
se detenga `loyalty-service`, si estaba levantado.

---

## Escenario 1: Camino feliz

**Concepto:** fan-out. Un evento (`ActivationRequested`) y varios servicios reaccionan sin conocerse.

1. En la Demo UI, completar el formulario: cliente `C-1234`, un plan, modo de fallo **ninguno**. Enviar.
2. La tarjeta aparece enseguida en `PENDING` (la API respondió 202 sin esperar a nadie).
3. La línea de tiempo se va llenando en vivo, por WebSocket:
   `ActivationRequested` → `BillingAccountCreated` y `ProvisioningCompleted` (en paralelo) → `ActivationCompleted`.
4. La tarjeta termina en **ACTIVE**.
5. Abrir Mailhog: llegó el email de bienvenida.

**Qué mostrar en Kafka UI:** en el topic `activation.requested`, el mensaje; en la solapa *Consumers*,
`billing-svc-server` y `provisioning-svc-server` leyeron **el mismo** mensaje, cada uno con su propio grupo.

**Qué decir:** billing y provisioning se enteran por el mismo evento y trabajan en paralelo. La API no
espera a nadie.

---

## Escenario 2: Fallo y compensación

**Concepto:** saga por coreografía, sin llamadas directas entre servicios.

1. En la Demo UI, crear otra activación con modo de fallo **provisioning**.
2. En la línea de tiempo aparecen, en este orden aproximado:
   `ProvisioningFailed` → `ActivationFailed` → `BillingAccountCancelled`.
3. La tarjeta termina en **FAILED**.
4. En Mailhog llegó el email de **error**.

**Qué decir:** billing ya había creado la cuenta. Al enterarse de que la activación falló (por
`ActivationFailed`), la anula solo. Nadie le dio la orden: reaccionó a un hecho. Eso es la compensación.

**Comprobación opcional** (la cuenta quedó anulada):

```powershell
@'
select "activationId", status from billing_accounts order by "createdAt" desc limit 3;
'@ | docker compose exec -T postgres psql -U postgres -d billing_db -P pager=off
```

**Variante:** con modo de fallo **billing** la activación también termina en `FAILED`. Como billing nunca
creó la cuenta, no hay nada que anular. Es la regla de agregación: el primer fallo cierra la activación y
los resultados que lleguen después solo quedan en el historial.

---

## Escenario 3: Servicio caído

**Concepto:** offsets. Kafka guarda los mensajes hasta que el consumidor los lee: nadie pierde nada.

1. Detener notification:

   ```powershell
   docker compose stop notification-service
   ```

2. En la Demo UI, crear **3 activaciones** (con clientes distintos, sin fallo). Las 3 terminan en ACTIVE:
   el resto del sistema no se enteró de que notification está caído.
3. En Mailhog **no** llegó ningún email nuevo.
4. En Kafka UI: *Consumers* → `notification-svc-server`. Aparece un **lag de 3** sobre `activation.events`
   (3 mensajes que el grupo todavía no leyó).
5. Volver a levantarlo:

   ```powershell
   docker compose start notification-service
   ```

6. En unos segundos el lag baja a 0 y llegan **los 3 emails** a Mailhog.

**Qué decir:** Kafka guardó los mensajes. Cuando el servicio volvió, siguió desde donde se había quedado.
Con llamadas HTTP directas, esos 3 avisos se habrían perdido.

---

## Escenario 4: Escalar billing

**Concepto:** consumer group y particiones. Varias instancias del mismo servicio se reparten el trabajo.

1. Levantar una segunda instancia de billing:

   ```powershell
   docker compose up -d --scale billing-service=2
   ```

2. En Kafka UI: *Consumers* → `billing-svc-server`. Ahora tiene **2 members**. Abrir el grupo: las
   particiones de los topics están repartidas entre las dos instancias (una tiene 2 de las 3 particiones
   de `activation.requested` y la otra tiene 1).
3. Crear **6 activaciones** con clientes distintos (`C-1` a `C-6`). Seguir los logs de las dos instancias:

   ```powershell
   docker compose logs -f billing-service
   ```

   Se ve `ActivationRequested recibido (... cliente C-x)` repartido entre `billing-service-1` y
   `billing-service-2`. Un mismo cliente lo atiende siempre la misma instancia, porque la clave del mensaje
   es el `customerId`.
4. Las 6 terminan en ACTIVE.

**Qué decir:** escalar no requirió tocar código ni configurar nada: Kafka reparte las particiones entre los
consumidores del mismo grupo. Al sumar la segunda instancia hubo una pausa de unos segundos (el
*rebalanceo*), y es esperable.

**Variante (rebalanceo al caer una instancia):** detener solo una de las dos con `docker stop` y el nombre
que muestra `docker compose ps` (por ejemplo `activation-poc-billing-service-2`). La instancia restante se
queda con todas las particiones (se ve en su log, con un nuevo `memberAssignment` de 3 particiones) y sigue
atendiendo. Crear otra activación para comprobarlo.

**Volver a una sola instancia:**

```powershell
docker compose up -d --scale billing-service=1
```

---

## Escenario 5: Nuevo consumidor

**Concepto:** replay del log. Un consumidor nuevo procesa **todo el historial** sin tocar a los demás.
"Algo que con APIs directas no se puede hacer."

1. Mostrar que `loyalty-service` no está corriendo y que no existe todavía su consumer group
   (`loyalty-svc-server`) en Kafka UI.
2. Levantarlo:

   ```powershell
   docker compose --profile loyalty up -d loyalty-service
   ```

3. Seguir su log:

   ```powershell
   docker compose logs -f loyalty-service
   ```

   Aparece una línea `Cliente C-xxx: N puntos` por **cada activación completada del historial**: lee todo
   lo que ya estaba en `activation.events`.
4. Ver la tabla de puntos:

   ```powershell
   @'
   select "customerId", points, "completedActivations" from loyalty_accounts order by 1;
   '@ | docker compose exec -T postgres psql -U postgres -d loyalty_db -P pager=off
   ```

   Cada activación completada suma 10 puntos.
5. Crear una activación nueva en la Demo UI: el cliente suma 10 puntos en vivo.

**Qué decir:** el productor (activation-api) y el resto de los servicios no se enteraron de que apareció un
consumidor nuevo. Los mensajes seguían en Kafka (retención de 7 días) y el servicio nuevo los leyó desde
el inicio, porque tiene su propio grupo.

### Repetir este escenario

El grupo `loyalty-svc-server` ya guardó hasta dónde leyó. Para volver a mostrar el historial completo:

```powershell
docker compose stop loyalty-service

@'
truncate loyalty_accounts, processed_events;
'@ | docker compose exec -T postgres psql -U postgres -d loyalty_db

docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:19092 --group loyalty-svc-server --reset-offsets --to-earliest --all-topics --execute

docker compose --profile loyalty up -d loyalty-service
```

---

## Extras (si sobra tiempo)

### Idempotencia: reenviar un evento no duplica nada (RNF-03)

En Kafka UI, abrir el topic `activation.requested` → un mensaje → *Produce message* con **exactamente el
mismo** contenido (mismo `eventId`) y la misma clave. En los logs de billing y provisioning:

```
ActivationRequested <eventId> ya fue procesado; se descarta
```

No se crea una segunda cuenta ni un segundo email.

### Mensaje inválido: va a la DLQ y el flujo sigue (RNF-04)

En Kafka UI, producir en `billing.events` el mensaje `{"hola":"mundo"}` (clave cualquiera). Termina en
`billing.events.dlq`, sin reintentos. En sus headers, `x-error-message` dice qué faltaba
(`falta el campo "eventId"`). Mientras tanto, nuevas activaciones siguen funcionando.

### Base caída: reintentos y DLQ

```powershell
docker compose stop postgres
```

Producir un `ActivationRequested` válido (ver el ejemplo en `architecture.md`, sección 4, con `eventId` y
`correlationId` nuevos). En el log de billing se ven los reintentos (1 s, 2 s, 4 s) y después el mensaje
va a `activation.requested.dlq`. El header `x-error-message` trae el motivo (`ECONNREFUSED ...`).
Volver a levantar con `docker compose start postgres`.

### Reproceso del historial en crm-analytics (RF-10)

`crm-analytics` guarda una copia de cada evento. Ver la historia de una activación:

```powershell
@'
select "eventType", source, topic, partition, "kafkaOffset" from event_log where "correlationId" = 'act-XXXXXXXX' order by "occurredAt";
'@ | docker compose exec -T postgres psql -U postgres -d crm_analytics_db -P pager=off
```

Para reprocesar todo desde cero, parar el servicio, vaciar la tabla, resetear el grupo y volver a levantar:

```powershell
docker compose stop crm-analytics-service

@'
truncate event_log, processed_events;
'@ | docker compose exec -T postgres psql -U postgres -d crm_analytics_db

docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:19092 --group crm-analytics-server --reset-offsets --to-earliest --all-topics --execute

docker compose start crm-analytics-service
```

Al terminar, `event_log` tiene los mismos eventos de antes. Si se resetea el grupo **sin** vaciar las
tablas, el servicio vuelve a leer todo pero no duplica nada.

---

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `port is already allocated` al hacer `up` en el puerto 3000 o 5173 | Hay otro proceso en ese puerto: un `pnpm dev:*` o un contenedor de otro proyecto. Detenerlo. |
| La UI dice que no puede conectarse con la API | `activation-api` todavía no terminó de arrancar. Mirar `docker compose logs --tail 20 activation-api`. |
| Billing o provisioning muestran `ECONNREFUSED` al arrancar | Kafka o PostgreSQL todavía no estaban listos. Los servicios reintentan solos. |
| Errores `This is not the correct coordinator for this group` | Kafka reorganizó sus grupos internos (pasa en un rebalanceo o con la PC cargada). KafkaJS reintenta y se recupera en segundos. |
| Kafka UI no muestra lo último que pasó | No se refresca solo: actualizar la página. |
| `docker compose down` y los topics desaparecieron | Es lo esperado: Kafka no guarda datos en disco. Se recrean con `kafka-init` al volver a levantar. |
| `loyalty-service` falla con `database "loyalty_db" does not exist` | El volumen de PostgreSQL es anterior a `loyalty_db`. Crearla: `docker compose exec -T postgres psql -U postgres -c "create database loyalty_db"`. O borrar los volúmenes con `docker compose --profile loyalty down -v`. |
| La construcción falla con `ECONNRESET` o `EAI_AGAIN` | La conexión con el registro de npm se cortó. Repetir el comando; usar `COMPOSE_PARALLEL_LIMIT=1` ayuda. |
