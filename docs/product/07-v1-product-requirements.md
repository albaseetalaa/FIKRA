# Fikra AI v1 Product Requirements Document

Status: Draft for implementation review
Decision date: 2026-07-30
Target release: v1
Primary markets: Saudi Arabia and Jordan

## 1. Product Summary

Fikra AI is an Arabic-first intelligent operating workspace that helps founders and small-business owners understand, build, launch, and grow a coherent business and brand.

The product coordinates specialized AI agents, structured project decisions, shared Brand Memory, creative studios, and guided next actions inside one project experience.

Fikra AI is not an unstructured AI chat interface and is not a collection of disconnected generators.

The customer remains the final decision-maker.

## 2. v1 Objective

The objective of v1 is to help a founder or small-business owner move from a new idea or an existing business to:

- A structured project foundation
- Approved strategic and brand decisions
- A coherent brand direction
- Useful launch and marketing assets
- A repeatable social-content workflow
- Clear recommended next actions

The experience must demonstrate that multiple studios and agents can work consistently from the same approved project context.

## 3. Primary Markets

Saudi Arabia and Jordan are equal primary launch markets.

Neither market is:

- Secondary
- Experimental
- Pilot-only
- Delayed behind the other
- A reduced product experience

Both markets should receive the same:

- Core product capabilities
- Quality standards
- Release cadence
- Support priority
- Product attention

Pricing may be localized independently in:

- Saudi Riyals
- Jordanian Dinars

Localized pricing must not create a lower-quality experience in either market.

## 4. Primary User

The primary v1 user is:

A founder or small-business owner in Saudi Arabia or Jordan who has a new idea or an existing business and wants to build a coherent brand, prepare it for launch, and continue marketing it without assembling a full professional team.

## 5. Secondary Users

Secondary v1 users include:

- Designers managing client projects
- Marketers managing brand and content work
- Consultants supporting small businesses
- Small internal teams

Agency-specific complexity must not dominate the first release.

## 6. Core Customer Problems

The primary user often experiences:

- Unclear project direction
- Disconnected advice from multiple providers
- Inconsistent branding and marketing
- Difficulty translating ideas into professional outputs
- Repeatedly explaining the project to different tools
- Unclear next steps
- High coordination cost
- Limited access to a complete professional team
- Difficulty maintaining content after launch

Fikra AI should reduce these problems through one shared project context and one guided operating workflow.

## 7. Product Principles

Fikra AI v1 must:

- Be Arabic-first
- Support Arabic and English
- Use structured approved decisions
- Preserve version history
- Keep projects isolated
- Show clear next actions
- Explain meaningful Fikra Credit usage
- Avoid unexpected charges
- Keep the customer in control
- Distinguish AI proposals from approved decisions
- Maintain consistency across studios
- Continue providing value after launch

## 8. Core Project Lifecycle

Each project follows five connected stages:

### Discover

Understand:

- The idea
- The existing business
- The customer problem
- The market
- The audience
- The opportunity
- The constraints
- The available assets

### Decide

Review and approve:

- Strategic foundation
- Market direction
- Audience
- Value proposition
- Positioning
- Brand personality
- Tone of voice
- Creative direction

### Build

Create approved assets through relevant studios.

### Launch

Prepare:

- Launch content
- Website readiness
- Campaign materials
- Final reviews
- Launch priorities

### Grow

Support:

- Recurring content
- Content calendars
- Campaign planning
- Brand consistency
- Updates
- Improvement recommendations

The lifecycle is guided but not rigid.

Customers must not be required to use every studio.

## 9. Entry Paths

New projects begin through one of three paths:

### New Idea

For users defining or exploring a new business.

### Existing Business

For users importing or improving an operating business.

### Client Work

For designers, marketers, consultants, or teams working for a client.

The selected path changes onboarding questions and recommended workflows.

## 10. Progressive Onboarding

Onboarding must feel like a guided conversation rather than a long form.

Fikra AI should progressively collect:

- Project name
- New idea or existing business status
- Industry
- Country
- City
- Primary language
- Output language
- Target audience
- Customer problem
- Proposed solution
- Value proposition
- Objectives
- Brand personality
- Competitors
- Budget context
- Existing assets
- Current project stage

Users may skip non-critical questions and return later.

The interface should explain why important information is needed.

## 11. First-Session Success

The first session should not attempt to complete an entire brand.

A successful first session should allow the user to:

- Create a project
- Provide essential context
- Understand the current project state
- Approve at least one meaningful decision
- Receive at least one useful output
- See no more than three next recommended actions

A useful first output may be:

- Project summary
- Target-audience definition
- Value proposition
- Initial brand direction
- Positioning proposal
- Prioritized action plan

## 12. Project Home

The Project Home must show:

- Project name
- Industry
- Selected market
- Current lifecycle stage
- Completion status
- Approved decisions
- Missing information
- Items awaiting review
- Current conflicts or risks
- Recent activity
- Fikra Credit usage
- Up to three recommended next actions

Each recommended action should explain:

- Why it matters
- Required input
- Expected output
- Relevant studio or agents
- Estimated credit usage when material

## 13. v1 Product Capabilities

The approved v1 capabilities are:

- AI Chat
- Workspace and Brand Memory
- Logo Studio
- Brand Studio
- Social Content Studio
- Menu Studio
- Packaging Studio
- Basic Website Studio

Architecture Studio and Interior Studio are deferred beyond v1.

## 14. AI Chat

AI Chat is the primary conversational interface for:

- Understanding the project
- Answering project questions
- Collecting missing context
- Proposing decisions
- Recommending next actions
- Starting approved workflows
- Explaining outputs
- Identifying conflicts
- Coordinating specialized agents

AI Chat must use:

- The selected project
- Approved Brand Memory
- Market Profile
- Current lifecycle stage
- User permissions
- Relevant sources
- Usage and credit rules

AI Chat must not silently replace approved decisions.

## 15. Agent Orchestration

Fikra AI should operate as a coordinated digital team.

The orchestration layer should be able to:

- Select relevant agents
- Provide approved project context
- Run agents in a controlled sequence
- Validate structured outputs
- Detect conflicts
- Retry recoverable failures
- Preserve execution records
- Produce one consolidated result

Provider-specific behavior must remain behind approved provider adapters.

The browser must not call AI providers directly.

## 16. Workspace and Brand Memory

Each Project has an independent Brand Memory.

Brand Memory may include:

- Target audience
- Market
- Customer problem
- Value proposition
- Positioning
- Brand personality
- Tone of voice
- Visual direction
- Colors
- Typography
- Messaging
- Approved terminology
- Customer promises
- Product information
- Source references

Important entries should retain where practical:

- Source
- Creation date
- Latest update date
- Approval status
- Confidence status
- Author or approving user

Users should be able to:

- Review entries
- Correct entries
- Remove entries
- Approve proposed entries
- Replace approved decisions explicitly

Project memory must not automatically move between projects.

## 17. Information Types

Fikra AI must distinguish between:

### Customer Input

Information directly provided or confirmed by the customer.

### Imported Source

Information extracted from a customer file, link, or connected source.

### AI Proposal

An unapproved recommendation or draft.

### Approved Decision

A decision explicitly approved by an authorized user.

### Derived Output

An artifact created from approved information.

### Superseded Decision

A previous approved decision replaced by a newer decision.

### Archived Item

An inactive item retained for history.

AI proposals must not silently become approved project facts.

## 18. Artifact Lifecycle

Important artifacts should support:

- Draft
- Needs Review
- Approved
- Superseded
- Archived

Each new generated or edited version must preserve the earlier version.

Users should be able to:

- Review versions
- Restore an earlier version
- Continue editing from a selected version
- Identify the approved version
- See who approved an artifact
- See when approval occurred

## 19. Logo Studio

Logo Studio v1 should help the customer:

- Create a structured logo brief
- Explore visual directions
- Generate logo concepts
- Compare concepts
- Provide feedback
- Regenerate selected directions
- Approve a selected direction
- Store the approved direction in project memory

Logo Studio must use approved:

- Brand personality
- Market
- Audience
- Positioning
- Visual direction
- Color direction
- Industry context

Final export formats and editable-vector capabilities remain an implementation decision.

## 20. Brand Studio

Brand Studio v1 should help create and maintain:

- Brand foundation
- Brand personality
- Tone of voice
- Messaging pillars
- Visual direction
- Color palette
- Typography direction
- Logo usage guidance
- Brand consistency guidance
- Basic brand documentation

Outputs must remain connected to approved Brand Memory.

## 21. Social Content Studio

Social Content Studio v1 supports:

- Content strategy based on project identity and objectives
- Weekly content calendars
- Monthly content calendars
- Post ideas
- Story ideas
- Reel ideas
- Arabic captions
- English captions
- Headlines
- Calls to action
- Short video scripts
- Reel scripts
- Creative briefs
- Tone and brand guidance
- Repurposing one idea across platforms
- Review before export

Deferred beyond v1:

- Direct publishing
- Direct scheduling
- Full AI video production
- Comment management
- Direct-message management
- Influencer campaign management
- Paid-ad campaign management
- Advanced platform analytics

## 22. Menu Studio

Menu Studio v1 should support relevant food and beverage projects through:

- Menu structure
- Category organization
- Item naming
- Item descriptions
- Brand-consistent tone
- Basic pricing presentation guidance
- Menu-content review
- Versioning
- Approval

Menu Studio must use approved project positioning and brand tone.

It must not present food, nutrition, allergy, or regulatory claims as verified unless reliable supporting information is available.

## 23. Packaging Studio

Packaging Studio v1 should support:

- Packaging brief creation
- Packaging concept direction
- Front-panel content
- Back-panel content structure
- Brand consistency guidance
- Product naming
- Messaging hierarchy
- Visual-direction guidance
- Review and approval
- Version history

Packaging Studio must not claim regulatory compliance unless verified through appropriate human or professional review.

## 24. Basic Website Studio

Basic Website Studio v1 should help create:

- Website structure
- Sitemap
- Page priorities
- Basic landing-page content
- Homepage content
- About content
- Service or product content
- Calls to action
- Brand-consistent messaging
- Basic visual direction
- Reviewable website artifacts

The exact website publishing model remains an implementation decision.

Possible v1 approaches include:

- Exportable website specification
- Generated static website
- Hosted basic website
- A limited combination of these options

The selected approach must be finalized before engineering implementation begins.

## 25. Industry Templates

The first v1 templates are:

1. Restaurant or cafe
2. E-commerce store or product brand
3. Service business

Templates may configure:

- Onboarding questions
- Recommended agents
- Recommended studios
- Expected artifacts
- Industry terminology
- Common risks
- Suggested lifecycle order
- Market examples

Templates must remain editable and must not place unverified assumptions into approved project memory.

## 26. Adaptive Studio Recommendations

Fikra AI should recommend studios according to:

- Industry
- Business type
- Project stage
- Existing assets
- Missing decisions
- Customer objectives
- Market
- Available budget
- Available Fikra Credits

Examples:

### Restaurant or Cafe

Likely recommendations:

- Logo Studio
- Brand Studio
- Menu Studio
- Packaging Studio
- Social Content Studio
- Basic Website Studio

### E-commerce or Product Brand

Likely recommendations:

- Logo Studio
- Brand Studio
- Packaging Studio
- Social Content Studio
- Basic Website Studio

### Service Business

Likely recommendations:

- Brand Studio
- Social Content Studio
- Basic Website Studio

## 27. Roles and Permissions

The initial roles are:

### Owner

Can:

- Manage project settings
- Make final approvals
- Manage members
- Manage billing
- Manage Fikra Credits
- Export the project
- Delete the project

### Editor

Can:

- Create and edit content
- Run approved workflows
- Produce drafts
- Propose memory updates
- Prepare artifacts for approval

Editors must not silently replace protected approved decisions.

### Viewer

Can:

- View permitted project information
- View approved artifacts
- Review project progress

Viewers cannot edit or approve.

Deferred collaboration features include:

- External Reviewer
- Public review links
- Advanced agency workspaces
- Custom permission builders
- Complex approval chains
- Multi-organization administration

## 28. Arabic-First Requirements

Arabic must be a first-class product experience.

v1 must support:

- Right-to-left interface behavior
- Arabic interface copy
- English interface copy
- Arabic project outputs
- English project outputs
- Independent interface and output languages
- Mixed Arabic and English text
- Arabic typography
- Local market tone
- Saudi market context
- Jordanian market context
- Local currencies
- Correct date and number presentation
- Appropriate punctuation behavior

The user may use:

- Arabic interface with English outputs
- English interface with Arabic outputs

## 29. Commercial Model

Fikra AI supports:

- Limited free trial
- Starter subscription
- Pro subscription
- Business subscription
- Monthly billing
- Annual billing
- Included monthly Fikra Credits
- One-time additional credit purchases
- Subscription upgrades

Final prices and credit quantities remain open pending cost modeling and market validation.

## 30. Fikra Credits

Fikra Credits represent resource-intensive AI usage.

Credits may be consumed by:

- Running AI agents
- Generating content
- Regenerating content
- Generating images
- Generating logo concepts
- Market analysis
- Competitor analysis
- Coordinating multiple agents
- Creating large campaigns
- Creating large content calendars

Normal workspace actions should not consume credits, including:

- Opening projects
- Viewing results
- Manual editing
- Organizing files
- Reviewing versions
- Downloading completed work
- Managing project settings

## 31. Credit Notifications

Customers should receive notifications at:

- 70 percent usage
- 90 percent usage
- 100 percent usage

The interface should show expected credit usage before a materially expensive operation.

When credits are exhausted:

- Saved work remains accessible
- Projects remain accessible
- Manual editing remains available
- Download and export remain available
- New resource-intensive AI operations are paused

The customer may:

- Buy additional credits
- Upgrade the subscription
- Wait for renewal

## 32. Billing Protection

v1 must not automatically charge for additional credits.

Additional-credit purchases and upgrades require explicit customer approval.

Automatic credit replenishment is deferred.

## 33. Data Ownership

Customers retain ownership of:

- Uploaded files
- Project data
- Conversations
- Brand materials
- Saved outputs
- Project artifacts

Use of Fikra AI does not transfer ownership to Fikra AI.

## 34. Fikra AI Processing Permission

Customers grant Fikra AI limited, non-exclusive permission to process content only as reasonably necessary to:

- Provide product capabilities
- Run agents
- Generate outputs
- Save outputs
- Maintain memory
- Maintain versions
- Provide support
- Protect the platform
- Diagnose failures
- Improve service reliability
- Improve the product under approved data rules

Fikra AI must not:

- Sell customer project content
- Publicly publish customer work without permission
- Use a project as a marketing case study without permission
- Grant unrelated third parties rights to customer content

## 35. Product Improvement Data

Fikra AI may use aggregated, operational, and de-identified signals, including:

- Agent success rates
- Agent failure rates
- Execution time
- Infrastructure cost
- Regeneration frequency
- Feature usage
- Validation outcomes
- User ratings
- Output acceptance
- Output rejection
- Technical errors
- Performance measurements

Use of identifiable project-specific content for broader training or evaluation requires a separate and clear contribution choice.

## 36. Privacy

Projects, conversations, files, and artifacts are private by default.

Public sharing requires an intentional customer action.

Access must be restricted according to:

- Account permissions
- Project permissions
- Team permissions
- Service requirements
- Security requirements

## 37. Export and Deletion

Customers should be able to:

- Export completed work
- Download project artifacts
- Request supported project-data export
- Delete a project
- Request account deletion

Retention periods, recovery windows, backup deletion, and final erasure require architectural and legal review.

Fikra AI must not claim immediate deletion from every backup unless verified.

## 38. Data Residency

Fikra AI must not claim local data residency in Saudi Arabia, Jordan, or another jurisdiction unless it is implemented and verified.

## 39. AI Transparency

The product should distinguish when relevant between:

- Customer-provided information
- Imported information
- Approved project memory
- AI-generated proposals
- Human-reviewed outputs
- Customer-approved decisions

## 40. Accuracy and Human Review

Fikra AI outputs are proposals and decision-support materials.

Fikra AI must not present AI outputs as guaranteed:

- Legal advice
- Financial advice
- Medical advice
- Regulatory approval
- Market success
- Factual certainty without reliable verification

High-risk decisions require appropriately qualified human review.

## 41. Non-Functional Requirements

### Security

The product must:

- Keep provider credentials server-side
- Keep service-role credentials server-side
- Prevent secrets from entering prompts
- Enforce project access controls
- Validate file access
- Validate user permissions
- Record meaningful security events
- Prevent direct browser-to-provider AI calls

### Reliability

The product should:

- Preserve work after recoverable failures
- Support safe retries
- Avoid duplicate destructive operations
- Record workflow status
- Record validation failures
- Provide understandable recovery messages

### Performance

The interface should remain responsive during long-running AI operations.

Long-running work should expose:

- Current status
- Progress where practical
- Failure state
- Retry option
- Cancel option where technically safe

### Accessibility

Core user journeys should support:

- Keyboard navigation
- Visible focus states
- Meaningful labels
- Appropriate contrast
- RTL behavior
- Clear validation messages

### Observability

The system should record:

- Workflow type
- Agent execution
- Provider usage
- Cost
- Duration
- Validation outcome
- Retry count
- Failure category
- Credit usage
- User approval outcome

Sensitive customer content should not be placed into operational logs unnecessarily.

## 42. High-Level Data Objects

The v1 product is expected to use objects such as:

- User
- Organization
- Membership
- Project
- Market Profile
- Project Profile
- Brand Memory Entry
- Decision
- Source
- Conversation
- Message
- Workflow
- Agent Execution
- Artifact
- Artifact Version
- Approval
- Comment
- Credit Ledger Entry
- Subscription
- Usage Event
- Activity Event

The detailed database schema will be defined separately.

## 43. Core Analytics Events

The product should measure events such as:

- Account created
- Trial started
- Project created
- Entry path selected
- Onboarding step completed
- Onboarding abandoned
- First decision proposed
- First decision approved
- First artifact generated
- First artifact approved
- Studio opened
- Workflow started
- Workflow completed
- Workflow failed
- Output regenerated
- Project returned to
- Social calendar created
- Credit threshold reached
- Additional credits purchased
- Subscription upgraded

Analytics must follow approved privacy principles.

## 44. v1 Success Signals

The v1 experience should measure whether users:

- Complete project creation
- Complete essential onboarding
- Approve a first meaningful decision
- Produce a useful first output
- Use approved memory across multiple studios
- Return to continue the project
- Return for recurring social-content use
- Understand credit usage
- Complete workflows without human support
- Receive consistent outputs across studios

Numerical targets will be defined after establishing a real baseline.

## 45. v1 Non-Goals

v1 does not require:

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
- Advanced agency workspaces
- Public client review portals
- Complex approval chains
- Custom role builders
- Automatic credit replenishment
- Proprietary-model training on unreviewed raw customer files

## 46. Release Gates

v1 should not be considered ready until:

- Primary onboarding works in Arabic and English
- Project isolation is verified
- Role permissions are verified
- Approved decisions are distinguishable from AI proposals
- Brand Memory is reused across relevant studios
- Version history preserves earlier work
- Credit usage is recorded accurately
- Credit limits do not remove access to saved work
- Additional charges require explicit approval
- Primary templates function correctly
- Core AI workflows have validation and failure recovery
- Critical security review items are resolved
- Core analytics events are recorded
- Accessibility checks cover primary journeys
- Production monitoring is available
- Data export and deletion behavior matches product claims

## 47. Open Product Decisions

The following decisions remain open:

- Exact subscription prices
- Included credits per plan
- Credit cost per operation
- Free-trial limits
- Image-generation provider
- Final AI-provider routing rules
- Payment gateway or gateways
- Basic Website Studio publishing model
- Logo Studio export formats
- Initial file-upload limits
- Data-retention periods
- Backup-deletion behavior
- Regional hosting roadmap
- Initial support model
- Exact numerical success targets

These decisions must be resolved before the affected implementation or public claim is released.

## 48. Implementation Principle

Engineering should implement the smallest coherent version of the approved experience.

The implementation should prioritize:

1. Project creation and isolation
2. Progressive onboarding
3. Structured decisions and Brand Memory
4. AI Chat and orchestration
5. Artifact versioning and approvals
6. Adaptive studio workflows
7. Credit accounting
8. Arabic-first experience
9. Security, privacy, and observability
10. Recurring Social Content Studio value

The implementation must avoid building deferred features merely because the architecture could support them.

## 49. Product Definition Reference

This PRD consolidates the approved decisions documented in:

- 01-product-scope.md
- 02-launch-markets.md
- 03-commercial-model.md
- 04-data-memory-trust.md
- 05-user-experience-principles.md
- 06-mvp-users-and-core-journey.md

Where this PRD conflicts with a later formally approved decision, the later decision takes precedence and this PRD must be updated.
