# Soy Nativo - Centro de Gestión y Simulación (Migración Appwrite)

Este proyecto es un simulador de cotizaciones para parcelas, migrado exitosamente de Supabase a **Appwrite**. Permite a asesores y partners generar cotizaciones personalizadas, gestionar precios (overrides) y mantener un historial de ventas.

## 🚀 Cambios Realizados en la Migración

1.  **Eliminación de Supabase:** Se eliminó la dependencia de `@supabase/supabase-js` y se reemplazó por el SDK de Appwrite.
2.  **Nuevo Backend:** Se configuró una base de datos en Appwrite (`cotizador_db`) con colecciones optimizadas:
    *   `parcelas_overrides`: Gestión dinámica de precios.
    *   `quotes_history`: Historial de cotizaciones generadas.
    *   `app_users`: Control de acceso para personal interno.
3.  **Adaptación de Código:**
    *   `supabase-service-v2.js` fue reemplazado por `appwrite-service.js`.
    *   `pdf-service.js` fue actualizado a `pdf-service-appwrite.js` para integrarse con el nuevo flujo de datos.
    *   `index.html` actualizado para cargar el SDK de Appwrite y los nuevos módulos.

## 🛠️ Requisitos e Instalación

El proyecto es una aplicación estática (SPA). Para ejecutarlo localmente:

1.  Clona este repositorio.
2.  Asegúrate de tener las variables de entorno configuradas en `appwrite-service.js` (Endpoint, Project ID, API Key).
3.  Abre `index.html` en cualquier navegador moderno o usa un servidor local (ej. Live Server en VS Code).

### Configuración de Appwrite

Si deseas replicar el entorno en un nuevo proyecto de Appwrite:

1.  Crea una base de datos con ID `cotizador_db`.
2.  Crea las siguientes colecciones con sus respectivos atributos (todos como **String** para máxima compatibilidad con el cálculo local):
    *   **parcelas_overrides**: `proyecto`, `parcela`, `precio`, `pie`, `cuotas`, `updated_at`.
    *   **quotes_history**: `user_type`, `asesor_name`, `client_name`, `client_phone`, `proyecto`, `parcela`, `m2`, `precio_lista`, `precio_contado`, `pie`, `cuotas_detalle`, `total_quote`, `pdf_url`, `created_at`.
    *   **app_users**: `username`, `password`, `role`, `needs_change` (boolean).

## 📂 Estructura del Proyecto

*   `index.html`: Punto de entrada y estructura de la UI.
*   `appwrite-service.js`: Capa de integración con Appwrite (CRUD, Auth).
*   `app.js`: Lógica principal del simulador y administración.
*   `database.js`: Catálogo estático de parcelas y proyectos.
*   `pdf-service-appwrite.js`: Generación de reportes PDF.
*   `styles-v2.css`: Estilos visuales del dashboard.

## 🔐 Seguridad

Actualmente, el proyecto utiliza una API Key con permisos abiertos para facilitar la transición. En un entorno de producción, se recomienda:
1.  Utilizar el sistema de autenticación nativo de Appwrite (`Account`).
2.  Restringir los permisos de las colecciones a usuarios autenticados.
3.  Implementar hashing de contraseñas para la colección `app_users`.

---
Desarrollado para **Soy Nativo**.
Migración realizada por **Manus AI**.
