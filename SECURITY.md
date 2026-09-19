# Security Policy

SpeakEasy ASD handles sensitive child speech-practice data. Please report security issues privately and do not open public GitHub issues for vulnerabilities.

## Reporting A Vulnerability

Email the repository owner/team directly, or contact the project maintainers through the final-year project coordination channel. Include:

- Affected area: frontend, backend, Android, deployment, model artifact, or documentation
- Steps to reproduce
- Impact and whether any data exposure is suspected
- Suggested mitigation, if known

## Secret Handling

- Do not commit `.env` files, API keys, database URLs, JWT secrets, service-account files, or raw child audio.
- Rotate any key that appears in chat, screenshots, logs, commits, or issue descriptions.
- Keep optional service credentials such as OpenAI, Cloudinary, SMTP, WhatsApp, Azure Speech, and MongoDB Atlas only in deployment environment variables.

## Supported Security Controls

The current application includes JWT-based sessions, HttpOnly cookie support, production configuration validation, trusted-host checks, CORS allowlists, upload limits, rate limits, consent records, result whitelisting, and CSV export guarding.

## Clinical Boundary

This project is an assistive speech-practice and progress-tracking tool. It is not a diagnostic product, medical device, or replacement for a licensed speech-language pathologist.
