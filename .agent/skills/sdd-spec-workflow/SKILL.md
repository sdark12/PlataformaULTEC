---
name: sdd-spec-workflow
description: Spec-Driven Development (SDD) workflow for complex features. Use when implementing features affecting more than 2 files, when requirements are ambiguous, or when the user explicitly requests the SDD flow. Produces specification → plan → tasks → implementation → validation.
---

# Spec-Driven Development (SDD) — Plataforma ULTEC

## Principio Fundamental

**La especificación manda sobre el código. No se escribe ni una línea de código hasta que los requisitos estén formalizados, revisados y aprobados por el usuario.**

Este flujo es **Spec-Anchored**: la especificación se mantiene viva y evoluciona junto al código como fuente de verdad.

## Cuándo Usar SDD

- Funcionalidades que afectan **3+ archivos** (backend + frontend + base de datos)
- Cambios que impactan **múltiples módulos** (ej. estudiantes + matrículas + pagos)
- Requisitos que tienen **casos borde** no obvios
- Cuando el usuario dice "quiero que implementes X" sin detallar el comportamiento exacto

## Flujo de Trabajo en 7 Pasos

### Paso 1: Constitución (Principios Innegociables)

Antes de todo, recordar los principios del proyecto Plataforma ULTEC:
- **Simplicidad:** Preferir soluciones simples y directas.
- **Código limpio:** Sin hacks, sin TODO sin resolver, sin console.log olvidados.
- **Pruebas obligatorias:** Cada feature se prueba antes de desplegar en producción.
- **Preservación de datos:** NUNCA borrar datos de producción sin confirmación del usuario.
- **Retrocompatibilidad:** Los cambios no deben romper funcionalidad existente.
- **Regla 0 de AGENTS.md:** Presentar propuesta y obtener aprobación ANTES de ejecutar.

### Paso 2: Especificación (El QUÉ y el POR QUÉ)

Crear un artefacto de especificación con:

1. **Contexto:** ¿Qué problema resuelve esta funcionalidad?
2. **Historias de Usuario:** Quién, Qué, Para qué.
   ```
   COMO [rol], QUIERO [acción], PARA [beneficio]
   ```
3. **Requisitos Funcionales en Sintaxis EARS:**
   ```
   CUANDO <evento>, EL SISTEMA <respuesta>
   SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta de error>
   MIENTRAS <estado activo>, EL SISTEMA <comportamiento continuo>
   EL SISTEMA <comportamiento permanente>
   ```
4. **Casos Borde:** ¿Qué pasa si el input está vacío? ¿Si no hay conexión? ¿Si el usuario no tiene permisos?
5. **Lo que NO incluye:** Dejar claro qué queda fuera del alcance.

**IMPORTANTE:** La especificación NO menciona archivos, funciones ni tecnologías. Solo describe comportamiento.

### Paso 3: Clarificación (QA Preventivo)

Revisar la especificación buscando:
- **Ambigüedades:** ¿Hay algo que se pueda interpretar de más de una forma?
- **Contradicciones:** ¿Dos requisitos entran en conflicto?
- **Omisiones:** ¿Falta algún caso borde importante?
- **Suposiciones:** ¿Se asume algo que debería ser explícito?

Si se encuentran problemas → preguntar al usuario ANTES de continuar.

### Paso 4: Planificación (El CÓMO Técnico)

Crear un plan técnico con:

1. **Archivos afectados:** Lista explícita de cada archivo que se modificará o creará.
2. **Cambios en base de datos:** Migraciones SQL necesarias (ALTER TABLE, nueva tabla, etc.).
3. **Pseudocódigo:** Para la lógica más compleja, describir el algoritmo en palabras.
4. **Dependencias:** ¿Se necesitan nuevos paquetes npm? ¿Cambios en configuración?
5. **Estrategia de pruebas:** Qué se probará y cómo.
6. **Orden de ejecución:** En qué secuencia se deben hacer los cambios.

### Paso 5: Desglose en Tareas

Dividir el plan en tareas atómicas de **20-30 minutos máximo** cada una:

```
## Tarea 1: [Nombre descriptivo]
- Archivo(s): [ruta]
- Cambio: [descripción concisa]
- Hecho cuando: [criterio de aceptación claro y verificable]
```

Cada tarea debe ser independiente y verificable por sí misma.

### Paso 6: Implementación

Ejecutar tarea por tarea en orden estricto:

1. Implementar el cambio
2. Verificar que compila (`npm run build` con 0 errores)
3. Pasar al siguiente solo si el actual está verde
4. Si algo falla → activar `systematic-debugging` skill

**NO se permite:**
- Implementar múltiples tareas a la vez
- Saltarse el orden definido
- Hacer cambios no planificados "ya que estamos aquí"

### Paso 7: Validación

Recorrido punto por punto de cada requisito EARS contra la implementación:

```
| # | Requisito EARS | Implementación | Prueba | Estado |
|---|---------------|----------------|--------|--------|
| 1 | CUANDO X, EL SISTEMA Y | [archivo:línea] | [test o verificación] | ✅/❌ |
```

Solo cuando TODOS los requisitos están verificados se procede al despliegue.

## Integración con AGENTS.md

- **Regla 0:** El artefacto de especificación (Paso 2) ES la propuesta que se presenta al usuario para aprobación.
- **Regla 6:** Al finalizar la implementación, verificar si el cambio amerita incremento de Build.
- **Pruebas pre-despliegue:** Usar batería automatizada en contenedor aislado `test-backend` antes de tocar producción.
