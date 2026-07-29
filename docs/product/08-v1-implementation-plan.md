# Fikra AI v1 Implementation Plan

Status: Approved implementation plan
Decision date: 2026-07-30
Target release: v1
Source PRD: 07-v1-product-requirements.md

## 1. Purpose

This document converts the approved Fikra AI v1 Product Requirements Document into an ordered engineering delivery plan.

The implementation must extend the existing AI foundation rather than replace it.

The plan prioritizes:

1. Security and tenant isolation
2. Durable execution
3. Product-domain foundations
4. One coherent end-to-end customer journey
5. Shared decisions and Brand Memory
6. Adaptive studios
7. Fikra Credits
8. Arabic-first quality
9. Operational and release hardening

## 2. Current Engineering Foundation

The repository already contains a substantial AI execution foundation.

Existing capabilities include:

- CEO Orchestrator
- Dynamic agent selection
- Agent dependency graphs
- Agent SDK
- Agent registry
- Provider adapters
- OpenAI provider integration
- Mock provider
- Structured output contracts
- Structural validation
- Semantic validation
- Output repair
- Retry classification
- Retry execution
- Workflow state machine
- Pause and resume
- User-input checkpoints
- Artifact persistence
- Workflow-run persistence
- Task persistence
- Attempt persistence
- Provider and token usage capture
- In-memory repositories
- Supabase repositories
- Project-context normalization
- Business-vertical classification
- Project scoring
- Automated AI reliability tests

These capabilities must be reused.

## 3. Existing Product Prototype

The current application provides an early product prototype with:

- Landing-page components
- A six-step project-creation wizard
- Project creation API
- Project start API
- Project status API
- Project history API
- Workflow resume API
- Processing screen
- Demo workspace
- Business Plan display
- Market Research display
- Financial Model display
- Project Score display
- Basic capability recommendations

This prototype proves technical integration but does not yet implement the approved v1 product experience.

## 4. Critical Findings

### 4.1 Authentication Is Not Enforced

Supabase browser and server clients exist, but authentication is not enforced in the project APIs.

The session-refresh helper exists but is described as waiting to be wired into application middleware.

Current project routes do not visibly require an authenticated user.

### 4.2 Projects Are Not Tenant-Scoped

The current project model does not contain:

- User ownership
- Organization ownership
- Membership
- Project role
- Created-by user
- Updated-by user

Project repositories expose global operations such as:

- Get project by ID
- List projects
- Update project by ID

These operations do not currently require tenant context.

### 4.3 Row-Level Security Is Missing

The current database migrations create workflow tables and indexes but do not define:

- Row-level security enablement
- Project ownership policies
- Organization membership policies
- Artifact-access policies
- Workflow-access policies

This must be resolved before real customer data is stored.

### 4.4 Administrative Database Access Is Overused

Production persistence currently uses a Supabase service-role client.

The service role bypasses normal row-level security and therefore must not be the general authorization mechanism for user-facing requests.

Administrative access should be limited to narrowly defined trusted operations.

### 4.5 Project History Is Global

The current history service lists recent projects without a visible user or organization filter.

This is acceptable only for local prototype data and must not remain in a multi-user environment.

### 4.6 Workflow Execution Is Process-Local

The current project-start route begins execution through a background promise.

The current implementation also uses an in-process set to prevent duplicate project runs.

This approach is not sufficient for distributed or serverless production because:

- The request process may terminate
- Another server instance does not share the set
- Deployments can interrupt execution
- Duplicate starts cannot be prevented globally
- Recovery depends on the original process remaining available

A durable job-execution boundary is required.

### 4.7 Persistence Can Fall Back to Memory

When Supabase persistence is not explicitly selected or configured, the application uses in-memory repositories.

This is useful for tests and local development but production must fail safely rather than silently store customer work in temporary memory.

### 4.8 Completion Is Coupled to Three Artifacts

The existing workflow considers execution successful only after finding:

- BusinessPlan
- MarketResearchReport
- FinancialModel

The approved v1 experience requires flexible workflows selected according to project stage and customer needs.

Workflow success must be evaluated against the selected workflow contract rather than a fixed set of three artifacts.

### 4.9 Project Metadata Is Overloaded

Important project information is currently stored in a general metadata JSON object.

This is appropriate for early prototyping but not sufficient for:

- Approved decisions
- Brand Memory
- Market Profiles
- Sources
- Audit history
- Permissions
- Product analytics
- Data export
- Reliable querying

Stable product concepts require typed tables and contracts.

### 4.10 AI Artifacts and Product Artifacts Are Not Separated

The current artifact store tracks validated AI outputs.

The product additionally needs customer-facing artifact behavior:

- Draft
- Needs Review
- Approved
- Superseded
- Archived
- Version history
- Approval identity
- Approval time
- Restoration
- Customer edits

AI execution artifacts should remain available as technical records.

Product artifacts should provide the customer-facing lifecycle above them.

### 4.11 The Current Interface Is a Demo

Current routes and copy still include demo-oriented behavior:

- `/workspace/demo`
- Fixed Business Plan sections
- Fixed Market Research sections
- Fixed Financial Model sections
- English-only primary flow
- Free-text country input
- Saudi-specific budget choices
- Long form-style onboarding
- No entry-path selection
- No lifecycle navigation
- No decisions screen
- No Brand Memory screen
- No studio routes
- No credit balance
- No approval experience

### 4.12 Encoding Defects Exist

Some existing source strings contain damaged punctuation encoding.

Examples include malformed representations of:

- En dashes
- Em dashes
- Middle dots

Encoding quality must be included in Arabic and English interface testing.

### 4.13 Commercial Infrastructure Is Missing

The current code records token usage on AI attempts but does not yet provide:

- Subscription plans
- Entitlements
- Fikra Credit balances
- Credit reservations
- Credit ledger
- Credit settlement
- Credit refunds
- Usage thresholds
- Additional-credit purchases
- Billing approval records

The existing token and cost metadata should feed the future credit system.

## 5. Architecture Principles

### 5.1 Extend the Existing AI Foundation

Do not build a second orchestrator, provider manager, retry engine, validation system, or artifact persistence system.

New agents and studios must use the existing Agent SDK and shared execution foundation.

### 5.2 Separate Product Domain From AI Runtime

The product domain should represent:

- Customers
- Organizations
- Projects
- Profiles
- Decisions
- Memory
- Sources
- Product artifacts
- Approvals
- Credits
- Subscriptions

The AI runtime should represent:

- Workflows
- Tasks
- Attempts
- Checkpoints
- Provider calls
- Technical artifacts
- Validation results

The layers should integrate through explicit contracts.

### 5.3 Authorize Before Access

Every customer-facing read or write must establish:

1. Authenticated user
2. Organization context
3. Project membership
4. Required role or permission
5. Target resource ownership

Knowing a project ID must never be enough to access a project.

### 5.4 Use Defense in Depth

Authorization must exist in:

- Route or server-action guards
- Service-layer checks
- Repository scoping
- Database row-level security

The service role must not replace these controls.

### 5.5 Make Workflows Durable

Starting a workflow must create a durable execution command.

The system must support:

- Idempotent start
- Durable claim or lock
- Retry
- Pause
- Resume
- Cancellation where safe
- Recovery after process interruption
- Status polling or event delivery
- Duplicate prevention
- Execution audit history

### 5.6 Preserve Current Testability

Repository interfaces should continue to provide in-memory implementations for deterministic tests.

Production implementations must enforce the same contracts with Supabase and tenant scoping.

### 5.7 Build Vertical Slices

Each milestone should deliver a usable end-to-end path rather than creating many disconnected partial systems.

The first complete slice should prove:

- Authentication
- Project creation
- Tenant isolation
- Progressive onboarding
- AI proposal
- Customer approval
- Brand Memory update
- Product artifact
- Version history
- Next recommended action

## 6. Target Product Data Model

The detailed schema will be finalized during implementation, but v1 requires the following product concepts.

### Identity and Tenancy

- User Profile
- Organization
- Organization Membership
- Project Membership
- Role
- Permission

### Project Foundation

- Project
- Project Profile
- Market Profile
- Industry Template
- Lifecycle Stage
- Project Objective
- Project Source

### Decisions and Memory

- Decision
- Decision Version
- Decision Approval
- Brand Memory Entry
- Memory Source Reference
- Memory Status
- Superseded Relationship

### Product Artifacts

- Product Artifact
- Product Artifact Version
- Artifact Approval
- Artifact Comment
- Artifact Source Reference
- Artifact Status

### AI Runtime

Existing concepts remain:

- Workflow Run
- Workflow Task
- Attempt
- Workflow Checkpoint
- AI Artifact

Runtime records must become tenant-scoped through their project relationship.

### Commercial

- Subscription
- Plan Entitlement
- Credit Account
- Credit Ledger Entry
- Credit Reservation
- Usage Event
- Billing Approval

### Operations

- Activity Event
- Analytics Event
- Security Event
- Export Request
- Deletion Request

## 7. Delivery Milestones

## Milestone 0: Baseline and Decision Closure

Purpose:

Prepare the repository for safe product implementation.

Deliverables:

- Confirm production execution environment
- Select durable job-execution approach
- Define tenant and organization ownership model
- Define migration strategy for prototype projects
- Define production persistence fail-closed behavior
- Document environment requirements
- Resolve duplicate metadata migration handling
- Correct known encoding defects
- Align documented Node version requirements

Exit criteria:

- No unresolved architecture blocker prevents authentication or durable workflows
- Existing test suite remains green
- Production does not silently select memory persistence

## Milestone 1: Authentication and Tenant Isolation

Purpose:

Ensure every real project belongs to authorized users.

Deliverables:

- Supabase authentication flow
- Root middleware session refresh
- Sign-in and sign-out
- User Profile
- Organization
- Organization Membership
- Project ownership
- Owner, Editor, and Viewer roles
- Route authorization helpers
- Service-layer authorization context
- Tenant-scoped repository methods
- RLS policies for all customer-linked tables
- Migration for existing prototype records
- Unauthorized-access tests
- Cross-tenant isolation tests

Required behavior:

- Unauthenticated project APIs return an authorization response
- Users can list only authorized projects
- Users cannot access another tenant's project by guessing an ID
- Service-role usage is limited and documented

Exit criteria:

- Project isolation is verified at route, service, repository, and database levels

## Milestone 2: Durable Workflow Execution

Purpose:

Make AI workflows safe for production deployment.

Deliverables:

- Durable execution-command model
- Job-runner adapter interface
- Idempotency keys
- Database-backed execution claim or lock
- Duplicate-start protection
- Heartbeat or lease strategy where required
- Durable retry scheduling
- Recovery of interrupted work
- Safe cancellation contract
- Integration with existing pause and resume checkpoints
- Execution status API
- Job-runner integration tests

Required changes:

- Remove dependence on process-local `runningProjects`
- Remove fire-and-forget execution from request handlers
- Preserve CEO Orchestrator, state machine, retry engine, and checkpoints

Exit criteria:

- A workflow can survive request completion and process interruption
- Repeated start requests do not create duplicate execution

## Milestone 3: Product Domain Foundation

Purpose:

Create typed product concepts required by the PRD.

Deliverables:

- Project Profile
- Market Profile
- Lifecycle Stage
- Entry Path
- Industry Template
- Source
- Decision
- Decision Version
- Approval
- Brand Memory Entry
- Activity Event
- Repository contracts
- In-memory implementations
- Supabase implementations
- Database migrations
- RLS policies
- Domain validation schemas
- Repository contract tests

Migration principle:

Existing metadata may temporarily feed the new structures, but approved product behavior must not rely permanently on unstructured JSON.

Exit criteria:

- Typed project context can be created, read, updated, exported, and authorized

## Milestone 4: Progressive Onboarding

Purpose:

Replace the fixed prototype wizard with the approved adaptive onboarding experience.

Deliverables:

- Entry-path selection:
  - New Idea
  - Existing Business
  - Client Work
- Industry-template selection
- Saudi Arabia and Jordan market profiles
- Arabic and English interface support
- RTL layout
- Independent interface and output languages
- Progressive questions
- Skip and return behavior
- Server-persisted draft
- Existing-asset intake
- Context-completeness status
- First recommended action
- Onboarding analytics events

The onboarding flow must not require every available field before project creation.

Exit criteria:

- A user can create and resume a project in Arabic or English
- Saudi and Jordanian projects receive correct market and currency context

## Milestone 5: Project Home and Lifecycle

Purpose:

Create the primary operating screen for each project.

Deliverables:

- Real project route
- Remove dependency on `/workspace/demo`
- Lifecycle navigation:
  - Discover
  - Decide
  - Build
  - Launch
  - Grow
- Current lifecycle stage
- Project completion
- Missing information
- Items awaiting review
- Conflicts and risks
- Recent activity
- Up to three next best actions
- Workflow state
- Credit summary placeholder
- Accessible loading, empty, failure, and pause states

Exit criteria:

- The user can understand the project state and next action without reading raw workflow output

## Milestone 6: Decisions and Brand Memory

Purpose:

Turn AI recommendations into controlled, reusable project knowledge.

Deliverables:

- AI Proposal creation
- Customer Input classification
- Imported Source classification
- Approved Decision
- Superseded Decision
- Decision approval
- Decision rejection
- Decision replacement
- Brand Memory proposal
- Brand Memory approval
- Brand Memory correction
- Brand Memory removal
- Source and timestamp display
- Conflict detection
- Conflict-resolution workflow
- Agent context builder using approved memory only

Required rule:

AI proposals must never silently become approved project facts.

Exit criteria:

- An approved decision is reused by a second workflow
- A conflicting proposal produces an explicit warning and approval choice

## Milestone 7: Product Artifact Lifecycle

Purpose:

Provide customer-facing artifacts and versions above technical AI artifacts.

Deliverables:

- Product Artifact
- Artifact Version
- Draft status
- Needs Review status
- Approved status
- Superseded status
- Archived status
- Customer manual edits
- Restore previous version
- Approval identity and time
- Source AI artifact relationship
- Product-artifact access control
- Version and approval tests

Exit criteria:

- Regeneration does not destroy previous work
- The approved version is always identifiable

## Milestone 8: AI Chat and Adaptive Orchestration

Purpose:

Connect conversational project guidance to the existing CEO Orchestrator.

Deliverables:

- Project-aware AI Chat
- Conversation and Message persistence
- Approved-memory context injection
- Market context injection
- Lifecycle context injection
- User-permission context
- Source references
- Missing-input questions
- Workflow-start commands
- Pause and resume interface
- Adaptive workflow contracts
- Workflow-specific completion requirements
- Consolidated result presentation

Required change:

Remove fixed completion dependence on BusinessPlan, MarketResearchReport, and FinancialModel.

Each workflow must declare its own required outputs.

Exit criteria:

- AI Chat can propose and run an appropriate workflow without bypassing decisions or permissions

## Milestone 9: Brand Foundation Vertical Slice

Purpose:

Deliver the first complete customer-value workflow.

Deliverables:

- Project summary
- Target audience proposal
- Value proposition proposal
- Positioning proposal
- Brand personality proposal
- Tone-of-voice proposal
- Approval workflow
- Brand Memory persistence
- Basic Brand Studio interface
- First-session completion experience
- Three recommended next actions

Exit criteria:

A new user can:

1. Create a project
2. Complete essential context
3. Receive a meaningful proposal
4. Approve a decision
5. Store it in Brand Memory
6. Produce a useful brand artifact
7. See the next recommended actions

## Milestone 10: Social Content Studio

Purpose:

Deliver the primary recurring-use capability.

Deliverables:

- Content-strategy artifact
- Weekly calendar
- Monthly calendar
- Post ideas
- Story ideas
- Reel ideas
- Arabic captions
- English captions
- Headlines
- Calls to action
- Short scripts
- Creative briefs
- Content repurposing
- Review and approval
- Version history
- Brand consistency validation
- Market occasion configuration
- Recurring-use analytics

Exit criteria:

- Social outputs use approved audience, tone, positioning, and terminology
- Customers can return and produce a new calendar without rebuilding project context

## Milestone 11: Logo and Visual Brand Studios

Purpose:

Add approved visual-direction workflows without compromising consistency.

Deliverables:

- Structured logo brief
- Visual-direction proposals
- Logo concept generation adapter
- Concept comparison
- Feedback and regeneration
- Direction approval
- Color-palette direction
- Typography direction
- Visual-identity guidance
- Versioning
- Credit estimation
- Export behavior selected from the open PRD decision

Exit criteria:

- Generated concepts trace back to approved Brand Memory
- Repeated generations preserve earlier versions

## Milestone 12: Menu, Packaging, and Basic Website Studios

Purpose:

Complete the approved v1 execution studios.

### Menu Studio

- Menu structure
- Categories
- Item naming
- Item descriptions
- Brand tone
- Pricing presentation
- Review
- Approval
- Versioning

### Packaging Studio

- Packaging brief
- Content hierarchy
- Front-panel content
- Back-panel structure
- Product naming
- Messaging hierarchy
- Visual direction
- Review
- Approval
- Versioning

### Basic Website Studio

- Sitemap
- Page priorities
- Homepage content
- About content
- Service or product content
- Calls to action
- Visual direction
- Reviewable artifact
- Selected publishing or export model

Exit criteria:

- Each studio uses the same approved project foundation
- Compliance-sensitive statements display appropriate review requirements

## Milestone 13: Fikra Credits and Subscriptions

Purpose:

Make AI usage understandable and commercially sustainable.

Deliverables:

- Plan definitions
- Subscription state
- Plan entitlements
- Credit Account
- Append-only Credit Ledger
- Credit estimation
- Credit reservation before work
- Actual usage settlement
- Refund or release rules
- Failed-workflow handling
- 70-percent notification
- 90-percent notification
- 100-percent limit
- Additional-credit purchase approval
- Subscription upgrade flow
- Billing provider adapter
- Usage and cost observability
- Customer-visible history

Required rule:

Exhausted credits must not remove access to saved projects, manual editing, or exports.

Exit criteria:

- Credit accounting reconciles with recorded AI usage
- No additional charge occurs without explicit approval

## Milestone 14: Arabic-First and Market Quality

Purpose:

Verify that Arabic and both launch markets are first-class product experiences.

Deliverables:

- Complete RTL audit
- Arabic copy review
- English copy review
- Mixed-direction text testing
- Arabic typography testing
- Saudi market terminology
- Jordanian market terminology
- SAR presentation
- JOD presentation
- Date and number localization
- Currency-sensitive budget options
- Encoding regression tests
- Removal of malformed punctuation
- Interface-language switching
- Output-language switching

Exit criteria:

- Core journeys work equivalently in Arabic and English
- Neither Saudi Arabia nor Jordan receives reduced capabilities

## Milestone 15: Privacy, Export, and Deletion

Purpose:

Implement the customer-control claims in the PRD.

Deliverables:

- Supported project export
- Artifact download
- Account data-export request
- Project deletion
- Account-deletion request
- Recovery-window behavior
- Retention configuration
- Backup-deletion documentation
- Contribution settings
- Project-specific contribution choices
- Withdrawal of future participation
- Audit events
- Privacy tests

Exit criteria:

- Product behavior matches every public privacy and deletion claim

## Milestone 16: Release Hardening

Purpose:

Prepare v1 for controlled production launch.

Deliverables:

- Security review
- Threat model
- Authorization test suite
- RLS verification
- Dependency review
- Abuse and rate limits
- Upload validation
- Prompt-data minimization
- Secret scanning
- Operational dashboards
- Error monitoring
- Cost monitoring
- Workflow monitoring
- Backup and recovery tests
- Accessibility review
- Performance review
- Arabic and English acceptance tests
- Saudi and Jordan template acceptance
- Incident runbook
- Support runbook
- Release checklist

Exit criteria:

All PRD release gates are demonstrably satisfied.

## 8. Recommended Pull Request Sequence

Each Pull Request must remain focused and independently reviewable.

### PR 1: Production Baseline

- Production persistence fail-closed behavior
- Environment validation
- Encoding repairs
- Documentation alignment
- Duplicate migration review

### PR 2: Authentication Foundation

- Middleware
- Sign-in
- Sign-out
- Authenticated server helpers
- Protected route foundation

### PR 3: Organizations, Memberships, and RLS

- Organization schema
- Membership schema
- Project ownership
- Owner, Editor, Viewer
- RLS policies
- Tenant-isolation tests

### PR 4: Tenant-Scoped Persistence

- Authorization context
- Repository contract changes
- Scoped reads and writes
- Removal of global project history
- Service-role restrictions

### PR 5: Durable Job Execution

- Job adapter
- Idempotent start
- Distributed execution claim
- Recovery
- Existing checkpoint integration

### PR 6: Product Domain Schema

- Project Profile
- Market Profile
- Templates
- Sources
- Decisions
- Brand Memory
- Activity events

### PR 7: Progressive Onboarding

- Entry paths
- Draft persistence
- Market profiles
- Arabic and English
- RTL
- Template-aware questions

### PR 8: Project Home

- Lifecycle
- Status
- Missing context
- Risks
- Activity
- Three next actions

### PR 9: Decisions and Brand Memory

- Proposal
- Approval
- Rejection
- Supersession
- Memory integration
- Conflict handling

### PR 10: Product Artifact Lifecycle

- Product artifacts
- Versions
- Review
- Approval
- Restore
- Archive

### PR 11: AI Chat Integration

- Conversations
- Project context
- Commands
- Pause and resume
- Adaptive completion contracts

### PR 12: Brand Foundation Slice

- First complete customer journey
- First approved decision
- First useful artifact
- First-session success

### PR 13: Social Content Studio

- Strategy
- Calendar
- Content outputs
- Recurring workflow

### PR 14: Logo and Brand Studio

- Logo brief
- Concepts
- Visual direction
- Brand documentation

### PR 15: Menu Studio

- Menu content workflow
- Review
- Versioning

### PR 16: Packaging Studio

- Packaging content workflow
- Review
- Versioning

### PR 17: Basic Website Studio

- Sitemap
- Content
- Visual direction
- Selected delivery model

### PR 18: Fikra Credits

- Ledger
- Reservation
- Settlement
- Limits
- Thresholds

### PR 19: Subscriptions and Billing

- Plans
- Entitlements
- Purchases
- Upgrades
- Explicit billing approval

### PR 20: Privacy and Customer Controls

- Export
- Deletion
- Contribution choices
- Retention behavior

### PR 21: Arabic and Market Acceptance

- RTL
- Localization
- SAR
- JOD
- Saudi and Jordan acceptance tests

### PR 22: Launch Hardening

- Security
- Accessibility
- Observability
- Operations
- Release gates

The sequence may be split further when a PR becomes too large.

Security, tenancy, and durable-execution work must not be combined with unrelated studio development.

## 9. Testing Strategy

Every milestone should include tests at the lowest useful level.

### Unit Tests

Required for:

- Domain rules
- Permission rules
- Credit calculations
- Status transitions
- Context construction
- Next-action selection
- Conflict detection

### Repository Contract Tests

Each repository must pass the same behavioral contract for:

- In-memory implementation
- Supabase implementation

Tenant scope must be part of the repository contract.

### Database Tests

Required for:

- RLS policies
- Cascading behavior
- Tenant isolation
- Role permissions
- Credit ledger constraints
- Idempotency constraints

### Integration Tests

Required for:

- Authentication
- Project creation
- Workflow start
- Pause
- Resume
- Approval
- Brand Memory update
- Product artifact generation
- Credit settlement

### End-to-End Tests

Core journeys must cover:

- Saudi Arabic project
- Jordanian Arabic project
- English project
- New Idea entry path
- Existing Business entry path
- Owner permissions
- Editor permissions
- Viewer permissions
- Cross-tenant access denial
- Credit exhaustion without data loss

### Regression Tests

The existing AI reliability and Agent SDK suites must remain green throughout implementation.

## 10. Continuous Integration Gates

Every implementation PR must pass:

- Install
- Lint
- Type check
- Unit tests
- Integration tests relevant to the change
- Production build
- Migration validation when schema changes
- Secret and placeholder checks
- Documentation updates when contracts change

Security-sensitive PRs additionally require:

- RLS tests
- Authorization tests
- Cross-tenant tests
- Service-role usage review

## 11. Observability Requirements

The implementation should record without unnecessarily logging customer content:

- Correlation ID
- Organization ID
- Project ID
- Workflow Run ID
- Agent ID
- Provider ID
- Model
- Duration
- Retry count
- Validation outcome
- Usage
- Estimated cost
- Credit reservation
- Credit settlement
- Failure category
- Approval outcome

Sensitive project content must not be placed in routine logs.

## 12. Migration Strategy

Migrations must be:

- Additive where practical
- Reversible through a documented rollback approach
- Tested against existing prototype data
- Safe for repeated deployment
- Ordered by dependency
- Reviewed for RLS impact

Prototype metadata should be migrated or mapped deliberately.

The application must not permanently maintain conflicting sources of truth between typed tables and `metadata_json`.

## 13. Explicit Non-Goals

This implementation plan does not add the following to v1:

- Architecture Studio
- Interior Studio
- Expert Hub
- Direct social publishing
- Direct social scheduling
- Full AI video production
- Social comment management
- Social direct-message management
- Influencer campaign management
- Paid-ad campaign management
- Advanced social analytics
- Advanced agency workspace
- Public client review portal
- Custom role builder
- Complex approval chains
- Automatic credit replenishment
- Training a proprietary model on unreviewed customer files

## 14. Open Engineering Decisions

The following decisions must be resolved before their affected milestone begins:

- Durable job-execution platform
- Background execution deployment model
- Organization ownership model
- Prototype-data migration behavior
- Billing provider
- Image-generation provider
- AI provider routing rules
- Basic Website Studio delivery model
- Logo export formats
- File-upload limits
- File-storage design
- Retention periods
- Backup-erasure behavior
- Regional hosting roadmap
- Numerical performance targets
- Numerical reliability targets
- Numerical v1 success targets

Open decisions must not be disguised as implemented capabilities or public promises.

## 15. First Implementation Target

The first implementation target after this plan is not a studio.

It is a secure product foundation consisting of:

1. Production persistence safety
2. Authentication
3. Organizations and memberships
4. Tenant-scoped projects
5. Row-level security
6. Durable workflow execution

Only after these foundations are verified should real customer projects and studio workflows be expanded.

## 16. Completion Principle

Fikra AI v1 is complete only when a real authorized customer can:

1. Create an isolated project
2. Build context progressively
3. Receive an AI proposal
4. Approve a meaningful decision
5. Store that decision in Brand Memory
6. Generate consistent artifacts from it
7. Preserve versions
8. Understand credit usage
9. Return for recurring content work
10. Export or delete supported data
11. Use the core experience in Arabic or English
12. Receive the same product quality in Saudi Arabia and Jordan

The existing AI foundation makes this achievable.

The implementation must now turn that foundation into a secure, durable, coherent product.
