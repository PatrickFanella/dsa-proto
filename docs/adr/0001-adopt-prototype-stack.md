# ADR 0001: Adopt the TypeScript Prototype Stack

## Status

Accepted

## Context

dsa-proto needs a small runnable web application for exploring ATProto-shaped civic records, local indexing models, and lightweight API/UI demos while the exact first milestone is still being refined.

## Decision

Use the inherited TypeScript full-stack baseline: Node backend, Vite React TypeScript frontend, Postgres, Docker Compose, Makefile verification, and Open Pilot issue/PR conventions.

## Consequences

- The prototype can move quickly without introducing new infrastructure.
- Postgres is available for indexed/read-model experiments.
- The frontend can support demos once requirements are settled.
- Open Pilot conventions remain available for issue-driven implementation.
