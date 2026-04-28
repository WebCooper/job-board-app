# Database Schemas

These schemas reflect the TypeORM entity definitions used at runtime. Tables are auto-synchronized when `NODE_ENV` is not `production`.

## jobs_db

### Table: `jobs`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key, `gen_random_uuid()` |
| employer_id | varchar(255) | Indexed |
| title | varchar(255) | |
| description | text | |
| salary_min | numeric(10,2) | Nullable |
| salary_max | numeric(10,2) | Nullable |
| status | varchar(50) | Default `DRAFT` |
| created_at | timestamp | Default `CURRENT_TIMESTAMP` |

## payments_db

### Table: `payments`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key, `gen_random_uuid()` |
| employer_id | varchar(255) | Indexed |
| job_id | varchar(255) | |
| amount | numeric(10,2) | Nullable |
| status | varchar(50) | Nullable |
| created_at | timestamp | Default `CURRENT_TIMESTAMP` |

## applications_db

### Table: `applications`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key, `gen_random_uuid()` |
| job_id | varchar(255) | Nullable |
| candidate_id | varchar(255) | Nullable |
| resume | text | Nullable |
| cover_letter | text | Nullable |
| phone_number | text | Nullable |
| preferred_start_date | date | Nullable |
| status | varchar(50) | Nullable |
| saga_state | varchar(50) | |
| created_at | timestamp | Default `CURRENT_TIMESTAMP` |

## notifications_db

### Table: `notifications`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key, generated |
| eventType | varchar(255) | |
| status | varchar(50) | Default `RECEIVED` |
| recipientEmail | varchar(255) | |
| subject | varchar(255) | |
| body | text | |
| errorMessage | text | Nullable |
| payload | jsonb | |
| createdAt | timestamp | Auto timestamp |

## jobboard_auth

### Table: `users`

| Column | Type | Notes |
| --- | --- | --- |
| id | int | Primary key, auto-generated |
| auth0_sub | varchar(255) | Unique, not null |
| role | varchar(50) | Not null |
| created_at | timestamp with time zone | Default `CURRENT_TIMESTAMP` |
