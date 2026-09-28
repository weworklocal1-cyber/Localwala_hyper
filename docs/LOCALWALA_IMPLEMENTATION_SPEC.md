

WEWORKLOCAL PRIVATE LIMITED

LOCALWALA

LOCALWALA — Enterprise Implementation Specification

OpenCode AI Implementation Master Plan & Completion Checklist

Danda local, ey system matram digital.Prepared: 27 September 2026

# Document Use
Place this document in the repository as the master implementation specification. Recommended canonical path: docs/LOCALWALA_IMPLEMENTATION_SPEC.md. OpenCode agents should read the relevant sections before implementation and update task status only after acceptance criteria pass.

# 1. Purpose & AI Execution Contract
This document is the master implementation specification for LocalWala. It is intended to be placed in the repository and used by OpenCode/AI coding agents as the source of truth for implementation. The implementation must be treated as an enterprise hyperlocal platform, not as a single CRUD application.

The uploaded LocalWala implementation plan establishes a shared core for identity, geography, commerce, fulfillment and finance, with vertical-specific engines for Food, Local Store, Daily/Dairy, Zatka, Local Services and Real Estate. This specification converts that business plan into an executable software architecture, application UX plan, service boundaries, security model, payment/OTP model, delivery dispatch model, configuration system and AI-agent checklist.

Do not start implementation by generating random screens or services.

Read this document before modifying architecture or creating a new service.

Do not invent a second business rule when a rule already exists in this specification.

Do not mark a task complete because code compiles; use the acceptance criteria and tests.

Every completed item must have implementation evidence: code path, test, migration/configuration where applicable, and documentation update.

Do not silently replace a required capability with a mock, placeholder, TODO, hardcoded response or fake API.

If a dependency or provider is unavailable, implement the provider interface and clearly mark the integration boundary as BLOCKED rather than pretending it works.

Never weaken security, payment verification, authorization, idempotency or financial audit requirements for speed.

# 2. Source Business Architecture — Must Preserve
The existing business document defines LocalWala as one platform with a shared core and multiple vertical engines. Food, Local Store, Daily/Dairy, Zatka and Local Services reuse identity, geography, payments, notifications and applicable commerce/fulfillment components. Real Estate has its own transaction lifecycle.

The geographic master is Country → State → City → Operational Zone → Locality → Geo Boundary. Administrative metadata such as District, Mandal/Taluk and Pincode remains separate from the operational hierarchy.

The source plan explicitly requires capability/configuration rather than scattered vertical-specific conditionals, and requires locality activation by configuration rather than custom code.

Shared identity across customer, vendor/business, employee and delivery-partner accounts.

One geographic master for every vertical.

Shared commerce capabilities: categories, products, variants, inventory, carts, orders, payments, refunds and settlements.

Shared fulfillment capabilities: delivery areas, slots, delivery-partner assignment and tracking.

Shared financial capabilities: wallet, referral, commission, vendor settlement and audit ledgers.

Organic remains a Local Store business type/product attribute, not a separate vertical.

Real Estate remains a separate transaction engine.

Every locality must be activatable by configuration.

# 3. Applications & Repositories
Build separate applications while sharing a common design language and API contracts. The customer, partner, delivery and executive experiences must not be forced into one UI. The backend remains a shared platform with service boundaries.

Customer Flutter App — discovery, ordering, payments, tracking, subscriptions, services and property discovery.

Partner Flutter App — restaurant/store/dairy/Zatka/service-provider operations.

Delivery Flutter App — availability, assignments, navigation, pickup, delivery, OTP/proof and earnings.

Executive Flutter App — field operations, service/real-estate executive workflows and assignments.

Admin Web App — operational control center, configuration, finance, geography, content, support and audit.

Landing Web App — public marketing/SEO website, separate from transactional application.

Backend — Fastify + TypeScript services.

Shared packages — contracts, design system, validation, errors, event schemas and utilities.

# 4. Backend Service Topology
Use domain-oriented services. Do not create a microservice for every table or tiny feature. A capability can begin as a module in a deployment and be split into an independent service when operational scale requires it.

API Gateway

auth-service

user-service

geography-service

config-service

media-service

notification-service

search-service

support-service

catalog-service

inventory-service

cart-service

order-service

payment-service

wallet-service

promotion-service

settlement-service

referral-service

delivery-service

dispatch-engine

driver-service

tracking-service

food-service

store-service

dairy-service

zatka-service

local-services-service

realestate-service

analytics-service

audit-service

# 5. Recommended Repository Structure
Start as a monorepo so AI agents can share contracts and tooling without creating duplicated infrastructure. Services remain independently deployable where required.

apps/customer_flutter

apps/partner_flutter

apps/delivery_flutter

apps/executive_flutter

apps/admin_web

apps/landing_web

services/api-gateway

services/auth-service

services/user-service

services/geography-service

services/config-service

services/media-service

services/notification-service

services/search-service

services/support-service

services/catalog-service

services/inventory-service

services/cart-service

services/order-service

services/payment-service

services/wallet-service

services/promotion-service

services/settlement-service

services/referral-service

services/delivery-service

services/dispatch-engine

services/driver-service

services/tracking-service

services/food-service

services/store-service

services/dairy-service

services/zatka-service

services/local-services-service

services/realestate-service

services/analytics-service

services/audit-service

packages/design-system

packages/contracts

packages/event-schemas

packages/validation

packages/errors

packages/config

packages/logger

infrastructure/docker

infrastructure/nginx

infrastructure/observability

docs/architecture

docs/api

docs/events

docs/runbooks

# 6. Fastify Service Standard
Every Fastify service must use the same internal structure. Routes must remain thin. Business logic belongs in application/domain services; persistence belongs in repositories; validation belongs in schemas.

src/server.ts

src/app.ts

src/config/

src/plugins/

src/routes/

src/controllers/

src/services/

src/repositories/

src/models/

src/schemas/

src/events/

src/jobs/

src/errors/

src/utils/

tests/unit/

tests/integration/

tests/e2e/

# 7. Identity, Authentication, OTP & RBAC
Authentication is a shared platform capability. One customer account must work across all LocalWala verticals. OTP must be implemented as a real backend verification flow with rate limiting, expiry, attempt limits and provider abstraction.

Phone/email identity.

OTP request, verify and resend.

OTP hash storage; never store plaintext OTP.

OTP expiry and maximum attempts.

Device/session management.

Access token + refresh token model.

Logout and session revocation.

Role-based access control plus permission checks.

Roles for customer, partner, partner staff, delivery partner, executive, support agent, manager, admin and super-admin.

Provider abstraction for SMS OTP.

Android SMS Retriever/autofill-compatible UX where applicable; do not request unnecessary SMS permissions.

All authorization must be enforced server-side; Flutter is never trusted.

# 8. Native Payment Architecture
Payment must feel native inside Flutter while remaining provider-controlled and server-verified. The app must not implement fake payment confirmation. The payment-service creates the gateway transaction/order, the native SDK handles the customer payment UI, and the backend verifies the payment and webhook before confirming the order.

payment-service owns gateway integration.

Gateway adapter interface so providers can be changed without rewriting order logic.

Native Android/iOS payment SDK integration through the selected provider's supported Flutter/native integration.

UPI Intent and other provider-supported methods.

Cards and other supported methods.

COD where enabled.

Server-side payment order creation.

Signature/server-side verification.

Webhook verification and idempotency.

Payment status reconciliation.

Refund creation and status tracking.

Payment failure/retry flow.

Never trust a Flutter-only success callback.

Store immutable payment audit records.

# 9. Commerce Core
Build the common commerce engine before implementing the vertical-specific experiences. Products, variants, categories, inventory, cart, order, payment, refund and settlement are shared capabilities, while verticals define their specific lifecycle.

Catalog: categories, subcategories, products, variants, modifiers, attributes, media, pricing and availability.

Inventory: physical, reserved and sellable quantities where required.

Cart: items, variants, quantity, instructions, coupon, address and pricing snapshot.

Order: immutable pricing snapshot, status machine, item snapshot, partner snapshot and address snapshot.

Refunds: item/order/partial/full refund support.

Settlement: partner payable, platform fees, delivery contribution, taxes and adjustments.

Idempotency keys for order creation and payment operations.

Concurrency control for inventory and assignment.

Audit events for critical state transitions.

# 10. Geography, Zones & Serviceability
The geography service is a shared dependency for discovery, delivery, promotions, service coverage and real estate. Use actual operational boundaries/GeoJSON where available rather than treating every locality as a circle.

Country → State → City → Operational Zone → Locality → Geo Boundary.

Keep government/admin metadata separate.

Point-in-polygon locality resolution.

Zone resolution.

Serviceability checks.

Partner service area.

Delivery area.

Vertical availability by locality/zone.

Geographic configuration versioning.

Admin tools for creating, editing, activating and deactivating zones/localities.

Spatial indexing.

Cache high-frequency geographic lookups.

# 11. Dynamic Configuration & Remote UI
The platform must be configuration-driven, but not a fully arbitrary remote-UI engine. Backend controls content, ordering, visibility, campaigns, assets and feature flags. Native Flutter components control complex interaction behavior such as checkout, payment, maps and order tracking.

config-service owns versioned configuration.

Draft/published/scheduled/expired configuration states.

Rollback to previous version.

Environment separation.

Feature flags.

Minimum app version / force update.

Maintenance mode.

Vertical enable/disable.

City/zone/locality-specific configuration.

Time/date-based configuration.

Customer-segment targeting.

Home section ordering.

Banner configuration.

Category configuration.

Lottie URL, fit, speed, loop and visibility.

Payment method visibility.

Delivery rules.

Pricing rules.

Commission rules.

Promotion rules.

Notification templates.

Do not allow arbitrary code execution through remote configuration.

# 12. Customer App UI/UX
The customer app should feel like one premium hyperlocal platform rather than six unrelated applications. The header contains location/context and dynamic vertical navigation. The active vertical controls the discovery feed.

Home: location, profile/notifications/cart, dynamic Lottie header, vertical tabs, search, banners, contextual sections.

Bottom navigation: Home, Explore, Orders, Offers, Account.

Food: restaurant discovery, cuisine/categories, restaurant detail, menu, modifiers, cart, checkout, tracking.

Local Store: category discovery, product search, store detail, inventory-aware product cards, cart, delivery/pickup.

Dairy: product selection, quantity, frequency, start date, subscription management, pause/resume/skip/vacation.

Zatka: meat type, cut, weight, cleaning/preparation options, inventory reservation and delivery slot.

Services: service discovery, provider details, fixed/starting/quote flow, scheduling, job status.

Real Estate: buy/rent/commercial, map/listing discovery, property detail, enquiry, visit request and lead status.

Native-feeling payment experience.

Live order tracking.

Push notification deep links.

Loading, skeleton, empty, error, offline and retry states for every important screen.

Accessibility, readable typography, touch targets and responsive layouts.

# 13. Partner / Restaurant App UI/UX
Partner UX is operations-first. A restaurant should be able to accept and progress orders quickly, manage menu availability and understand earnings without navigating through consumer-style screens.

Dashboard with today's revenue, orders, active orders and rating.

New order queue with prominent Accept/Reject actions.

Kitchen Mode with New / Preparing / Ready columns.

Order detail with item modifiers, instructions, preparation time and delivery state.

Menu/catalog management.

Availability toggle.

Inventory where applicable.

Offers and promotions.

Store/restaurant timings.

Settlement/earnings.

Analytics.

Support.

Staff roles/permissions.

Notifications.

Offline/retry behavior.

Large operational controls for fast use.

# 14. Delivery App UI/UX & Dispatch
Delivery UX must be task-first. One obvious primary action per screen. The backend dispatch engine selects eligible drivers and offers deliveries through a controlled assignment process.

Online/offline toggle.

Current earnings.

New assignment card.

Accept/reject with timeout.

Navigation to pickup.

Arrived at pickup.

Pickup confirmation.

Navigation to customer.

Arrived at customer.

Customer OTP verification.

Proof of delivery where configured.

COD collection confirmation where applicable.

Delivery completion.

Failed delivery workflow.

Earnings and settlement history.

Support and incident reporting.

Live location updates through a dedicated tracking path.

# 15. Dispatch Engine
Dispatch is a separate domain. Do not assign simply to the nearest driver. First determine eligibility, then score candidates, then create a controlled offer and atomically claim the delivery.

Determine pickup/delivery coordinates.

Resolve operational zone.

Find online/available drivers.

Filter by service area.

Filter by vehicle requirements.

Filter by capacity.

Filter by driver state/suspension.

Apply maximum candidate distance.

Calculate distance/ETA.

Consider current workload.

Consider same-zone priority where configured.

Score candidates using configurable dispatch policy.

Offer to best candidate.

Timeout/reject → next candidate.

Use atomic claim/idempotency to prevent double assignment.

Support manual admin assignment/reassignment.

Record assignment history.

Design data model for future batching.

Do not aggressively batch at initial launch unless operationally validated.

# 16. Food Engine
Food is prepared-to-order commerce.

Restaurant onboarding and verification.

Restaurant profile and service area.

Menu/categories/items/modifiers.

Availability and stock-outs.

Preparation time.

Order acceptance.

Preparing state.

Ready state.

Pickup and delivery.

Restaurant commission and platform fees.

Sponsored placement capability.

Ratings/reviews.

Kitchen Mode.

Restaurant staff permissions.

# 17. Local Store & Organic
Local Store is general retail. Organic remains a store business type/product attribute with optional certification and verification.

Store profile and multiple branches.

Product catalog.

Inventory.

Instant and scheduled delivery.

Pickup where enabled.

Product substitutions if enabled.

Organic business_type.

Organic product attributes.

Certification documents.

Verified Organic Partner badge.

Organic collections across multiple stores.

Store commission and settlement.

# 18. Daily / Dairy
Daily/Dairy is recurring commerce and must not be represented as ordinary one-off orders only.

Subscription entity separate from normal orders.

Daily/alternate/weekly frequency.

Start date.

Quantity.

Product changes.

Address changes.

Pause/resume.

Skip.

Vacation pause.

Scheduled delivery instances.

Missed-delivery handling.

Recurring payment handling.

Delivery route integration.

# 19. Zatka / Fresh Meat
Zatka requires a dedicated engine because inventory and preparation have real-time characteristics.

Fresh meat catalog.

Cut/weight/options.

Inventory reservation.

Physical vs reserved vs sellable stock.

Accept.

Cut/clean.

Pack.

Ready.

Pickup.

Instant/scheduled delivery.

Slot capacity.

Inventory race-condition protection.

# 20. Local Services
Services use a booking/provider/job lifecycle rather than a normal retail order lifecycle.

Provider onboarding.

Skills.

Verification.

Service areas.

Availability.

Ratings.

Service request.

Provider matching.

Schedule.

Provider accept.

Fixed pricing.

Starting-from pricing.

Quote pricing.

Inspection/details.

Customer quote approval.

Job execution.

Final payment.

Review.

# 21. Real Estate
Real Estate remains a separate transaction engine.

Property listings.

Residential/commercial.

Buy/rent.

Property discovery.

Leads/referrals.

Visit request.

Executive assignment.

Visit.

Property hold.

Hold expiry/cancellation/refund rules.

Sale verification.

Loan process.

Commission calculation.

Separate transaction/commission/referral/executive/wallet/bank-partner ledger entries.

Real-estate documents and verification.

# 22. Notifications & Communication
Use a centralized notification service with channel adapters.

Push notifications.

SMS.

Email.

WhatsApp where an approved provider/integration is used.

In-app notifications.

Templates with versioning.

Event-triggered notifications.

Deep links.

Retry policy.

Delivery status.

User preferences.

Quiet/opt-out controls where applicable.

# 23. Search & Discovery
Use a dedicated search service. Do not build enterprise discovery entirely from database regex queries.

Search restaurants.

Search stores.

Search products.

Search services.

Search properties.

Search localities.

Geo-filtering.

Vertical filtering.

Availability filtering.

Ranking configuration.

Recent searches.

Suggestions/autocomplete.

Index update events.

# 24. Support & Customer Operations
Support must support bot-first routing, agent assignment, transfer, SLA and auditability.

Bot-first conversation.

Escalation to human.

Agent queue.

Capacity-aware assignment.

Priority/SLA.

Tags.

Internal notes.

Transfer with reason.

Manager join.

Bulk operations.

Auto-close rules.

Assignment history.

Customer/order context.

Audit trail.

# 25. Finance, Wallet, Commission & Settlement
Financial records must be ledger-based and immutable. Reversals are recorded as new entries rather than overwriting history.

Payment ledger.

Wallet ledger.

Referral ledger.

Commission ledger.

Settlement ledger.

Refund ledger.

Versioned commission rules.

Partner settlement cycles.

Delivery earnings.

Platform fees.

Taxes.

Gateway fees.

Adjustments.

Reconciliation.

Withdrawal approval.

Immutable audit trail.

# 26. Security Requirements
Security is a release blocker, not a post-launch enhancement.

Secrets never committed.

Environment-specific secrets.

JWT validation.

Refresh-token rotation/revocation strategy.

RBAC and permission checks.

Rate limiting.

OTP abuse prevention.

Webhook signature verification.

Input validation.

Output validation where needed.

MongoDB query safety.

SQL parameterization.

CORS policy.

Security headers.

Audit logs.

PII minimization.

Encryption in transit.

Encryption at rest where supported.

Admin MFA if supported by the chosen identity architecture.

Device/session management.

File upload validation and malware/content controls as appropriate.

Least privilege service credentials.

# 27. Observability & Reliability
Every important operation must be traceable across services.

Structured JSON logs.

requestId.

traceId.

userId where available.

service name.

latency.

status code.

OpenTelemetry tracing.

Prometheus metrics.

Grafana dashboards.

Centralized logs.

Error tracking.

Health endpoints.

Readiness/liveness.

Queue lag metrics.

Payment failure metrics.

Order failure metrics.

Dispatch assignment metrics.

Notification failure metrics.

# 28. Infrastructure & Deployment
Start with Dockerized services and a clear path to scaling. Do not introduce Kubernetes solely for appearance; introduce it when the operational need justifies it.

Development environment.

Staging environment.

Production environment.

Docker images.

Docker Compose for local development.

Nginx/load balancer.

Managed or self-hosted databases as appropriate.

Redis.

Kafka for durable domain events.

BullMQ/Redis for short-lived background jobs where appropriate.

Object storage/CDN.

CI/CD.

Database backups.

Restore testing.

Migration strategy.

Environment-specific configuration.

# 29. Event & Messaging Rules
Kafka is for durable domain events and asynchronous service integration. Redis is for cache, live operational state and short-lived queues/jobs. Do not publish high-frequency GPS coordinates as Kafka domain events.

Version event schemas.

Use event IDs.

Use aggregate/entity IDs.

Include occurredAt.

Include correlation/trace ID.

Use idempotent consumers.

Retry transient failures.

Dead-letter failed messages where appropriate.

Do not rely on event delivery exactly-once semantics as a substitute for idempotent business logic.

Order/payment/settlement state changes must remain authoritative in their owning service.

# 30. API & Contract Rules
All service boundaries must be explicit. Prefer REST for synchronous command/query APIs initially and events for asynchronous propagation.

Version public APIs.

OpenAPI documentation.

Request/response schemas.

Error format.

Correlation IDs.

Idempotency keys for mutation endpoints where duplicate requests are possible.

Pagination.

Filtering/sorting conventions.

Authentication requirements documented per route.

Authorization requirements documented per route.

Event schemas versioned.

Breaking changes require versioning/migration.

# 31. Flutter Architecture
Use feature-based Flutter architecture with a shared design system.

core/networking.

core/auth.

core/routing.

core/storage.

core/notifications.

core/location.

core/analytics.

core/design_system.

features/auth.

features/home.

features/food.

features/store.

features/dairy.

features/zatka.

features/services.

features/realestate.

features/cart.

features/orders.

features/payments.

features/profile.

features/support.

Use Riverpod or Bloc consistently; do not mix state-management paradigms without a documented reason.

Secure local storage for tokens/sensitive session state.

Repository/service abstraction for API access.

Deep-link handling.

Crash/error handling.

# 32. Design System & UX Quality Gates
The apps must share a coherent LocalWala design system while preserving role-specific workflows.

Design tokens.

Olive-green brand language where applicable.

Typography scale.

Spacing system.

Corner-radius system.

Elevation/shadow rules.

Iconography.

Motion rules.

Skeleton components.

Empty/error/offline states.

Accessible contrast.

Touch target minimums.

Dark mode decision documented.

Localization-ready strings.

Responsive tablet layouts for partner/delivery/kitchen where required.

Native-feeling payment and OTP interactions.

# 33. Admin Control Center
Admin must be the operational and configuration control plane. It should not directly modify service databases.

Dashboard.

Users.

Partners.

Partner staff.

Restaurants.

Stores.

Dairy.

Zatka.

Services.

Properties.

Orders.

Payments.

Refunds.

Wallet.

Settlements.

Delivery.

Drivers.

Geography.

Zones/localities.

Home builder.

Lottie/media.

Promotions.

Notifications.

Support.

Employees/executives.

Analytics.

Feature flags.

System settings.

Audit logs.

# 34. Testing Strategy
Testing must exist at service, contract, integration and end-to-end levels. Critical payment, order, inventory and dispatch workflows must not rely only on manual testing.

Unit tests for domain logic.

Integration tests for repositories and provider adapters.

API contract tests.

Event schema/consumer tests.

Payment webhook tests.

Order state transition tests.

Inventory reservation concurrency tests.

Dispatch double-assignment tests.

OTP rate-limit tests.

RBAC tests.

Flutter widget tests.

Flutter integration tests.

Critical end-to-end customer journey.

Partner order acceptance journey.

Driver pickup/delivery journey.

Subscription lifecycle tests.

Service quote lifecycle tests.

Real-estate lead/visit/hold lifecycle tests.

Load tests for critical APIs.

# 35. CI/CD & Quality Gates
No service should be deployable because an AI agent says it is done. The pipeline must enforce quality gates.

Format/lint.

Type-check.

Unit tests.

Integration tests.

Build.

Dependency vulnerability scan.

Container vulnerability scan where available.

Migration validation.

OpenAPI generation/validation.

Event schema validation.

Staging deployment.

Smoke tests.

Production approval gate.

Rollback procedure.

# 36. AI/OpenCode Multi-Agent Operating Rules
OpenCode agents must work from a shared task registry and contract-first workflow. Multiple agents may work in parallel only when their file/service ownership does not create conflicting architecture decisions.

Before coding, read docs/LOCALWALA_IMPLEMENTATION_SPEC.md and relevant service docs.

Each agent must state the task ID it is implementing.

Each agent must inspect existing code before creating new files.

Never create duplicate services because a similarly named service already exists.

Never create a second User, Order, Payment or Geography model without explicit architecture approval.

Shared contracts belong in packages/contracts or the documented contract location.

Database ownership must be respected.

One service owns each authoritative state.

AI agents must not silently change API contracts.

AI agents must update the checklist after implementation.

AI agents must add/update tests.

AI agents must report blockers instead of using fake implementations.

AI agents must not delete working features to make tests pass.

AI agents must not rewrite large portions of the repository without an explicit task.

Run the smallest relevant tests first, then broader tests.

Record migrations and configuration changes.

Document any architectural deviation.

# 37. OpenCode Task Execution Template
Use one task file per implementation unit. Example structure:

TASK-ID:OWNER:SERVICE:DEPENDENCIES:FILES TO TOUCH:API CONTRACTS:EVENTS:DATABASE CHANGES:UI CHANGES:SECURITY IMPACT:TESTS REQUIRED:ACCEPTANCE CRITERIA:BLOCKERS:STATUS:

Agents should update status only after acceptance criteria pass.

TODO — not started

IN_PROGRESS — actively being implemented

BLOCKED — dependency or external integration prevents completion

READY_FOR_REVIEW — implementation and tests complete

DONE — reviewer/CI acceptance criteria complete

# 38. Implementation Phases & Gates
The following sequence prevents the AI team from building disconnected features.

Phase 0 — Architecture freeze: service boundaries, data ownership, event contracts, state machines, configuration schemas, security model.

Phase 1 — Infrastructure: monorepo, Fastify base, Docker, databases, Redis, Kafka, CI/CD, observability.

Phase 2 — Core identity: auth, OTP, user, RBAC, sessions.

Phase 3 — Geography/config/media: geography master, GeoJSON boundaries, serviceability, remote config, media.

Phase 4 — Commerce: catalog, inventory, cart, order, payment, refunds, wallet, settlement.

Phase 5 — Fulfillment: driver, delivery, dispatch, tracking.

Phase 6 — Flutter foundations: design system, networking, auth, navigation, remote config, Lottie, maps, notifications.

Phase 7 — Food + restaurant app.

Phase 8 — Local Store + Organic.

Phase 9 — Daily/Dairy subscriptions.

Phase 10 — Zatka.

Phase 11 — Local Services.

Phase 12 — Real Estate + executive workflows.

Phase 13 — Support, advanced analytics, sponsored marketplace, route optimization and reconciliation.

Phase 14 — Production hardening, load testing, disaster recovery and operational runbooks.

# 39. Master Release Checklist
The following checklist is the final gate. Do not declare LocalWala production-ready until all release-blocking items are checked.

- [ ] Architecture document committed.
- [ ] Service ownership documented.
- [ ] Database ownership documented.
- [ ] API contracts documented.
- [ ] Event contracts documented and versioned.
- [ ] Auth flow tested.
- [ ] OTP flow tested with real provider in staging.
- [ ] OTP abuse limits tested.
- [x] RBAC tested.
- [x] Geography point-in-polygon tested.
- [ ] Zone/locality activation tested.
- [x] Remote config publish/rollback tested.
- [ ] Lottie remote asset flow tested.
- [x] Catalog tested.
- [x] Inventory reservation tested.
- [x] Cart tested.
- [x] Order state machine tested.
- [ ] Native payment flow tested on Android.
- [ ] Native payment flow tested on iOS where build environment is available.
- [ ] Payment webhook verification tested.
- [ ] Payment idempotency tested.
- [ ] Refund flow tested.
- [x] Wallet ledger tested.
- [x] Commission ledger tested.
- [x] Settlement reconciliation tested.
- [x] Driver onboarding tested.
- [x] Driver online/offline tested.
- [x] Dispatch assignment tested.
- [x] Assignment timeout/retry tested.
- [x] Double-assignment prevention tested.
- [x] Live tracking tested.
- [x] Delivery OTP tested.
- [x] Failed delivery tested.
- [ ] Food restaurant acceptance tested.
- [ ] Food kitchen flow tested.
- [ ] Store inventory/order flow tested.
- [ ] Dairy subscription lifecycle tested.
- [ ] Zatka reservation/preparation flow tested.
- [ ] Services fixed/starting/quote flows tested.
- [ ] Real-estate lead/visit/hold flow tested.
- [ ] Customer app complete journey tested.
- [ ] Partner app complete journey tested.
- [ ] Delivery app complete journey tested.
- [ ] Admin operations tested.
- [ ] Admin configuration tested.
- [ ] Audit logs verified.
- [ ] Observability dashboards live.
- [ ] Alerts configured.
- [ ] Backups configured.
- [ ] Restore procedure tested.
- [ ] Security scan passed.
- [ ] Dependency vulnerabilities reviewed.
- [ ] Load tests passed for critical endpoints.
- [ ] CI/CD pipeline green.
- [ ] Staging smoke tests green.
- [ ] Production rollback tested.
- [ ] Runbooks completed.
- [ ] Privacy/terms/support content completed.
- [ ] App-store release configuration completed.
# 40. Definition of Done
A feature is DONE only when all of the following are true:

- [ ] Business rule implemented.
- [ ] API implemented and documented.
- [ ] Database migration/schema completed.
- [ ] Authorization enforced.
- [ ] Validation implemented.
- [ ] Error handling implemented.
- [ ] Idempotency considered.
- [ ] Events emitted where required.
- [ ] Logs/traces/metrics added.
- [ ] Unit tests added.
- [ ] Integration tests added where applicable.
- [ ] UI states implemented.
- [ ] Loading/empty/error/offline states implemented.
- [ ] Analytics/event tracking considered.
- [ ] Admin controls implemented where the requirement is configurable.
- [ ] Documentation updated.
- [ ] CI passes.
- [ ] No TODO/FIXME placeholder remains for the accepted scope.
- [ ] Manual acceptance criteria verified.
# 41. Non-Negotiable Rules
These rules come directly from the business plan and are also architecture release gates.

One geography master.

One user/vendor identity.

One payment and financial ledger.

Versioned commission rules.

Inventory reservation for scheduled/Zatka orders.

Idempotent payment webhooks.

Immutable financial audit trail with reversals instead of overwrites.

Separate fulfillment engines for Services and Real Estate.

Organic is a Local Store business type, not a vertical.

Every locality is activatable by configuration, not custom code.

# 42. First OpenCode Implementation Backlog
Start the AI implementation with the following sequence. Do not ask separate agents to build vertical screens before the foundation tasks are complete.

- [x] OC-0001 Create monorepo and repository conventions.
- [x] OC-0002 Create architecture decision records.
- [x] OC-0003 Create shared TypeScript configuration/lint/format/test tooling.
- [x] OC-0004 Create Fastify service template.
- [x] OC-0005 Create API Gateway skeleton.
- [x] OC-0006 Create shared error/validation/logger packages.
- [x] OC-0007 Create event envelope and schema package.
- [x] OC-0008 Create environment/configuration package.
- [x] OC-0009 Bootstrap MongoDB/PostgreSQL/Redis/Kafka local infrastructure.
- [ ] OC-0010 Create observability baseline.
- [x] OC-0011 Implement auth-service.
- [x] OC-0012 Implement OTP provider abstraction and staging adapter.
- [x] OC-0013 Implement user-service and RBAC.
- [x] OC-0014 Implement geography-service.
- [x] OC-0015 Implement config-service.
- [ ] OC-0016 Implement media/CDN abstraction.
- [x] OC-0017 Implement catalog-service.
- [x] OC-0018 Implement inventory-service.
- [x] OC-0019 Implement cart-service.
- [x] OC-0020 Implement order-service/state machine.
- [ ] OC-0021 Implement payment-service/provider adapter.
- [ ] OC-0022 Implement webhook/idempotency/reconciliation.
- [x] OC-0023 Implement wallet/ledger.
- [x] OC-0024 Implement settlement/commission.
- [x] OC-0025 Implement notification-service.
- [x] OC-0026 Implement delivery-service.
- [x] OC-0027 Implement driver-service.
- [x] OC-0028 Implement dispatch-engine.
- [x] OC-0029 Implement tracking-service.
- [x] OC-0030 Create Flutter design system.
- [x] OC-0031 Create customer app shell.
- [x] OC-0032 Create partner app shell.
- [x] OC-0033 Create delivery app shell.
- [x] OC-0034 Create admin shell.
- [x] OC-0035 Implement remote-config home renderer using native components.
- [x] OC-0036 Implement Lottie header.
- [x] OC-0037 Implement native OTP UX.
- [ ] OC-0038 Implement native payment UX.
- [ ] OC-0039 Implement Food engine.
- [ ] OC-0040 Implement restaurant operational UX.
- [ ] OC-0041 Implement Local Store.
- [ ] OC-0042 Implement Dairy subscriptions.
- [ ] OC-0043 Implement Zatka.
- [ ] OC-0044 Implement Local Services.
- [ ] OC-0045 Implement Real Estate.
- [ ] OC-0046 Implement support.
- [ ] OC-0047 Implement analytics.
- [ ] OC-0048 Implement production hardening.
- [ ] OC-0049 Run complete release checklist.

# 43. Application Screen & Workflow Master Specification

This section is mandatory for all application implementations. OpenCode agents must not invent screens, navigation flows, business states or role-specific actions independently. Each application must implement the screen and workflow catalog below and record implementation evidence against the relevant task.

## 43.1 Official Applications

LocalWala consists of five official applications:

1. Customer App - Flutter.
1. Partner App - Flutter.
1. Delivery App - Flutter.
1. Executive App - Flutter.
1. Admin Control Center - Angular + TypeScript.

All applications share API contracts, authentication standards, design tokens, analytics conventions and domain terminology, but they must not be forced into one UI experience.

## 43.2 Screen Contract

Every production screen must have a documented screen contract containing:

- Screen ID.
- Screen name.
- Application and role.
- Feature/domain/vertical.
- Entry points and exit points.
- Route/deep link.
- Required permissions.
- API/query/mutation dependencies.
- Domain entities/value objects used.
- Loading state.
- Skeleton state where appropriate.
- Empty state.
- Error state.
- Offline state.
- Unauthorized/session-expired state.
- Primary and secondary actions.
- Navigation behavior.
- Analytics events.
- Audit requirements for privileged actions.
- Acceptance criteria.

## 43.3 Customer App - Screen Catalog

Global/authentication screens:

- Splash and app initialization.
- Onboarding.
- Location permission and location selection.
- Login, signup and OTP verification.
- Profile setup.
- Language selection.
- Notification permission.
- Maintenance mode and force-update screens.
- Network/offline, retry, unauthorized and session-expired screens.

Global consumer experience:

- Home.
- Explore.
- Search and search suggestions.
- Search results and filters.
- Notifications and notification preferences.
- Offers.
- Orders.
- Account.
- Favorites.
- Recently viewed.
- Buy again.
- Addresses and saved locations.
- Wallet and transaction history.
- Referral and earn.
- Payment methods.
- Privacy, security, terms and account deletion.

Food:

- Food home.
- Cuisine/category discovery.
- Restaurant listing/search.
- Restaurant details.
- Menu/category.
- Item details.
- Modifiers/add-ons/customization.
- Cart.
- Checkout.
- Address/delivery instructions.
- Coupon/offer selection.
- Payment.
- Order confirmation.
- Order details/timeline.
- Live tracking.
- Cancel/refund status.
- Reorder and rating.

Dineout, when enabled as a product capability:

- Dineout home.
- Restaurant discovery/details.
- Dining offers.
- Date/time/guest selection.
- Reservation/table confirmation.
- My reservations.
- Reservation details/check-in.
- Bill/payment.
- Review.

Local Store:

- Store home/categories.
- Store listing/details.
- Product listing/search.
- Product details and variants.
- Inventory-aware add-to-cart.
- Cart/checkout.
- Delivery or pickup selection.
- Scheduled delivery.
- Payment/confirmation/tracking.
- Reorder and support.

Dairy:

- Dairy home/category/product.
- Quantity selection.
- Frequency selection.
- Start date.
- Address.
- Subscription checkout/payment.
- Subscription confirmation.
- My subscriptions.
- Subscription details.
- Upcoming deliveries.
- Pause/resume.
- Skip/vacation.
- Change product/quantity/address.
- Missed delivery.
- Subscription history/support.

Zatka:

- Fresh inventory/category discovery.
- Product details.
- Cut/weight/cleaning/marination/packaging options.
- Availability/reservation.
- Delivery slot.
- Cart/checkout/payment.
- Order tracking.
- Shortage/substitution/actual-weight adjustment.
- Refund/price adjustment.
- Support.

Local Services:

- Services home/categories.
- Service/provider listing.
- Provider details.
- Service details.
- Availability/date/time.
- Address and requirements.
- Photo upload.
- Booking confirmation.
- Provider assignment/tracking.
- Inspection.
- Quote details.
- Approve/reject quote.
- Job status/completion.
- Payment/review.
- Reschedule/cancel/support.

Real Estate:

- Real Estate home.
- Buy/rent/sell/new-project discovery.
- Search/list/map.
- Property details/gallery/location/amenities.
- Enquiry/contact.
- Schedule visit.
- My visits.
- Executive assignment.
- Follow-up.
- Property hold.
- Hold details.
- Loan application/status.
- Sale status.
- Documents.
- Transaction/support.

## 43.4 Customer Bottom Navigation

Default configuration is Home, Explore, Orders, Offers and Account. The order and visibility may be configuration-driven, but the native navigation structure must remain predictable and accessible.

## 43.5 Partner App - Screen Catalog

Authentication/onboarding:

- Login/OTP.
- Business type selection.
- Owner/business details.
- KYC/PAN/GST/bank details.
- Document upload and expiry.
- Business address/location.
- Service area.
- Operating hours.
- Staff setup.
- Agreement.
- Application/approval status.

Operations:

- Dashboard.
- Incoming/new orders.
- Order details.
- Accept/reject.
- Preparation/picking/packing/ready states.
- Kitchen mode where applicable.
- Catalog/categories/items/variants.
- Inventory/stock adjustment/out-of-stock.
- Pricing and offers.
- Branches.
- Staff and roles.
- Operating hours/busy mode.
- Ratings and complaints.
- Notifications.

Vertical-specific partner workflows:

- Food: menu, modifiers, preparation time and kitchen states.
- Store: products, variants, inventory, branches, delivery/pickup.
- Dairy: subscription orders, scheduled deliveries, quantity and missed delivery handling.
- Zatka: physical/reserved/sellable inventory, cut/clean/marination/packaging, slot capacity and actual-weight adjustment.
- Services: requests, availability, calendar, quotes, active jobs and service area.

Finance/support:

- Earnings.
- Wallet.
- Transactions.
- Settlements.
- Payouts.
- Invoices/tax reports.
- Commission.
- Refund adjustments.
- Partner support bot.
- Human support chat.
- Account/security.

## 43.6 Delivery App - Screen Catalog

Onboarding:

- Login/OTP.
- KYC.
- Personal details.
- Vehicle details.
- Driving licence/RC/insurance.
- Bank account.
- Verification status.

Execution:

- Delivery dashboard.
- Online/offline/break.
- Zone/availability.
- Delivery offer.
- Accept/reject/expired.
- Pickup details.
- Navigation.
- Restaurant/store arrival.
- Pickup verification.
- Picked up.
- Customer navigation.
- Customer arrival.
- OTP/proof of delivery.
- COD collection.
- Delivered.
- Failed delivery.
- Customer unavailable.
- Return to store.
- Cancelled order.
- Incident report.

Earnings/support:

- Earnings dashboard.
- Incentives/bonuses.
- COD balance.
- Wallet/settlement/withdrawal.
- Delivery history.
- Support bot/chat.
- Emergency flow.
- Vehicle/account/documents.

Driver state machine must be explicit: OFFLINE → ONLINE → AVAILABLE → OFFERED → ACCEPTED → AT_PICKUP → PICKED_UP → OUT_FOR_DELIVERY → AT_CUSTOMER → DELIVERED, with rejected, expired, cancelled, failed, return and suspended states.

## 43.7 Executive App - Screen Catalog

General:

- Login/OTP.
- Profile/role.
- Dashboard.
- Today's tasks.
- Task details.
- Calendar.
- Attendance/check-in/check-out.
- Notifications.
- Expenses.
- Earnings.
- Support.

Service workflow:

- Service requests.
- Request/customer details.
- Navigation.
- Arrival.
- Inspection/checklist.
- Photos and notes.
- Quote creation/details.
- Customer approval.
- Job start/progress/completion.
- Payment/confirmation.
- Review/escalation.

Real-estate workflow:

- Leads.
- Lead/customer details.
- Property search/details.
- Contact/call/chat.
- Schedule visit.
- Navigation.
- Visit/notes/photos.
- Follow-up/reminder.
- Property hold.
- Sale status.
- Loan status.
- Commission.
- Documents.

# 44. Admin Control Center - Master Screen & Workflow Specification

The Admin Control Center is an Angular + TypeScript enterprise web application. It is the operational and configuration control plane. It must not directly modify service-owned databases; it must use authenticated service/API contracts through the platform boundary.

## 44.1 Admin Shell

- Secure login.
- MFA/2FA.
- Device/session management.
- Global search.
- Command palette.
- City/zone/locality context selector.
- Notifications/alerts.
- Breadcrumbs.
- Saved filters.
- Date-range controls.
- Admin profile.
- Access denied/session expired.

## 44.2 RBAC

Roles may include Super Admin, Operations Admin, Finance Admin, Support Manager, Support Agent, Geography Admin, Partner Admin, Catalog Admin, Marketing Admin, Delivery Manager, Real Estate Manager, Service Manager, HR/Employee Admin, Analytics and Read Only.

Permissions must be explicit and auditable: VIEW, CREATE, EDIT, APPROVE, REJECT, ASSIGN, CANCEL, REFUND, PUBLISH, EXPORT and DELETE, subject to role and domain restrictions.

## 44.3 Executive Dashboard

Dashboard widgets:

- Orders.
- GMV/revenue.
- Active deliveries.
- Online drivers.
- Active partners.
- New customers.
- Refunds.
- Support tickets.
- SLA breaches.
- Payment failures.
- Dispatch failures.
- System health.

All applicable metrics must support date, city, operational zone, locality and vertical filters.

## 44.4 Operations Command Center

Screens/views:

- Live orders.
- Live deliveries.
- Dispatch queue.
- Unassigned orders.
- Delayed orders.
- Failed deliveries.
- SLA breaches.
- Driver availability.
- Incidents.
- Serviceability.
- Live map.

Operational actions:

- Assign.
- Reassign.
- Force assign with permission.
- Contact relevant party.
- Investigate.
- Escalate.
- Cancel according to authorization.
- Create incident.
- View complete order/delivery timeline.

## 44.5 Approval Center

Approval queues:

- Partner onboarding.
- Restaurant/store/dairy/Zatka/service-provider onboarding.
- Real-estate properties.
- KYC/documents.
- Bank accounts.
- Organic certification where applicable.
- Refund requests.
- Withdrawals.
- Settlement adjustments.
- Promotions.
- Sponsored placements.

States: PENDING → UNDER_REVIEW → NEEDS_INFORMATION → APPROVED/REJECTED. All decisions must record actor, timestamp, reason and audit information.

## 44.6 Customer Management

- Customer list/search/filter.
- Customer detail.
- Addresses.
- Orders.
- Payments.
- Wallet.
- Referrals.
- Coupons.
- Subscriptions.
- Support tickets/conversations.
- Devices/sessions.
- Account status.
- Audit history.

## 44.7 Partner Management

- Partner list/search/filter.
- Onboarding/approval.
- Business/owner/KYC/documents.
- Branches.
- Staff/roles.
- Catalog.
- Inventory.
- Orders.
- Delivery area.
- Ratings/complaints.
- Earnings/settlements.
- Promotions.
- Audit.

## 44.8 Vertical Management

Food:

- Restaurants.
- Menus/categories/items/modifiers.
- Availability.
- Preparation settings.
- Kitchen states.
- Offers.
- Performance.

Store:

- Stores/branches.
- Categories/products/variants.
- Inventory.
- Pricing.
- Pickup/delivery.
- Offers.

Dairy:

- Products.
- Inventory.
- Subscriptions.
- Delivery schedule.
- Upcoming/missed deliveries.
- Pause/resume requests.

Zatka:

- Partners/products.
- Physical/reserved/sellable inventory.
- Cut/clean/marination/packaging.
- Slots/capacity.
- Orders.
- Weight adjustments.

Services:

- Categories/services/providers.
- Skills/verification.
- Service areas.
- Availability.
- Requests/assignments.
- Quotes/jobs.
- Reviews/complaints.

Real Estate:

- Properties.
- Owners/agents/builders.
- Leads.
- Assignments.
- Visits/follow-ups.
- Holds.
- Sales.
- Loan applications.
- Documents.
- Commissions/settlements.

## 44.9 Order Management

- All orders.
- Status queues.
- Order detail.
- Customer/partner/driver context.
- Items/pricing/tax/discounts.
- Payment.
- Delivery.
- Timeline/events.
- Support.
- Refunds.
- Audit.

## 44.10 Finance Administration

Payments:

- Successful/pending/failed transactions.
- Provider references.
- Webhook status.
- Reconciliation.

Refunds:

- Item/order/partial/full refund.
- Approval.
- Processing.
- Completed/failed.
- Adjustment history.

Wallet:

- Customer/partner/driver/executive wallets.
- Transactions.
- Adjustments.
- Withdrawals.

Settlements:

- Partner.
- Delivery.
- Executive.
- Referral.
- Platform.
- Pending/processing/paid/failed.
- Reconciliation.

Financial correction must use auditable adjustment/reversal records rather than destructive editing.

## 44.11 Delivery & Driver Administration

Delivery:

- Live deliveries.
- Unassigned.
- Assigned.
- Pickup.
- In transit.
- Delivered.
- Failed.
- Returned.
- Incidents.
- SLA.

Drivers:

- Driver list.
- KYC/documents.
- Vehicle.
- Current location where authorized.
- Availability.
- Current assignment.
- Delivery history.
- Earnings/COD.
- Incentives.
- Incidents.
- Suspension/audit.

## 44.12 Geography Administration

Canonical operational hierarchy:

Country → State → City → Operational Zone → Locality → Geo Boundary.

Administrative/reference metadata such as District, Mandal/Taluk and Pincode remains separate.

Screens:

- Country master.
- State master.
- City master.
- Operational zones.
- Localities.
- Geo boundaries.
- Administrative metadata.
- Service zones.
- Import/version history.
- Activation/deactivation.
- Map editor.
- Point-in-polygon validation.
- Serviceability preview.

Geography changes require versioning, audit and appropriate downstream cache/index refresh.

## 44.13 Home Builder / CMS

- Home sections.
- Vertical tabs.
- Banners.
- Categories.
- Collections.
- Offers.
- Sponsored sections.
- Schedules.
- Preview.
- Publish.
- Rollback.

Section configuration fields should support section ID, title, subtitle, vertical, section type, data source, category, zone, locality, customer segment, start/end time, priority, ranking, limit and visibility.

## 44.14 Media/Lottie

- Images.
- Videos.
- Lottie assets.
- Banners.
- Icons.
- Documents.

Lottie configuration includes URL/asset, fit, size, speed, loop, autoplay, visibility, date range and geographic/vertical targeting.

## 44.15 Category, Filter & Search Administration

Category management:

- Name.
- Icon/image.
- Vertical.
- Parent category.
- Sort order.
- Active state.
- Geographic targeting.
- Schedule.

Filter engine:

- Attribute definitions.
- Filter groups.
- Sort options.
- Vertical applicability.
- Geographic/segment applicability.

Search administration:

- Search terms.
- Suggestions.
- Trending terms.
- Synonyms.
- Ranking/boosting.
- Banned terms.
- Search analytics.

## 44.16 Promotions & Campaigns

- Coupons.
- Discounts.
- Cashback.
- Free delivery.
- BOGO.
- Combos.
- Sponsored placements.
- Campaigns.

Eligibility/targeting:

- Platform.
- Partner.
- Category/product.
- City/zone/locality.
- Customer segment.
- New/existing customer.
- Subscription customer.
- Payment method.

## 44.17 Notifications

Channels:

- Push.
- SMS.
- Email.
- WhatsApp where integrated.
- In-app.

Admin screens:

- Templates.
- Campaigns.
- Delivery logs.
- Preference rules.
- Deep-link configuration.

## 44.18 Support & Agent Console

Support queues:

- Live queue.
- My conversations.
- Unassigned.
- High priority.
- SLA breached.
- Waiting customer.
- Waiting partner.
- Waiting driver.
- Escalated.
- Resolved.
- Closed.
- Analytics.

Agent workspace must provide three coordinated panels: queue/list, conversation and context.

Actions:

- Reply.
- Template.
- Attachment.
- Internal note.
- Assign/reassign.
- Transfer.
- Escalate.
- Callback.
- Contextual order/payment/delivery actions.
- Close/reopen.

## 44.19 Chatbot Administration

- Intents.
- Categories.
- Conversation flows.
- Responses.
- Authorized bot actions.
- Escalation rules.
- Human handoff.
- Knowledge/configuration.
- Conversation logs.
- Bot analytics.

Bot actions must always execute through authorized backend operations; the bot must never bypass domain authorization or financial controls.

## 44.20 Employee/Executive Administration

- Employees.
- Executives.
- Departments.
- Roles.
- Permissions.
- Attendance.
- Tasks.
- Performance.
- Expenses.
- Access.

## 44.21 Analytics

- Business analytics.
- Customer analytics.
- Order analytics.
- Revenue/GMV.
- Partner analytics.
- Delivery analytics.
- Food/store/dairy/Zatka analytics.
- Services analytics.
- Real-estate analytics.
- Support analytics.
- Marketing analytics.

## 44.22 Feature Flags & System Settings

Feature flags must support environment, app version, platform, vertical, city, zone, locality and customer-segment targeting where required.

System settings cover authentication/OTP, payment, delivery, orders, inventory, subscriptions, services, real estate, notifications, support, security and integrations.

## 44.23 System Health

Admin must expose service and infrastructure health for authorized operations users:

- API gateway.
- Core services.
- Orders/payments/inventory/dispatch.
- Notifications/search/support.
- Kafka.
- Redis.
- Databases.
- External providers.

Show HEALTHY, DEGRADED or DOWN with latency/error/queue/heartbeat information where available.

## 44.24 Audit Logs

Audit views must support:

- Actor.
- Action.
- Timestamp.
- Target entity.
- Before/after where appropriate.
- Reason.
- IP/device/session metadata where permitted.
- Correlation/trace ID.

Critical financial, security, authorization, configuration, order, refund and settlement actions must be auditable.

# 45. Support & Conversational Platform - Complete Specification

Support is a platform capability shared by Customer, Partner, Delivery and Executive experiences and operated from Admin.

## 45.1 Customer Support Flow

Customer → Help & Support → AI/Bot First → resolved OR human handoff → assignment → conversation → resolution → CSAT → close/reopen.

Support categories must cover Orders, Payments, Delivery, Food, Stores, Dairy, Zatka, Services, Real Estate, Account, Wallet, Referral and Other.

When support is opened from an order or transaction, the backend must pass relevant context so agents do not repeatedly request information already available.

## 45.2 Bot-to-Agent Handoff Contract

Handoff must include:

- Conversation transcript.
- Customer profile.
- Order/booking/property context.
- Detected issue/intent.
- Bot actions already taken.
- Relevant IDs.
- Payment/delivery status.
- Suggested resolution where available.
- SLA/priority.

## 45.3 Support Domain Model

Conversation, Message, Participant, Ticket, TicketCategory, TicketTag, Assignment, SLA, Priority, InternalNote, Escalation, Transfer, BotSession, BotIntent, BotAction, Resolution, CSAT, Attachment and ConversationAudit.

## 45.4 Support States

OPEN, BOT_ACTIVE, WAITING_FOR_AGENT, ASSIGNED, IN_PROGRESS, WAITING_CUSTOMER, WAITING_PARTNER, WAITING_DRIVER, ESCALATED, RESOLVED, CLOSED and REOPENED.

# 46. Global Customer UI Content Architecture

The customer app must use a formal Global Section Engine. Flutter owns reusable native components; backend configuration controls content, ordering, visibility, targeting, schedules and data sources. Arbitrary remote code execution is prohibited.

## 46.1 Section Types

Horizontal cards, vertical cards, grids, 2/3/4-column grids, carousels, banners, hero sections, story rails, category rails, product rails, restaurant rails, property rails, service-provider rails, offer rails, map/list sections, collections and search-result sections.

## 46.2 Section Configuration

Section ID, title, subtitle, vertical, section type, data source, category, zone, locality, customer segment, start/end time, priority, ranking, limit and visibility.

## 46.3 Global Card System

Restaurant cards: image, rating, name, cuisine, ETA, distance, offer and price.

Product cards: image, brand, product, weight/quantity, MRP, selling price, discount, stock and add action.

Service cards: provider, service, rating, starting price, distance, availability, verification and book action.

Property cards: image, property, location, price, BHK, area, verification, owner/agent and visit action.

## 46.4 Global Filter and Offer Engines

Filters are backend-configured and rendered through reusable Flutter components. Offers support platform, partner, category, product, zone/locality and customer-segment scopes, with percentage/flat/free-delivery/cashback/BOGO/combo/special-price benefits where applicable.

## 46.5 Personalization

The home feed may expose contextual sections such as buy again, favorites, recently viewed, upcoming dairy subscriptions, recently viewed properties and behavior-based recommendations. Personalization must remain governed by configuration and privacy rules.

# 47. Navigation, Deep Linking & Common UX State Contract

Every application must define route ownership and deep links. Push notifications, support conversations, order updates, payment results, service bookings and real-estate visits must be able to open the relevant contextual screen when authorized.

Every important operation must define loading, skeleton where appropriate, empty, error, offline, retry, unauthorized and session-expired states. Destructive or irreversible actions require confirmation and clear outcome feedback.

# 48. Flutter Architecture - DDD/Clean/Feature-First Clarification

Flutter architecture is explicitly:

Feature-First + Clean Architecture + DDD principles + Repository Pattern + Use Cases + consistent reactive state management.

Each feature should be structured around presentation, application/use-case, domain and data/infrastructure concerns. Domain entities/value objects and business rules must not depend on Flutter widgets or HTTP clients. API models belong to the data layer and are mapped to domain models where appropriate.

The four Flutter applications use the same architectural standards but have different feature sets and role-specific workflows. Do not mirror backend microservices one-to-one as Flutter folders; organize the mobile UI around user/business capabilities.

# 49. Admin Architecture - Feature-First Enterprise Web

The Angular Admin application uses a feature-first enterprise structure with shared core infrastructure, shared design-system components and domain feature modules. It must implement route guards, RBAC/permission checks, API interceptors, error handling, audit-aware actions, table/filter/form/map/chart primitives and responsive enterprise layouts.

Recommended structure:

- core/auth, guards, permissions, API, routing, notifications and error handling.
- shared/components, tables, forms, maps, charts and design system.
- features/dashboard, operations, approvals, customers, partners, restaurants, stores, dairy, zatka, services, realestate, orders, payments, refunds, wallet, settlements, delivery, drivers, geography, home-builder, media, promotions, notifications, support, chatbot, employees, analytics, feature-flags, system-health, settings and audit.

Admin is a control plane, not a database console. All mutations must use authorized APIs and respect service ownership.

# 50. AI/OpenCode Screen Implementation Rules

OpenCode agents must not create screens solely from a feature name. Before implementation, the agent must read the relevant screen contract and business workflow.

For every screen, the agent must:

1. Verify the screen ID and application.
1. Verify role and permission requirements.
1. Verify the domain/API dependencies.
1. Implement all required states.
1. Implement navigation/deep-link behavior.
1. Implement analytics events where specified.
1. Implement authorization and audit behavior for privileged actions.
1. Add relevant tests.
1. Update the implementation checklist.
1. Report blockers rather than substituting fake APIs, hardcoded business rules or placeholder success states.

No agent may silently rename, merge or remove a required screen/workflow. Any architectural deviation must be recorded and approved through the project's documented ADR/architecture process.

# 51. Updated Implementation Backlog - Application UX & Admin

The following work packages are now mandatory additions to the implementation backlog:

- OC-0050 - Customer screen registry and navigation/deep-link contracts.
- OC-0051 - Customer global section/category/filter/offer rendering engine.
- OC-0052 - Food and Dineout screen workflows.
- OC-0053 - Store screen workflows.
- OC-0054 - Dairy subscription screen workflows.
- OC-0055 - Zatka inventory/cut/weight screen workflows.
- OC-0056 - Local Services booking/quote/job workflows.
- OC-0057 - Real Estate discovery/lead/visit/hold/sale workflows.
- OC-0058 - Partner app screen registry and vertical workflows.
- OC-0059 - Delivery app execution/state-machine workflows.
- OC-0060 - Executive app services and real-estate field workflows.
- OC-0061 - Customer/partner/driver/executive support bot and handoff.
- OC-0062 - Admin shell, RBAC and permission matrix.
- OC-0063 - Admin dashboard and Operations Command Center.
- OC-0064 - Admin Approval Center.
- OC-0065 - Admin customer/partner/vertical management.
- OC-0066 - Admin order/payment/refund/wallet/settlement control.
- OC-0067 - Admin delivery/driver operations and live map.
- OC-0068 - Admin geography/map/GeoJSON management.
- OC-0069 - Admin Home Builder/CMS/category/filter/search management.
- OC-0070 - Admin promotions/notifications/media/Lottie management.
- OC-0071 - Admin Support Agent Console and Chatbot Administration.
- OC-0072 - Admin employees/analytics/feature flags/system health/audit.
- OC-0073 - Screen-contract test coverage and acceptance evidence.

These tasks must be added to the master registry and must not be treated as optional UI polish.

# 52. Final Application Completion Gate

The platform is not considered application-complete merely because all APIs compile or the main happy path works. Completion requires:

- All five official applications have implemented screen registries.
- All major business workflows have explicit state machines.
- All critical screens implement loading/empty/error/offline/unauthorized/session-expired states.
- RBAC is enforced in Admin.
- Admin approvals and privileged operations are audited.
- Support bot-to-agent handoff is operational.
- Home sections/categories/filters/offers are configuration-driven.
- Geography uses the canonical hierarchy and actual boundaries where available.
- Customer, Partner, Delivery and Executive apps have separate role-specific workflows.
- Critical payment/order/inventory/dispatch/support workflows have automated tests.
- No screen or workflow is backed by fake success responses, TODO-only logic or hardcoded production business rules.

# 53. Authentication, Persistence & Asset Resilience - Non-Negotiable Implementation Contract

This section extends the existing authentication, media/CDN, remote-configuration, screen-state and production-readiness requirements. OpenCode agents MUST implement these contracts consistently and MUST NOT invent alternate behavior.

## 53.1 Authentication & Signup/Login

Customer authentication is mobile-number + OTP based. New users complete profile setup after OTP verification; existing users proceed to the authenticated experience.

- Splash → App Bootstrap → Maintenance/Force Update → Onboarding → Mobile Number → Send OTP → Verify OTP.
- After OTP verification, determine whether the identity is an existing user.
- Existing user: restore/establish session and continue to Home, subject to any incomplete required onboarding state.
- New user: Complete Profile with Name REQUIRED; Email OPTIONAL; Referral OPTIONAL; then Location Setup and Home.
- Incomplete registration must be resumable after app restart without creating duplicate customer identities.
- Handle wrong OTP, expired OTP, resend OTP, OTP attempt/rate limits, session creation, refresh, expiry, logout and account deletion.
- A temporary/incomplete registration state may be used until the required profile completion is finished.

## 53.2 Persistence & State Restoration

Persistence MUST be classified into server-authoritative, secure-local, cached/UX-local, and ephemeral state.

- Server-authoritative: users, profiles, addresses, orders, payments, wallet, subscriptions, favorites, referrals, support, bookings, property enquiries, carts and operational states.
- Secure-local: access token, refresh token, session/device identifiers and authentication metadata using platform-secure storage.
- UX-local/cache: selected location/address, selected vertical, language/theme, recent searches, recently viewed, cached configuration, cached categories, cached banners, cart cache and onboarding progress.
- The server remains authoritative when local cached state conflicts with server state.
- Cart restoration MUST synchronize with the server and revalidate inventory, price and availability before presenting a final checkout state.
- On app restart, restore the authenticated session when valid; refresh tokens when required; otherwise clear the invalid session and return to authentication.
- Offline startup should use safe cached configuration where possible and must expose offline/retry state rather than rendering a broken screen.

## 53.3 Static Application Assets vs Dynamic Business Assets

Business/content assets MUST NOT be hardcoded into Flutter or Admin. Application-critical assets required for safe rendering MUST be bundled locally.

| Asset | Dynamic | Bundled |
| --- | --- | --- |
| Product / restaurant / store / property / provider images | YES | NO |
| User avatars / banners / offers / category images | YES | NO |
| Vertical promotional artwork / dynamic Lottie | YES | NO |
| LocalWala logo / logo mark | Optional | YES |
| Native splash logo / brand startup background | NO | YES |
| Product / restaurant / store / dairy / Zatka / service / property placeholders | NO | YES |
| Network / server / timeout / unauthorized / forbidden error assets | NO | YES |
| Empty-state / success / payment-state assets | NO | YES |
| Critical loading animation / system icons | NO | YES |

## 53.4 Static Flutter Asset Contract

Flutter MUST contain a minimal local asset set sufficient to render safely without backend/CDN availability.

- brand/: logo, logo mark, splash logo, brand startup background.
- placeholders/: product, restaurant, store, dairy, Zatka, service provider, property, avatar.
- errors/: network, server, timeout, unauthorized, forbidden, something went wrong.
- empty/: cart, orders, favorites, notifications, search, subscriptions and other required empty states.
- status/: success, payment success, payment failed, cancelled and other required status states.
- animations/: critical local loading/success/error animations where required.
- The exact local asset filenames/keys MUST be defined in the app asset registry/constants and referenced through the design system rather than scattered hardcoded paths.

## 53.5 Static Admin Asset Contract

- Admin MUST bundle application-critical brand assets, icons, illustrations, placeholders, error states, empty states and status assets required for safe operation.
- Admin business/content imagery such as product, restaurant, store, property, provider, campaign and offer media MUST be loaded from the media/content system rather than embedded as permanent application assets.
- Admin must remain usable when dynamic media is unavailable; tables, forms, navigation and core controls must not depend on a remote content image.

## 53.6 Asset Registry & Media Resolution

Dynamic assets MUST be addressable through a consistent asset registry/media abstraction. Recommended fields:

- assetKey, assetType, scope, vertical, remoteUrl, localFallback, fallbackAssetKey, fit, dimensions, cachePolicy, version and enabled state.
- Admin/Media Service owns dynamic business/content assets and their metadata; object storage/CDN serves optimized media.
- Remote configuration may select dynamic assets, but remote configuration MUST NOT make application startup dependent on remote media.

## 53.7 Asset Fallback Resolution

Every remote/content asset MUST have a deterministic fallback strategy:

- Remote configured asset → Remote load → Cached asset → Bundled context-specific fallback → Design-token/brand fallback → Hide optional component.
- Product image failure → product placeholder.
- Restaurant image failure → restaurant placeholder.
- Store image failure → store placeholder.
- Dairy image failure → dairy placeholder.
- Zatka image failure → Zatka placeholder.
- Service-provider image failure → service-provider placeholder.
- Property image failure → property placeholder.
- Avatar failure → avatar placeholder.
- A single generic broken-image icon MUST NOT be the universal fallback for all verticals.

## 53.8 Lottie & Remote Media Resilience

- Remote Lottie → cached Lottie → bundled local Lottie → static image → brand background.
- Remote banner → cached banner → bundled fallback banner → generic local banner → hide optional section.
- Remote asset failure MUST NOT prevent the rest of the screen from rendering.
- Asset loading must support loading, success, failure and fallback states and must avoid repeated uncontrolled downloads.

## 53.9 Native Splash & Bootstrap

- The first splash screen MUST be native/bundled and available without network access.
- Splash MUST contain the bundled LocalWala logo and bundled brand startup background/color.
- Remote configuration, CDN media, Lottie and API responses MUST NOT be required to display the initial splash.
- After splash, Bootstrap loads session, cached configuration, feature flags, maintenance/force-update state, location context and required dynamic assets.
- If the network is unavailable, the app should use safe cached state where possible and transition to an explicit offline/retry state.

## 53.10 Global Rendering State Contract

Important screens/components MUST explicitly support the applicable states:

- LOADING
- SKELETON
- LOADED
- EMPTY
- ERROR
- OFFLINE
- RETRY
- UNAUTHORIZED
- FORBIDDEN
- SESSION_EXPIRED
- FALLBACK
- MAINTENANCE
- FORCE_UPDATE

## 53.11 OpenCode Non-Negotiable Rules

- Do not invent authentication or onboarding behavior outside the defined contract.
- Do not hardcode business/content images, banners, offers, category imagery or vertical promotional content into Flutter/Admin.
- Do not make remote assets mandatory for application startup.
- Do not render broken-image icons when a context-specific fallback exists.
- Every production screen MUST implement the states required by its screen contract.
- Every remote asset MUST have a defined fallback path.
- Every persistent value MUST be classified as server-authoritative, secure-local, cached/UX-local or ephemeral.
- All asset, persistence and authentication behavior MUST be testable in offline, expired-session, missing-media, invalid-URL, CDN-failure and app-restart scenarios.

## 53.12 Release Acceptance Tests

- New customer can complete OTP signup and resume incomplete onboarding after app restart.
- Existing customer can restore a valid session without unnecessary login.
- Expired session is refreshed or safely returned to login.
- Cart survives restart and reconciles against server inventory/pricing.
- App launches with no network using bundled splash and safe local assets.
- Missing product/restaurant/store/property/provider image displays the correct contextual placeholder.
- Broken CDN URL falls back without breaking the surrounding UI.
- Remote Lottie failure follows the defined fallback chain.
- Admin remains operational when dynamic content media is unavailable.
- All required loading/empty/error/offline/unauthorized/session-expired states are visually implemented and tested.

