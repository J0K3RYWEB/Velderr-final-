# Velderr Product & Operations Specification

Customer journey: discover services -> request booking -> receive reference -> admin review -> quotation -> confirmation -> staff assignment -> payment record -> event completion.

Roles: Customer, Admin/Operations, Staff.

Core booking data: name, phone, email, date, time, location, guest count, service, package, budget and notes.

Package tiers (guest-count based): Bronze (50–100), Silver (101–250), Gold (251–500), Platinum (501–750), Diamond (751–1000), Double Diamond (1001–1500), Triple Diamond (1501–2000). Guest count auto-recommends a tier via `/api/public/recommend`.

Operational modules: bookings, staff roster, availability, quotes, payment records, KPIs and communication.

Production security: managed database, salted password hashes, short-lived sessions, RBAC, server validation, rate limits, HTTPS, backups and audit logs.
