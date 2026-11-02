# FOREVER AUCTION INTELLIGENCE
## Prompt maestro de desarrollo — Versión 2.0

### 1. Tu rol y responsabilidad

Quiero que actúes como mi arquitecto de software, desarrollador Full Stack senior, ingeniero de datos, diseñador UX/UI y analista especializado en la economía de World of Warcraft Forever.

Tu objetivo es construir **Forever Auction Intelligence (FAI)**, una aplicación real y completa para analizar la Auction House, detectar oportunidades comerciales, gestionar inversiones y maximizar mi oro.

**Quiero que hagas prácticamente todo vos.**

- Investigá las herramientas y fuentes de información.
- Tomá las decisiones técnicas.
- Diseñá la arquitectura.
- Escribí el código completo.
- Configurá la base de datos.
- Implementá las funcionalidades.
- Ejecutá las pruebas disponibles.
- Corregí errores.
- Prepará archivos, scripts e instrucciones de instalación.
- Mostrame los avances y pedime aprobación en decisiones importantes.

Mi intervención debe limitarse a acciones imprescindibles en mi computadora o dentro del juego.

No quiero una maqueta ni una simulación presentada como aplicación funcional. Quiero software ejecutable, probado y documentado.

### 2. Contexto de WoW Forever

- Juego: World of Warcraft Forever.
- Región: América.
- Servidor: PvP.
- Facción: Alianza.
- Main: Hunter Night Elf.
- Profesiones iniciales: Herbalism + Enchanting.
- Profesiones finales: Alchemy + Enchanting.
- Objetivo económico: maximizar oro con una estrategia agresiva.
- Lanzamiento: 4 de noviembre de 2026.
- Apertura prevista de raids: 9 de diciembre de 2026.
- Sistema operativo: Windows.
- Interfaz: español argentino.
- Código y documentación técnica: inglés.

La aplicación debe permitir cambiar servidor, facción y personaje sin mezclar sus datos.

**Regla fundamental:** utilizar exclusivamente información verificada de Forever para cálculos y recomendaciones ejecutables.

Las experiencias de Classic, Reddit y otras versiones pueden servir para investigar hipótesis, pero nunca deben presentarse como datos confirmados de Forever.

### 3. Stack tecnológico

Utilizá las siguientes tecnologías, alineadas con mi formación futura:

| Componente | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Backend | Node.js + Express |
| Frontend | React + TypeScript + Vite |
| Base de datos | PostgreSQL |
| ORM | Prisma |
| Validación | Zod |
| Testing | Vitest |
| Contenedores | Docker |
| Control de versiones | Git + GitHub |
| CI/CD | GitHub Actions |

Podés agregar bibliotecas cuando aporten beneficios claros.

Quiero código modular, legible, mantenible y documentado, que más adelante podamos utilizar para estudiar programación Full Stack.

### 4. Captura e importación de Auction House — MVP obligatorio

Quiero poder abrir la Auction House de Forever, ejecutar un escaneo y que nuestra aplicación importe automáticamente la información cuando el addon la haya guardado en disco.

Investigá y compará:

- Auctioneer.
- auxForever.
- AHDB.
- AuctionHouse.fyi.
- GoldCap Forever.
- Otras alternativas compatibles.

Verificá la compatibilidad real con Forever, los formatos de archivos, las limitaciones y la legalidad del mecanismo.

Implementá:

- Detección de nuevos escaneos.
- Lectura de SavedVariables u otro formato compatible.
- Validación y normalización.
- Importación incremental.
- Prevención de duplicados.
- Registro de errores.
- Identificación de región, servidor y facción.
- Conservación de los datos originales.
- Estado y fecha de última sincronización.

La importación no debe interferir con el cliente del juego ni automatizar acciones prohibidas.

Cuando un addon requiera `/reload` o cerrar sesión para guardar datos, la aplicación debe explicarlo.

### 5. APIs y datos comunitarios

Investigá fuentes específicas de Forever que puedan proporcionar precios adicionales.

Comprobá:

- Disponibilidad real de APIs.
- Endpoints y documentación.
- Frecuencia de actualización.
- Cobertura de PvP Alliance América.
- Autenticación y límites.
- Licencias y condiciones de uso.
- Calidad de los datos.

Integrá las fuentes viables como complemento de nuestros escaneos.

Cada registro debe conservar su procedencia y fecha.

Separá estrictamente datos de beta, lanzamiento, otros servidores y datos simulados.

Si una fuente no funciona, la aplicación debe seguir operando con los datos disponibles.

### 6. Base de datos histórica — MVP obligatorio

Diseñá una base PostgreSQL que registre:

- Catálogo de objetos.
- Identificadores de Forever.
- Servidores y facciones.
- Escaneos.
- Subastas observadas, cuando los datos lo permitan.
- Precios unitarios.
- Cantidades.
- Fechas y horas.
- Fuentes.
- Estadísticas históricas.
- Compras.
- Ventas.
- Inventario.
- Materiales de profesiones.
- Resultados de desencantamiento.
- Alertas.
- Eventos económicos.

Conservá los escaneos originales para recalcular estadísticas.

Implementá índices, migraciones, copias de seguridad y recuperación.

### 7. Dashboard principal — MVP obligatorio

Quiero una interfaz moderna, oscura, rápida y profesional, inspirada en terminales financieras y en la estética de WoW.

Debe mostrar:

- Oro disponible.
- Capital invertido.
- Valor estimado del inventario.
- Ganancias realizadas.
- Ganancias no realizadas.
- Mejores oportunidades.
- Evolución del mercado.
- Alertas.
- Último escaneo.
- Calidad y antigüedad de datos.

Incluí búsqueda, filtros, gráficos interactivos y navegación sencilla.

La interfaz debe ser responsive.

### 8. Análisis individual de objetos — MVP obligatorio

Cada objeto debe tener una página con:

- Nombre e ID.
- Precio actual observado.
- Historial de precios.
- Mínimos y máximos.
- Medianas y percentiles.
- Oferta disponible.
- Cambios de precio.
- Comparación con históricos.
- Calidad de datos.
- Posibles anomalías.
- Precio máximo de compra.
- Precio objetivo de venta.
- ROI estimado.

No confundas precios publicados con ventas realizadas.

### 9. Detector de flipping — MVP obligatorio

Desarrollá un motor que detecte oportunidades de comprar barato y revender.

Debe calcular:

- Precio actual.
- Precio histórico de referencia.
- Margen bruto.
- Comisiones y depósitos aplicables.
- Margen neto.
- ROI.
- Cantidad disponible.
- Liquidez estimada.
- Riesgo.
- Capital necesario.
- Confianza de la señal.

Cada recomendación debe explicar por qué fue generada.

Implementá filtros configurables y límites de exposición por objeto.

No recomendar compras cuando los datos sean insuficientes.

### 10. Arbitraje por desencantamiento — MVP OBLIGATORIO Y PRIORITARIO

Esta funcionalidad debe estar implementada desde la primera versión.

Quiero detectar objetos baratos en la Auction House que pueda comprar, desencantar con mi Hunter y vender sus materiales con ganancia.

El módulo debe:

1. Buscar objetos potencialmente rentables para desencantar.
2. Comprobar si pueden desencantarse en Forever.
3. Comprobar requisitos de habilidad y otras restricciones.
4. Identificar materiales posibles.
5. Utilizar probabilidades verificadas de Forever.
6. Calcular cantidades esperadas.
7. Consultar precios actuales de materiales.
8. Calcular valor esperado neto.
9. Calcular beneficio y ROI.
10. Estimar probabilidad de pérdida cuando sea posible.
11. Calcular precio máximo recomendado de compra.
12. Comparar vender directamente contra desencantar.
13. Registrar objetos comprados y resultados reales.
14. Registrar ventas de materiales.

Si no existen probabilidades oficiales verificadas, incorporá un sistema para registrar nuestros desencantamientos y estimar probabilidades con intervalos de incertidumbre.

No presentes probabilidades de Classic como confirmadas para Forever.

Quiero filtros por rentabilidad, precio, riesgo y habilidad requerida.

Las compras y desencantamientos se realizarán manualmente dentro del juego.

### 11. Cartera e inventario — MVP obligatorio

Quiero registrar:

- Compras y ventas.
- Costos unitarios.
- Cantidades.
- Fechas.
- Comisiones.
- Depósitos.
- Inventario disponible.
- Capital comprometido.
- Ganancias realizadas.
- Ganancias no realizadas.
- Rendimiento por objeto.
- Rendimiento total.

Incluí operaciones de flipping, acumulación y desencantamiento.

Permití corregir registros sin perder el historial de cambios.

Implementá exportación CSV y JSON.

### 12. Inversiones anticipadas para raids — seguimiento desde el lanzamiento

Quiero preparar inversiones relacionadas con las raids previstas para el 9 de diciembre.

Investigá qué consumibles y materiales podrían tener mayor demanda cuando los jugadores empiecen a raidear.

Considerá:

- Pociones.
- Elixires.
- Frascos.
- Hierbas.
- Materiales elementales.
- Materiales de Enchanting.
- Recetas raras.
- Consumibles defensivos y ofensivos.
- Objetos nuevos o modificados de Forever.

Verificá las recetas y dependencias específicas de Forever.

Creá una watchlist desde el lanzamiento, aunque el módulo avanzado se implemente después.

Quiero poder comprar materiales baratos durante las primeras semanas, acumularlos y vender cuando aumente la demanda.

No asumas que el mejor momento para vender es el 9 de diciembre. Analizá la posibilidad de aumentos anticipados y caídas posteriores.

Incluí:

- Tesis de inversión.
- Precio de entrada.
- Cantidad recomendada.
- Horizonte.
- Objetivo de venta.
- Riesgos.
- Escenarios optimista, moderado y pesimista.
- Alertas de salida.

### 13. Calculadora de profesiones

Implementá progresivamente cálculos de rentabilidad para:

- Herbalism.
- Alchemy.
- Enchanting.
- Desencantamiento.
- Otras profesiones relevantes.

Compará costos de materiales contra valor neto de productos terminados.

Usá recetas y cantidades verificadas de Forever.

### 14. Alertas inteligentes

Quiero alertas para:

- Objetos infravalorados.
- Objetivos de venta alcanzados.
- Materiales para raids.
- Oportunidades de desencantamiento.
- Caídas fuertes de precios.
- Cambios de oferta.
- Datos desactualizados.
- Problemas de importación.

Primero implementá alertas dentro de la aplicación.

En futuras versiones evaluá Telegram, Discord o correo.

### 15. Análisis avanzado — funcionalidades futuras

Reservá la arquitectura para incorporar estas cuatro funciones:

**A. Análisis de horarios y días**

Estudiar variaciones de precios y cantidades según horario, día de semana y momentos de mayor actividad.

**B. Profundidad de mercado**

Analizar cuántas unidades pueden comprarse a distintos precios y simular el impacto de operaciones grandes.

**C. Rentabilidad de recolección por hora**

Comparar rutas, materiales obtenidos, tiempo invertido y valor de mercado para decidir qué conviene farmear.

**D. Detección de anomalías**

Identificar precios atípicos, cambios sospechosos, escaneos incompletos y posibles manipulaciones.

Estas funciones no deben retrasar el MVP, pero el diseño debe permitir incorporarlas sin reconstruir toda la aplicación.

### 16. Integración con ChatGPT

Quiero generar informes completos para analizar el mercado con ChatGPT.

Incluí:

- Exportación JSON.
- Exportación CSV.
- Resumen legible.
- Cartera actual.
- Precios relevantes.
- Mejores oportunidades.
- Señales.
- Riesgos.
- Datos faltantes.

Investigá más adelante una integración directa mediante API, considerando costos y seguridad.

No supongas que ChatGPT puede leer automáticamente los archivos de mi PC.

### 17. Seguridad y cumplimiento

Respetá las reglas de WoW Forever.

No implementes bots que compren, vendan, desencanten o jueguen automáticamente.

No modifiques el cliente del juego ni utilices mecanismos prohibidos.

Protegé credenciales y datos locales.

No expongas la base de datos públicamente.

Utilizá dependencias confiables y actualizadas.

### 18. Preparación del lanzamiento

La prioridad es disponer de una primera versión funcional para el 4 de noviembre, si los tiempos técnicos lo permiten.

Antes del lanzamiento:

- Crear repositorio y estructura.
- Configurar PostgreSQL.
- Implementar backend.
- Implementar frontend.
- Preparar importación.
- Cargar datos de prueba.
- Implementar detector de flipping.
- Implementar arbitraje por desencantamiento.
- Implementar cartera básica.
- Crear watchlist de raids.
- Configurar pruebas.
- Preparar backups.
- Documentar instalación y ejecución.

Cuando abra el servidor, validar la integración con datos reales.

Si no llegamos con alguna funcionalidad, priorizá estabilidad y datos correctos antes que resultados aparentes.

### 19. Calidad técnica

Exijo:

- TypeScript estricto.
- Código modular.
- Separación frontend/backend.
- Validación de datos.
- Manejo de errores.
- Tests unitarios.
- Tests de integración.
- Migraciones.
- Logs.
- README.
- `.env.example`.
- Scripts reproducibles.
- Git organizado.
- Datos de ejemplo identificados.
- Documentación técnica.

### 20. Objetivo educativo futuro

Más adelante quiero utilizar esta misma aplicación para estudiar desarrollo Full Stack.

Mantené código legible, nombres en inglés y documentación suficiente para explicar:

- TypeScript.
- Node.js.
- Express.
- React.
- SQL.
- PostgreSQL.
- APIs.
- Testing.
- Docker.
- Git.
- CI/CD.

Durante el desarrollo inicial no necesito clases de programación.

### 21. Preferencias y decisiones pendientes

- Nombre: Forever Auction Intelligence.
- Interfaz: español argentino.
- Estilo: oscuro, profesional, con elementos visuales de WoW.
- Uso principal: PC Windows.
- Acceso desde teléfono: [A DEFINIR].
- Notificaciones externas: [A DEFINIR].
- Presupuesto inicial: preferentemente cero.
- Frecuencia de actualización: la máxima permitida y técnicamente viable.
- Operaciones automáticas dentro del juego: no.
- Prioridad económica: flipping, desencantamiento e inversiones para raids.
- Funcionalidades adicionales: [AGREGAR AQUÍ].

### 22. Forma de ejecución

Antes de programar, revisá críticamente esta especificación.

Verificá las fuentes, APIs, addons y restricciones de Forever.

Proponé la arquitectura definitiva, el modelo de datos y el orden de implementación.

Preguntame únicamente por decisiones que cambien significativamente el producto.

Una vez que apruebe la especificación, encargate de construir la aplicación por etapas, generando archivos reales, ejecutando pruebas y entregando resultados comprobables.

**Quiero que Forever Auction Intelligence sea una herramienta profesional de inteligencia económica, no simplemente una calculadora de precios.**

Su objetivo es detectar oportunidades antes que otros jugadores, administrar correctamente el riesgo y maximizar mi oro a lo largo de la vida del servidor.