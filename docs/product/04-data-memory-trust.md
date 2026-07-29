# Fikra AI Data, Memory, and Trust Principles

Status: Approved
Decision date: 2026-07-30
Target release: v1

## Customer Ownership

Customers retain ownership of:

- Their uploaded files
- Their project data
- Their conversations
- Their brand materials
- Their saved outputs and project artifacts

Using Fikra AI does not transfer ownership of customer content to Fikra AI.

## Limited Permission Granted to Fikra AI

Customers grant Fikra AI a limited, non-exclusive permission to process, store, copy, transform, and transmit their content only as reasonably necessary to:

- Provide the requested product capabilities
- Run AI agents and coordinated workflows
- Generate, validate, repair, and save outputs
- Maintain project memory and version history
- Provide technical and customer support
- Protect the platform from fraud, abuse, and security threats
- Diagnose failures and improve service reliability
- Improve Fikra AI under the rules defined in this document

This permission does not allow Fikra AI to:

- Sell customer files or project content
- Publicly publish customer work without permission
- Use a customer brand or project as a marketing case study without permission
- Grant unrelated third parties the right to use customer content outside providing the Fikra AI service

## Product Improvement Data

Fikra AI may use aggregated, operational, and de-identified signals to improve the product.

Examples include:

- Agent success and failure rates
- Execution duration and infrastructure cost
- Regeneration frequency
- Feature and studio usage
- Validation and repair outcomes
- User ratings and product feedback
- Whether an output was accepted, edited, or rejected
- Technical errors and performance measurements
- Aggregated usage patterns that do not identify a customer or project

These signals may be used to improve:

- Prompts
- Agent workflows
- Validation rules
- Reliability policies
- User experience
- Fikra Credit allocation
- Cost and performance efficiency

## Contribution of Customer Content

Raw customer conversations, files, brand materials, business ideas, and private project content must not be placed into a training or evaluation dataset merely because the customer uses Fikra AI.

Using identifiable or project-specific customer content for broader product improvement requires a separate and clear contribution choice.

The contribution controls should allow customers to choose participation at an appropriate level, such as:

- The entire account
- A specific project
- A specific conversation or output
- A manually submitted correction or feedback item

Customers must be able to withdraw future participation.

Withdrawal does not require Fikra AI to reverse improvements already produced from previously processed, de-identified, or aggregated information where reversal is not technically practical.

## Contribution Incentives

Fikra AI may reward useful voluntary contributions with benefits such as additional Fikra Credits.

A reward must not make unclear what the customer is agreeing to share.

The contribution request must explain:

- What information may be used
- The purpose of using it
- Whether identifying details will be removed
- How participation can be changed or withdrawn

## v1 Improvement Strategy

Fikra AI v1 will not depend on directly training a proprietary model on unreviewed raw customer files.

Approved contributions should initially support activities such as:

- Prompt improvement
- Agent evaluation
- Failure analysis
- Human-reviewed benchmark creation
- Validation-rule improvement
- Curated and quality-controlled datasets

A future decision to train or fine-tune a proprietary model must receive a separate technical, privacy, security, and legal review.

## Project Brand Memory

Each project has an independent Brand Memory.

Information must not automatically move from one project to another.

Sharing identity information or memory between projects belonging to the same customer requires an explicit customer action.

Important memory entries should retain, where practical:

- Their source
- Their creation date
- Their latest update date
- Their approval or confidence status

Customers should be able to:

- Review memory entries
- Correct inaccurate entries
- Remove entries
- Approve proposed entries
- Control cross-project sharing

Agents must use approved project memory without silently replacing confirmed customer decisions.

## Privacy by Default

Projects, files, conversations, and generated artifacts are private by default.

Access must be limited to:

- Authorized account users
- Authorized team members
- Fikra AI systems required to provide the service
- Approved service providers operating under defined responsibilities
- Authorized support or security personnel when necessary

Public sharing requires an intentional customer action.

## Export and Deletion

Customers should be able to:

- Export their completed work
- Download project artifacts
- Request export of supported project data
- Delete an individual project
- Request account deletion

Detailed retention, recovery-window, backup-deletion, and final-erasure periods will be defined after architectural and legal review.

Fikra AI must not claim immediate deletion from every backup or system unless that behavior is technically implemented and verified.

## Data Residency

Fikra AI must not claim that customer data is hosted inside Saudi Arabia, Jordan, or another specific jurisdiction unless that hosting arrangement is actually implemented and verified.

Future regional hosting or residency options may be introduced as the product expands and requirements become clear.

## AI Providers

AI requests must pass through Fikra AI's server-side provider and orchestration layers rather than being sent directly from the browser.

Fikra AI should send each provider only the information reasonably necessary to complete the requested operation.

Prompts must not contain:

- Payment-card data
- Authentication secrets
- Service-role credentials
- API keys
- Unrelated private project information

Provider-specific behavior must remain behind provider adapters so Fikra AI can change or add AI providers without rebuilding the core product.

Provider use must respect the selected project's permissions, memory boundaries, and market context.

## AI Transparency

Customers should be informed when content or recommendations are generated or materially transformed by artificial intelligence.

The interface should distinguish, where relevant:

- Customer-provided information
- Confirmed project memory
- AI-generated proposals
- Human-reviewed outputs
- Final customer-approved decisions

## Accuracy and Human Review

Fikra AI outputs are professional proposals and decision-support materials that remain subject to customer review.

Fikra AI must not present AI-generated outputs as guaranteed:

- Legal advice
- Financial advice
- Medical advice
- Regulatory approval
- Market success
- Factual certainty when reliable verification is unavailable

High-risk decisions should be reviewed by an appropriately qualified human professional.

Fikra AI should preserve sources, assumptions, uncertainty, and validation results where they are material to the customer's decision.

## Trust Principle

Fikra AI should improve from customer participation without treating private customer work as unrestricted company property.

Product improvement must preserve:

- Customer ownership
- Purpose-limited processing
- Clear permissions
- Project-memory isolation
- Security boundaries
- Meaningful customer control
- Transparency about AI generation
- Responsible human review
