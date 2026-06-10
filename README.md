# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).
# Model Tester - API Connectivity Test Tool

## Overview

With the rapid growth of LLM APIs, developers often find themselves managing multiple API keys from different providers. Many free-tier platforms display a long list of available models, but in practice:

- Some models are deprecated but still listed
- Some require special permissions not included in your current tier
- Some are simply unavailable due to regional restrictions or quota limits

This tool solves that problem by testing each model under your API key and reporting its real-time availability.

## Features

- 🔍 Auto-detect all models under a given API endpoint
- ✅ Test connectivity with real requests
- 📊 Clear pass/fail results with response time
- 🆓 Free to use (self-hosted)
- 🌐 Works with OpenAI-compatible APIs

## How It Works

1. Enter your API base URL and key
2. The tool fetches the model list from `/v1/models`
3. For each model, it sends a minimal test request
4. Results are displayed — green for working, red for failed

## Tech Stack

- Frontend: HTML + CSS + JavaScript
- Backend: Node.js (Express)
- Deployment: Render

## Self-Hosting

Fork this repo → connect to Render → done.
