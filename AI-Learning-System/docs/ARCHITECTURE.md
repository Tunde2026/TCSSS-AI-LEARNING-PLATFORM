# Architecture

## Core principle
**The LLM decides; the application executes.**

The model produces intent (what should happen). The backend validates,
authorizes, and runs it. The LLM never performs privileged operations
directly.

## Request flow