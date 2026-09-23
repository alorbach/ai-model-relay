'use strict';

const { PRODUCT_NAME, LEGACY_PRODUCT_NAME } = require('./brand');

function statusPageHtml() {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="icon" href="/favicon.ico" sizes="any">
	<title>${PRODUCT_NAME} Status</title>
	<style>
		:root {
			color-scheme: dark;
			--bg: #0b0f14;
			--panel: #121923;
			--panel-2: #172231;
			--panel-elevated: #1a2838;
			--line: #263445;
			--text: #edf4fb;
			--muted: #9cadbf;
			--ok: #34d399;
			--warn: #fbbf24;
			--bad: #fb7185;
			--info: #60a5fa;
			--accent: #38bdf8;
			--primary: #2563eb;
			--primary-hover: #3b82f6;
			--shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
			--sticky-top: 0;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			background: var(--bg);
			color: var(--text);
			font: 14px/1.45 "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
			overflow-x: hidden;
		}
		main {
			width: min(1280px, calc(100vw - 32px));
			margin: 0 auto 24px;
			overflow-x: hidden;
		}
		.app-shell {
			position: sticky;
			top: var(--sticky-top);
			z-index: 10;
			background: linear-gradient(180deg, var(--bg) 78%, rgba(11, 15, 20, 0));
			padding: 16px 0 0;
			margin-bottom: 12px;
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			margin-bottom: 12px;
		}
		h1 {
			margin: 0;
			font-size: 24px;
			font-weight: 650;
			letter-spacing: 0;
		}
		.updated {
			color: var(--muted);
			font-size: 12px;
			white-space: nowrap;
		}
		.status-meta {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			flex-wrap: wrap;
			gap: 8px;
		}
		.connection-pill {
			font-size: 12px;
			padding: 5px 9px;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(12, 1fr);
			gap: 12px;
			min-width: 0;
		}
		.panel {
			background: var(--panel);
			border: 1px solid var(--line);
			border-radius: 8px;
			padding: 14px;
			min-width: 0;
			max-width: 100%;
			overflow: hidden;
		}
		.span-4 { grid-column: span 4; }
		.span-6 { grid-column: span 6; }
		.span-12 { grid-column: span 12; }
		.label {
			color: var(--muted);
			font-size: 12px;
			margin-bottom: 6px;
		}
		.value {
			font-size: 18px;
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.pill {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			border-radius: 999px;
			padding: 6px 10px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			font-weight: 650;
		}
		.dot {
			width: 9px;
			height: 9px;
			border-radius: 50%;
			background: var(--muted);
		}
		.ok .dot { background: var(--ok); }
		.warn .dot { background: var(--warn); }
		.bad .dot { background: var(--bad); }
		.status-text {
			font-weight: 650;
		}
		.status-completed { color: var(--ok); }
		.status-failed { color: var(--bad); }
		.status-running { color: var(--info); }
		.status-queued,
		.status-pending { color: var(--warn); }
		.table {
			width: 100%;
			border-collapse: collapse;
			table-layout: fixed;
		}
		.table th,
		.table td {
			border-bottom: 1px solid var(--line);
			padding: 9px 8px;
			text-align: left;
			vertical-align: top;
			overflow-wrap: anywhere;
			word-break: break-word;
		}
		.table th {
			color: var(--muted);
			font-size: 12px;
			font-weight: 600;
		}
		.table tr:last-child td { border-bottom: 0; }
		.muted { color: var(--muted); }
		.help-list {
			margin: 0;
			padding-left: 18px;
			color: var(--muted);
		}
		.help-list li { margin: 4px 0; }
		.feature-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
		}
		.feature-pill {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			min-width: 0;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 9px 10px;
		}
		.feature-pill .name {
			flex: 1 1 auto;
			min-width: 0;
			overflow-wrap: anywhere;
		}
		.feature-pill .state {
			flex: 0 0 auto;
			max-width: 10rem;
			overflow-wrap: anywhere;
			color: var(--muted);
			font-size: 12px;
			font-weight: 650;
		}
		.feature-pill.enabled .state { color: var(--ok); }
		.feature-pill.disabled .state { color: var(--bad); }
		.session-output-block {
			min-width: 0;
			border: 1px solid var(--line);
			border-radius: 8px;
			background: #0e1520;
			margin-bottom: 10px;
		}
		.job-artifacts {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 14px;
			padding: 4px 0 16px;
		}
		.job-artifact-preview {
			display: grid;
			gap: 6px;
			width: min(280px, 100%);
			padding: 0;
			border: 0;
			background: transparent;
			color: var(--accent);
			cursor: zoom-in;
			font-size: 12px;
			text-align: left;
			text-decoration: none;
		}
		.job-artifact-preview img {
			width: 100%;
			max-height: 220px;
			object-fit: contain;
			background: #070b10;
			border: 1px solid var(--line);
			border-radius: 8px;
		}
		.job-artifact-meta {
			color: var(--muted);
			font-size: 11px;
		}
		.job-artifact-preview video {
			width: 100%;
			max-height: 320px;
			background: #070b10;
			border: 1px solid var(--line);
			border-radius: 8px;
		}
		.job-artifact-preview.video { cursor: default; }
		.image-lightbox {
			position: fixed;
			z-index: 20;
			inset: 0;
			display: grid;
			place-items: center;
			padding: 28px;
			background: rgba(4, 8, 14, 0.88);
		}
		.image-lightbox[hidden] { display: none; }
		.image-lightbox img,
		.image-lightbox video {
			display: block;
			max-width: min(1100px, 94vw);
			max-height: 84vh;
			border: 1px solid var(--line);
			border-radius: 10px;
			background: #070b10;
			object-fit: contain;
		}
		.image-lightbox img[hidden],
		.image-lightbox video[hidden] { display: none; }
		.image-lightbox-close {
			position: absolute;
			top: 18px;
			right: 18px;
		}
		.session-output-summary {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 10px 12px;
			cursor: pointer;
			list-style: none;
			user-select: none;
		}
		.session-output-summary::-webkit-details-marker {
			display: none;
		}
		.session-output-summary::before {
			content: ">";
			flex: 0 0 auto;
			color: var(--text);
			transition: transform 0.15s ease;
		}
		.session-output-block[open] .session-output-summary::before {
			transform: rotate(90deg);
		}
		.session-output-summary .label {
			margin: 0 auto 0 0;
		}
		.copy-session-output {
			appearance: none;
			border: 1px solid var(--line);
			border-radius: 6px;
			background: var(--panel-2);
			color: var(--text);
			cursor: pointer;
			font: inherit;
			font-size: 12px;
			line-height: 1;
			padding: 7px 10px;
			white-space: nowrap;
		}
		.copy-value {
			appearance: none;
			border: 1px solid var(--line);
			border-radius: 5px;
			background: #0e1520;
			color: #d7e7ff;
			cursor: pointer;
			font: inherit;
			font-size: 12px;
			padding: 2px 6px;
			max-width: 100%;
			overflow-wrap: anywhere;
			text-align: left;
		}
		.copy-session-output:hover,
		.copy-session-output:focus-visible,
		.copy-value:hover,
		.copy-value:focus-visible {
			border-color: var(--info);
			outline: none;
		}
		details.panel {
			padding: 0;
		}
		summary {
			cursor: pointer;
			list-style: none;
			padding: 14px;
			color: var(--muted);
			font-size: 12px;
			user-select: none;
		}
		summary::-webkit-details-marker { display: none; }
		summary::before {
			content: ">";
			display: inline-block;
			margin-right: 8px;
			color: var(--text);
			transition: transform 0.15s ease;
		}
		details[open] summary::before {
			transform: rotate(90deg);
		}
		code {
			color: #d7e7ff;
			background: #0e1520;
			border: 1px solid var(--line);
			border-radius: 5px;
			padding: 2px 5px;
			overflow-wrap: anywhere;
		}
		pre {
			margin: 0;
			padding: 12px;
			background: #0e1520;
			border: 1px solid var(--line);
			border-radius: 8px;
			color: #d7e7ff;
			overflow: auto;
			max-height: 320px;
			font-size: 12px;
			max-width: 100%;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
			word-break: break-word;
		}
		.session-output {
			border-width: 1px 0 0;
			border-radius: 0 0 8px 8px;
			max-height: none;
		}
		.live-session-output {
			scroll-behavior: smooth;
		}
		.raw-status {
			border-width: 1px 0 0;
			border-radius: 0;
			max-height: 420px;
		}
		.raw-actions {
			display: flex;
			justify-content: flex-end;
			padding: 0 14px 12px;
		}
		.settings-editor {
			display: grid;
			gap: 14px;
		}
		.settings-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 10px;
		}
		.field {
			display: grid;
			gap: 5px;
			min-width: 0;
		}
		.field span,
		.checkbox-row span {
			color: var(--muted);
			font-size: 12px;
			font-weight: 600;
		}
		.field input,
		.field select,
		.settings-editor textarea {
			width: 100%;
			background: #0e1520;
			border: 1px solid var(--line);
			color: #d7e7ff;
			border-radius: 6px;
			font: inherit;
			padding: 8px 9px;
			min-width: 0;
		}
		.settings-editor textarea {
			min-height: 220px;
			resize: vertical;
			font: 12px/1.45 Consolas, "SFMono-Regular", monospace;
		}
		.checkbox-row {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 9px 10px;
		}
		.checkbox-row input {
			flex: 0 0 auto;
		}
		.model-settings-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 10px;
		}
		.model-settings-card {
			display: grid;
			gap: 8px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 8px;
			padding: 12px;
			min-width: 0;
		}
		.model-settings-card .model-heading {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.settings-advanced {
			border: 1px solid var(--line);
			border-radius: 8px;
			background: var(--panel-2);
		}
		.settings-advanced summary {
			padding: 10px 12px;
		}
		.settings-advanced textarea {
			border-width: 1px 0 0;
			border-radius: 0 0 8px 8px;
		}
		.settings-actions {
			display: flex;
			align-items: center;
			gap: 10px;
			justify-content: flex-end;
		}
		.settings-actions .label {
			margin-right: auto;
			margin-bottom: 0;
		}
		.settings-actions button {
			appearance: none;
			border: 1px solid var(--line);
			border-radius: 6px;
			background: var(--panel-2);
			color: var(--text);
			cursor: pointer;
			font: inherit;
			font-size: 12px;
			padding: 8px 11px;
		}
		.settings-actions button:hover,
		.settings-actions button:focus-visible {
			border-color: var(--info);
		}
		.setup-log {
			display: block;
			margin: 10px 0 0;
			max-height: 280px;
			overflow: auto;
			white-space: pre-wrap;
			word-break: break-word;
			font-size: 12px;
			line-height: 1.45;
			padding: 10px 12px;
			background: #070b10;
			border: 1px solid var(--line);
			border-radius: 8px;
			color: var(--text);
		}
		.setup-log[hidden] { display: none; }
		.btn-primary {
			background: var(--primary) !important;
			border-color: var(--primary) !important;
			color: #fff !important;
		}
		.btn-primary:hover,
		.btn-primary:focus-visible {
			background: var(--primary-hover) !important;
			border-color: var(--primary-hover) !important;
		}
		.btn-primary:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}
		.tab-badge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 18px;
			height: 18px;
			margin-left: 6px;
			padding: 0 5px;
			border-radius: 999px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			color: var(--muted);
			font-size: 11px;
			font-weight: 700;
			line-height: 1;
		}
		.tab-badge.warn { color: var(--warn); border-color: rgba(251, 191, 36, 0.35); }
		.tab-badge.bad { color: var(--bad); border-color: rgba(251, 113, 133, 0.35); }
		.tab-badge.dirty { color: var(--accent); border-color: rgba(56, 189, 248, 0.35); }
		.health-grid {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 10px;
		}
		.health-card {
			display: grid;
			gap: 8px;
			min-width: 0;
			padding: 14px;
			background: var(--panel);
			border: 1px solid var(--line);
			border-radius: 10px;
			box-shadow: var(--shadow);
			text-align: left;
			cursor: pointer;
			color: inherit;
			font: inherit;
		}
		.health-card:hover,
		.health-card:focus-visible {
			border-color: var(--accent);
			outline: none;
		}
		.health-card .health-title {
			color: var(--muted);
			font-size: 12px;
			font-weight: 600;
		}
		.health-card .health-value {
			font-size: 17px;
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.health-card .health-hint {
			color: var(--muted);
			font-size: 11px;
		}
		.panel.live-inspector {
			padding: 0;
			background: transparent;
			border: 0;
			box-shadow: none;
			overflow: visible;
		}
		.live-inspector {
			display: grid;
			grid-template-columns: minmax(280px, 400px) minmax(0, 1fr);
			gap: 12px;
			min-height: calc(100vh - 148px);
			align-items: stretch;
		}
		.live-list-panel,
		.live-detail-panel {
			display: flex;
			flex-direction: column;
			background: var(--panel);
			border: 1px solid var(--line);
			border-radius: 12px;
			min-width: 0;
			min-height: min(72vh, 720px);
			overflow: hidden;
			box-shadow: var(--shadow);
		}
		.live-list-toolbar {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
			padding: 12px;
			border-bottom: 1px solid var(--line);
			background: var(--panel-2);
		}
		.live-filter {
			appearance: none;
			display: inline-flex;
			align-items: center;
			gap: 6px;
			border: 1px solid var(--line);
			border-radius: 999px;
			background: var(--panel);
			color: var(--muted);
			cursor: pointer;
			font: inherit;
			font-size: 11px;
			font-weight: 650;
			padding: 5px 10px;
		}
		.live-filter[aria-pressed="true"] {
			color: var(--text);
			border-color: var(--accent);
			background: rgba(56, 189, 248, 0.12);
		}
		.live-filter-count {
			min-width: 1.25em;
			border-radius: 999px;
			background: rgba(255, 255, 255, 0.06);
			color: inherit;
			font-size: 10px;
			font-weight: 700;
			line-height: 1;
			padding: 3px 6px;
			text-align: center;
		}
		.live-search {
			display: grid;
			flex: 1 1 160px;
			min-width: 140px;
		}
		.live-search input {
			width: 100%;
			background: #0e1520;
			border: 1px solid var(--line);
			border-radius: 8px;
			color: var(--text);
			font: inherit;
			font-size: 12px;
			padding: 7px 10px;
		}
		.live-search input:focus {
			outline: none;
			border-color: var(--accent);
		}
		.visually-hidden {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}
		.live-job-list {
			display: grid;
			align-content: start;
			gap: 0;
			flex: 1 1 auto;
			min-height: 240px;
			overflow: auto;
		}
		.live-job-card {
			display: grid;
			gap: 6px;
			width: 100%;
			padding: 12px 14px;
			border: 0;
			border-bottom: 1px solid var(--line);
			background: transparent;
			color: inherit;
			cursor: pointer;
			font: inherit;
			text-align: left;
		}
		.live-job-card:hover,
		.live-job-card:focus-visible {
			background: var(--panel-2);
			outline: none;
		}
		.live-job-card[aria-selected="true"] {
			background: rgba(56, 189, 248, 0.1);
			box-shadow: inset 3px 0 0 var(--accent);
		}
		.live-job-card-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
		}
		.live-job-card-title {
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.live-job-card-meta {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 6px 8px;
			color: var(--muted);
			font-size: 11px;
			overflow-wrap: anywhere;
		}
		.live-job-tag {
			display: inline-flex;
			align-items: center;
			border-radius: 999px;
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid var(--line);
			color: var(--text);
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.02em;
			padding: 2px 7px;
			text-transform: uppercase;
		}
		.live-status-pill {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			border-radius: 999px;
			border: 1px solid var(--line);
			background: var(--panel);
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.02em;
			padding: 3px 8px;
			text-transform: uppercase;
		}
		.live-status-dot {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			background: currentColor;
		}
		.live-status-pill.status-running {
			color: var(--info);
			background: rgba(96, 165, 250, 0.12);
			border-color: rgba(96, 165, 250, 0.35);
		}
		.live-status-pill.status-queued,
		.live-status-pill.status-pending {
			color: var(--warn);
			background: rgba(251, 191, 36, 0.12);
			border-color: rgba(251, 191, 36, 0.35);
		}
		.live-status-pill.status-completed {
			color: var(--ok);
			background: rgba(52, 211, 153, 0.12);
			border-color: rgba(52, 211, 153, 0.35);
		}
		.live-status-pill.status-failed,
		.live-status-pill.status-cancelled {
			color: var(--bad);
			background: rgba(251, 113, 133, 0.12);
			border-color: rgba(251, 113, 133, 0.35);
		}
		@keyframes live-pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.35; }
		}
		.live-status-pill.status-running .live-status-dot,
		.live-status-pill.status-pending .live-status-dot {
			animation: live-pulse 1.2s ease-in-out infinite;
		}
		.live-detail-empty {
			display: grid;
			place-items: center;
			gap: 8px;
			flex: 1 1 auto;
			min-height: 320px;
			padding: 32px 24px;
			color: var(--muted);
			text-align: center;
		}
		.live-detail-content {
			display: flex;
			flex-direction: column;
			min-height: 0;
			flex: 1 1 auto;
		}
		.live-detail-header {
			display: flex;
			flex-wrap: wrap;
			align-items: flex-start;
			justify-content: space-between;
			gap: 12px;
			padding: 16px;
			border-bottom: 1px solid var(--line);
			background: var(--panel-2);
		}
		.live-detail-heading {
			display: grid;
			gap: 8px;
			min-width: 0;
		}
		.live-detail-title-row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
		}
		.live-detail-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}
		.live-detail-body {
			padding: 16px;
			flex: 1 1 auto;
			min-height: 0;
			overflow: auto;
		}
		.live-detail-meta {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 10px;
			margin: 0 0 16px;
		}
		.live-meta-card {
			display: grid;
			gap: 4px;
			min-width: 0;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 10px;
			padding: 10px 12px;
		}
		.live-meta-card > span {
			color: var(--muted);
			font-size: 11px;
			font-weight: 650;
		}
		.live-artifact-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}
		.live-artifact-download {
			color: var(--accent);
			font-size: 12px;
			text-decoration: none;
		}
		.live-artifact-download:hover {
			text-decoration: underline;
		}
		.live-artifact-card {
			display: grid;
			gap: 6px;
			min-width: 0;
		}
		.settings-layout {
			display: grid;
			grid-template-columns: 200px minmax(0, 1fr);
			gap: 12px;
			align-items: start;
		}
		.settings-nav {
			display: grid;
			gap: 4px;
			align-self: start;
		}
		.settings-nav button {
			appearance: none;
			border: 1px solid transparent;
			border-radius: 8px;
			background: transparent;
			color: var(--muted);
			cursor: pointer;
			font: inherit;
			font-size: 13px;
			font-weight: 650;
			padding: 9px 11px;
			text-align: left;
		}
		.settings-nav button:hover,
		.settings-nav button:focus-visible {
			color: var(--text);
			background: var(--panel-2);
			outline: none;
		}
		.settings-nav button[aria-current="page"] {
			color: var(--text);
			background: var(--panel);
			border-color: var(--line);
			box-shadow: var(--shadow);
		}
		.settings-section[hidden] { display: none; }
		.debug-health-list {
			display: grid;
			gap: 8px;
		}
		.debug-health-item {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 12px;
			padding: 10px 12px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 8px;
		}
		.debug-health-item.ok { border-left: 3px solid var(--ok); }
		.debug-health-item.warn { border-left: 3px solid var(--warn); }
		.debug-health-item.bad { border-left: 3px solid var(--bad); }
		.debug-failure-list {
			display: grid;
			gap: 6px;
		}
		.debug-failure-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			padding: 8px 10px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 8px;
			font-size: 12px;
		}
		.raw-filter {
			display: flex;
			gap: 8px;
			padding: 0 14px 10px;
		}
		.raw-filter input {
			flex: 1;
			background: #0e1520;
			border: 1px solid var(--line);
			color: #d7e7ff;
			border-radius: 6px;
			font: inherit;
			padding: 7px 9px;
			min-width: 0;
		}
		.raw-status mark {
			background: rgba(56, 189, 248, 0.28);
			color: inherit;
			border-radius: 2px;
		}
		.provider-media-tests {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
		.provider-test-tabs {
			margin-top: 14px;
		}
		.provider-test-panel[hidden] {
			display: none;
		}
		.provider-media-test {
			display: grid;
			gap: 9px;
			min-width: 0;
			padding: 12px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 8px;
		}
		.provider-media-test-heading {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.provider-media-test button {
			justify-self: start;
			appearance: none;
			border: 1px solid var(--line);
			border-radius: 6px;
			background: var(--panel);
			color: var(--text);
			cursor: pointer;
			font: inherit;
			font-size: 12px;
			padding: 8px 11px;
		}
		.provider-media-test button:hover,
		.provider-media-test button:focus-visible {
			border-color: var(--info);
			outline: none;
		}
		.provider-media-test button:disabled {
			cursor: progress;
			opacity: 0.7;
		}
		.provider-test-status {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			min-width: 0;
		}
		.provider-test-progress {
			color: var(--info);
			font-variant-numeric: tabular-nums;
			text-align: right;
		}
		.provider-test-activity {
			height: 4px;
			overflow: hidden;
			background: var(--line);
			border-radius: 999px;
		}
		.provider-test-activity[hidden] { display: none; }
		.provider-test-activity span {
			display: block;
			width: 42%;
			height: 100%;
			border-radius: inherit;
			background: linear-gradient(90deg, transparent, var(--info), var(--accent), transparent);
			animation: provider-test-activity 1.15s ease-in-out infinite;
		}
		@keyframes provider-test-activity {
			from { transform: translateX(-120%); }
			to { transform: translateX(260%); }
		}
		.provider-test-result:empty { display: none; }
		.provider-test-result {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
		}
		.provider-media-test .provider-test-artifact {
			display: grid;
			gap: 6px;
			width: min(280px, 100%);
			padding: 0;
			border: 0;
			background: transparent;
			color: var(--accent);
			cursor: zoom-in;
			font-size: 12px;
			text-align: left;
		}
		.provider-media-test .provider-test-artifact img,
		.provider-media-test .provider-test-artifact video {
			width: 100%;
			max-height: 220px;
			object-fit: contain;
			background: #070b10;
			border: 1px solid var(--line);
			border-radius: 8px;
		}
		.tabs {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
			border-bottom: 1px solid var(--line);
			overflow-x: auto;
		}
		.tab-button {
			appearance: none;
			border: 1px solid transparent;
			border-bottom: 0;
			border-radius: 8px 8px 0 0;
			background: transparent;
			color: var(--muted);
			cursor: pointer;
			font: inherit;
			font-weight: 650;
			padding: 10px 13px;
			white-space: nowrap;
		}
		.tab-button:hover,
		.tab-button:focus-visible {
			color: var(--text);
			outline: none;
		}
		.tab-button[aria-selected="true"] {
			background: var(--panel);
			border-color: var(--line);
			color: var(--text);
		}
		.tab-panel[hidden] {
			display: none;
		}
		@media (max-width: 760px) {
			main { width: min(100% - 20px, 1280px); }
			header { align-items: flex-start; flex-direction: column; }
			.status-meta { justify-content: flex-start; }
			.tabs { gap: 4px; }
			.tab-button { padding: 9px 10px; }
			.span-4,
			.span-6 { grid-column: span 12; }
			.feature-grid,
			.health-grid { grid-template-columns: 1fr; }
			.settings-grid,
			.model-settings-grid,
			.provider-media-tests { grid-template-columns: 1fr; }
			.live-inspector { grid-template-columns: 1fr; min-height: 0; }
			.settings-layout { grid-template-columns: 1fr; }
			.settings-nav { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); }
			.live-detail-meta { grid-template-columns: 1fr 1fr; }
			.live-job-list { max-height: 42vh; }
		}
	</style>
</head>
<body>
	<main>
		<div class="app-shell">
			<header>
				<div>
					<h1>${PRODUCT_NAME}</h1>
					<div class="updated">formerly ${LEGACY_PRODUCT_NAME}</div>
				</div>
				<div class="status-meta">
					<span class="pill connection-pill warn" id="connectionPill"><span class="dot"></span><span>Connecting</span></span>
					<div class="updated" id="updated">Loading</div>
					<div class="updated" id="lastEvent">No live events yet</div>
				</div>
			</header>
			<nav class="tabs" role="tablist" aria-label="Status page sections">
				<button class="tab-button" type="button" role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true" data-route="overview">Overview</button>
				<button class="tab-button" type="button" role="tab" id="tab-live" aria-controls="panel-live" aria-selected="false" tabindex="-1" data-route="live">Live<span class="tab-badge" id="liveTabBadge" hidden>0</span></button>
				<button class="tab-button" type="button" role="tab" id="tab-settings" aria-controls="panel-settings" aria-selected="false" tabindex="-1" data-route="settings">Settings<span class="tab-badge dirty" id="settingsTabBadge" hidden>•</span></button>
				<button class="tab-button" type="button" role="tab" id="tab-debug" aria-controls="panel-debug" aria-selected="false" tabindex="-1" data-route="debug">Debug<span class="tab-badge bad" id="debugTabBadge" hidden>0</span></button>
			</nav>
		</div>
		<section class="tab-panel grid" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
			<div class="panel span-12">
				<div class="label">Health</div>
				<div class="health-grid" id="healthGrid">
					<button type="button" class="health-card" data-nav="overview"><span class="health-title">Bridge</span><span class="health-value" id="healthBridge">Checking</span><span class="health-hint">Local relay status</span></button>
					<button type="button" class="health-card" data-nav="debug"><span class="health-title">Codex</span><span class="health-value" id="healthCodex">Checking</span><span class="health-hint">CLI readiness</span></button>
					<button type="button" class="health-card" data-nav="live"><span class="health-title">Jobs</span><span class="health-value" id="healthJobs">Running 0 / Queued 0</span><span class="health-hint">Open live inspector</span></button>
					<button type="button" class="health-card" data-nav="settings/asr"><span class="health-title">Local ASR</span><span class="health-value" id="healthAsr">Checking</span><span class="health-hint">Runtime and models</span></button>
				</div>
			</div>
			<div class="panel span-4">
				<div class="label">Bridge</div>
				<div class="value"><span class="pill" id="bridgePill"><span class="dot"></span><span>Checking</span></span></div>
			</div>
			<div class="panel span-4">
				<div class="label">Codex</div>
				<div class="value"><span class="pill" id="codexPill"><span class="dot"></span><span>Checking</span></span></div>
			</div>
			<div class="panel span-4">
				<div class="label">Jobs</div>
				<div class="value" id="jobCounts">Running 0 / Queued 0</div>
			</div>
			<div class="panel span-4">
				<div class="label">Bridge Version</div>
				<div class="value" id="version">-</div>
			</div>
			<div class="panel span-4">
				<div class="label">Max Parallel Jobs</div>
				<div class="value" id="maxConcurrent">-</div>
			</div>
			<div class="panel span-4">
				<div class="label">Paired Sites</div>
				<div class="value" id="overviewPairedCount">0</div>
			</div>
			<div class="panel span-6">
				<div class="label">Codex CLI Version</div>
				<div class="value" id="codexCliVersion">-</div>
			</div>
			<div class="panel span-6">
				<div class="label">Codex Binary</div>
				<div class="value"><code id="codexBinary">-</code></div>
			</div>
			<div class="panel span-12">
				<div class="label">Local ASR Runtime</div>
				<table class="table">
					<tbody id="asrDetails"><tr><td class="muted">Loading</td></tr></tbody>
				</table>
			</div>
		</section>
		<section class="tab-panel grid" id="panel-live" role="tabpanel" aria-labelledby="tab-live" hidden>
			<div class="panel span-12 live-inspector">
				<div class="live-list-panel">
					<div class="live-list-toolbar" role="toolbar" aria-label="Job filters">
						<button type="button" class="live-filter" data-live-filter="all" aria-pressed="true">All <span class="live-filter-count" data-live-filter-count="all">0</span></button>
						<button type="button" class="live-filter" data-live-filter="running" aria-pressed="false">Running <span class="live-filter-count" data-live-filter-count="running">0</span></button>
						<button type="button" class="live-filter" data-live-filter="queued" aria-pressed="false">Queued <span class="live-filter-count" data-live-filter-count="queued">0</span></button>
						<button type="button" class="live-filter" data-live-filter="completed" aria-pressed="false">Completed <span class="live-filter-count" data-live-filter-count="completed">0</span></button>
						<button type="button" class="live-filter" data-live-filter="failed" aria-pressed="false">Failed <span class="live-filter-count" data-live-filter-count="failed">0</span></button>
						<label class="live-search">
							<span class="visually-hidden">Search jobs</span>
							<input type="search" id="liveJobSearch" placeholder="Search id, model, provider" autocomplete="off">
						</label>
					</div>
					<div class="live-job-list" id="liveJobList" role="listbox" aria-label="Job activity"></div>
				</div>
				<div class="live-detail-panel">
					<div class="live-detail-empty" id="liveDetailEmpty">Select a job to inspect live output, artifacts, and debug logs.</div>
					<div class="live-detail-content" id="liveDetailContent" hidden>
						<div class="live-detail-header">
							<div class="live-detail-heading">
								<div class="label">Job inspector</div>
								<div class="live-detail-title-row">
									<div class="value" id="liveDetailTitle">-</div>
									<span id="liveDetailStatus"></span>
								</div>
								<div class="muted" id="liveDetailSubtitle"></div>
							</div>
							<div class="live-detail-actions">
								<button type="button" class="copy-value" id="liveDetailCancel" hidden>Cancel generation</button>
								<button type="button" class="copy-value" id="liveDetailCopyId">Copy request id</button>
							</div>
						</div>
						<div class="live-detail-body" id="liveDetailBody"></div>
					</div>
				</div>
			</div>
		</section>
		<section class="tab-panel grid" id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden>
			<div class="panel span-12 settings-layout">
				<nav class="settings-nav" id="settings-nav" aria-label="Settings sections">
					<button type="button" data-settings-section="providers" aria-current="page">Providers</button>
					<button type="button" data-settings-section="runtime">Runtime</button>
					<button type="button" data-settings-section="tests">Tests</button>
					<button type="button" data-settings-section="upscale">CUDA Upscale</button>
					<button type="button" data-settings-section="image">Local Image</button>
					<button type="button" data-settings-section="music">Music Analysis</button>
					<button type="button" data-settings-section="asr">Local ASR</button>
					<button type="button" data-settings-section="pairing">Pairing</button>
				</nav>
				<div class="settings-panels">
					<div class="settings-section" id="settings-section-providers" data-settings-panel="providers">
						<div class="label">Providers and Model Routing</div>
						<div class="feature-grid" id="providerSettings">Loading providers</div>
						<form class="settings-editor" id="relaySettingsForm">
							<p class="muted">Optional executable paths are used only by this local bridge. Leave a field blank to use its configured environment variable or PATH lookup. Refresh detection saves the visible paths before probing every provider.</p>
							<div class="settings-grid" id="relayCliPaths"></div>
							<div class="settings-grid" id="relayDefaultSettings"></div>
							<div class="settings-grid" id="relayTokenDefaults"></div>
							<div class="settings-grid" id="relayProviderOptions"></div>
							<div class="settings-actions"><span class="muted" id="relaySettingsMessage">Loading routing settings</span><button type="button" id="refreshRelayProviders">Refresh detection</button><button type="button" class="btn-primary" id="saveRelaySettings" disabled>Save paths &amp; routing</button></div>
						</form>
					</div>
					<div class="settings-section" id="settings-section-runtime" data-settings-panel="runtime" hidden>
						<div class="label">Runtime options</div>
						<p class="muted">Blank timeout and concurrency fields keep the environment variable or code default. The listen port is set at process start and is not editable here.</p>
						<div class="settings-grid" id="relayRuntimeSettings"></div>
						<div class="settings-actions"><span class="muted" id="relayRuntimeMessage">Loading runtime settings</span><button type="button" class="btn-primary" id="saveRelayRuntimeSettings" disabled>Save runtime</button></div>
					</div>
					<div class="settings-section" id="settings-section-pairing" data-settings-panel="pairing" hidden>
						<div class="label">Pairing code</div>
						<p class="muted">Use a fixed six-digit code when you need the same code after Relay restarts and successful pairings. It is encrypted with the operating-system secure storage. A fixed numeric code is weaker than a one-time code; pairing attempts are rate-limited across origins and survive restarts.</p>
						<form class="settings-editor" id="persistentPairingCodeForm">
							<label class="field"><span>Fixed pairing code</span><input id="persistentPairingCodeInput" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" placeholder="Enter six digits" aria-describedby="pairingCodeStatus pairingCodeMessage"></label>
							<div class="settings-actions">
								<span class="muted" id="pairingCodeStatus">Loading pairing status</span>
								<button type="submit" class="btn-primary" id="saveFixedPairingCode">Save fixed code</button>
								<button type="button" id="disableFixedPairingCode">Use rotating code</button>
							</div>
							<p class="muted" id="pairingCodeMessage" aria-live="polite"></p>
						</form>
					</div>
					<div class="settings-section" id="settings-section-tests" data-settings-panel="tests" hidden>
						<div class="label">Provider media and audio tests</div>
						<p class="muted">Runs a real request against the selected ready provider. Provider usage or API charges may apply. Selecting xAI Speech-to-Text uploads the chosen audio to xAI; Local ASR and Local Music Analysis stay on this computer.</p>
						<div class="tabs provider-test-tabs" role="tablist" aria-label="Provider test types">
							<button class="tab-button" type="button" role="tab" id="provider-test-tab-images" data-provider-test-tab aria-controls="provider-test-panel-images" aria-selected="true">Image</button>
							<button class="tab-button" type="button" role="tab" id="provider-test-tab-videos" data-provider-test-tab aria-controls="provider-test-panel-videos" aria-selected="false" tabindex="-1">Video</button>
							<button class="tab-button" type="button" role="tab" id="provider-test-tab-analysis" data-provider-test-tab aria-controls="provider-test-panel-analysis" aria-selected="false" tabindex="-1">Video analysis</button>
							<button class="tab-button" type="button" role="tab" id="provider-test-tab-audio" data-provider-test-tab aria-controls="provider-test-panel-audio" aria-selected="false" tabindex="-1">Audio</button>
						</div>
						<div class="provider-test-panel" id="provider-test-panel-images" role="tabpanel" aria-labelledby="provider-test-tab-images">
							<div class="provider-media-tests" id="providerImageTests">Load routing settings to see ready image providers.</div>
						</div>
						<div class="provider-test-panel" id="provider-test-panel-videos" role="tabpanel" aria-labelledby="provider-test-tab-videos" hidden>
							<div class="provider-media-tests" id="providerVideoTests">Load routing settings to see ready video providers.</div>
						</div>
						<div class="provider-test-panel" id="provider-test-panel-analysis" role="tabpanel" aria-labelledby="provider-test-tab-analysis" hidden>
							<div class="provider-media-tests" id="providerAnalysisTests">Load routing settings to see ready video-analysis providers.</div>
						</div>
						<div class="provider-test-panel" id="provider-test-panel-audio" role="tabpanel" aria-labelledby="provider-test-tab-audio" hidden>
							<div class="provider-media-tests" id="providerAudioTests">Load routing settings to see ready transcription and music-analysis providers.</div>
						</div>
					</div>
					<div class="settings-section" id="settings-section-upscale" data-settings-panel="upscale" hidden>
						<div class="label">Local CUDA Upscale Settings</div>
						<p class="muted">Installs a selected, pinned local Upscale model on this computer. Native ×2 and ×4 outputs are never downsampled; setup never runs during a job and never falls back to CPU.</p>
						<form class="settings-editor" id="upscaleSettingsForm">
							<div class="settings-grid" id="upscaleSettings"></div>
							<div class="muted" id="upscaleModelStates">Models: not checked</div>
							<div class="settings-grid" id="upscaleInstallActions"></div>
							<div class="settings-actions">
								<span class="muted" id="upscaleSettingsMessage">Loading settings</span>
								<button type="button" id="reloadUpscaleSettings">Reload</button>
								<button type="button" class="btn-primary" id="saveUpscaleSettings" disabled>Save settings</button>
							</div>
							<pre class="setup-log" id="upscaleSetupLog" hidden></pre>
						</form>
					</div>
					<div class="settings-section" id="settings-section-image" data-settings-panel="image" hidden>
						<div class="label">Local Image Generation (Qwen-Image-2.1)</div>
						<p class="muted">Sets up a CUDA Diffusers runtime for Qwen-Image-2.1 with CPU offload and VAE tiling. Use Setup Environment for the venv and packages; Install Model downloads weights only when you press the button.</p>
						<form class="settings-editor" id="imageSettingsForm">
							<div class="settings-grid" id="imageSettings"></div>
							<div class="muted" id="imageModelStates">Models: not checked</div>
							<div class="settings-grid" id="imageInstallActions"></div>
							<div class="settings-actions">
								<span class="muted" id="imageSettingsMessage">Loading settings</span>
								<button type="button" id="reloadImageSettings">Reload</button>
								<button type="button" id="setupImageEnvironment">Setup Environment</button>
								<button type="button" class="btn-primary" id="saveImageSettings" disabled>Save settings</button>
							</div>
							<pre class="setup-log" id="imageSetupLog" hidden></pre>
						</form>
					</div>
					<div class="settings-section" id="settings-section-music" data-settings-panel="music" hidden>
						<div class="label">Local Music Analysis Settings</div>
						<p class="muted">Core album metrics run privately with ffmpeg/ffprobe, librosa, and pyloudnorm. Setup downloads Python packages only when you press Setup.</p>
						<form class="settings-editor" id="musicAnalysisSettingsForm">
							<div class="settings-grid" id="musicAnalysisSettings"></div>
							<div class="settings-actions">
								<span class="muted" id="musicAnalysisSettingsMessage">Loading settings</span>
								<button type="button" id="reloadMusicAnalysisSettings">Reload</button>
								<button type="button" id="refreshMusicAnalysisRuntime">Refresh runtime</button>
								<button type="button" id="setupMusicAnalysis">Setup local runtime</button>
								<button type="button" class="btn-primary" id="saveMusicAnalysisSettings" disabled>Save settings</button>
							</div>
						</form>
					</div>
					<div class="settings-section" id="settings-section-asr" data-settings-panel="asr" hidden>
						<div class="label">Local ASR Settings</div>
						<p class="muted">Install a Whisper or Qwen model onto this computer with the per-model Install button. That download is explicit; transcription jobs stay offline unless you also enable Allow ASR model downloads.</p>
						<form class="settings-editor" id="asrSettingsForm">
							<div class="settings-grid" id="asrGeneralSettings"></div>
							<div>
								<div class="settings-actions">
									<span class="label">Models</span>
									<button type="button" id="addAsrModel">Add model</button>
								</div>
								<div class="model-settings-grid" id="asrModelSettings"></div>
							</div>
							<details class="settings-advanced">
								<summary>Advanced JSON</summary>
								<textarea id="asrSettingsJson" spellcheck="false"></textarea>
								<div class="settings-actions">
									<button type="button" id="applyAsrSettingsJson">Apply JSON to form</button>
								</div>
							</details>
							<div class="settings-actions">
								<span class="muted" id="asrSettingsMessage">Loading settings</span>
								<button type="button" id="reloadAsrSettings">Reload</button>
								<button type="button" id="refreshAsrRuntime">Refresh runtime</button>
								<button type="button" class="btn-primary" id="saveAsrSettings" disabled>Save settings</button>
							</div>
							<pre class="setup-log" id="asrSetupLog" hidden></pre>
						</form>
					</div>
				</div>
			</div>
		</section>
		<section class="tab-panel grid" id="panel-debug" role="tabpanel" aria-labelledby="tab-debug" hidden>
			<div class="panel span-12">
				<div class="label">Health checks</div>
				<div class="debug-health-list" id="debugHealthList"></div>
			</div>
			<div class="panel span-12">
				<div class="label">Recent failures</div>
				<div class="debug-failure-list" id="debugFailureList"><div class="muted">No recent failures</div></div>
			</div>
			<div class="panel span-12">
				<div class="label">Detected Features</div>
				<div class="feature-grid" id="detectedFeatures"></div>
			</div>
			<div class="panel span-12">
				<div class="label">Backend Drivers</div>
				<div class="feature-grid" id="backendDrivers"></div>
			</div>
			<div class="panel span-12">
				<div class="label">Paired Sites</div>
				<div id="pairedSites" class="muted">None</div>
			</div>
			<div class="panel span-12">
				<div class="label">Codex Details</div>
				<table class="table">
					<tbody id="codexDetails"></tbody>
				</table>
			</div>
			<details class="panel span-12">
				<summary>Raw Status</summary>
				<div class="raw-actions"><button type="button" class="copy-session-output" id="copyRawStatus">Copy diagnostics JSON</button></div>
				<div class="raw-filter"><input type="search" id="rawStatusFilter" placeholder="Filter JSON keys or values" autocomplete="off" spellcheck="false"></div>
				<pre class="raw-status" id="rawStatus">{}</pre>
			</details>
		</section>
	</main>
	<div class="image-lightbox" id="imageLightbox" role="dialog" aria-modal="true" aria-label="Generated media preview" hidden>
		<button type="button" class="copy-session-output image-lightbox-close" id="closeImageLightbox">Close</button>
		<img id="imageLightboxContent" alt="Generated image full preview">
		<video id="mediaLightboxVideo" controls preload="metadata" playsinline hidden></video>
	</div>
	<script>
		const statusUrl = '/v1/status';
		const capabilitiesUrl = '/v1/capabilities';
		const asrSettingsUrl = '/v1/asr/settings';
		const asrSetupUrl = '/v1/asr/setup';
		const musicAnalysisSettingsUrl = '/v1/music-analysis/settings';
		const musicAnalysisSetupUrl = '/v1/music-analysis/setup';
		const upscaleSettingsUrl = '/v1/upscale/settings';
		const upscaleSetupUrl = '/v1/upscale/setup';
		const imageSettingsUrl = '/v1/image/settings';
		const imageSetupUrl = '/v1/image/setup';
		const relaySettingsUrl = '/v1/relay/settings';
		const pairingCodeSettingsUrl = '/v1/relay/pairing-code';
		const relayTestUrl = '/v1/relay/test';
		const liveImageCancelUrl = '/v1/relay/jobs/images/cancel';
		const jobEventsUrl = '/v1/status/events';
		let currentStatus = {};
		let currentCapabilities = {};
		let currentAsrSettings = null;
		let currentMusicAnalysisSettings = null;
		let currentUpscaleSettings = null;
		let currentImageSettings = null;
		let settingsLoaded = false;
		let fallbackPollTimer = null;
		let providerRefreshPollTimer = null;
		let jobEvents = null;
		let liveFilter = 'all';
		let liveSearchQuery = '';
		let selectedLiveRequestId = '';
		let livePinned = false;
		const cancellingLiveImageRequests = new Set();
		const seenLiveRequestIds = new Set();
		let settingsSection = 'providers';
		let suppressHashChange = false;
		const knownSettingsSections = ['providers', 'runtime', 'tests', 'upscale', 'image', 'music', 'asr', 'pairing'];
		let formSnapshots = { relay: '', runtime: '', asr: '', music: '', upscale: '', image: '' };
		const fields = {
			tabButtons: Array.from(document.querySelectorAll('.app-shell nav.tabs[role="tablist"] [role="tab"]')),
			tabPanels: Array.from(document.querySelectorAll('main > .tab-panel[role="tabpanel"]')),
			liveTabBadge: document.getElementById('liveTabBadge'),
			settingsTabBadge: document.getElementById('settingsTabBadge'),
			debugTabBadge: document.getElementById('debugTabBadge'),
			healthBridge: document.getElementById('healthBridge'),
			healthCodex: document.getElementById('healthCodex'),
			healthJobs: document.getElementById('healthJobs'),
			healthAsr: document.getElementById('healthAsr'),
			overviewPairedCount: document.getElementById('overviewPairedCount'),
			liveJobList: document.getElementById('liveJobList'),
			liveJobSearch: document.getElementById('liveJobSearch'),
			liveDetailEmpty: document.getElementById('liveDetailEmpty'),
			liveDetailContent: document.getElementById('liveDetailContent'),
			liveDetailTitle: document.getElementById('liveDetailTitle'),
			liveDetailStatus: document.getElementById('liveDetailStatus'),
			liveDetailSubtitle: document.getElementById('liveDetailSubtitle'),
			liveDetailBody: document.getElementById('liveDetailBody'),
			liveDetailCopyId: document.getElementById('liveDetailCopyId'),
			liveDetailCancel: document.getElementById('liveDetailCancel'),
			settingsNavButtons: Array.from(document.querySelectorAll('#settings-nav [data-settings-section]')),
			settingsPanels: Array.from(document.querySelectorAll('[data-settings-panel]')),
			persistentPairingCodeForm: document.getElementById('persistentPairingCodeForm'),
			persistentPairingCodeInput: document.getElementById('persistentPairingCodeInput'),
			pairingCodeStatus: document.getElementById('pairingCodeStatus'),
			pairingCodeMessage: document.getElementById('pairingCodeMessage'),
			saveFixedPairingCode: document.getElementById('saveFixedPairingCode'),
			disableFixedPairingCode: document.getElementById('disableFixedPairingCode'),
			debugHealthList: document.getElementById('debugHealthList'),
			debugFailureList: document.getElementById('debugFailureList'),
			rawStatusFilter: document.getElementById('rawStatusFilter'),
			updated: document.getElementById('updated'),
			lastEvent: document.getElementById('lastEvent'),
			connectionPill: document.getElementById('connectionPill'),
			bridgePill: document.getElementById('bridgePill'),
			codexPill: document.getElementById('codexPill'),
			jobCounts: document.getElementById('jobCounts'),
			version: document.getElementById('version'),
			maxConcurrent: document.getElementById('maxConcurrent'),
			codexCliVersion: document.getElementById('codexCliVersion'),
			codexBinary: document.getElementById('codexBinary'),
			detectedFeatures: document.getElementById('detectedFeatures'),
			backendDrivers: document.getElementById('backendDrivers'),
			providerSettings: document.getElementById('providerSettings'),
			relaySettingsForm: document.getElementById('relaySettingsForm'),
			relayCliPaths: document.getElementById('relayCliPaths'),
			relayDefaultSettings: document.getElementById('relayDefaultSettings'),
			relayTokenDefaults: document.getElementById('relayTokenDefaults'),
			relayProviderOptions: document.getElementById('relayProviderOptions'),
			relayRuntimeSettings: document.getElementById('relayRuntimeSettings'),
			relayRuntimeMessage: document.getElementById('relayRuntimeMessage'),
			saveRelayRuntimeSettings: document.getElementById('saveRelayRuntimeSettings'),
			relaySettingsMessage: document.getElementById('relaySettingsMessage'),
			refreshRelayProviders: document.getElementById('refreshRelayProviders'),
			saveRelaySettings: document.getElementById('saveRelaySettings'),
                        providerImageTests: document.getElementById('providerImageTests'),
                        providerVideoTests: document.getElementById('providerVideoTests'),
                        providerAnalysisTests: document.getElementById('providerAnalysisTests'),
                        providerAudioTests: document.getElementById('providerAudioTests'),
                        providerTestTabButtons: Array.from(document.querySelectorAll('[data-provider-test-tab]')),
                        providerTestTabPanels: Array.from(document.querySelectorAll('.provider-test-panel[role="tabpanel"]')),
			musicAnalysisSettingsForm: document.getElementById('musicAnalysisSettingsForm'),
			musicAnalysisSettings: document.getElementById('musicAnalysisSettings'),
			musicAnalysisSettingsMessage: document.getElementById('musicAnalysisSettingsMessage'),
			reloadMusicAnalysisSettings: document.getElementById('reloadMusicAnalysisSettings'),
			refreshMusicAnalysisRuntime: document.getElementById('refreshMusicAnalysisRuntime'),
			setupMusicAnalysis: document.getElementById('setupMusicAnalysis'),
			saveMusicAnalysisSettings: document.getElementById('saveMusicAnalysisSettings'),
			upscaleSettingsForm: document.getElementById('upscaleSettingsForm'),
			upscaleSettings: document.getElementById('upscaleSettings'),
			upscaleModelStates: document.getElementById('upscaleModelStates'),
			upscaleSettingsMessage: document.getElementById('upscaleSettingsMessage'),
			reloadUpscaleSettings: document.getElementById('reloadUpscaleSettings'),
			upscaleInstallActions: document.getElementById('upscaleInstallActions'),
			saveUpscaleSettings: document.getElementById('saveUpscaleSettings'),
			upscaleSetupLog: document.getElementById('upscaleSetupLog'),
			imageSettingsForm: document.getElementById('imageSettingsForm'),
			imageSettings: document.getElementById('imageSettings'),
			imageModelStates: document.getElementById('imageModelStates'),
			imageSettingsMessage: document.getElementById('imageSettingsMessage'),
			reloadImageSettings: document.getElementById('reloadImageSettings'),
			imageInstallActions: document.getElementById('imageInstallActions'),
			setupImageEnvironment: document.getElementById('setupImageEnvironment'),
			saveImageSettings: document.getElementById('saveImageSettings'),
			imageSetupLog: document.getElementById('imageSetupLog'),
			asrDetails: document.getElementById('asrDetails'),
			asrSettingsForm: document.getElementById('asrSettingsForm'),
			asrGeneralSettings: document.getElementById('asrGeneralSettings'),
			asrModelSettings: document.getElementById('asrModelSettings'),
			asrSettingsJson: document.getElementById('asrSettingsJson'),
			asrSettingsMessage: document.getElementById('asrSettingsMessage'),
			reloadAsrSettings: document.getElementById('reloadAsrSettings'),
			refreshAsrRuntime: document.getElementById('refreshAsrRuntime'),
			saveAsrSettings: document.getElementById('saveAsrSettings'),
			applyAsrSettingsJson: document.getElementById('applyAsrSettingsJson'),
			addAsrModel: document.getElementById('addAsrModel'),
			asrSetupLog: document.getElementById('asrSetupLog'),
			pairedSites: document.getElementById('pairedSites'),
			codexDetails: document.getElementById('codexDetails'),
			rawStatus: document.getElementById('rawStatus'),
			copyRawStatus: document.getElementById('copyRawStatus'),
			imageLightbox: document.getElementById('imageLightbox'),
			imageLightboxContent: document.getElementById('imageLightboxContent'),
			mediaLightboxVideo: document.getElementById('mediaLightboxVideo'),
			closeImageLightbox: document.getElementById('closeImageLightbox'),
		};

		function parseHash() {
			const raw = (location.hash || '#overview').replace(/^#/, '');
			const parts = raw.split('/').filter(Boolean);
			const root = parts[0] || 'overview';
			if (root === 'live') {
				return { tab: 'live', liveRequestId: parts[1] || '', settingsSection: '' };
			}
			if (root === 'settings') {
				return { tab: 'settings', liveRequestId: '', settingsSection: normalizeSettingsSection(parts[1]) };
			}
			return { tab: root, liveRequestId: '', settingsSection: '' };
		}

		function setHash(route, options = {}) {
			const next = route.startsWith('#') ? route : '#' + route;
			if (location.hash !== next) {
				if (options.replace === false) {
					location.hash = next;
				} else {
					history.replaceState(null, '', next);
				}
			}
		}

		function tabIdForRoute(tab) {
			const map = { overview: 'tab-overview', live: 'tab-live', settings: 'tab-settings', debug: 'tab-debug' };
			return map[tab] || 'tab-overview';
		}

		function routeForTabId(tabId) {
			const map = { 'tab-overview': 'overview', 'tab-live': 'live', 'tab-settings': 'settings', 'tab-debug': 'debug' };
			return map[tabId] || 'overview';
		}

		function isFormDirty(key) {
			if (key === 'relay') {
				try {
					return formSnapshots.relay && JSON.stringify(collectRelaySettingsPayload('relay')) !== formSnapshots.relay;
				} catch (error) {
					return true;
				}
			}
			if (key === 'runtime') {
				try {
					return formSnapshots.runtime && JSON.stringify(collectRelaySettingsPayload('runtime')) !== formSnapshots.runtime;
				} catch (error) {
					return true;
				}
			}
			if (key === 'asr') {
				try {
					return formSnapshots.asr && JSON.stringify(serializeAsrSettingsForm()) !== formSnapshots.asr;
				} catch (error) {
					return true;
				}
			}
			if (key === 'music') {
				try {
					return formSnapshots.music && JSON.stringify(serializeMusicAnalysisSettings()) !== formSnapshots.music;
				} catch (error) {
					return false;
				}
			}
			if (key === 'upscale') {
				try {
					return formSnapshots.upscale && JSON.stringify(serializeUpscaleSettings()) !== formSnapshots.upscale;
				} catch (error) {
					return false;
				}
			}
			if (key === 'image') {
				try {
					return formSnapshots.image && JSON.stringify(serializeImageSettings()) !== formSnapshots.image;
				} catch (error) {
					return false;
				}
			}
			return false;
		}

		function updateSettingsDirtyState() {
			const dirty = isFormDirty('relay') || isFormDirty('runtime') || isFormDirty('asr') || isFormDirty('music') || isFormDirty('upscale') || isFormDirty('image');
			fields.settingsTabBadge.hidden = !dirty;
			if (fields.saveRelaySettings) fields.saveRelaySettings.disabled = !isFormDirty('relay');
			if (fields.saveRelayRuntimeSettings) fields.saveRelayRuntimeSettings.disabled = !isFormDirty('runtime');
			if (fields.saveAsrSettings) fields.saveAsrSettings.disabled = !isFormDirty('asr');
			if (fields.saveMusicAnalysisSettings) fields.saveMusicAnalysisSettings.disabled = !isFormDirty('music');
			if (fields.saveUpscaleSettings) fields.saveUpscaleSettings.disabled = !isFormDirty('upscale');
			if (fields.saveImageSettings) fields.saveImageSettings.disabled = !isFormDirty('image');
		}

		function captureFormSnapshots(keys) {
			const targets = Array.isArray(keys) && keys.length ? keys : ['relay', 'runtime', 'asr', 'music', 'upscale', 'image'];
			if (targets.includes('relay')) {
				try {
					formSnapshots.relay = JSON.stringify(collectRelaySettingsPayload('relay'));
				} catch (error) {
					formSnapshots.relay = '';
				}
			}
			if (targets.includes('runtime')) {
				try {
					formSnapshots.runtime = JSON.stringify(collectRelaySettingsPayload('runtime'));
				} catch (error) {
					formSnapshots.runtime = '';
				}
			}
			if (targets.includes('asr')) {
				try {
					formSnapshots.asr = JSON.stringify(serializeAsrSettingsForm());
				} catch (error) {
					formSnapshots.asr = '';
				}
			}
			if (targets.includes('music')) {
				try {
					formSnapshots.music = JSON.stringify(serializeMusicAnalysisSettings());
				} catch (error) {
					formSnapshots.music = '';
				}
			}
			if (targets.includes('upscale')) {
				try {
					formSnapshots.upscale = JSON.stringify(serializeUpscaleSettings());
				} catch (error) {
					formSnapshots.upscale = '';
				}
			}
			if (targets.includes('image')) {
				try {
					formSnapshots.image = JSON.stringify(serializeImageSettings());
				} catch (error) {
					formSnapshots.image = '';
				}
			}
			updateSettingsDirtyState();
		}

		function collectRelaySettingsPayload(section) {
			const defaults = {};
			const cli_paths = {};
			const token_defaults = {};
			const timeouts = {};
			fields.relayDefaultSettings.querySelectorAll('[data-relay-job]').forEach((select) => {
				defaults[select.getAttribute('data-relay-job')] = select.value;
			});
			fields.relayCliPaths.querySelectorAll('[data-relay-cli-path]').forEach((input) => {
				cli_paths[input.getAttribute('data-relay-cli-path')] = input.value.trim();
			});
			fields.relayTokenDefaults.querySelectorAll('[data-relay-token-default]').forEach((input) => {
				token_defaults[input.getAttribute('data-relay-token-default')] = input.value.trim();
			});
			(fields.relayRuntimeSettings ? fields.relayRuntimeSettings.querySelectorAll('[data-relay-timeout]') : []).forEach((input) => {
				timeouts[input.getAttribute('data-relay-timeout')] = input.value.trim();
			});
			const maxConcurrent = document.getElementById('relayMaxConcurrent');
			const enabledSelect = document.getElementById('relayOpenaiEnabled');
			const enabledValue = enabledSelect ? enabledSelect.value : '';
			const runtime = { timeouts };
			if (maxConcurrent) runtime.max_concurrent_jobs = maxConcurrent.value.trim();
			const payload = {
				defaults,
				cli_paths,
				token_defaults,
				runtime,
				providers: {
					xai: {
						api_key: (document.getElementById('relayXaiApiKey') || {}).value || '',
						clear_api_key: !!(document.getElementById('relayXaiApiKeyClear') && document.getElementById('relayXaiApiKeyClear').checked),
						base_url: (document.getElementById('relayXaiBaseUrl') || {}).value || '',
						models: (document.getElementById('relayXaiModels') || {}).value || '',
					},
					openai_videos: {
						enabled: enabledValue === '' ? null : enabledValue === 'true',
						api_key: (document.getElementById('relayOpenaiApiKey') || {}).value || '',
						clear_api_key: !!(document.getElementById('relayOpenaiApiKeyClear') && document.getElementById('relayOpenaiApiKeyClear').checked),
					},
					api_key_chat: {
						api_key: (document.getElementById('relayApiKeyChatKey') || {}).value || '',
						clear_api_key: !!(document.getElementById('relayApiKeyChatKeyClear') && document.getElementById('relayApiKeyChatKeyClear').checked),
						base_url: (document.getElementById('relayApiKeyChatBaseUrl') || {}).value || '',
						provider_id: (document.getElementById('relayApiKeyChatProviderId') || {}).value || '',
						model: (document.getElementById('relayApiKeyChatModel') || {}).value || '',
					},
					cli_process: {
						args: (document.getElementById('relayCliProcessArgs') || {}).value || '',
					},
					grok: {
						imagine_skill: (document.getElementById('relayGrokImagineSkill') || {}).value || '',
					},
					antigravity: {
						state_dir: (document.getElementById('relayAntigravityStateDir') || {}).value || '',
					},
				},
			};
			if (section === 'runtime') return { runtime: payload.runtime };
			if (section === 'relay') {
				return {
					defaults: payload.defaults,
					cli_paths: payload.cli_paths,
					token_defaults: payload.token_defaults,
					providers: payload.providers,
				};
			}
			return payload;
		}

		function restoreRelaySection(section, preserved) {
			if (!preserved) return;
			if (section === 'runtime') {
				const runtime = preserved.runtime || {};
				const maxConcurrent = document.getElementById('relayMaxConcurrent');
				if (maxConcurrent && runtime.max_concurrent_jobs != null) maxConcurrent.value = runtime.max_concurrent_jobs;
				const timeouts = runtime.timeouts || {};
				(fields.relayRuntimeSettings ? fields.relayRuntimeSettings.querySelectorAll('[data-relay-timeout]') : []).forEach((input) => {
					const key = input.getAttribute('data-relay-timeout');
					if (key && Object.prototype.hasOwnProperty.call(timeouts, key)) input.value = timeouts[key];
				});
				return;
			}
			const defaults = preserved.defaults || {};
			fields.relayDefaultSettings.querySelectorAll('[data-relay-job]').forEach((select) => {
				const job = select.getAttribute('data-relay-job');
				if (Object.prototype.hasOwnProperty.call(defaults, job)) select.value = defaults[job];
			});
			const cliPaths = preserved.cli_paths || {};
			fields.relayCliPaths.querySelectorAll('[data-relay-cli-path]').forEach((input) => {
				const key = input.getAttribute('data-relay-cli-path');
				if (Object.prototype.hasOwnProperty.call(cliPaths, key)) input.value = cliPaths[key];
			});
			const tokenDefaults = preserved.token_defaults || {};
			fields.relayTokenDefaults.querySelectorAll('[data-relay-token-default]').forEach((input) => {
				const key = input.getAttribute('data-relay-token-default');
				if (Object.prototype.hasOwnProperty.call(tokenDefaults, key)) input.value = tokenDefaults[key];
			});
			const providers = preserved.providers || {};
			const xai = providers.xai || {};
			const openai = providers.openai_videos || {};
			const apiKeyChat = providers.api_key_chat || {};
			const setValue = (id, value) => {
				const el = document.getElementById(id);
				if (el) el.value = value == null ? '' : value;
			};
			const setChecked = (id, value) => {
				const el = document.getElementById(id);
				if (el) el.checked = !!value;
			};
			setValue('relayXaiApiKey', xai.api_key);
			setChecked('relayXaiApiKeyClear', xai.clear_api_key);
			setValue('relayXaiBaseUrl', xai.base_url);
			setValue('relayXaiModels', xai.models);
			const enabledSelect = document.getElementById('relayOpenaiEnabled');
			if (enabledSelect) enabledSelect.value = openai.enabled === true ? 'true' : (openai.enabled === false ? 'false' : '');
			setValue('relayOpenaiApiKey', openai.api_key);
			setChecked('relayOpenaiApiKeyClear', openai.clear_api_key);
			setValue('relayApiKeyChatKey', apiKeyChat.api_key);
			setChecked('relayApiKeyChatKeyClear', apiKeyChat.clear_api_key);
			setValue('relayApiKeyChatBaseUrl', apiKeyChat.base_url);
			setValue('relayApiKeyChatProviderId', apiKeyChat.provider_id);
			setValue('relayApiKeyChatModel', apiKeyChat.model);
			setValue('relayCliProcessArgs', (providers.cli_process && providers.cli_process.args) || '');
			setValue('relayGrokImagineSkill', (providers.grok && providers.grok.imagine_skill) || '');
			setValue('relayAntigravityStateDir', (providers.antigravity && providers.antigravity.state_dir) || '');
		}

		function normalizeSettingsSection(section) {
			const next = String(section || '').trim().toLowerCase();
			return knownSettingsSections.includes(next) ? next : 'providers';
		}

		function isSettingsTabSelected() {
			const selected = fields.tabButtons.find((button) => button.getAttribute('aria-selected') === 'true');
			return !!(selected && selected.id === 'tab-settings');
		}

		function confirmUnsavedSettings() {
			if (!isFormDirty('relay') && !isFormDirty('runtime') && !isFormDirty('asr') && !isFormDirty('music') && !isFormDirty('upscale') && !isFormDirty('image')) {
				return true;
			}
			return window.confirm('You have unsaved settings changes. Leave this section without saving?');
		}

		function selectSettingsSection(section, options = {}) {
			const next = normalizeSettingsSection(section);
			if (!options.force && next !== settingsSection && !confirmUnsavedSettings()) {
				return false;
			}
			settingsSection = next;
			for (const button of fields.settingsNavButtons) {
				const selected = button.getAttribute('data-settings-section') === next;
				button.setAttribute('aria-current', selected ? 'page' : 'false');
			}
			for (const panel of fields.settingsPanels) {
				panel.hidden = panel.getAttribute('data-settings-panel') !== next;
			}
			if (!options.skipHash) {
				setHash('settings/' + next);
			}
			if (next === 'pairing') loadPairingSettings();
			return true;
		}

		function initSettingsNav() {
			fields.settingsNavButtons.forEach((button) => {
				button.addEventListener('click', () => {
					if (!selectSettingsSection(button.getAttribute('data-settings-section'))) {
						return;
					}
					ensureSettingsLoaded();
				});
			});
		}

		function ensureSettingsLoaded() {
			if (!settingsLoaded) {
				settingsLoaded = true;
				loadAsrSettings();
				loadMusicAnalysisSettings();
				loadUpscaleSettings();
				loadImageSettings();
				loadRelaySettings();
			}
		}

		function applyRouteFromHash(options = {}) {
			const route = parseHash();
			const nextTabId = tabIdForRoute(route.tab);
			if (!options.skipGuard && nextTabId !== 'tab-settings' && isSettingsTabSelected() && !confirmUnsavedSettings()) {
				suppressHashChange = true;
				setHash('settings/' + settingsSection);
				suppressHashChange = false;
				return;
			}
			if (!selectTab(nextTabId, { skipHash: true, focus: options.focus, skipGuard: true })) {
				return;
			}
			if (route.tab === 'settings') {
				ensureSettingsLoaded();
				selectSettingsSection(route.settingsSection, { skipHash: true, force: true });
			}
			if (route.tab === 'live') {
				if (route.liveRequestId) {
					selectLiveJob(route.liveRequestId, { skipHash: true, pin: true });
				} else {
					livePinned = false;
					selectedLiveRequestId = '';
					autoSelectLiveJob(currentStatus.jobs || {});
				}
			}
		}

		function selectTab(tabId, options = {}) {
			const nextButton = fields.tabButtons.find((button) => button.id === tabId) || fields.tabButtons[0];
			if (!nextButton) {
				return false;
			}
			if (!options.skipGuard && nextButton.id !== 'tab-settings' && isSettingsTabSelected() && !confirmUnsavedSettings()) {
				return false;
			}
			const nextPanelId = nextButton.getAttribute('aria-controls');
			for (const button of fields.tabButtons) {
				const selected = button === nextButton;
				button.setAttribute('aria-selected', selected ? 'true' : 'false');
				button.tabIndex = selected ? 0 : -1;
			}
			for (const panel of fields.tabPanels) {
				panel.hidden = panel.id !== nextPanelId;
			}
			if (options.focus) {
				nextButton.focus();
			}
			if (!options.skipHash) {
				const route = routeForTabId(nextButton.id);
				if (route === 'settings') {
					setHash('settings/' + settingsSection);
				} else if (route === 'live') {
					livePinned = false;
					setHash('live');
					autoSelectLiveJob(currentStatus.jobs || {});
				} else {
					setHash(route);
				}
			}
			if (nextButton.id === 'tab-settings') {
				ensureSettingsLoaded();
			}
			return true;
		}

		function initTabs() {
			fields.tabButtons.forEach((button, index) => {
				button.addEventListener('click', () => {
					selectTab(button.id);
				});
				button.addEventListener('keydown', (event) => {
					if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
						return;
					}
					event.preventDefault();
					let nextIndex = index;
					if (event.key === 'Home') {
						nextIndex = 0;
					} else if (event.key === 'End') {
						nextIndex = fields.tabButtons.length - 1;
					} else {
						const direction = event.key === 'ArrowRight' ? 1 : -1;
						nextIndex = (index + direction + fields.tabButtons.length) % fields.tabButtons.length;
					}
					selectTab(fields.tabButtons[nextIndex].id, { focus: true });
				});
			});
			window.addEventListener('hashchange', () => {
				if (suppressHashChange) {
					return;
				}
				applyRouteFromHash();
			});
			document.getElementById('healthGrid').addEventListener('click', (event) => {
				const card = event.target.closest('[data-nav]');
				if (!card) return;
				const target = card.getAttribute('data-nav');
				if (target === 'overview') return;
				if (target.startsWith('settings/')) {
					ensureSettingsLoaded();
					if (!selectSettingsSection(target.split('/')[1] || 'providers')) {
						return;
					}
					selectTab('tab-settings');
					return;
				}
				setHash(target);
				applyRouteFromHash();
			});
			applyRouteFromHash();
		}

		function selectProviderTestTab(tabId, options = {}) {
			const nextButton = fields.providerTestTabButtons.find((button) => button.id === tabId) || fields.providerTestTabButtons[0];
			if (!nextButton) return;
			const nextPanelId = nextButton.getAttribute('aria-controls');
			for (const button of fields.providerTestTabButtons) {
				const selected = button === nextButton;
				button.setAttribute('aria-selected', selected ? 'true' : 'false');
				button.tabIndex = selected ? 0 : -1;
			}
			for (const panel of fields.providerTestTabPanels) panel.hidden = panel.id !== nextPanelId;
			if (options.focus) nextButton.focus();
		}

                function initProviderTestTabs() {
			fields.providerTestTabButtons.forEach((button, index) => {
				button.addEventListener('click', () => selectProviderTestTab(button.id));
				button.addEventListener('keydown', (event) => {
					if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
					event.preventDefault();
					let nextIndex = index;
					if (event.key === 'Home') nextIndex = 0;
					else if (event.key === 'End') nextIndex = fields.providerTestTabButtons.length - 1;
					else nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + fields.providerTestTabButtons.length) % fields.providerTestTabButtons.length;
					selectProviderTestTab(fields.providerTestTabButtons[nextIndex].id, { focus: true });
				});
			});
			selectProviderTestTab('provider-test-tab-images');
		}

		function formatArtifactBytes(sizeBytes) {
			const bytes = Number(sizeBytes);
			if (!Number.isFinite(bytes) || bytes < 0) return '';
			if (bytes < 1024) return bytes + ' B';
			if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + ' KB';
			return (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
		}

		function artifactMetaLabel(artifact) {
			const parts = [];
			const width = Number(artifact && artifact.width);
			const height = Number(artifact && artifact.height);
			if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
				parts.push(width + ' × ' + height);
			}
			const sizeLabel = formatArtifactBytes(artifact && artifact.size_bytes);
			if (sizeLabel) parts.push(sizeLabel);
			return parts.join(' · ');
		}

		function text(value, fallback = '-') {
			const normalized = String(value ?? '').trim();
			return normalized || fallback;
		}

		function normalizeText(value) {
			return String(value || '')
				.replace(/\u00e2\u0080\u0098/g, "'")
				.replace(/\u00e2\u0080\u0099/g, "'")
				.replace(/\u00e2\u0080\u009c/g, '"')
				.replace(/\u00e2\u0080\u009d/g, '"')
				.replace(/\u00e2\u0080\u0093/g, '-')
				.replace(/\u00e2\u0080\u0094/g, '-')
				.replace(/\u00e2\u0080\u00a6/g, '...')
				.replace(/\u00c2\u00a0/g, ' ')
				.replace(/\u00c2/g, '');
		}

		function escapeHtml(value) {
			return text(value, '').replace(/[&<>"']/g, (char) => ({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			}[char]));
		}

		function elapsed(ms) {
			const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
			const minutes = Math.floor(seconds / 60);
			return minutes > 0 ? minutes + 'm ' + (seconds % 60) + 's' : seconds + 's';
		}

		function setPill(element, state, label) {
			element.className = 'pill ' + state;
			element.querySelector('span:last-child').textContent = label;
		}

		function setConnection(state, label) {
			fields.connectionPill.className = 'pill connection-pill ' + state;
			fields.connectionPill.querySelector('span:last-child').textContent = label;
		}

		function markLiveEvent(label) {
			fields.lastEvent.textContent = label + ' event ' + new Date().toLocaleTimeString();
		}

		function statusClass(status) {
			const normalized = String(status || '').toLowerCase();
			if (normalized === 'completed') return 'status-completed';
			if (normalized === 'failed' || normalized === 'cancelled') return 'status-failed';
			if (normalized === 'running') return 'status-running';
			if (normalized === 'pending') return 'status-pending';
			if (normalized === 'queued' || normalized === 'expired' || normalized === 'cancelling') return 'status-queued';
			return '';
		}

		function statusText(status) {
			const normalized = String(status || 'unknown');
			return '<span class="live-status-pill ' + statusClass(normalized) + '"><span class="live-status-dot"></span>' + escapeHtml(normalized) + '</span>';
		}

		function elapsedSpan(job, live) {
			const base = Number(job.elapsed_ms || 0);
			return '<span class="elapsed" data-live-elapsed="' + (live ? 'true' : 'false') + '" data-elapsed-base="' + base + '" data-elapsed-captured="' + Date.now() + '">' + elapsed(base) + '</span>';
		}

		function shortLiveRequestId(requestId) {
			const value = String(requestId || '').trim();
			return value.length > 18 ? value.slice(0, 8) + '...' + value.slice(-6) : value;
		}

		function sessionOutputBlock(label, options = {}) {
			const live = !!options.live;
			const key = text(options.key, '');
			return '<details class="session-output-block"' + (live ? ' open' : '') + '>' +
				'<summary class="session-output-summary">' +
					'<span class="label">' + escapeHtml(label) + '</span>' +
					'<button type="button" class="copy-session-output">Copy</button>' +
				'</summary>' +
				'<pre class="session-output' + (live ? ' live-session-output' : '') + '" data-session-key="' + escapeHtml(key) + '"></pre>' +
			'</details>';
		}

		function artifactPreviewBlock(job) {
			const artifacts = Array.isArray(job.artifacts) ? job.artifacts : [];
			const previews = artifacts.map((artifact, index) => {
				const url = text(artifact && artifact.url, '');
				const mimeType = text(artifact && artifact.mime_type, '');
				if (!/^\\/v1\\/status\\/jobs\\/\\d+\\/artifacts\\/\\d+$/.test(url)) return '';
				const download = '<div class="live-artifact-actions"><a class="live-artifact-download" href="' + escapeHtml(url) + '" download>Download</a></div>';
				if (/^video\\//.test(mimeType)) return '<div class="live-artifact-card"><button type="button" class="job-artifact-preview" data-media-preview="' + escapeHtml(url) + '" data-media-mime="' + escapeHtml(mimeType) + '" title="Open generated video ' + (index + 1) + '"><video src="' + escapeHtml(url) + '" muted preload="metadata" playsinline></video><span>Open generated video ' + (index + 1) + '</span></button>' + download + '</div>';
				if (!/^image\\//.test(mimeType)) return '';
				const label = 'Open generated image ' + (index + 1);
				const meta = artifactMetaLabel(artifact);
				return '<div class="live-artifact-card"><button type="button" class="job-artifact-preview" data-media-preview="' + escapeHtml(url) + '" data-media-mime="' + escapeHtml(mimeType) + '" title="' + escapeHtml(label) + '"><img src="' + escapeHtml(url) + '" alt="Generated image preview ' + (index + 1) + '" loading="lazy"><span>' + escapeHtml(label) + (meta ? '<br><span class="job-artifact-meta">' + escapeHtml(meta) + '</span>' : '') + '</span></button>' + download + '</div>';
			}).filter(Boolean);
			return previews.length ? '<div class="job-artifacts">' + previews.join('') + '</div>' : '';
		}

		function debugLogBlocks(job, key) {
			const logs = Array.isArray(job.debug_logs) ? job.debug_logs : [];
			const blocks = [];
			logs.forEach((log, index) => {
				const suffix = logs.length > 1 ? ' ' + (index + 1) : '';
				if (log.prompt) {
					blocks.push(sessionOutputBlock('Prompt' + suffix, { key: key + ':prompt:' + index }));
				}
				if (log.output) {
					blocks.push(sessionOutputBlock('AI Response' + suffix, { key: key + ':output:' + index }));
				}
			});
			return blocks.join('');
		}

		function updateDebugLogBlocks(container, job, key) {
			const logs = Array.isArray(job.debug_logs) ? job.debug_logs : [];
			const outputs = Array.from(container.querySelectorAll('.session-output'));
			const byKey = (value) => outputs.find((output) => output.dataset.sessionKey === value);
			logs.forEach((log, index) => {
				const promptOutput = byKey(key + ':prompt:' + index);
				if (promptOutput) {
					updateSessionOutput(promptOutput, log.prompt || '');
				}
				const responseOutput = byKey(key + ':output:' + index);
				if (responseOutput) {
					updateSessionOutput(responseOutput, log.output || '');
				}
			});
		}

		function updateSessionOutput(output, nextValue) {
			const next = normalizeText(text(nextValue, ''));
			const current = output.textContent || '';
			if (next === current) {
				return;
			}
			if (next.startsWith(current)) {
				output.appendChild(document.createTextNode(next.slice(current.length)));
				return;
			}
			output.textContent = next;
		}

		function providerSessionLabel(job, label, channel) {
			if (text(job && job.provider, '') !== 'grok-cli') {
				return label;
			}
			return channel === 'input'
				? label.replace(/stdin/i, 'Grok CLI request')
				: label.replace(/Session Output/i, 'Grok CLI stdout / stderr');
		}

		function jobRequestId(job) {
			return text(job.request_id || job.id || job.short_request_id, '');
		}

		function collectUnifiedJobs(jobs) {
			const active = (Array.isArray(jobs.active) ? jobs.active : []).map((job) => ({ ...job, _bucket: 'active' }));
			const queued = (Array.isArray(jobs.queued) ? jobs.queued : []).map((job) => ({ ...job, _bucket: 'queued' }));
			const recent = (Array.isArray(jobs.recent) ? jobs.recent : []).map((job) => ({ ...job, _bucket: 'recent' }));
			const unified = [...active, ...queued, ...recent];
			unified.forEach((job) => {
				const requestId = jobRequestId(job);
				if (requestId) seenLiveRequestIds.add(requestId);
			});
			return unified;
		}

		function liveJobStatus(job) {
			return String(job && (job.status || job._bucket) || '').toLowerCase();
		}

		function liveJobMatchesFilter(job) {
			const status = liveJobStatus(job);
			if (liveFilter === 'all') return true;
			if (liveFilter === 'running') return status === 'running';
			if (liveFilter === 'queued') return status === 'queued' || status === 'pending';
			if (liveFilter === 'completed') return status === 'completed';
			if (liveFilter === 'failed') return status === 'failed' || status === 'cancelled';
			return true;
		}

		function liveJobMatchesSearch(job) {
			const query = String(liveSearchQuery || '').trim().toLowerCase();
			if (!query) return true;
			const haystack = [
				job.request_id,
				job.short_request_id,
				job.type,
				job.model,
				job.provider,
				job.provider_label,
				job.workflow,
				job.status,
			].join(' ').toLowerCase();
			return haystack.includes(query);
		}

		function pendingLiveJob(requestId) {
			const id = String(requestId || '');
			return {
				request_id: id,
				short_request_id: shortLiveRequestId(id),
				type: 'job',
				model: '',
				provider: '',
				status: seenLiveRequestIds.has(id) ? 'expired' : 'pending',
				_pending: true,
				_expired: seenLiveRequestIds.has(id),
			};
		}

		function updateLiveFilterCounts(jobs) {
			const unified = collectUnifiedJobs(jobs);
			const counts = { all: unified.length, running: 0, queued: 0, completed: 0, failed: 0 };
			unified.forEach((job) => {
				const status = liveJobStatus(job);
				if (status === 'running') counts.running += 1;
				else if (status === 'queued' || status === 'pending') counts.queued += 1;
				else if (status === 'completed') counts.completed += 1;
				else if (status === 'failed' || status === 'cancelled') counts.failed += 1;
			});
			document.querySelectorAll('[data-live-filter-count]').forEach((badge) => {
				const key = badge.getAttribute('data-live-filter-count');
				badge.textContent = String(counts[key] || 0);
			});
		}

		function liveMetaCard(label, value) {
			return '<div class="live-meta-card"><span>' + escapeHtml(label) + '</span><div>' + value + '</div></div>';
		}

		function renderLiveJobList(jobs) {
			updateLiveFilterCounts(jobs);
			const unified = collectUnifiedJobs(jobs).filter((job) => liveJobMatchesFilter(job) && liveJobMatchesSearch(job));
			if (livePinned && selectedLiveRequestId && !unified.some((job) => jobRequestId(job) === selectedLiveRequestId)) {
				const selected = findJobByRequestId(selectedLiveRequestId, jobs);
				if (selected) {
					unified.unshift(selected);
				} else if (!seenLiveRequestIds.has(selectedLiveRequestId)) {
					unified.unshift(pendingLiveJob(selectedLiveRequestId));
				}
			}
			if (!unified.length) {
				fields.liveJobList.innerHTML = '<div class="muted" style="padding:12px;">No jobs match this filter.</div>';
				return;
			}
			Array.from(fields.liveJobList.children).forEach((child) => {
				if (!child.matches('[data-live-request-id]')) {
					child.remove();
				}
			});
			const wanted = new Set();
			for (const job of unified) {
				const requestId = jobRequestId(job);
				if (!requestId) continue;
				wanted.add(requestId);
				let card = fields.liveJobList.querySelector('[data-live-request-id="' + CSS.escape(requestId) + '"]');
				if (!card) {
					card = document.createElement('button');
					card.type = 'button';
					card.className = 'live-job-card';
					card.dataset.liveRequestId = requestId;
					card.setAttribute('role', 'option');
					card.addEventListener('click', () => selectLiveJob(requestId));
				}
				const provider = text(job.provider_label || job.provider || 'Unknown');
				const status = liveJobStatus(job);
				const live = status === 'running' || status === 'queued' || status === 'pending';
				card.setAttribute('aria-selected', requestId === selectedLiveRequestId ? 'true' : 'false');
				card.innerHTML = '<div class="live-job-card-head"><span class="live-job-card-title">' + escapeHtml(text(job.short_request_id || shortLiveRequestId(requestId))) + '</span>' + statusText(status || 'pending') + '</div>' +
					'<div class="live-job-card-meta">' + (job.type ? '<span class="live-job-tag">' + escapeHtml(job.type) + '</span>' : '') +
					'<span>' + escapeHtml(text(job.model, 'Waiting for job')) + '</span></div>' +
					'<div class="live-job-card-meta"><span>' + escapeHtml(provider) + '</span><span>' + elapsedSpan(job, live) + '</span></div>';
				fields.liveJobList.appendChild(card);
			}
			Array.from(fields.liveJobList.querySelectorAll('[data-live-request-id]')).forEach((card) => {
				if (!wanted.has(card.dataset.liveRequestId)) card.remove();
			});
		}

		function renderLiveDetail(job) {
			if (!job) {
				fields.liveDetailEmpty.hidden = false;
				fields.liveDetailContent.hidden = true;
				fields.liveDetailBody.innerHTML = '';
				if (fields.liveDetailStatus) fields.liveDetailStatus.innerHTML = '';
				if (fields.liveDetailSubtitle) fields.liveDetailSubtitle.textContent = '';
				return;
			}
			const requestId = jobRequestId(job);
			const status = liveJobStatus(job);
			const live = status === 'running' || status === 'queued' || status === 'pending';
			const canCancelImage = job.type === 'images' && job.provider === 'local-image' && ['running', 'queued', 'cancelling'].includes(status);
			if (canCancelImage && fields.liveDetailCancel) {
				fields.liveDetailCancel.hidden = false;
				fields.liveDetailCancel.disabled = status === 'cancelling' || cancellingLiveImageRequests.has(requestId);
				fields.liveDetailCancel.textContent = fields.liveDetailCancel.disabled ? 'Cancelling…' : 'Cancel generation';
				fields.liveDetailCancel.dataset.requestId = requestId;
			} else if (fields.liveDetailCancel) {
				fields.liveDetailCancel.hidden = true;
				fields.liveDetailCancel.disabled = false;
				fields.liveDetailCancel.textContent = 'Cancel generation';
				fields.liveDetailCancel.dataset.requestId = '';
				if (['completed', 'failed', 'cancelled'].includes(status)) cancellingLiveImageRequests.delete(requestId);
			}
			const key = 'detail:' + requestId;
			fields.liveDetailEmpty.hidden = true;
			fields.liveDetailContent.hidden = false;
			fields.liveDetailTitle.textContent = text(job.short_request_id || shortLiveRequestId(requestId) || requestId);
			if (fields.liveDetailStatus) fields.liveDetailStatus.innerHTML = statusText(status || 'pending');
			if (fields.liveDetailSubtitle) {
				fields.liveDetailSubtitle.textContent = [job.type, job.model, job.provider_label || job.provider].filter(Boolean).join(' · ');
			}
			fields.liveDetailCopyId.dataset.copyValue = requestId;
			const skills = Array.isArray(job.skills) ? job.skills.filter(Boolean) : [];
			let blocks = '';
			if (job._pending) {
				blocks += '<div class="muted" style="margin-bottom:12px;">' + (job._expired
					? 'This job is no longer in the 15-minute live retention window.'
					: 'Waiting for this job to appear in live updates.') + '</div>';
			}
			blocks += '<div class="live-detail-meta">' +
				liveMetaCard('Request', '<code>' + escapeHtml(requestId) + '</code>') +
				liveMetaCard('Type', escapeHtml(text(job.type, '-'))) +
				liveMetaCard('Model', escapeHtml(text(job.model, '-'))) +
				liveMetaCard('Provider', '<code>' + escapeHtml(text(job.provider || 'Unknown')) + '</code>') +
				liveMetaCard('Status', statusText(status) + (job.error_message ? '<div class="muted">' + escapeHtml(job.error_message) + '</div>' : '')) +
				liveMetaCard('Workflow', escapeHtml(text(job.workflow || (live ? 'Pending' : '-'))) + (skills.length ? '<div class="muted">Skill: ' + escapeHtml(skills.join(', ')) + '</div>' : '')) +
				liveMetaCard('Elapsed', elapsedSpan(job, live)) +
				(job.finished_at ? liveMetaCard('Finished', escapeHtml(new Date(job.finished_at).toLocaleTimeString())) : '') +
				'</div>';
			blocks += artifactPreviewBlock(job);
			if (job.session_input) {
				blocks += sessionOutputBlock(providerSessionLabel(job, live ? 'Live stdin' : 'stdin', 'input'), { live, key: key + ':input' });
			}
			if (job.session_output) {
				blocks += sessionOutputBlock(providerSessionLabel(job, live ? 'Live Session Output' : 'Session Output', 'output'), { live, key: key + ':output' });
			}
			blocks += debugLogBlocks(job, key);
			const signature = JSON.stringify({
				requestId,
				status: job.status,
				error_message: job.error_message,
				finished_at: job.finished_at,
				workflow: job.workflow,
				skills: job.skills,
				pending: !!job._pending,
				expired: !!job._expired,
				artifacts: (Array.isArray(job.artifacts) ? job.artifacts : []).map((artifact) => [artifact && artifact.url, artifact && artifact.mime_type]),
				input: !!job.session_input,
				output: !!job.session_output,
				debug: Array.isArray(job.debug_logs) ? job.debug_logs.length : 0,
			});
			if (fields.liveDetailBody.dataset.detailSignature !== signature) {
				fields.liveDetailBody.dataset.detailSignature = signature;
				fields.liveDetailBody.innerHTML = blocks;
			}
			if (job.session_output) {
				const output = fields.liveDetailBody.querySelector('.session-output[data-session-key="' + key + ':output"]');
				if (output) updateSessionOutput(output, job.session_output);
			}
			if (job.session_input) {
				const input = fields.liveDetailBody.querySelector('.session-output[data-session-key="' + key + ':input"]');
				if (input) updateSessionOutput(input, job.session_input);
			}
			updateDebugLogBlocks(fields.liveDetailBody, job, key);
		}

		async function cancelLiveImageJob(button) {
			const requestId = String(button && button.dataset.requestId || '').trim();
			if (!requestId || button.disabled) return;
			button.disabled = true;
			button.textContent = 'Cancelling…';
			cancellingLiveImageRequests.add(requestId);
			try {
				const response = await fetch(liveImageCancelUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ request_id: requestId }),
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Image generation could not be cancelled.');
				if (fields.lastEvent) fields.lastEvent.textContent = 'Image cancellation requested ' + new Date().toLocaleTimeString();
			} catch (error) {
				cancellingLiveImageRequests.delete(requestId);
				button.disabled = false;
				button.textContent = 'Cancel generation';
				if (fields.lastEvent) fields.lastEvent.textContent = error.message || 'Image cancellation failed';
			}
		}

		function findJobByRequestId(requestId, jobs) {
			const source = jobs || (currentStatus && currentStatus.jobs) || {};
			return collectUnifiedJobs(source).find((job) => jobRequestId(job) === String(requestId || '')) || null;
		}

		function selectLiveJob(requestId, options = {}) {
			selectedLiveRequestId = String(requestId || '');
			livePinned = options.pin !== false && !!selectedLiveRequestId;
			if (!options.skipHash && livePinned) {
				setHash('live/' + encodeURIComponent(selectedLiveRequestId));
			}
			const jobs = currentStatus && currentStatus.jobs || {};
			renderLiveJobList(jobs);
			renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs) || (livePinned && selectedLiveRequestId ? pendingLiveJob(selectedLiveRequestId) : null));
		}

		function autoSelectLiveJob(jobs) {
			if (livePinned && selectedLiveRequestId) {
				const selected = findJobByRequestId(selectedLiveRequestId, jobs);
				renderLiveDetail(selected || (!seenLiveRequestIds.has(selectedLiveRequestId) ? pendingLiveJob(selectedLiveRequestId) : selected));
				return;
			}
			const active = Array.isArray(jobs.active) ? jobs.active : [];
			if (active.length) {
				selectedLiveRequestId = jobRequestId(active[0]);
				livePinned = false;
				renderLiveJobList(jobs);
				renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs));
				return;
			}
			const queued = Array.isArray(jobs.queued) ? jobs.queued : [];
			if (queued.length) {
				selectedLiveRequestId = jobRequestId(queued[0]);
				livePinned = false;
				renderLiveJobList(jobs);
				renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs));
				return;
			}
			const unified = collectUnifiedJobs(jobs).filter((job) => liveJobMatchesFilter(job) && liveJobMatchesSearch(job));
			if (unified.length) {
				selectedLiveRequestId = jobRequestId(unified[0]);
				livePinned = false;
				renderLiveJobList(jobs);
				renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs));
				return;
			}
			selectedLiveRequestId = '';
			renderLiveDetail(null);
		}

		function initLiveFilters() {
			document.querySelectorAll('[data-live-filter]').forEach((button) => {
				button.addEventListener('click', () => {
					liveFilter = button.getAttribute('data-live-filter') || 'all';
					document.querySelectorAll('[data-live-filter]').forEach((item) => {
						item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
					});
					const jobs = currentStatus && currentStatus.jobs || {};
					renderLiveJobList(jobs);
					if (livePinned && selectedLiveRequestId) {
						renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs) || (!seenLiveRequestIds.has(selectedLiveRequestId) ? pendingLiveJob(selectedLiveRequestId) : null));
					} else {
						autoSelectLiveJob(jobs);
					}
				});
			});
			if (fields.liveJobSearch) {
				fields.liveJobSearch.addEventListener('input', () => {
					liveSearchQuery = fields.liveJobSearch.value || '';
					const jobs = currentStatus && currentStatus.jobs || {};
					renderLiveJobList(jobs);
				});
			}
		}

		function updateTabBadges(jobs) {
			const running = Number(jobs.running_count || 0);
			const queued = Number(jobs.queued_count || 0);
			const liveCount = running + queued;
			fields.liveTabBadge.hidden = liveCount <= 0;
			fields.liveTabBadge.textContent = String(liveCount);
			fields.liveTabBadge.className = 'tab-badge' + (running > 0 ? ' warn' : '');
			const recent = Array.isArray(jobs.recent) ? jobs.recent : [];
			const failed = recent.filter((job) => String(job.status || '').toLowerCase() === 'failed').length;
			fields.debugTabBadge.hidden = failed <= 0;
			fields.debugTabBadge.textContent = String(failed);
			updateSettingsDirtyState();
		}

		function renderDebugHealth(payload, ok) {
			const jobs = payload.jobs || {};
			const bridge = payload.bridge || {};
			const paired = Array.isArray(bridge.paired_origins) ? bridge.paired_origins : [];
			const asr = payload.asr || currentCapabilities.asr || {};
			const queued = Number(jobs.queued_count || 0);
			const recent = Array.isArray(jobs.recent) ? jobs.recent : [];
			const lastFailure = recent.find((job) => String(job.status || '').toLowerCase() === 'failed');
			const checks = [
				{
					state: ok ? 'ok' : 'bad',
					title: 'Bridge reachable',
					detail: ok ? 'Local relay is responding.' : 'Bridge status request failed.',
					action: '<button type="button" data-nav-hash="overview">Overview</button>',
				},
				{
					state: payload.success ? 'ok' : 'warn',
					title: 'Codex ready',
					detail: payload.success ? 'Codex CLI is ready for jobs.' : (payload.message || 'Codex needs attention.'),
					action: '<button type="button" data-nav-hash="debug">Inspect details</button>',
				},
				{
					state: paired.length ? 'ok' : 'warn',
					title: 'Paired browser origins',
					detail: paired.length ? paired.length + ' origin(s) paired.' : 'No browser origins are paired yet.',
					action: '<button type="button" data-nav-hash="debug">View paired sites</button>',
				},
				{
					state: queued > 0 ? 'warn' : 'ok',
					title: 'Job queue',
					detail: queued > 0 ? queued + ' job(s) waiting.' : 'No queued jobs.',
					action: '<button type="button" data-nav-hash="live">Open Live</button>',
				},
				{
					state: asr.ready ? 'ok' : (asr.enabled === false ? 'warn' : 'warn'),
					title: 'Local ASR',
					detail: asr.ready ? 'Local ASR runtime is ready.' : 'Local ASR is not ready or not checked.',
					action: '<button type="button" data-nav-hash="settings/asr">ASR settings</button>',
				},
				{
					state: lastFailure ? 'bad' : 'ok',
					title: 'Recent failures',
					detail: lastFailure ? 'Latest failure: ' + text(lastFailure.error_message || lastFailure.type, 'unknown') : 'No recent failed jobs.',
					action: lastFailure ? '<button type="button" data-open-live-job="' + escapeHtml(jobRequestId(lastFailure)) + '">Inspect failure</button>' : '<button type="button" data-nav-hash="live">Open Live</button>',
				},
			];
			fields.debugHealthList.innerHTML = checks.map((check) => (
				'<div class="debug-health-item ' + check.state + '">' +
					'<div><strong>' + escapeHtml(check.title) + '</strong><div class="muted">' + escapeHtml(check.detail) + '</div></div>' +
					'<div>' + check.action + '</div>' +
				'</div>'
			)).join('');
		}

		function renderDebugFailures(jobs) {
			const recent = Array.isArray(jobs.recent) ? jobs.recent : [];
			const failed = recent.filter((job) => String(job.status || '').toLowerCase() === 'failed').slice(0, 8);
			if (!failed.length) {
				fields.debugFailureList.innerHTML = '<div class="muted">No recent failures</div>';
				return;
			}
			fields.debugFailureList.innerHTML = failed.map((job) => (
				'<div class="debug-failure-item">' +
					'<span><code>' + escapeHtml(text(job.short_request_id || jobRequestId(job))) + '</code> · ' + escapeHtml(job.type) + ' · <span class="muted">' + escapeHtml(text(job.error_message, 'Failed')) + '</span></span>' +
					'<button type="button" data-open-live-job="' + escapeHtml(jobRequestId(job)) + '">Inspect</button>' +
				'</div>'
			)).join('');
		}

		function escapeRegExp(value) {
			return String(value).replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
		}

		function applyRawStatusFilter() {
			const query = String(fields.rawStatusFilter && fields.rawStatusFilter.value || '').trim();
			const json = JSON.stringify(currentStatus, null, 2);
			if (!query) {
				fields.rawStatus.textContent = json;
				return;
			}
			const pattern = new RegExp('(' + escapeRegExp(query) + ')', 'ig');
			fields.rawStatus.innerHTML = escapeHtml(json).replace(pattern, '<mark>$1</mark>');
		}

		function updateHealthCards(payload, ok) {
			const jobs = payload.jobs || {};
			const bridge = payload.bridge || {};
			const paired = Array.isArray(bridge.paired_origins) ? bridge.paired_origins : [];
			const asr = payload.asr || currentCapabilities.asr || {};
			fields.healthBridge.textContent = ok ? 'Reachable' : 'Error';
			fields.healthCodex.textContent = payload.success ? 'Ready' : 'Needs attention';
			fields.healthJobs.textContent = 'Running ' + Number(jobs.running_count || 0) + ' / Queued ' + Number(jobs.queued_count || 0);
			fields.healthAsr.textContent = asr.ready ? 'Ready' : (asr.enabled === false ? 'Disabled' : 'Not ready');
			fields.overviewPairedCount.textContent = String(paired.length);
		}

		function renderDetails(details) {
			const rows = [
				['Binary', details.codex_binary],
				['Home', details.codex_home],
				['Auth', details.auth_path],
				['Generated Images', details.generated_images_dir],
				['Version', details.version],
				['Login', details.login_status],
			];
			return rows.map(([label, value]) => '<tr><th>' + escapeHtml(label) + '</th><td><code>' + escapeHtml(value) + '</code></td></tr>').join('');
		}

		function renderAsrDetails(asr) {
			asr = asr || {};
			const runtime = asr.runtime || {};
			const python = runtime.python || {};
			const gpu = runtime.gpu || {};
			const selected = asr.selected || {};
			const checked = runtime.checked !== false && asr.runtime_checked !== false;
			const availability = (value, yes, no) => value === null || value === undefined ? 'Not checked' : (value ? yes : no);
			const torchCuda = runtime.qwen_torch_cuda || {};
			const torchCudaText = torchCuda.available === null || torchCuda.available === undefined
				? 'Not checked'
				: (torchCuda.available ? ((torchCuda.version || 'torch') + ' / CUDA ' + (torchCuda.cuda_version || '?') + ' / devices ' + (torchCuda.device_count || 0)) : (torchCuda.reason || 'Unavailable'));
			const rows = [
				['Runtime Check', checked ? (runtime.cached ? 'Cached' : 'Checked') : 'Not checked'],
				['Ready', availability(asr.ready, 'Yes', 'No')],
				['Auto Model', asr.auto_model],
				['Selected Device', selected.device ? selected.device + ' / ' + selected.compute_type : ''],
				['Selected Provider', selected.provider || ''],
				['Selected Model Path', selected.model_path],
				['Selected Aligner Path', selected.aligner_model_path || ''],
				['Python', checked ? (python.available ? python.command + ' ' + (python.version || '') : 'Not found') : 'Not checked'],
				['Venv', runtime.venv_python],
				['faster-whisper', availability(runtime.faster_whisper_installed, 'Installed', 'Missing')],
				['Qwen Python', checked && runtime.qwen_python ? (runtime.qwen_python.available ? runtime.qwen_python.command + ' ' + (runtime.qwen_python.version || '') : 'Not found') : 'Not checked'],
				['Qwen Venv', runtime.qwen_venv_python],
				['qwen-asr', availability(runtime.qwen_asr_installed, 'Installed', 'Missing')],
				['Qwen torch CUDA', torchCudaText],
				['ffmpeg', availability(runtime.ffmpeg_available, 'Available', 'Missing')],
				['ffprobe', availability(runtime.ffprobe_available, 'Available', 'Missing')],
				['GPU', gpu.available === null || gpu.available === undefined ? 'Not checked' : (gpu.available ? gpu.name + ' (' + gpu.free_mb + ' MB free / ' + gpu.total_mb + ' MB)' : 'Unavailable')],
			];
			fields.asrDetails.innerHTML = rows.map(([label, value]) => '<tr><th>' + escapeHtml(label) + '</th><td><code>' + escapeHtml(value) + '</code></td></tr>').join('');
		}

		function featureState(value) {
			if (value === null || value === undefined) {
				return 'disabled';
			}
			return value ? 'enabled' : 'disabled';
		}

		function featureLabel(value) {
			if (value === null || value === undefined) {
				return 'Not checked';
			}
			return value ? 'Yes' : 'No';
		}

		function featurePill(name, value) {
			const state = featureState(value);
			return '<div class="feature-pill ' + state + '">' +
				'<span class="name">' + escapeHtml(name) + '</span>' +
				'<span class="state">' + featureLabel(value) + '</span>' +
			'</div>';
		}

		function renderBackendDrivers(backends) {
			const items = Array.isArray(backends) ? backends : [];
			if (!items.length) {
				fields.backendDrivers.innerHTML = '<div class="muted">No backend metadata reported</div>';
				return;
			}
			fields.backendDrivers.innerHTML = items.map((backend) => {
				const ready = backend.ready === true || (backend.configured === true && backend.enabled !== false);
				const state = ready ? 'enabled' : 'disabled';
				const label = backend.ready === true ? 'Ready' : (backend.configured === false ? 'Not configured' : (backend.enabled === false ? 'Disabled' : 'Available'));
				const name = (backend.label || backend.id || 'Backend') + (backend.kind ? ' (' + backend.kind + ')' : '');
				return '<div class="feature-pill ' + state + '">' +
					'<span class="name">' + escapeHtml(name) + '</span>' +
					'<span class="state">' + escapeHtml(label) + '</span>' +
				'</div>';
			}).join('');
		}

		function renderCapabilities(payload) {
			currentCapabilities = payload || {};
			const codex = currentCapabilities.codex || {};
			const features = currentCapabilities.features || {};
			const video = currentCapabilities.video || {};
			const mediaAnalysis = currentCapabilities.media_analysis || {};
			const musicAnalysis = currentCapabilities.music_analysis || {};
			fields.codexCliVersion.textContent = text(codex.version);
			fields.codexBinary.textContent = text(codex.binary);
			fields.detectedFeatures.innerHTML = [
				featurePill('Structured exec JSON', features.structured_exec_json),
				featurePill('Output schema', features.output_schema),
				featurePill('Image attachments', features.image_attachments),
				featurePill('Codex app server', features.app_server),
				featurePill('Local image generation', features.images),
				featurePill('Local ASR', currentCapabilities.asr && currentCapabilities.asr.enabled),
				featurePill('Local ASR ready', currentCapabilities.asr && currentCapabilities.asr.ready),
				featurePill('Media analysis route', mediaAnalysis.enabled),
				featurePill('ffmpeg frame extraction', mediaAnalysis.ffmpeg_available),
				featurePill('Local music analysis', musicAnalysis.enabled),
				featurePill('Music analysis ready', musicAnalysis.ready),
				featurePill('OpenAI video route', video.enabled),
				featurePill('Video API configured', video.configured),
			].join('');
			renderBackendDrivers(currentCapabilities.backends || []);
			renderAsrDetails(currentCapabilities.asr || {});
			currentStatus.capabilities = currentCapabilities;
			applyRawStatusFilter();
		}

		function renderRelaySettings(payload) {
			const settings = payload && payload.settings || {};
			const defaults = settings.defaults || {};
			const cliPaths = settings.cli_paths || {};
			const tokenDefaults = settings.token_defaults || {};
			const models = Array.isArray(payload && payload.models) ? payload.models : [];
			const backends = Array.isArray(payload && payload.backends) ? payload.backends : (currentCapabilities.backends || []);
			const backendById = new Map(backends.map((backend) => [backend.id, backend]));
			fields.providerSettings.innerHTML = backends.map((backend) => {
			const status = backend.ready ? 'Ready' : (backend.state === 'not_authenticated' ? 'Not authenticated' : (backend.state === 'unsupported' ? 'Unsupported CLI' : (backend.state === 'installed' ? 'Authentication unchecked' : (backend.installed === false ? 'Not installed' : 'Unavailable'))));
				const features = Object.keys(backend.features || {}).filter((key) => backend.features[key]).join(', ') || (backend.job_types || []).join(', ') || 'No supported jobs';
				const detail = backend.version || backend.command || features;
				const diagnostic = backend.diagnostic && backend.diagnostic !== 'Ready.' && backend.diagnostic !== 'Authentication not checked yet.' ? '<br><small class="muted">' + escapeHtml(backend.diagnostic) + '</small>' : '';
				const installation = backend.id === 'local-upscale'
					? '<br><small class="muted">Use Settings → Local CUDA Upscale to install an available pinned model. Jobs never download a model, downsample native output, or fall back to CPU.</small><br><small class="muted">Models: ' + (Array.isArray(backend.models) ? backend.models.map((model) => escapeHtml(String(model.label || model.id || 'model') + ' — ' + String(model.state || 'not checked'))).join(' · ') : 'not checked') + '</small>'
					: (backend.id === 'local-image'
						? '<br><small class="muted">Use Settings → Local Image to set up the Qwen-Image-2.1 Diffusers runtime. Setup Environment installs packages; Install Model downloads weights explicitly.</small><br><small class="muted">Models: ' + (Array.isArray(backend.models) ? backend.models.map((model) => escapeHtml(String(model.label || model.id || 'model') + ' — ' + String(model.state || (model.ready ? 'ready' : 'not ready')))).join(' · ') : 'not checked') + '</small>'
						: '');
				return '<div class="feature-pill ' + (backend.ready ? 'enabled' : 'disabled') + '"><span class="name"><strong>' + escapeHtml(backend.label || backend.id) + '</strong><br><small class="muted">' + escapeHtml(detail) + '</small>' + diagnostic + installation + '</span><span class="state">' + escapeHtml(status) + '</span></div>';
			}).join('') || '<div class="muted">No provider metadata reported</div>';
			const cliPathFields = [
				{ id: 'codex-cli', label: 'Codex CLI executable', placeholder: 'codex or C:\\Tools\\codex.exe' },
				{ id: 'grok-cli', label: 'Grok CLI executable', placeholder: 'grok or C:\\Tools\\grok.exe' },
				{ id: 'antigravity-cli', label: 'Antigravity CLI executable', placeholder: 'agy or C:\\Tools\\agy.exe', hint: 'Windows auto-detects %LOCALAPPDATA%\\agy\\bin\\agy.exe; enter another path here to override it.' },
				{ id: 'cursor-cli', label: 'Cursor Agent executable', placeholder: 'cursor-agent or C:\\Tools\\cursor-agent.exe' },
				{ id: 'cli-process', label: 'CLI Process executable', placeholder: 'Optional generic command path' },
			];
			fields.relayCliPaths.innerHTML = cliPathFields.map((entry) => '<label class="field"><span>' + escapeHtml(entry.label) + '</span><input type="text" autocomplete="off" spellcheck="false" data-relay-cli-path="' + escapeHtml(entry.id) + '" value="' + escapeHtml(cliPaths[entry.id] || '') + '" placeholder="' + escapeHtml(entry.placeholder) + '">' + (entry.hint ? '<small class="muted">' + escapeHtml(entry.hint) + '</small>' : '') + '</label>').join('');
			const labels = { chat: 'Chat and coding', images: 'Image generation', videos: 'Video generation', transcribe: 'Transcription', 'media.analyze': 'Media analysis', 'music.analyze': 'Music analysis' };
			fields.relayDefaultSettings.innerHTML = Object.keys(labels).map((jobType) => {
				const current = defaults[jobType] || '';
				const expectedType = (jobType === 'chat' || jobType === 'media.analyze') ? 'text' : ({ images: 'image', videos: 'video', transcribe: 'audio', 'music.analyze': 'audio' }[jobType]);
				const compatible = models.filter((model) => {
					const backend = backendById.get(model.backend);
					return model.type === expectedType && model.ready !== false && backend && backend.ready === true && Array.isArray(backend.job_types) && backend.job_types.includes(jobType) && (!Array.isArray(model.job_types) || !model.job_types.length || model.job_types.includes(jobType));
				});
				const selectedKnown = compatible.some((model) => model.id === current);
				const unavailable = current && !selectedKnown ? ['<option value="' + escapeHtml(current) + '" selected disabled>Unavailable saved selection: ' + escapeHtml(current) + '</option>'] : [];
				const options = unavailable.concat(compatible.map((model) => '<option value="' + escapeHtml(model.id) + '"' + optionAttr(model.id, current) + '>' + escapeHtml(model.id) + (model.experimental ? ' (experimental)' : '') + '</option>'));
				return '<label class="field"><span>' + labels[jobType] + '</span><select data-relay-job="' + jobType + '">' + options.join('') + '</select></label>';
			}).join('');
			const tokenFields = [
				{ jobType: 'chat', label: 'Chat token default', codeDefault: 8192 },
				{ jobType: 'media.analyze', label: 'Media analysis token default', codeDefault: 4096 },
			];
			fields.relayTokenDefaults.innerHTML = tokenFields.map((entry) => '<label class="field"><span>' + escapeHtml(entry.label) + '</span><input type="number" min="512" max="128000" step="1" inputmode="numeric" data-relay-token-default="' + escapeHtml(entry.jobType) + '" value="' + escapeHtml(tokenDefaults[entry.jobType] || '') + '" placeholder="Code default: ' + entry.codeDefault + '"><small class="muted">Leave blank to use the code default.</small></label>').join('');
			const providers = settings.providers || {};
			const xai = providers.xai || {};
			const openai = providers.openai_videos || {};
			const apiKeyChat = providers.api_key_chat || {};
			const secretHint = (secret, envName) => {
				if (secret && secret.configured) return 'Saved key ends with ' + escapeHtml(secret.suffix || '') + '. Leave blank to keep it.';
				return 'Leave blank to use ' + envName + '.';
			};
			const secretInput = (id, label, secret, envName) => '<label class="field"><span>' + escapeHtml(label) + '</span><input type="password" autocomplete="new-password" spellcheck="false" id="' + id + '" placeholder="' + (secret && secret.configured ? '••••' + escapeHtml(secret.suffix || '') : '') + '"><small class="muted">' + secretHint(secret, envName) + '</small></label><label class="checkbox-row"><input type="checkbox" id="' + id + 'Clear"><span>Clear saved key</span></label>';
			if (fields.relayProviderOptions) {
				fields.relayProviderOptions.innerHTML = [
					'<div class="label">Cloud APIs and extra CLI options</div>',
					secretInput('relayXaiApiKey', 'xAI API key', xai.api_key, 'XAI_API_KEY'),
					'<label class="field"><span>xAI base URL</span><input id="relayXaiBaseUrl" value="' + escapeHtml(xai.base_url || '') + '" placeholder="https://api.x.ai/v1" autocomplete="off" spellcheck="false"></label>',
					'<label class="field"><span>xAI chat models</span><input id="relayXaiModels" value="' + escapeHtml(xai.models || '') + '" placeholder="grok-4.6,grok-4.5,grok-4.3,latest" autocomplete="off" spellcheck="false"><small class="muted">Comma-separated native model IDs.</small></label>',
					'<label class="field"><span>OpenAI Videos</span><select id="relayOpenaiEnabled"><option value="">Use environment</option><option value="true"' + (openai.enabled === true ? ' selected' : '') + '>Enabled</option><option value="false"' + (openai.enabled === false ? ' selected' : '') + '>Disabled</option></select></label>',
					secretInput('relayOpenaiApiKey', 'OpenAI API key', openai.api_key, 'OPENAI_API_KEY'),
					secretInput('relayApiKeyChatKey', 'API-key chat key', apiKeyChat.api_key, 'AI_MODEL_RELAY_CHAT_API_KEY'),
					'<label class="field"><span>API-key chat base URL</span><input id="relayApiKeyChatBaseUrl" value="' + escapeHtml(apiKeyChat.base_url || '') + '" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false"></label>',
					'<label class="field"><span>API-key chat provider id</span><input id="relayApiKeyChatProviderId" value="' + escapeHtml(apiKeyChat.provider_id || '') + '" placeholder="api-key-chat" autocomplete="off" spellcheck="false"></label>',
					'<label class="field"><span>API-key chat model</span><input id="relayApiKeyChatModel" value="' + escapeHtml(apiKeyChat.model || '') + '" placeholder="default" autocomplete="off" spellcheck="false"></label>',
					'<label class="field"><span>CLI process extra arguments</span><input id="relayCliProcessArgs" value="' + escapeHtml((providers.cli_process && providers.cli_process.args) || '') + '" placeholder="Optional argv after the executable" autocomplete="off" spellcheck="false"></label>',
					'<label class="field"><span>Grok Imagine skill path</span><input id="relayGrokImagineSkill" value="' + escapeHtml((providers.grok && providers.grok.imagine_skill) || '') + '" placeholder="%USERPROFILE%\\.grok\\skills\\imagine\\SKILL.md" autocomplete="off" spellcheck="false"></label>',
					'<label class="field"><span>Antigravity state directory</span><input id="relayAntigravityStateDir" value="' + escapeHtml((providers.antigravity && providers.antigravity.state_dir) || '') + '" placeholder="%USERPROFILE%\\.gemini\\antigravity-cli" autocomplete="off" spellcheck="false"></label>',
				].join('');
			}
			const runtime = settings.runtime || {};
			const runtimeTimeouts = runtime.timeouts || {};
			const timeoutFields = [
				{ key: 'codex_chat_ms', label: 'Codex chat timeout (ms)', placeholder: '600000' },
				{ key: 'codex_image_ms', label: 'Codex image timeout (ms)', placeholder: '1800000' },
				{ key: 'codex_status_ms', label: 'Codex status probe timeout (ms)', placeholder: '15000' },
				{ key: 'named_cli_chat_ms', label: 'Grok/Cursor chat timeout (ms)', placeholder: '600000' },
				{ key: 'grok_media_ms', label: 'Grok Imagine timeout (ms)', placeholder: '450000' },
				{ key: 'antigravity_chat_ms', label: 'Antigravity chat timeout (ms)', placeholder: '600000' },
				{ key: 'antigravity_image_ms', label: 'Antigravity image timeout (ms)', placeholder: '1800000' },
				{ key: 'antigravity_media_ms', label: 'Antigravity media timeout (ms)', placeholder: '600000' },
				{ key: 'cli_process_ms', label: 'CLI process timeout (ms)', placeholder: '600000' },
				{ key: 'cli_probe_ms', label: 'CLI probe timeout (ms)', placeholder: '10000' },
				{ key: 'provider_fetch_ms', label: 'HTTP provider fetch timeout (ms)', placeholder: '60000' },
				{ key: 'xai_poll_timeout_ms', label: 'xAI video poll timeout (ms)', placeholder: '600000' },
				{ key: 'xai_poll_interval_ms', label: 'xAI video poll interval (ms)', placeholder: '3000' },
				{ key: 'openai_poll_timeout_ms', label: 'OpenAI Videos poll timeout (ms)', placeholder: '600000' },
				{ key: 'openai_poll_interval_ms', label: 'OpenAI Videos poll interval (ms)', placeholder: '3000' },
			];
			if (fields.relayRuntimeSettings) {
				fields.relayRuntimeSettings.innerHTML = [
					'<label class="field"><span>Listen port</span><input value="' + escapeHtml(payload && payload.listen_port || '') + '" disabled><small class="muted">Set ALORBACH_CODEX_BRIDGE_PORT before starting the tray app.</small></label>',
					'<label class="field"><span>Max concurrent jobs</span><input id="relayMaxConcurrent" type="number" min="1" max="32" step="1" inputmode="numeric" value="' + escapeHtml(runtime.max_concurrent_jobs || '') + '" placeholder="2"><small class="muted">Leave blank to use ALORBACH_CODEX_MAX_CONCURRENT_JOBS.</small></label>',
				].concat(timeoutFields.map((entry) => '<label class="field"><span>' + escapeHtml(entry.label) + '</span><input type="number" min="1" step="1" inputmode="numeric" data-relay-timeout="' + escapeHtml(entry.key) + '" value="' + escapeHtml(runtimeTimeouts[entry.key] || '') + '" placeholder="' + entry.placeholder + '"><small class="muted">Leave blank for the environment or code default.</small></label>')).join('');
			}
			if (fields.relayRuntimeMessage && fields.refreshRelayProviders && !fields.refreshRelayProviders.disabled) {
				fields.relayRuntimeMessage.textContent = 'Runtime settings loaded';
			}
			if (!document.querySelector('[data-provider-media-test][data-test-request-id]')) {
				renderProviderMediaTests(models, backends);
			}
		}

		function readyMediaModels(models, backends, jobType, type) {
			const backendById = new Map(backends.map((backend) => [backend.id, backend]));
			return models.filter((model) => {
				const backend = backendById.get(model.backend);
				return model.type === type && model.ready !== false && backend && backend.ready === true && Array.isArray(backend.job_types) && backend.job_types.includes(jobType) && (!Array.isArray(model.job_types) || !model.job_types.length || model.job_types.includes(jobType));
			});
		}

                function providerTestControls(model, jobType) {
                        const options = Array.isArray(model.test_options) ? model.test_options.filter((entry) => entry && entry.key && Array.isArray(entry.choices) && entry.choices.length) : [];
                        if (!options.length) return '';
                        const deliveryLabel = (entry) => {
                                if (entry.delivery === 'direct') return 'sent directly';
                                if (entry.delivery === 'tool-arg') return 'image_gen tool argument';
                                return 'generation guidance';
                        };
                        const deliverySummary = (entry) => {
                                if (entry.delivery === 'direct') return 'directly to the provider';
                                if (entry.delivery === 'tool-arg') return 'as an image_gen tool argument';
                                return 'as generation guidance';
                        };
                        const controls = options.map((entry) => {
                                const key = String(entry.key || '').trim();
                                const choices = entry.choices.filter((choice) => choice && choice.value !== undefined);
                                if (!key || !choices.length) return '';
                                const selected = key === 'model' ? model.id : String(choices[0].value);
                                const selectOptions = choices.map((choice) => '<option value="' + escapeHtml(choice.value) + '"' + (String(choice.value) === selected ? ' selected' : '') + '>' + escapeHtml(choice.label || choice.value) + '</option>').join('');
                                return '<label class="field"><span>' + escapeHtml(entry.label || key) + ' · ' + deliveryLabel(entry) + '</span><select data-test-option="' + escapeHtml(key) + '">' + selectOptions + '</select></label>';
                        }).filter(Boolean).join('');
                        const deliveries = Array.from(new Set(options.map((entry) => deliverySummary(entry))));
                        return controls ? '<div class="settings-grid provider-generation-options">' + controls + '</div><small class="muted">Selected values are sent ' + escapeHtml(deliveries.join(' and ')) + '.</small>' : '';
                }

                function renderProviderMediaTests(models, backends) {
			const imageTests = readyMediaModels(models, backends, 'images', 'image').map((model) => ({ model, jobType: 'images', title: 'Image generation', prompt: 'Ultrarealistic scene Cool Kungfu Cat' }));
                        const videoModels = readyMediaModels(models, backends, 'videos', 'video');
                        const renderedVideoBackends = new Set();
                        const videoTests = videoModels.filter((model) => {
                                if (model.backend !== 'openai-videos') return true;
                                if (renderedVideoBackends.has(model.backend)) return false;
                                renderedVideoBackends.add(model.backend);
                                return true;
                        }).map((model) => ({ model, jobType: 'videos', title: 'Video generation', prompt: 'Create a short, subtle cinematic motion from the supplied reference image.' }));
                        const analysisTests = readyMediaModels(models, backends, 'media.analyze', 'text').map((model) => ({ model, jobType: 'media.analyze', title: 'Video analysis', prompt: 'Summarize the visible action, text, timing, and user-facing issues in this video.' }));
                        const audioTests = [
                                ...readyMediaModels(models, backends, 'transcribe', 'audio').map((model) => ({ model, jobType: 'transcribe', title: model.backend === 'xai-api' ? 'xAI Speech-to-Text (cloud)' : 'Audio transcription', prompt: '' })),
                                ...readyMediaModels(models, backends, 'music.analyze', 'audio').map((model) => ({ model, jobType: 'music.analyze', title: 'Local music analysis', prompt: '' })),
                        ];
                        const renderCards = (items, emptyMessage) => items.length ? items.map(({ model, jobType, title, prompt }) => {
                                const isVideo = jobType === 'videos';
                                const isMediaAnalysis = jobType === 'media.analyze';
                                const isAudio = jobType === 'transcribe' || jobType === 'music.analyze';
				const reference = '<label class="field"><span>Reference image (optional)</span><input type="file" accept="image/png,image/jpeg,image/webp" data-test-reference></label>';
				const media = '<label class="field"><span>Video file (MP4, MOV, WebM, or AVI; small test file)</span><input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi" data-test-media></label>';
				const audio = '<label class="field"><span>Audio file</span><input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm" data-test-audio></label>';
				const promptField = isAudio ? '' : '<label class="field"><span>Test prompt</span><input type="text" data-test-prompt value="' + escapeHtml(prompt) + '"></label>';
				const testLabel = isAudio ? (jobType === 'transcribe' ? 'transcription' : 'music analysis') : (isMediaAnalysis ? 'video analysis' : (isVideo ? 'video' : 'image'));
				return '<article class="provider-media-test" data-provider-media-test>' +
                                        '<div class="provider-media-test-heading"><span>' + escapeHtml(title) + '</span><code>' + escapeHtml(model.id) + '</code></div>' +
                                        promptField +
                                        (isAudio ? audio : (isMediaAnalysis ? media : reference)) +
                                        providerTestControls(model, jobType) +
                                        (isMediaAnalysis && model.backend === 'antigravity-cli' ? '<small class="muted">The selected video is sent to your authenticated Antigravity CLI; it is not a local-only analysis path.</small>' : '') +
                                        ((jobType === 'images' || jobType === 'videos') && model.backend === 'xai-api' ? '<small class="muted">This request is sent to the xAI Imagine API; usage charges may apply.</small>' : '') +
					'<button type="button" data-provider-test="' + jobType + '" data-model="' + escapeHtml(model.id) + '">Run ' + testLabel + ' test</button>' +
                                        '<div class="provider-test-status"><small class="muted" data-test-message>Ready to test ' + escapeHtml(model.id) + '.</small><small class="provider-test-progress" data-test-progress aria-live="polite">Idle</small></div>' +
                                        '<div class="provider-test-activity" data-test-progress-bar role="progressbar" aria-label="Provider test activity" aria-valuetext="Idle" hidden><span></span></div>' +
                                        '<div class="provider-test-result" data-test-result></div>' +
				'</article>';
			}).join('') : '<div class="muted">' + escapeHtml(emptyMessage) + '</div>';
                        fields.providerImageTests.innerHTML = renderCards(imageTests, 'No ready image providers are available for testing.');
                        fields.providerVideoTests.innerHTML = renderCards(videoTests, 'No ready video providers are available for testing.');
                        fields.providerAnalysisTests.innerHTML = renderCards(analysisTests, 'No ready video-analysis providers are available for testing.');
                        fields.providerAudioTests.innerHTML = renderCards(audioTests, 'No ready transcription or music-analysis providers are available for testing.');
                }

		function fileAsDataUrl(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result || ''));
				reader.onerror = () => reject(new Error('The selected file could not be read.'));
				reader.readAsDataURL(file);
			});
		}

		function createProviderTestRequestId() {
			return 'status-test-ui-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
		}

		function providerTestJob(requestId) {
			const jobs = currentStatus && currentStatus.jobs || {};
			return [...(Array.isArray(jobs.active) ? jobs.active : []), ...(Array.isArray(jobs.queued) ? jobs.queued : []), ...(Array.isArray(jobs.recent) ? jobs.recent : [])]
				.find((job) => String(job && job.request_id || '') === String(requestId || '')) || null;
		}

		function setProviderTestActivity(card, active, state) {
			const activity = card && card.querySelector('[data-test-progress-bar]');
			if (!activity) return;
			activity.hidden = !active;
			activity.setAttribute('aria-valuetext', state || (active ? 'Working' : 'Idle'));
		}

		function restoreProviderTestButton(card) {
			const button = card && card.querySelector('[data-provider-test]');
			if (!button) return;
			button.disabled = false;
			button.textContent = card.dataset.testButtonLabel || button.textContent;
			delete card.dataset.testButtonLabel;
		}

		function settleProviderTestCard(card, job) {
			const message = card && card.querySelector('[data-test-message]');
			const progress = card && card.querySelector('[data-test-progress]');
			const state = String(job && job.status || '').toLowerCase();
			if (state === 'completed') {
				renderProviderTestResult(card, job);
				if (message) message.textContent = 'Completed. Click the result to preview it.';
				if (progress) progress.textContent = 'Completed · ' + elapsed(Number(job.elapsed_ms || 0));
			} else if (state === 'failed') {
				if (message) message.textContent = String(job.error_message || 'Provider test failed.');
				if (progress) progress.textContent = 'Failed · ' + elapsed(Number(job.elapsed_ms || 0));
			} else {
				return false;
			}
			setProviderTestActivity(card, false, state);
			delete card.dataset.testRequestId;
			delete card.dataset.testStartedAt;
			restoreProviderTestButton(card);
			return true;
		}

		function updateProviderTestProgress() {
			document.querySelectorAll('[data-provider-media-test][data-test-request-id]').forEach((card) => {
				const progress = card.querySelector('[data-test-progress]');
				const message = card.querySelector('[data-test-message]');
				if (!progress) return;
				const job = providerTestJob(card.dataset.testRequestId);
				const startedAt = Number(card.dataset.testStartedAt || Date.now());
				if (!job) {
					progress.textContent = 'Submitting · ' + elapsed(Math.max(0, Date.now() - startedAt));
					if (message) message.textContent = 'Submitting provider test. This card will follow the matching Live job.';
					setProviderTestActivity(card, true, 'Submitting');
					return;
				}
				const duration = Number(job.elapsed_ms || Math.max(0, Date.now() - startedAt));
				const state = String(job.status || 'running').toLowerCase();
				if (settleProviderTestCard(card, job)) return;
				const detail = String(job.session_output || '').trim().replace(/\s+/g, ' ').slice(-180);
				progress.textContent = (state === 'queued' ? 'Queued' : (state === 'running' ? 'Running' : state)) + ' · ' + elapsed(duration) + (detail ? ' · ' + detail : '');
				if (message) message.textContent = (state === 'queued' ? 'Queued' : 'Running') + '. This card is following the matching Live job.';
				if (detail) progress.title = String(job.session_output).slice(-500);
				setProviderTestActivity(card, state === 'queued' || state === 'running', state);
			});
		}

		function renderProviderTestResult(card, job) {
			const result = card && card.querySelector('[data-test-result]');
			if (!result) return;
			const artifacts = Array.isArray(job && job.artifacts) ? job.artifacts : [];
			const artifact = artifacts.find((entry) => entry && /^\\/(?:v1)\\/status\\/jobs\\/\\d+\\/artifacts\\/\\d+$/.test(String(entry.url || '')) && /^(image|video)\\//.test(String(entry.mime_type || '')));
			if (!artifact) {
				const requestId = jobRequestId(job);
				result.innerHTML = requestId
					? '<button type="button" data-open-live-job="' + escapeHtml(requestId) + '">Open completed result in Live</button>'
					: '<button type="button" data-open-live>Open completed result in Live</button>';
				return;
			}
			const url = escapeHtml(artifact.url);
			const mimeType = String(artifact.mime_type || '');
			const isVideo = /^video\\//.test(mimeType);
			const label = isVideo ? 'Open generated video' : 'Open generated image';
			const media = isVideo
				? '<video src="' + url + '" muted preload="metadata" playsinline></video>'
				: '<img src="' + url + '" alt="Generated image preview" loading="lazy">';
			result.innerHTML = '<button type="button" class="provider-test-artifact" data-media-preview="' + url + '" data-media-mime="' + escapeHtml(mimeType) + '" title="' + escapeHtml(label) + '">' + media + '<span>' + escapeHtml(label) + '</span></button>';
		}

		async function runProviderMediaTest(button) {
			const card = button.closest('[data-provider-media-test]');
			const message = card && card.querySelector('[data-test-message]');
			const progress = card && card.querySelector('[data-test-progress]');
			const result = card && card.querySelector('[data-test-result]');
			const jobType = button.dataset.providerTest;
			const prompt = card && card.querySelector('[data-test-prompt]');
			const reference = card && card.querySelector('[data-test-reference]');
			const media = card && card.querySelector('[data-test-media]');
			const audio = card && card.querySelector('[data-test-audio]');
			const original = button.textContent;
			const requestId = createProviderTestRequestId();
			let completed = false;
			let continuingTrackedJob = false;
			try {
				button.disabled = true;
				button.textContent = 'Running...';
				card.dataset.testButtonLabel = original;
				card.dataset.testRequestId = requestId;
				card.dataset.testStartedAt = String(Date.now());
				if (result) result.innerHTML = '';
				if (message) message.textContent = 'Starting provider test.';
				updateProviderTestProgress();
				if (selectTab('tab-live')) {
					selectLiveJob(requestId, { skipHash: false });
				}
				const body = { job_type: jobType, model: button.dataset.model || '', prompt: prompt ? prompt.value.trim() : '', test_request_id: requestId };
				Array.from(card.querySelectorAll('[data-test-option]')).forEach((field) => {
					const key = String(field.dataset.testOption || '').trim();
					if (!key || !field.value) return;
					if (key === 'model') body.model = field.value;
					else body[key] = field.value;
				});
				const file = reference && reference.files && reference.files[0];
				if (file) body.input_reference_data_url = await fileAsDataUrl(file);
				const mediaFile = media && media.files && media.files[0];
				if (jobType === 'media.analyze' && !mediaFile) throw new Error('Choose a small video file before running this test.');
				if (mediaFile) body.media_data_url = await fileAsDataUrl(mediaFile);
				const audioFile = audio && audio.files && audio.files[0];
				if ((jobType === 'transcribe' || jobType === 'music.analyze') && !audioFile) throw new Error('Choose an audio file before running this test.');
				if (audioFile) {
					const dataUrl = await fileAsDataUrl(audioFile);
					const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
					if (!match) throw new Error('The selected audio file is not a supported base64 upload.');
					body.audio_base64 = match[2].replace(/\s+/g, '');
					body.audio_format = audioFile.type || (audioFile.name.split('.').pop() || '');
				}
				const response = await fetch(relayTestUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.success) throw new Error(payload.message || 'Provider test failed.');
				completed = true;
			} catch (error) {
				await refresh().catch(() => {});
				const job = providerTestJob(requestId);
				const state = String(job && job.status || '').toLowerCase();
				if (job && (state === 'queued' || state === 'running')) {
					continuingTrackedJob = true;
					if (message) message.textContent = 'The test request connection ended, but the provider job is still ' + state + '. Continuing to follow it here.';
					updateProviderTestProgress();
				} else {
					if (message) message.textContent = error.message || 'Provider test failed.';
					if (progress) progress.textContent = 'Failed · ' + elapsed(Math.max(0, Date.now() - Number(card.dataset.testStartedAt || Date.now())));
					setProviderTestActivity(card, false, 'Failed');
				}
			} finally {
				await refresh().catch(() => {});
				const job = providerTestJob(requestId);
				const state = String(job && job.status || '').toLowerCase();
				if (continuingTrackedJob && job && (state === 'queued' || state === 'running')) {
					return;
				}
				if (completed && job) {
					settleProviderTestCard(card, job);
				} else if (completed && message) {
					message.textContent = 'Completed. Open Live to inspect the result.';
					if (progress) progress.textContent = 'Completed';
				}
				delete card.dataset.testRequestId;
				delete card.dataset.testStartedAt;
				setProviderTestActivity(card, false, completed ? 'Completed' : 'Failed');
				restoreProviderTestButton(card);
			}
		}

		async function loadPairingSettings() {
			try {
				const response = await fetch(pairingCodeSettingsUrl, { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Pairing settings unavailable');
				fields.persistentPairingCodeInput.value = '';
				fields.pairingCodeStatus.textContent = payload.persistent ? 'A fixed pairing code is active.' : 'Relay is using a rotating code.';
				fields.saveFixedPairingCode.disabled = payload.persistence_available !== true;
				fields.disableFixedPairingCode.disabled = payload.persistent !== true;
				fields.pairingCodeMessage.textContent = payload.persistence_available
					? 'The code is never returned to this page after saving.'
					: 'Fixed-code storage requires the AI Model Relay desktop app and available OS secure storage.';
			} catch (error) {
				fields.pairingCodeStatus.textContent = error.message || 'Pairing settings unavailable';
				fields.saveFixedPairingCode.disabled = true;
				fields.disableFixedPairingCode.disabled = true;
			}
		}

		async function saveFixedPairingCode() {
			const pairingCode = String(fields.persistentPairingCodeInput.value || '');
			if (!/^[0-9]{6}$/.test(pairingCode)) {
				fields.pairingCodeMessage.textContent = 'Enter exactly six digits.';
				return;
			}
			fields.saveFixedPairingCode.disabled = true;
			fields.pairingCodeMessage.textContent = 'Saving encrypted pairing code…';
			try {
				const response = await fetch(pairingCodeSettingsUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ pairing_code: pairingCode }),
					cache: 'no-store',
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Pairing code save failed');
				fields.persistentPairingCodeInput.value = '';
				await loadPairingSettings();
				fields.pairingCodeMessage.textContent = 'Fixed pairing code saved securely on this device.';
			} catch (error) {
				fields.pairingCodeMessage.textContent = error.message || 'Pairing code save failed';
				fields.saveFixedPairingCode.disabled = false;
			}
		}

		async function disableFixedPairingCode() {
			fields.disableFixedPairingCode.disabled = true;
			fields.pairingCodeMessage.textContent = 'Switching back to rotating codes…';
			try {
				const response = await fetch(pairingCodeSettingsUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ enabled: false }),
					cache: 'no-store',
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Fixed pairing code could not be disabled');
				await loadPairingSettings();
				fields.pairingCodeMessage.textContent = 'Relay will use a new rotating pairing code.';
			} catch (error) {
				fields.pairingCodeMessage.textContent = error.message || 'Fixed pairing code could not be disabled';
				fields.disableFixedPairingCode.disabled = false;
			}
		}

		async function loadRelaySettings() {
			try { const response = await fetch(relaySettingsUrl, { cache: 'no-store' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Routing settings unavailable'); renderRelaySettings(payload); captureFormSnapshots(['relay', 'runtime']); if (!fields.refreshRelayProviders.disabled) fields.relaySettingsMessage.textContent = 'Routing settings loaded'; } catch (error) { if (!fields.refreshRelayProviders.disabled) fields.relaySettingsMessage.textContent = error.message || 'Routing settings load failed'; }
		}

		function followProviderRefresh(refreshState) {
			if (!refreshState || !refreshState.active) return false;
			fields.refreshRelayProviders.disabled = true;
			fields.refreshRelayProviders.textContent = 'Checking…';
			fields.refreshRelayProviders.dataset.refreshId = String(refreshState.id || '');
			fields.relaySettingsMessage.textContent = 'CLI paths saved; checking providers in background…';
			clearInterval(providerRefreshPollTimer);
			providerRefreshPollTimer = setInterval(pollProviderRefresh, 1000);
			pollProviderRefresh();
			return true;
		}

		async function saveRelaySettings(options = {}) {
			const section = options.section || 'relay';
			const settings = collectRelaySettingsPayload(section);
			const otherSection = section === 'runtime' ? 'relay' : 'runtime';
			let preserved = null;
			try { preserved = collectRelaySettingsPayload(otherSection); } catch (error) {}
			try {
				const response = await fetch(relaySettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const payload = await response.json();
				if (!response.ok) throw new Error(payload.message || 'Routing settings save failed');
				renderRelaySettings(payload);
				restoreRelaySection(otherSection, preserved);
				const refreshStarted = payload.refresh_started === true && followProviderRefresh(payload.refresh);
				if (!options.quiet && !refreshStarted) {
					if (section === 'runtime') {
						if (fields.relayRuntimeMessage) fields.relayRuntimeMessage.textContent = 'Runtime settings saved';
					} else {
						fields.relaySettingsMessage.textContent = 'CLI paths, APIs, and routing saved';
					}
				}
				captureFormSnapshots([section]);
				return { success: true, payload, refreshStarted };
			} catch (error) {
				const message = error.message || 'Routing settings save failed';
				if (!options.quiet) {
					fields.relaySettingsMessage.textContent = message;
					if (fields.relayRuntimeMessage) fields.relayRuntimeMessage.textContent = message;
				}
				return { success: false, message };
			}
		}

		function renderMusicAnalysisSettings(settings) {
			currentMusicAnalysisSettings = settings || {};
			fields.musicAnalysisSettings.innerHTML = [
				'<label class="field"><span>Python path</span><input id="musicAnalysisPythonPath" value="' + escapeHtml(currentMusicAnalysisSettings.python_path || '') + '" placeholder="Auto-detect Python 3.10+"></label>',
				'<label class="field"><span>Virtual environment path</span><input id="musicAnalysisVenvPath" value="' + escapeHtml(currentMusicAnalysisSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>Analysis sample rate</span><input id="musicAnalysisSampleRate" type="number" min="8000" max="96000" value="' + escapeHtml(currentMusicAnalysisSettings.sample_rate || 22050) + '"></label>',
				'<label class="field"><span>Maximum sections</span><input id="musicAnalysisMaxSections" type="number" min="2" max="24" value="' + escapeHtml(currentMusicAnalysisSettings.max_sections || 12) + '"></label>',
				'<label class="field"><span>Analysis timeout (ms)</span><input id="musicAnalysisTimeout" type="number" min="1000" step="1000" inputmode="numeric" value="' + escapeHtml(currentMusicAnalysisSettings.timeout_ms || 1800000) + '" placeholder="1800000"><small class="muted">Leave the field at the loaded value unless you need a longer analysis job.</small></label>',
			].join('');
		}

		function serializeMusicAnalysisSettings() {
			return {
				python_path: document.getElementById('musicAnalysisPythonPath').value.trim(),
				venv_path: document.getElementById('musicAnalysisVenvPath').value.trim(),
				sample_rate: numberValue(document.getElementById('musicAnalysisSampleRate').value, 22050),
				max_sections: numberValue(document.getElementById('musicAnalysisMaxSections').value, 12),
				timeout_ms: numberValue((document.getElementById('musicAnalysisTimeout') || {}).value, currentMusicAnalysisSettings.timeout_ms || 1800000),
			};
		}

		async function loadMusicAnalysisSettings(options = {}) {
			const refreshRuntime = !!options.refreshRuntime;
			fields.musicAnalysisSettingsMessage.textContent = refreshRuntime ? 'Checking runtime' : 'Loading settings';
			try {
				const response = await fetch(musicAnalysisSettingsUrl + (refreshRuntime ? '?refresh=1' : ''), { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Music analysis settings unavailable');
				renderMusicAnalysisSettings(payload.settings || {});
				captureFormSnapshots(['music']);
				fields.musicAnalysisSettingsMessage.textContent = refreshRuntime ? 'Runtime checked' : 'Settings loaded';
			} catch (error) {
				fields.musicAnalysisSettingsMessage.textContent = error.message || 'Music analysis settings load failed';
			}
		}

		async function saveMusicAnalysisSettings() {
			const settings = serializeMusicAnalysisSettings();
			fields.musicAnalysisSettingsMessage.textContent = 'Saving';
			try {
				const response = await fetch(musicAnalysisSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Save failed');
				renderMusicAnalysisSettings(payload.settings || settings);
				fields.musicAnalysisSettingsMessage.textContent = 'Saved';
				captureFormSnapshots(['music']);
				await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.musicAnalysisSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		async function setupMusicAnalysis() {
			const original = fields.setupMusicAnalysis.textContent;
			try {
				fields.setupMusicAnalysis.disabled = true;
				fields.setupMusicAnalysis.textContent = 'Setting up...';
				fields.musicAnalysisSettingsMessage.textContent = 'Creating venv and downloading local packages...';
				const response = await fetch(musicAnalysisSetupUrl, { method: 'POST' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Music analysis setup failed');
				fields.musicAnalysisSettingsMessage.textContent = 'Local music analysis is ready';
				await Promise.all([loadMusicAnalysisSettings({ refreshRuntime: true }), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.musicAnalysisSettingsMessage.textContent = error.message || 'Music analysis setup failed';
			} finally {
				fields.setupMusicAnalysis.disabled = false;
				fields.setupMusicAnalysis.textContent = original;
			}
		}

		function renderUpscaleSettings(settings, models) {
			currentUpscaleSettings = settings || {};
			fields.upscaleSettings.innerHTML = [
				'<label class="field"><span>Python path</span><input id="upscalePythonPath" value="' + escapeHtml(currentUpscaleSettings.python_path || '') + '" placeholder="Auto-detect CUDA-capable Python"></label>',
				'<label class="field"><span>Virtual environment path</span><input id="upscaleVenvPath" value="' + escapeHtml(currentUpscaleSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>APISR virtual environment path</span><input id="upscaleApisrVenvPath" value="' + escapeHtml(currentUpscaleSettings.apisr_venv_path || '') + '" placeholder="Separate venv for APISR anime models"></label>',
				'<label class="field"><span>Job timeout (ms)</span><input id="upscaleTimeout" type="number" min="1000" step="1000" inputmode="numeric" value="' + escapeHtml(currentUpscaleSettings.timeout_ms || 1800000) + '" placeholder="1800000"></label>',
				'<label class="field"><span>Tile size</span><input id="upscaleTile" type="number" min="0" step="32" inputmode="numeric" value="' + escapeHtml(currentUpscaleSettings.tile === undefined || currentUpscaleSettings.tile === null ? 0 : currentUpscaleSettings.tile) + '" placeholder="0"><small class="muted">0 uses the model recommended tile.</small></label>',
				'<label class="field"><span>Precision</span><select id="upscalePrecision"><option value="fp16"' + (currentUpscaleSettings.precision === 'fp32' ? '' : ' selected') + '>fp16</option><option value="fp32"' + (currentUpscaleSettings.precision === 'fp32' ? ' selected' : '') + '>fp32</option></select></label>',
			].join('');
			fields.upscaleModelStates.textContent = 'Models: ' + (Array.isArray(models) && models.length ? models.map((model) => String(model.label || model.id || 'model') + ' — ' + String(model.state || 'not checked')).join(' · ') : 'not checked');
			fields.upscaleInstallActions.innerHTML = (Array.isArray(models) ? models : []).map((model) => {
				const caps = model.upscale_capabilities || {};
				const restriction = caps.academic_only ? '<small class="muted">Experimental · GPL-3.0-only · academic-only</small>' : '<small class="muted">' + escapeHtml(String(caps.model_class || 'local')) + ' · native ×' + escapeHtml(String(caps.native_scale || '?')) + '</small>';
				const acknowledgement = caps.installation_acknowledgement_required ? '<label class="field"><span><input type="checkbox" data-upscale-restricted="' + escapeHtml(String(model.id)) + '"> I acknowledge the APISR academic-only and GPL-3.0 restriction</span></label>' : '';
				const policy = caps.output_policy ? '<small class="muted">Output: ' + escapeHtml(String(caps.output_policy)) + ' · tile ' + escapeHtml(String(caps.tile && caps.tile.recommended || '?')) + ' · ' + escapeHtml(String((caps.precision || []).join('/')) || 'fp16') + '</small>' : '';
				return '<div class="field"><strong>' + escapeHtml(String(model.label || model.id)) + '</strong><br>' + restriction + '<br>' + policy + acknowledgement + '<button type="button" data-upscale-install="' + escapeHtml(String(model.id)) + '"' + (model.state === 'installed' ? ' disabled' : '') + '>Install ' + escapeHtml(String(model.label || 'model')) + '</button></div>';
			}).join('') || '<span class="muted">No local upscale models were reported.</span>';
		}

		function serializeUpscaleSettings() {
			return {
				python_path: document.getElementById('upscalePythonPath').value.trim(),
				venv_path: document.getElementById('upscaleVenvPath').value.trim(),
				apisr_venv_path: ((document.getElementById('upscaleApisrVenvPath') || {}).value || '').trim(),
				timeout_ms: numberValue((document.getElementById('upscaleTimeout') || {}).value, currentUpscaleSettings.timeout_ms || 1800000),
				tile: numberValue((document.getElementById('upscaleTile') || {}).value, currentUpscaleSettings.tile || 0),
				precision: ((document.getElementById('upscalePrecision') || {}).value || currentUpscaleSettings.precision || 'fp16'),
			};
		}

		async function loadUpscaleSettings() {
			fields.upscaleSettingsMessage.textContent = 'Loading settings';
			try {
				const response = await fetch(upscaleSettingsUrl, { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Local upscale settings unavailable');
				renderUpscaleSettings(payload.settings || {}, payload.models || []);
				captureFormSnapshots(['upscale']);
				fields.upscaleSettingsMessage.textContent = 'Settings loaded';
			} catch (error) {
				fields.upscaleSettingsMessage.textContent = error.message || 'Local upscale settings load failed';
			}
		}

		async function saveUpscaleSettings() {
			const settings = serializeUpscaleSettings();
			fields.upscaleSettingsMessage.textContent = 'Saving';
			try {
				const response = await fetch(upscaleSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Save failed');
				renderUpscaleSettings(payload.settings || settings, payload.models || []);
				fields.upscaleSettingsMessage.textContent = 'Saved';
				captureFormSnapshots(['upscale']);
				await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.upscaleSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		function showSetupLog(node, text) {
			if (!node) return;
			const value = String(text || '').trim();
			node.hidden = !value;
			node.textContent = value;
		}

		function setupFailureText(payload, fallback) {
			const details = payload && payload.details && typeof payload.details === 'object' ? payload.details : {};
			const lines = [String((payload && payload.message) || fallback || 'Setup failed')];
			if (payload && payload.code) lines.push('Code: ' + payload.code);
			['python', 'python_version', 'python_exists', 'venv_path', 'venv_python', 'index_url', 'extra_index_url', 'status', 'error', 'repo_id'].forEach((key) => {
				const value = details[key];
				if (value === undefined || value === null || value === '') return;
				const text = value && typeof value === 'object' ? (value.message || JSON.stringify(value)) : String(value);
				lines.push(key.replace(/_/g, ' ') + ': ' + text);
			});
			if (details.torch && typeof details.torch === 'object') {
				lines.push('torch: ' + JSON.stringify(details.torch));
			}
			const log = String(details.log || details.stderr || details.stdout || '').trim();
			if (log) lines.push('', log.slice(-12000));
			return lines.join(String.fromCharCode(10));
		}

		async function setupUpscale(modelId, button, acceptRestricted) {
			const original = button.textContent;
			try {
				Array.from(fields.upscaleInstallActions.querySelectorAll('[data-upscale-install]')).forEach((control) => { control.disabled = true; });
				button.textContent = 'Installing...';
				showSetupLog(fields.upscaleSetupLog, '');
				const settings = serializeUpscaleSettings();
				await fetch(upscaleSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				fields.upscaleSettingsMessage.textContent = 'Installing selected model (venv, CUDA torch, pinned checkout, verified weight)...';
				const response = await fetch(upscaleSetupUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, accept_restricted: !!acceptRestricted }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					const error = new Error(payload.message || 'Local upscale setup failed');
					error.payload = payload;
					throw error;
				}
				fields.upscaleSettingsMessage.textContent = (payload.model && payload.model.label || modelId) + ' is installed';
				showSetupLog(fields.upscaleSetupLog, payload.details && payload.details.log || '');
				await Promise.all([loadUpscaleSettings(), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.upscaleSettingsMessage.textContent = error.message || 'Local upscale setup failed';
				showSetupLog(fields.upscaleSetupLog, setupFailureText(error.payload || {}, error.message || 'Local upscale setup failed'));
			} finally {
				Array.from(fields.upscaleInstallActions.querySelectorAll('[data-upscale-install]')).forEach((control) => { control.disabled = false; });
				button.textContent = original;
			}
		}

		function renderImageSettings(settings, models, resolutionChoices) {
			currentImageSettings = settings || {};
			const precision = currentImageSettings.precision || 'bf16';
			const resolution = String(currentImageSettings.default_resolution || '1024x1024');
			const choices = Array.isArray(resolutionChoices) && resolutionChoices.length
				? resolutionChoices
				: [
					{ value: '1024x1024', label: '1K · 1:1 · 1024×1024' },
					{ value: '2048x2048', label: '2K · 1:1 · 2048×2048' },
				];
			const resolutionOptions = choices.map((choice) => {
				const value = String(choice.value || '');
				const selected = value === resolution || (resolution === '1k' && value === '1024x1024') || (resolution === '2k' && value === '2048x2048');
				return '<option value="' + escapeHtml(value) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(String(choice.label || value)) + '</option>';
			}).join('');
			fields.imageSettings.innerHTML = [
				'<label class="field"><span>Python path</span><input id="imagePythonPath" value="' + escapeHtml(currentImageSettings.python_path || '') + '" placeholder="Auto-detect Python 3.10+"></label>',
				'<label class="field"><span>Virtual environment path</span><input id="imageVenvPath" value="' + escapeHtml(currentImageSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>Precision</span><select id="imagePrecision"><option value="bf16"' + (precision === 'fp8' ? '' : ' selected') + '>BF16 (recommended with CPU offload)</option><option value="fp8"' + (precision === 'fp8' ? ' selected' : '') + '>FP8 (falls back to BF16)</option></select></label>',
				'<label class="field"><span>Default resolution</span><select id="imageDefaultResolution">' + resolutionOptions + '</select></label>',
				'<label class="field"><span>Default steps</span><input id="imageDefaultSteps" type="number" min="1" max="100" step="1" inputmode="numeric" value="' + escapeHtml(currentImageSettings.default_steps || 40) + '"></label>',
				'<label class="field"><span>True CFG scale</span><input id="imageGuidanceScale" type="number" min="0" max="20" step="0.1" inputmode="decimal" value="' + escapeHtml(currentImageSettings.guidance_scale == null ? 1 : currentImageSettings.guidance_scale) + '"><small class="muted">Qwen-Image-2.1 defaults to 1.0 (no CFG). Values &gt; 1 need a negative prompt and roughly double compute.</small></label>',
				'<label class="checkbox-row"><input type="checkbox" id="imageCpuOffload"' + checkedAttr(currentImageSettings.cpu_offload !== false) + '><span>Enable model CPU offload</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="imageVaeTiling"' + checkedAttr(currentImageSettings.vae_tiling !== false) + '><span>Enable VAE tiling</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="imageAllowModelDownloads"' + checkedAttr(currentImageSettings.allow_model_downloads === true) + '><span>Allow model downloads during setup</span></label>',
			].join('');
			fields.imageModelStates.textContent = 'Models: ' + (Array.isArray(models) && models.length ? models.map((model) => String(model.label || model.id || 'model') + ' — ' + String(model.state || 'not checked')).join(' · ') : 'not checked');
			fields.imageInstallActions.innerHTML = (Array.isArray(models) ? models : []).map((model) => (
				'<div class="field"><strong>' + escapeHtml(String(model.label || model.id)) + '</strong><br>' +
				'<small class="muted">Diffusers · ' + escapeHtml(String(model.precision || 'BF16')) + ' · ' + (Number(model.reference_images_max) === 1 ? '1 reference image' : 'up to ' + escapeHtml(String(model.reference_images_max || 10)) + ' reference images') + (model.vram_note ? ' · ' + escapeHtml(String(model.vram_note)) : '') + '</small><br>' +
				'<button type="button" data-image-install="' + escapeHtml(String(model.id)) + '">' +
				(model.state === 'installed' ? 'Repair / Reinstall Model' : 'Install Model') +
				'</button></div>'
			)).join('') || '<span class="muted">No local image models were reported.</span>';
		}

		function serializeImageSettings() {
			return {
				python_path: ((document.getElementById('imagePythonPath') || {}).value || '').trim(),
				venv_path: ((document.getElementById('imageVenvPath') || {}).value || '').trim(),
				precision: ((document.getElementById('imagePrecision') || {}).value || currentImageSettings.precision || 'bf16'),
				default_resolution: ((document.getElementById('imageDefaultResolution') || {}).value || currentImageSettings.default_resolution || '1024x1024'),
				default_steps: numberValue((document.getElementById('imageDefaultSteps') || {}).value, currentImageSettings.default_steps || 40),
				guidance_scale: numberValue((document.getElementById('imageGuidanceScale') || {}).value, currentImageSettings.guidance_scale == null ? 1 : currentImageSettings.guidance_scale),
				cpu_offload: !!(document.getElementById('imageCpuOffload') || {}).checked,
				vae_tiling: !!(document.getElementById('imageVaeTiling') || {}).checked,
				allow_model_downloads: !!(document.getElementById('imageAllowModelDownloads') || {}).checked,
			};
		}

		async function loadImageSettings() {
			fields.imageSettingsMessage.textContent = 'Loading settings';
			try {
				const response = await fetch(imageSettingsUrl, { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Local image settings unavailable');
				renderImageSettings(payload.settings || {}, payload.models || [], payload.resolution_choices || []);
				captureFormSnapshots(['image']);
				fields.imageSettingsMessage.textContent = 'Settings loaded';
			} catch (error) {
				fields.imageSettingsMessage.textContent = error.message || 'Local image settings load failed';
			}
		}

		async function saveImageSettings() {
			const settings = serializeImageSettings();
			fields.imageSettingsMessage.textContent = 'Saving';
			try {
				const response = await fetch(imageSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Save failed');
				const resolutionChoices = payload.resolution_choices || payload.capabilities?.resolution_choices || [];
				renderImageSettings(payload.settings || settings, payload.models || [], resolutionChoices);
				fields.imageSettingsMessage.textContent = 'Saved';
				captureFormSnapshots(['image']);
				await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.imageSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		async function setupImage(options = {}) {
			const button = options.button || fields.setupImageEnvironment;
			const original = button ? button.textContent : '';
			const downloadModel = options.download_model === true;
			const modelId = options.model || '';
			try {
				if (fields.setupImageEnvironment) fields.setupImageEnvironment.disabled = true;
				Array.from(fields.imageInstallActions.querySelectorAll('[data-image-install]')).forEach((control) => { control.disabled = true; });
				if (button) button.textContent = downloadModel ? 'Installing model...' : 'Setting up...';
				showSetupLog(fields.imageSetupLog, '');
				const settings = serializeImageSettings();
				await fetch(imageSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				fields.imageSettingsMessage.textContent = downloadModel
					? 'Downloading Qwen-Image-2.1 weights from Hugging Face...'
					: 'Creating venv and installing CUDA Diffusers packages...';
				const response = await fetch(imageSetupUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ model: modelId, download_model: downloadModel }),
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					const error = new Error(payload.message || 'Local image setup failed');
					error.payload = payload;
					throw error;
				}
				fields.imageSettingsMessage.textContent = downloadModel
					? ((payload.model && payload.model.label || modelId || 'Model') + ' is installed')
					: 'Local image environment is ready';
				showSetupLog(fields.imageSetupLog, payload.details && payload.details.log || '');
				await Promise.all([loadImageSettings(), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.imageSettingsMessage.textContent = error.message || 'Local image setup failed';
				showSetupLog(fields.imageSetupLog, setupFailureText(error.payload || {}, error.message || 'Local image setup failed'));
			} finally {
				if (fields.setupImageEnvironment) fields.setupImageEnvironment.disabled = false;
				Array.from(fields.imageInstallActions.querySelectorAll('[data-image-install]')).forEach((control) => { control.disabled = false; });
				if (button) button.textContent = original;
			}
		}

		function checkedAttr(value) {
			return value ? ' checked' : '';
		}

		function optionAttr(value, selected) {
			return String(value) === String(selected) ? ' selected' : '';
		}

		function numberValue(value, fallback) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : fallback;
		}

		function renderAsrSettingsJson(settings) {
			fields.asrSettingsJson.value = JSON.stringify(settings || {}, null, 2);
		}

		function renderAsrSettingsForm(settings) {
			currentAsrSettings = settings || {};
			const models = Array.isArray(currentAsrSettings.models) ? currentAsrSettings.models : [];
			const defaultModel = currentAsrSettings.default_model || '';
			const defaultModelOptions = [
				'<option value=""' + optionAttr('', defaultModel) + '>Auto</option>',
				...models.filter((model) => model && model.id && model.enabled !== false && model.provider !== 'qwen-aligner').map((model) => (
					'<option value="' + escapeHtml(model.id || '') + '"' + optionAttr(model.id || '', defaultModel) + '>' + escapeHtml(model.label || model.id || 'Model') + '</option>'
				)),
			].join('');
			fields.asrGeneralSettings.innerHTML = [
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowPackageInstall"' + checkedAttr(currentAsrSettings.allow_package_install !== false) + '><span>Install Python packages automatically</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowModelDownloads"' + checkedAttr(currentAsrSettings.allow_model_downloads === true) + '><span>Allow ASR model downloads</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowQwenCpuOffload"' + checkedAttr(currentAsrSettings.allow_qwen_cpu_offload !== false) + '><span>Allow Qwen CPU offload</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrVadFilter"' + checkedAttr(currentAsrSettings.vad_filter === true) + '><span>Use VAD filter</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrConditionPrevious"' + checkedAttr(currentAsrSettings.condition_on_previous_text !== false) + '><span>Condition on previous text</span></label>',
				'<label class="field"><span>Default model</span><select id="asrDefaultModel">' + defaultModelOptions + '</select></label>',
				'<label class="field"><span>Whisper Python path</span><input id="asrPythonPath" value="' + escapeHtml(currentAsrSettings.python_path || '') + '" placeholder="Auto-detect Python 3.10"></label>',
				'<label class="field"><span>Whisper venv path</span><input id="asrVenvPath" value="' + escapeHtml(currentAsrSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>Qwen Python path</span><input id="asrQwenPythonPath" value="' + escapeHtml(currentAsrSettings.qwen_python_path || '') + '" placeholder="Auto-detect Python 3.12"></label>',
				'<label class="field"><span>Qwen venv path</span><input id="asrQwenVenvPath" value="' + escapeHtml(currentAsrSettings.qwen_venv_path || '') + '"></label>',
				'<label class="field"><span>Qwen chunk seconds</span><input id="asrQwenChunkSeconds" type="number" min="5" max="180" value="' + escapeHtml(currentAsrSettings.qwen_chunk_seconds || 30) + '"></label>',
				'<label class="field"><span>Qwen max word seconds</span><input id="asrQwenMaxWordDurationSeconds" type="number" min="1" max="60" value="' + escapeHtml(currentAsrSettings.qwen_max_word_duration_seconds || 12) + '"></label>',
				'<label class="field"><span>CPU threads</span><input id="asrCpuThreads" type="number" min="1" max="64" value="' + escapeHtml(currentAsrSettings.cpu_threads || 4) + '"></label>',
				'<label class="field"><span>Workers</span><input id="asrNumWorkers" type="number" min="1" max="8" value="' + escapeHtml(currentAsrSettings.num_workers || 1) + '"></label>',
				'<label class="field"><span>Beam size</span><input id="asrBeamSize" type="number" min="1" max="20" value="' + escapeHtml(currentAsrSettings.beam_size || 5) + '"></label>',
				'<label class="field"><span>Best of</span><input id="asrBestOf" type="number" min="1" max="20" value="' + escapeHtml(currentAsrSettings.best_of || 5) + '"></label>',
				'<label class="field"><span>Transcribe timeout (ms)</span><input id="asrTranscribeTimeout" type="number" min="1000" step="1000" inputmode="numeric" value="' + escapeHtml(currentAsrSettings.transcribe_timeout_ms || 1800000) + '" placeholder="1800000"></label>',
				'<label class="field"><span>CUDA extra PATH</span><input id="asrCudaPaths" value="' + escapeHtml(currentAsrSettings.cuda_paths || '') + '" placeholder="Optional extra CUDA bin directories" autocomplete="off" spellcheck="false"><small class="muted">Leave blank to use ALORBACH_ASR_CUDA_PATHS.</small></label>',
				'<label class="field"><span>Qwen torch index URL</span><input id="asrQwenTorchIndexUrl" value="' + escapeHtml(currentAsrSettings.qwen_torch_index_url || '') + '" placeholder="https://download.pytorch.org/whl/cu128" autocomplete="off" spellcheck="false"><small class="muted">Leave blank to use ALORBACH_QWEN_TORCH_INDEX_URL.</small></label>',
			].join('');

			fields.asrModelSettings.innerHTML = models.map((model, index) => (
				'<div class="model-settings-card" data-model-index="' + index + '">' +
					'<div class="model-heading"><span>' + escapeHtml(model.label || model.id || 'Model') + '</span><label><input type="checkbox" data-field="enabled"' + checkedAttr(model.enabled !== false) + '> Enabled</label></div>' +
					'<label class="field"><span>Model id</span><input data-field="id" value="' + escapeHtml(model.id || '') + '"></label>' +
					'<label class="field"><span>Label</span><input data-field="label" value="' + escapeHtml(model.label || '') + '"></label>' +
					'<label class="field"><span>Provider</span><select data-field="provider">' +
						'<option value="faster-whisper"' + optionAttr('faster-whisper', model.provider || 'faster-whisper') + '>faster-whisper</option>' +
						'<option value="qwen-asr"' + optionAttr('qwen-asr', model.provider || 'faster-whisper') + '>qwen-asr</option>' +
						'<option value="qwen-aligner"' + optionAttr('qwen-aligner', model.provider || 'faster-whisper') + '>qwen-aligner</option>' +
					'</select></label>' +
					'<label class="field"><span>CPU repo id</span><input data-field="repo_id" value="' + escapeHtml(model.repo_id || '') + '"></label>' +
					'<label class="field"><span>GPU repo id</span><input data-field="gpu_repo_id" value="' + escapeHtml(model.gpu_repo_id || '') + '"></label>' +
					'<label class="field"><span>Aligner repo id</span><input data-field="aligner_repo_id" value="' + escapeHtml(model.aligner_repo_id || '') + '"></label>' +
					'<label class="field"><span>Local model path</span><input data-field="local_path" value="' + escapeHtml(model.local_path || '') + '"></label>' +
					'<label class="field"><span>Aligner local path</span><input data-field="aligner_local_path" value="' + escapeHtml(model.aligner_local_path || '') + '"></label>' +
					'<label class="field"><span>Minimum VRAM MB</span><input data-field="min_vram_mb" type="number" min="0" step="256" value="' + escapeHtml(model.min_vram_mb || 0) + '"></label>' +
					'<label class="field"><span>Preferred device</span><select data-field="preferred_device">' +
						'<option value="auto"' + optionAttr('auto', model.preferred_device || 'auto') + '>Auto</option>' +
						'<option value="cpu"' + optionAttr('cpu', model.preferred_device || 'auto') + '>CPU</option>' +
						'<option value="cuda"' + optionAttr('cuda', model.preferred_device || 'auto') + '>CUDA</option>' +
					'</select></label>' +
					'<div class="settings-actions"><button type="button" data-install-asr-model="' + escapeHtml(model.id || '') + '">Install model</button></div>' +
				'</div>'
			)).join('');
			renderAsrSettingsJson(currentAsrSettings);
		}

		function serializeAsrSettingsForm() {
			const modelCards = Array.from(fields.asrModelSettings.querySelectorAll('.model-settings-card'));
			return {
				allow_package_install: !!document.getElementById('asrAllowPackageInstall').checked,
				allow_model_downloads: !!document.getElementById('asrAllowModelDownloads').checked,
				allow_qwen_cpu_offload: !!document.getElementById('asrAllowQwenCpuOffload').checked,
				default_model: document.getElementById('asrDefaultModel').value.trim(),
				python_path: document.getElementById('asrPythonPath').value.trim(),
				venv_path: document.getElementById('asrVenvPath').value.trim(),
				qwen_python_path: document.getElementById('asrQwenPythonPath').value.trim(),
				qwen_venv_path: document.getElementById('asrQwenVenvPath').value.trim(),
				qwen_chunk_seconds: numberValue(document.getElementById('asrQwenChunkSeconds').value, 30),
				qwen_max_word_duration_seconds: numberValue(document.getElementById('asrQwenMaxWordDurationSeconds').value, 12),
				cpu_threads: numberValue(document.getElementById('asrCpuThreads').value, 4),
				num_workers: numberValue(document.getElementById('asrNumWorkers').value, 1),
				beam_size: numberValue(document.getElementById('asrBeamSize').value, 5),
				best_of: numberValue(document.getElementById('asrBestOf').value, 5),
				vad_filter: !!document.getElementById('asrVadFilter').checked,
				condition_on_previous_text: !!document.getElementById('asrConditionPrevious').checked,
				transcribe_timeout_ms: numberValue((document.getElementById('asrTranscribeTimeout') || {}).value, currentAsrSettings.transcribe_timeout_ms || 1800000),
				cuda_paths: ((document.getElementById('asrCudaPaths') || {}).value || '').trim(),
				qwen_torch_index_url: ((document.getElementById('asrQwenTorchIndexUrl') || {}).value || '').trim(),
				models: modelCards.map((card) => ({
					id: (card.querySelector('[data-field="id"]') || {}).value || '',
					label: (card.querySelector('[data-field="label"]') || {}).value || '',
					provider: (card.querySelector('[data-field="provider"]') || {}).value || 'faster-whisper',
					repo_id: (card.querySelector('[data-field="repo_id"]') || {}).value || '',
					gpu_repo_id: (card.querySelector('[data-field="gpu_repo_id"]') || {}).value || '',
					aligner_repo_id: (card.querySelector('[data-field="aligner_repo_id"]') || {}).value || '',
					local_path: (card.querySelector('[data-field="local_path"]') || {}).value || '',
					aligner_local_path: (card.querySelector('[data-field="aligner_local_path"]') || {}).value || '',
					min_vram_mb: numberValue((card.querySelector('[data-field="min_vram_mb"]') || {}).value, 0),
					enabled: !!(card.querySelector('[data-field="enabled"]') || {}).checked,
					preferred_device: (card.querySelector('[data-field="preferred_device"]') || {}).value || 'auto',
				})),
			};
		}

		async function loadAsrSettings(options = {}) {
			const refreshRuntime = !!options.refreshRuntime;
			fields.asrSettingsMessage.textContent = refreshRuntime ? 'Checking runtime' : 'Loading settings';
			try {
				const response = await fetch(asrSettingsUrl + (refreshRuntime ? '?refresh=1' : ''), { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					throw new Error(payload.message || 'Settings unavailable');
				}
				renderAsrSettingsForm(payload.settings || {});
				captureFormSnapshots(['asr']);
				fields.asrSettingsMessage.textContent = refreshRuntime ? 'Runtime checked' : 'Settings loaded';
				if (payload.capabilities) {
					renderAsrDetails(payload.capabilities);
				}
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Settings load failed';
			}
		}

		async function persistAsrSettings() {
			const settings = serializeAsrSettingsForm();
			renderAsrSettingsJson(settings);
			const response = await fetch(asrSettingsUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ settings }),
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.message || 'Save failed');
			}
			return payload;
		}

		async function saveAsrSettings() {
			fields.asrSettingsMessage.textContent = 'Saving';
			try {
				const payload = await persistAsrSettings();
				renderAsrSettingsForm(payload.settings || serializeAsrSettingsForm());
				fields.asrSettingsMessage.textContent = 'Saved';
				captureFormSnapshots(['asr']);
				if (payload.capabilities) {
					renderAsrDetails(payload.capabilities);
				}
				refresh();
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		async function setupAsrModel(button) {
			const card = button.closest('.model-settings-card');
			const modelId = String((card && card.querySelector('[data-field="id"]') || {}).value || button.getAttribute('data-install-asr-model') || '').trim();
			const original = button.textContent;
			const installButtons = Array.from(fields.asrModelSettings.querySelectorAll('[data-install-asr-model]'));
			try {
				installButtons.forEach((item) => { item.disabled = true; });
				button.textContent = 'Installing...';
				showSetupLog(fields.asrSetupLog, '');
				fields.asrSettingsMessage.textContent = 'Saving settings, then installing ' + (modelId || 'model') + '...';
				await persistAsrSettings();
				const response = await fetch(asrSetupUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_id: modelId }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					const error = new Error(payload.message || 'Local ASR setup failed');
					error.payload = payload;
					throw error;
				}
				fields.asrSettingsMessage.textContent = (payload.label || modelId) + ' is installed';
				showSetupLog(fields.asrSetupLog, payload.details && payload.details.log || '');
				await Promise.all([loadAsrSettings({ refreshRuntime: true }), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Local ASR setup failed';
				showSetupLog(fields.asrSetupLog, setupFailureText(error.payload || {}, error.message || 'Local ASR setup failed'));
			} finally {
				Array.from(fields.asrModelSettings.querySelectorAll('[data-install-asr-model]')).forEach((item) => { item.disabled = false; });
				if (button.isConnected) button.textContent = original;
			}
		}

		function markAsrSettingsDirty() {
			try {
				renderAsrSettingsJson(serializeAsrSettingsForm());
				fields.asrSettingsMessage.textContent = 'Unsaved changes';
			} catch (error) {
				fields.asrSettingsMessage.textContent = 'Settings need review';
			}
			updateSettingsDirtyState();
		}

		function applyAsrSettingsJson() {
			try {
				const settings = JSON.parse(fields.asrSettingsJson.value || '{}');
				renderAsrSettingsForm(settings);
				fields.asrSettingsMessage.textContent = 'JSON applied - save to persist';
				updateSettingsDirtyState();
			} catch (error) {
				fields.asrSettingsMessage.textContent = 'Invalid JSON';
			}
		}

		function addAsrModel() {
			const settings = serializeAsrSettingsForm();
			settings.models.push({
				id: 'custom-whisper-model',
				label: 'Custom Whisper Model',
				provider: 'faster-whisper',
				repo_id: '',
				gpu_repo_id: '',
				aligner_repo_id: '',
				local_path: '',
				aligner_local_path: '',
				min_vram_mb: 0,
				enabled: true,
				preferred_device: 'auto',
			});
			renderAsrSettingsForm(settings);
			fields.asrSettingsMessage.textContent = 'Model added - edit and save';
			updateSettingsDirtyState();
		}

		function captureSessionOutputScrolls() {
			const states = new Map();
			document.querySelectorAll('.session-output[data-session-key]').forEach((output) => {
				const maxScrollTop = Math.max(0, output.scrollHeight - output.clientHeight);
				states.set(output.dataset.sessionKey, {
					atBottom: maxScrollTop - output.scrollTop <= 8,
					scrollTop: output.scrollTop,
				});
			});
			return states;
		}

		function restoreSessionOutputScrolls(scrollStates) {
			document.querySelectorAll('.session-output[data-session-key]').forEach((output) => {
				const state = scrollStates.get(output.dataset.sessionKey);
				const maxScrollTop = Math.max(0, output.scrollHeight - output.clientHeight);
				if (state) {
					output.scrollTop = output.classList.contains('live-session-output') && state.atBottom
						? maxScrollTop
						: Math.min(state.scrollTop, maxScrollTop);
					return;
				}
				if (output.classList.contains('live-session-output')) {
					output.scrollTop = maxScrollTop;
				}
			});
		}

		function queueRestoreSessionOutputScrolls(scrollStates) {
			const restore = () => restoreSessionOutputScrolls(scrollStates);
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(restore);
				return;
			}
			setTimeout(restore, 0);
		}

		async function copyToClipboard(value) {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(value);
				return;
			}
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			textarea.remove();
		}

		function closeImageLightbox() {
			fields.imageLightbox.hidden = true;
			fields.mediaLightboxVideo.pause();
			fields.mediaLightboxVideo.hidden = true;
			fields.mediaLightboxVideo.removeAttribute('src');
			fields.imageLightboxContent.removeAttribute('src');
			fields.imageLightboxContent.hidden = true;
		}

		function openImageLightbox(url) {
			openMediaLightbox(url, 'image/png');
		}

		function openMediaLightbox(url, mimeType) {
			const video = /^video\\//i.test(String(mimeType || ''));
			fields.imageLightboxContent.hidden = video;
			fields.mediaLightboxVideo.hidden = !video;
			if (video) {
				fields.imageLightboxContent.removeAttribute('src');
				fields.mediaLightboxVideo.src = url;
			} else {
				fields.mediaLightboxVideo.pause();
				fields.mediaLightboxVideo.removeAttribute('src');
				fields.imageLightboxContent.src = url;
			}
			fields.imageLightbox.hidden = false;
			fields.closeImageLightbox.focus();
		}

		document.addEventListener('click', async (event) => {
			const cancelLiveImage = event.target.closest('#liveDetailCancel');
			if (cancelLiveImage) {
				event.preventDefault();
				await cancelLiveImageJob(cancelLiveImage);
				return;
			}
			const providerTest = event.target.closest('[data-provider-test]');
			if (providerTest) {
				event.preventDefault();
				await runProviderMediaTest(providerTest);
				return;
			}
			const mediaPreview = event.target.closest('[data-media-preview]');
			if (mediaPreview) {
				event.preventDefault();
				openMediaLightbox(mediaPreview.dataset.mediaPreview, mediaPreview.dataset.mediaMime);
				return;
			}
			const imagePreview = event.target.closest('[data-image-preview]');
			if (imagePreview) {
				event.preventDefault();
				openImageLightbox(imagePreview.dataset.imagePreview);
				return;
			}
			const openLive = event.target.closest('[data-open-live]');
			if (openLive) {
				event.preventDefault();
				if (!selectTab('tab-live')) {
					return;
				}
				const card = openLive.closest('[data-provider-media-test]');
				const requestId = card && card.dataset.testRequestId;
				if (requestId) selectLiveJob(requestId);
				return;
			}
			const openLiveJob = event.target.closest('[data-open-live-job]');
			if (openLiveJob) {
				event.preventDefault();
				if (!selectTab('tab-live')) {
					return;
				}
				selectLiveJob(openLiveJob.getAttribute('data-open-live-job') || '');
				return;
			}
			const navHash = event.target.closest('[data-nav-hash]');
			if (navHash) {
				event.preventDefault();
				const target = navHash.getAttribute('data-nav-hash') || 'overview';
				if (target.startsWith('settings/')) {
					ensureSettingsLoaded();
					if (!selectSettingsSection(target.split('/')[1] || 'providers')) {
						return;
					}
					selectTab('tab-settings');
					return;
				}
				setHash(target);
				applyRouteFromHash();
				return;
			}
			if (event.target === fields.closeImageLightbox || event.target === fields.imageLightbox) {
				closeImageLightbox();
				return;
			}
			const copyValue = event.target.closest('.copy-value');
			if (copyValue) {
				const original = copyValue.textContent;
				try {
					await copyToClipboard(copyValue.dataset.copyValue || original || '');
					copyValue.textContent = 'Copied';
				} catch (error) {
					copyValue.textContent = 'Copy failed';
				}
				setTimeout(() => {
					copyValue.textContent = original;
				}, 1800);
				return;
			}
			const button = event.target.closest('.copy-session-output');
			if (!button) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const block = button.closest('.session-output-block');
			const output = button === fields.copyRawStatus ? fields.rawStatus : (block ? block.querySelector('.session-output') : null);
			if (!output) {
				return;
			}
			const original = button.textContent;
			try {
				await copyToClipboard(output.textContent || '');
				button.textContent = 'Copied';
			} catch (error) {
				button.textContent = 'Copy failed';
			}
			setTimeout(() => {
				button.textContent = original;
			}, 1800);
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && !fields.imageLightbox.hidden) closeImageLightbox();
		});

		function renderJobs(jobs) {
			const scrollStates = captureSessionOutputScrolls();
			currentStatus.jobs = jobs;
			fields.jobCounts.textContent = 'Running ' + Number(jobs.running_count || 0) + ' / Queued ' + Number(jobs.queued_count || 0);
			fields.maxConcurrent.textContent = text(jobs.max_concurrent);
			renderLiveJobList(jobs);
			if (livePinned && selectedLiveRequestId) {
				renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs) || (!seenLiveRequestIds.has(selectedLiveRequestId) ? pendingLiveJob(selectedLiveRequestId) : null));
			} else {
				autoSelectLiveJob(jobs);
			}
			updateProviderTestProgress();
			updateTabBadges(jobs);
			renderDebugFailures(jobs);
			applyRawStatusFilter();
			fields.updated.textContent = 'Live updates on - updated ' + new Date().toLocaleTimeString();
			queueRestoreSessionOutputScrolls(scrollStates);
		}

		function tickElapsedCells() {
			document.querySelectorAll('.elapsed[data-live-elapsed="true"]').forEach((cell) => {
				const base = Number(cell.dataset.elapsedBase || 0);
				const captured = Number(cell.dataset.elapsedCaptured || Date.now());
				cell.textContent = elapsed(base + Math.max(0, Date.now() - captured));
			});
			updateProviderTestProgress();
			if (selectedLiveRequestId) {
				const job = findJobByRequestId(selectedLiveRequestId);
				if (job) {
					const status = String(job.status || '').toLowerCase();
					if (status === 'running' || status === 'queued' || status === 'pending') {
						renderLiveDetail(job);
					}
				} else if (livePinned && !seenLiveRequestIds.has(selectedLiveRequestId)) {
					renderLiveDetail(pendingLiveJob(selectedLiveRequestId));
				}
			}
		}

		function renderStatus(payload, ok) {
			currentStatus = payload;
			if (Object.keys(currentCapabilities).length) {
				currentStatus.capabilities = currentCapabilities;
			}
			const jobs = payload.jobs || {};
			const bridge = payload.bridge || {};
			const details = payload.details || {};
			const paired = Array.isArray(bridge.paired_origins) ? bridge.paired_origins : [];
			setPill(fields.bridgePill, ok ? 'ok' : 'bad', ok ? 'Reachable' : 'Error');
			setPill(fields.codexPill, payload.success ? 'ok' : 'warn', payload.success ? 'Ready' : 'Needs attention');
			fields.version.textContent = text(bridge.version);
			fields.pairedSites.innerHTML = paired.length ? paired.map((origin) => '<code>' + escapeHtml(origin) + '</code>').join(' ') : '<span class="muted">None</span>';
			fields.codexDetails.innerHTML = renderDetails(details);
			renderAsrDetails(payload.asr || currentCapabilities.asr || {});
			updateHealthCards(payload, ok);
			renderDebugHealth(payload, ok);
			if (!Object.keys(currentCapabilities).length) {
				fields.codexCliVersion.textContent = text(details.version);
				fields.codexBinary.textContent = text(details.codex_binary);
				fields.detectedFeatures.innerHTML = '<div class="muted">Loading detected features</div>';
				fields.backendDrivers.innerHTML = '<div class="muted">Loading backend drivers</div>';
			}
			renderJobs(jobs);
			updateProviderRefreshState(payload.refresh);
		}

		function updateProviderRefreshState(refreshState) {
			if (!settingsLoaded || !refreshState) return;
			const expectedId = Number(fields.refreshRelayProviders.dataset.refreshId || 0);
			if (expectedId && Number(refreshState.id || 0) !== expectedId) return;
			if (refreshState.active) {
				fields.refreshRelayProviders.disabled = true;
				fields.refreshRelayProviders.textContent = 'Checking…';
				fields.relaySettingsMessage.textContent = 'Checking providers in background…';
				return;
			}
			if (!expectedId) return;
			clearInterval(providerRefreshPollTimer);
			providerRefreshPollTimer = null;
			fields.refreshRelayProviders.disabled = false;
			fields.refreshRelayProviders.textContent = 'Refresh detection';
			delete fields.refreshRelayProviders.dataset.refreshId;
			if (refreshState.error) {
				fields.relaySettingsMessage.textContent = 'Detection refresh failed: ' + refreshState.error;
				return;
			}
			fields.relaySettingsMessage.textContent = 'Detection refreshed ' + new Date(refreshState.completed_at || Date.now()).toLocaleTimeString();
			loadRelaySettings();
		}

		function pollProviderRefresh() {
			refresh().catch(() => {});
		}

		async function refreshProviderDetection() {
			if (fields.refreshRelayProviders.disabled) return;
			fields.refreshRelayProviders.disabled = true;
			fields.refreshRelayProviders.textContent = 'Checking…';
			fields.relaySettingsMessage.textContent = 'Saving executable paths…';
			try {
				const saved = await saveRelaySettings({ quiet: true });
				if (!saved.success) throw new Error(saved.message || 'CLI path settings could not be saved');
				if (saved.refreshStarted) return;
				fields.relaySettingsMessage.textContent = 'Starting provider detection…';
				const response = await fetch('/v1/relay/refresh', { method: 'POST' });
				const payload = await response.json();
				if (!response.ok) throw new Error(payload.message || 'Detection refresh could not be started');
				const refreshState = payload.refresh || {};
				fields.refreshRelayProviders.dataset.refreshId = String(refreshState.id || '');
				fields.relaySettingsMessage.textContent = 'Checking providers in background…';
				clearInterval(providerRefreshPollTimer);
				providerRefreshPollTimer = setInterval(pollProviderRefresh, 1000);
				pollProviderRefresh();
			} catch (error) {
				fields.refreshRelayProviders.disabled = false;
				fields.refreshRelayProviders.textContent = 'Refresh detection';
				fields.relaySettingsMessage.textContent = 'Detection refresh failed: ' + (error.message || 'unknown error');
			}
		}

		async function refresh() {
			try {
				const [response, capabilitiesResponse] = await Promise.all([
					fetch(statusUrl, { cache: 'no-store' }),
					fetch(capabilitiesUrl, { cache: 'no-store' }).catch(() => null),
				]);
				const payload = await response.json();
				renderStatus(payload, response.ok);
				if (capabilitiesResponse && capabilitiesResponse.ok) {
					renderCapabilities(await capabilitiesResponse.json());
				}
				fields.updated.textContent = 'Polled - updated ' + new Date().toLocaleTimeString();
			} catch (error) {
				renderStatus({ success: false, message: error.message, jobs: {} }, false);
			}
		}

		function startFallbackPolling() {
			if (fallbackPollTimer) {
				return;
			}
			setConnection('warn', 'Polling fallback');
			fields.updated.textContent = 'Live updates unavailable - polling';
			refresh();
			fallbackPollTimer = setInterval(refresh, 5000);
		}

		function connectJobEvents() {
			if (!window.EventSource) {
				startFallbackPolling();
				return;
			}
			jobEvents = new EventSource(jobEventsUrl);
			jobEvents.addEventListener('open', () => {
				setConnection('ok', 'Connected');
				fields.updated.textContent = 'Live updates connected';
			});
			jobEvents.addEventListener('status', (event) => {
				try {
					markLiveEvent('Status');
					const payload = JSON.parse(event.data || '{}');
					renderStatus(payload, payload.success !== false);
				} catch (error) {}
			});
			jobEvents.addEventListener('capabilities', (event) => {
				try {
					markLiveEvent('Capabilities');
					renderCapabilities(JSON.parse(event.data || '{}'));
					if (settingsLoaded) loadRelaySettings();
				} catch (error) {}
			});
			jobEvents.addEventListener('jobs', (event) => {
				try {
					markLiveEvent('Jobs');
					renderJobs(JSON.parse(event.data || '{}'));
				} catch (error) {}
			});
			jobEvents.addEventListener('heartbeat', () => {
				markLiveEvent('Heartbeat');
			});
			jobEvents.onerror = () => {
				setConnection('warn', 'Reconnecting');
				if (jobEvents) {
					jobEvents.close();
					jobEvents = null;
				}
				startFallbackPolling();
			};
		}

		initTabs();
		initSettingsNav();
		initLiveFilters();
		initProviderTestTabs();
		setInterval(tickElapsedCells, 1000);
		fields.rawStatusFilter.addEventListener('input', applyRawStatusFilter);
		fields.relaySettingsForm.addEventListener('input', () => {
			fields.relaySettingsMessage.textContent = 'Unsaved changes';
			updateSettingsDirtyState();
		});
		fields.relaySettingsForm.addEventListener('change', updateSettingsDirtyState);
		fields.musicAnalysisSettingsForm.addEventListener('input', () => {
			fields.musicAnalysisSettingsMessage.textContent = 'Unsaved changes';
			updateSettingsDirtyState();
		});
		fields.musicAnalysisSettingsForm.addEventListener('change', updateSettingsDirtyState);
		fields.upscaleSettingsForm.addEventListener('input', () => {
			fields.upscaleSettingsMessage.textContent = 'Unsaved changes';
			updateSettingsDirtyState();
		});
		fields.upscaleSettingsForm.addEventListener('change', updateSettingsDirtyState);
		fields.imageSettingsForm.addEventListener('input', () => {
			fields.imageSettingsMessage.textContent = 'Unsaved changes';
			updateSettingsDirtyState();
		});
		fields.imageSettingsForm.addEventListener('change', updateSettingsDirtyState);
		fields.asrSettingsForm.addEventListener('submit', (event) => {
			event.preventDefault();
			saveAsrSettings();
		});
		fields.asrSettingsForm.addEventListener('input', (event) => {
			if (event.target === fields.asrSettingsJson) {
				fields.asrSettingsMessage.textContent = 'JSON edited - apply or reload';
				return;
			}
			markAsrSettingsDirty();
		});
		fields.asrSettingsForm.addEventListener('change', (event) => {
			if (event.target !== fields.asrSettingsJson) {
				markAsrSettingsDirty();
			}
		});
		fields.reloadAsrSettings.addEventListener('click', loadAsrSettings);
		fields.refreshAsrRuntime.addEventListener('click', () => loadAsrSettings({ refreshRuntime: true }));
		fields.saveAsrSettings.addEventListener('click', saveAsrSettings);
		fields.applyAsrSettingsJson.addEventListener('click', applyAsrSettingsJson);
		fields.addAsrModel.addEventListener('click', addAsrModel);
		fields.asrSettingsForm.addEventListener('click', (event) => {
			const button = event.target.closest('[data-install-asr-model]');
			if (!button || !fields.asrSettingsForm.contains(button)) return;
			event.preventDefault();
			setupAsrModel(button);
		});
		fields.musicAnalysisSettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveMusicAnalysisSettings(); });
		fields.reloadMusicAnalysisSettings.addEventListener('click', loadMusicAnalysisSettings);
		fields.refreshMusicAnalysisRuntime.addEventListener('click', () => loadMusicAnalysisSettings({ refreshRuntime: true }));
		fields.saveMusicAnalysisSettings.addEventListener('click', saveMusicAnalysisSettings);
		fields.setupMusicAnalysis.addEventListener('click', setupMusicAnalysis);
		fields.upscaleSettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveUpscaleSettings(); });
		fields.reloadUpscaleSettings.addEventListener('click', loadUpscaleSettings);
		fields.saveUpscaleSettings.addEventListener('click', saveUpscaleSettings);
		fields.upscaleInstallActions.addEventListener('click', (event) => {
			const button = event.target.closest('[data-upscale-install]');
			if (!button) return;
			const modelId = button.getAttribute('data-upscale-install');
			const restricted = fields.upscaleInstallActions.querySelector('[data-upscale-restricted="' + CSS.escape(modelId) + '"]');
			if (restricted && !restricted.checked) {
				fields.upscaleSettingsMessage.textContent = 'Confirm the APISR academic-only and GPL-3.0 restriction before installation.';
				return;
			}
			setupUpscale(modelId, button, !!(restricted && restricted.checked));
		});
		fields.imageSettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveImageSettings(); });
		fields.reloadImageSettings.addEventListener('click', loadImageSettings);
		fields.saveImageSettings.addEventListener('click', saveImageSettings);
		fields.setupImageEnvironment.addEventListener('click', () => setupImage({ button: fields.setupImageEnvironment, download_model: false }));
		fields.imageInstallActions.addEventListener('click', (event) => {
			const button = event.target.closest('[data-image-install]');
			if (!button) return;
			setupImage({ button, model: button.getAttribute('data-image-install'), download_model: true });
		});
		fields.persistentPairingCodeForm.addEventListener('submit', (event) => {
			event.preventDefault();
			saveFixedPairingCode();
		});
		fields.disableFixedPairingCode.addEventListener('click', disableFixedPairingCode);
		fields.relaySettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveRelaySettings(); });
		fields.saveRelaySettings.addEventListener('click', saveRelaySettings);
		if (fields.relayRuntimeSettings) {
			fields.relayRuntimeSettings.addEventListener('input', () => {
				if (fields.relayRuntimeMessage) fields.relayRuntimeMessage.textContent = 'Unsaved changes';
				fields.relaySettingsMessage.textContent = 'Unsaved changes';
				updateSettingsDirtyState();
			});
			fields.relayRuntimeSettings.addEventListener('change', updateSettingsDirtyState);
		}
		if (fields.saveRelayRuntimeSettings) fields.saveRelayRuntimeSettings.addEventListener('click', () => saveRelaySettings({ section: 'runtime' }));
		fields.refreshRelayProviders.addEventListener('click', refreshProviderDetection);
		refresh().then(connectJobEvents).catch(() => {
			startFallbackPolling();
		});
	</script>
</body>
</html>`;
}

module.exports = {
	statusPageHtml,
};
