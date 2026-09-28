

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
