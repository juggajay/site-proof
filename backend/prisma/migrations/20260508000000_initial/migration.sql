-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abn" TEXT,
    "address" TEXT,
    "logo_url" TEXT,
    "subscription_tier" TEXT NOT NULL DEFAULT 'basic',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "full_name" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "company_id" TEXT,
    "role_in_company" TEXT NOT NULL DEFAULT 'member',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "tos_accepted_at" TIMESTAMP(3),
    "tos_version" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "oauth_provider" TEXT,
    "oauth_provider_id" TEXT,
    "token_invalidated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_backup_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'read',
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '["*"]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "error" TEXT,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "auth_lockouts" (
    "key" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_lockouts_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "state_hash" TEXT NOT NULL,
    "redirect_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_callback_codes" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_callback_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_email_preferences" (
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "mentions_timing" TEXT NOT NULL DEFAULT 'immediate',
    "ncr_assigned" BOOLEAN NOT NULL DEFAULT true,
    "ncr_assigned_timing" TEXT NOT NULL DEFAULT 'immediate',
    "ncr_status_change" BOOLEAN NOT NULL DEFAULT true,
    "ncr_status_change_timing" TEXT NOT NULL DEFAULT 'immediate',
    "hold_point_reminder" BOOLEAN NOT NULL DEFAULT true,
    "hold_point_reminder_timing" TEXT NOT NULL DEFAULT 'immediate',
    "hold_point_release" BOOLEAN NOT NULL DEFAULT true,
    "hold_point_release_timing" TEXT NOT NULL DEFAULT 'immediate',
    "comment_reply" BOOLEAN NOT NULL DEFAULT true,
    "comment_reply_timing" TEXT NOT NULL DEFAULT 'immediate',
    "scheduled_reports" BOOLEAN NOT NULL DEFAULT true,
    "scheduled_reports_timing" TEXT NOT NULL DEFAULT 'immediate',
    "daily_digest" BOOLEAN NOT NULL DEFAULT false,
    "diary_reminder" BOOLEAN NOT NULL DEFAULT true,
    "diary_reminder_timing" TEXT NOT NULL DEFAULT 'immediate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_email_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notification_digest_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "project_name" TEXT,
    "link_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_digest_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "project_id" TEXT,
    "assigned_to_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "escalated_to" JSONB,

    CONSTRAINT "notification_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "project_number" TEXT NOT NULL,
    "client_name" TEXT,
    "contract_value" DECIMAL(65,30),
    "start_date" TIMESTAMP(3),
    "target_completion" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "state" TEXT NOT NULL,
    "specification_set" TEXT NOT NULL,
    "chainage_start" DECIMAL(65,30),
    "chainage_end" DECIMAL(65,30),
    "lot_prefix" TEXT DEFAULT 'LOT-',
    "lot_starting_number" INTEGER DEFAULT 1,
    "ncr_prefix" TEXT DEFAULT 'NCR-',
    "ncr_starting_number" INTEGER DEFAULT 1,
    "settings" TEXT,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "working_hours_start" TEXT DEFAULT '07:00',
    "working_hours_end" TEXT DEFAULT '17:00',
    "working_days" TEXT DEFAULT '1,2,3,4,5',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_users" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "project_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_areas" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chainage_start" DECIMAL(65,30),
    "chainage_end" DECIMAL(65,30),
    "colour" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "lot_type" TEXT NOT NULL,
    "description" TEXT,
    "chainage_start" DECIMAL(65,30),
    "chainage_end" DECIMAL(65,30),
    "offset" TEXT,
    "offset_custom" TEXT,
    "layer" TEXT,
    "area_zone" TEXT,
    "structure_id" TEXT,
    "structure_element" TEXT,
    "activity_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "itp_template_id" TEXT,
    "assigned_subcontractor_id" TEXT,
    "budget_amount" DECIMAL(65,30),
    "created_by" TEXT,
    "conformed_at" TIMESTAMP(3),
    "conformed_by" TEXT,
    "claimed_in_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itp_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "activity_type" TEXT,
    "specification_reference" TEXT,
    "state_spec" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itp_checklist_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "acceptance_criteria" TEXT,
    "point_type" TEXT NOT NULL DEFAULT 'standard',
    "responsible_party" TEXT NOT NULL DEFAULT 'contractor',
    "evidence_required" TEXT NOT NULL DEFAULT 'none',
    "test_type" TEXT,
    "notes" TEXT,

    CONSTRAINT "itp_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itp_instances" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_snapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itp_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itp_completions" (
    "id" TEXT NOT NULL,
    "itp_instance_id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "signature_url" TEXT,
    "witness_present" BOOLEAN,
    "witness_name" TEXT,
    "witness_company" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'none',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "verification_notes" TEXT,
    "gps_latitude" DECIMAL(65,30),
    "gps_longitude" DECIMAL(65,30),

    CONSTRAINT "itp_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itp_completion_attachments" (
    "id" TEXT NOT NULL,
    "completion_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,

    CONSTRAINT "itp_completion_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hold_points" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "itp_checklist_item_id" TEXT NOT NULL,
    "point_type" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notification_sent_at" TIMESTAMP(3),
    "notification_sent_to" TEXT,
    "scheduled_date" TIMESTAMP(3),
    "scheduled_time" TEXT,
    "released_by_name" TEXT,
    "released_by_organisation" TEXT,
    "released_at" TIMESTAMP(3),
    "release_method" TEXT,
    "release_signature_url" TEXT,
    "release_notes" TEXT,
    "evidence_package_url" TEXT,
    "chase_count" INTEGER NOT NULL DEFAULT 0,
    "last_chased_at" TIMESTAMP(3),
    "is_escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalated_at" TIMESTAMP(3),
    "escalated_by" TEXT,
    "escalated_to" TEXT,
    "escalation_reason" TEXT,
    "escalation_resolved" BOOLEAN NOT NULL DEFAULT false,
    "escalation_resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hold_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hold_point_release_tokens" (
    "id" TEXT NOT NULL,
    "hold_point_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "released_by_name" TEXT,
    "released_by_org" TEXT,
    "release_signature_url" TEXT,
    "release_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hold_point_release_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "itp_checklist_item_id" TEXT,
    "test_type" TEXT NOT NULL,
    "test_request_number" TEXT,
    "laboratory_name" TEXT,
    "laboratory_report_number" TEXT,
    "sample_date" TIMESTAMP(3),
    "sample_location" TEXT,
    "test_date" TIMESTAMP(3),
    "result_date" TIMESTAMP(3),
    "result_value" DECIMAL(65,30),
    "result_unit" TEXT,
    "specification_min" DECIMAL(65,30),
    "specification_max" DECIMAL(65,30),
    "pass_fail" TEXT NOT NULL DEFAULT 'pending',
    "certificate_document_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "entered_by" TEXT,
    "entered_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "ai_extracted" BOOLEAN NOT NULL DEFAULT false,
    "ai_confidence" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ncrs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "ncr_number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specification_reference" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "status" TEXT NOT NULL DEFAULT 'open',
    "qm_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "qm_approved_by" TEXT,
    "qm_approved_at" TIMESTAMP(3),
    "raised_by" TEXT,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsible_user_id" TEXT,
    "responsible_subcontractor_id" TEXT,
    "due_date" TIMESTAMP(3),
    "root_cause_category" TEXT,
    "root_cause_description" TEXT,
    "proposed_corrective_action" TEXT,
    "response_submitted_at" TIMESTAMP(3),
    "rectification_notes" TEXT,
    "rectification_submitted_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "verification_notes" TEXT,
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "concession_justification" TEXT,
    "concession_risk_assessment" TEXT,
    "client_notification_required" BOOLEAN NOT NULL DEFAULT false,
    "client_notified_at" TIMESTAMP(3),
    "lessons_learned" TEXT,
    "response" TEXT,
    "responded_at" TIMESTAMP(3),
    "responded_by" TEXT,
    "qm_reviewed_at" TIMESTAMP(3),
    "qm_reviewed_by" TEXT,
    "qm_review_comments" TEXT,
    "revision_requested" BOOLEAN NOT NULL DEFAULT false,
    "revision_requested_at" TIMESTAMP(3),
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "escalated_at" TIMESTAMP(3),
    "escalated_by" TEXT,
    "escalation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ncrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ncr_lots" (
    "id" TEXT NOT NULL,
    "ncr_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,

    CONSTRAINT "ncr_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ncr_evidence" (
    "id" TEXT NOT NULL,
    "ncr_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ncr_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_diaries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "weather_source" TEXT,
    "weather_conditions" TEXT,
    "temperature_min" DECIMAL(65,30),
    "temperature_max" DECIMAL(65,30),
    "rainfall_mm" DECIMAL(65,30),
    "weather_notes" TEXT,
    "general_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_diaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_personnel" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "start_time" TEXT,
    "finish_time" TEXT,
    "hours" DECIMAL(65,30),
    "lot_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "docket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diary_personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_plant" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "id_rego" TEXT,
    "company" TEXT,
    "hours_operated" DECIMAL(65,30),
    "notes" TEXT,
    "lot_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "docket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diary_plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_activities" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30),
    "unit" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diary_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_visitors" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "purpose" TEXT,
    "time_in_out" TEXT,

    CONSTRAINT "diary_visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_delays" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "delay_type" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "duration_hours" DECIMAL(65,30),
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "lot_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diary_delays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_deliveries" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "docket_number" TEXT,
    "quantity" DECIMAL(65,30),
    "unit" TEXT,
    "lot_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_events" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "lot_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_addendums" (
    "id" TEXT NOT NULL,
    "diary_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diary_addendums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_subcontractors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "abn" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_email" TEXT,
    "primary_contact_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_subcontractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractor_companies" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "global_subcontractor_id" TEXT,
    "company_name" TEXT NOT NULL,
    "abn" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_email" TEXT,
    "primary_contact_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "portal_access" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcontractor_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractor_users" (
    "id" TEXT NOT NULL,
    "subcontractor_company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontractor_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_subcontractor_assignments" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "subcontractor_company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "can_complete_itp" BOOLEAN NOT NULL DEFAULT false,
    "itp_requires_verification" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_subcontractor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_roster" (
    "id" TEXT NOT NULL,
    "subcontractor_company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "hourly_rate" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_register" (
    "id" TEXT NOT NULL,
    "subcontractor_company_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "id_rego" TEXT,
    "dry_rate" DECIMAL(65,30),
    "wet_rate" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_dockets" (
    "id" TEXT NOT NULL,
    "subcontractor_company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "foreman_notes" TEXT,
    "adjustment_reason" TEXT,
    "notes" TEXT,
    "total_labour_submitted" DECIMAL(65,30),
    "total_labour_approved" DECIMAL(65,30),
    "total_plant_submitted" DECIMAL(65,30),
    "total_plant_approved" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_dockets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_labour" (
    "id" TEXT NOT NULL,
    "docket_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "start_time" TEXT,
    "finish_time" TEXT,
    "submitted_hours" DECIMAL(65,30),
    "approved_hours" DECIMAL(65,30),
    "hourly_rate" DECIMAL(65,30),
    "submitted_cost" DECIMAL(65,30),
    "approved_cost" DECIMAL(65,30),
    "adjustment_reason" TEXT,

    CONSTRAINT "docket_labour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_labour_lots" (
    "id" TEXT NOT NULL,
    "docket_labour_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "hours" DECIMAL(65,30),

    CONSTRAINT "docket_labour_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_plant" (
    "id" TEXT NOT NULL,
    "docket_id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "hours_operated" DECIMAL(65,30),
    "wet_or_dry" TEXT,
    "hourly_rate" DECIMAL(65,30),
    "submitted_cost" DECIMAL(65,30),
    "approved_cost" DECIMAL(65,30),
    "adjustment_reason" TEXT,

    CONSTRAINT "docket_plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_plant_lots" (
    "id" TEXT NOT NULL,
    "docket_plant_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "hours" DECIMAL(65,30),

    CONSTRAINT "docket_plant_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_claims" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "claim_number" INTEGER NOT NULL,
    "claim_period_start" TIMESTAMP(3) NOT NULL,
    "claim_period_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "prepared_by" TEXT,
    "prepared_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_to" TEXT,
    "total_claimed_amount" DECIMAL(65,30),
    "certified_amount" DECIMAL(65,30),
    "certified_at" TIMESTAMP(3),
    "paid_amount" DECIMAL(65,30),
    "paid_at" TIMESTAMP(3),
    "payment_reference" TEXT,
    "evidence_package_url" TEXT,
    "sopa_statement_generated" BOOLEAN NOT NULL DEFAULT false,
    "disputed_at" TIMESTAMP(3),
    "dispute_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claimed_lots" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30),
    "unit" TEXT,
    "rate" DECIMAL(65,30),
    "amount_claimed" DECIMAL(65,30),
    "percentage_complete" DECIMAL(65,30),
    "evidence_package_url" TEXT,
    "notes" TEXT,

    CONSTRAINT "claimed_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "document_type" TEXT NOT NULL,
    "category" TEXT,
    "filename" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gps_latitude" DECIMAL(65,30),
    "gps_longitude" DECIMAL(65,30),
    "capture_timestamp" TIMESTAMP(3),
    "ai_classification" TEXT,
    "caption" TEXT,
    "tags" TEXT,
    "is_favourite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_document_id" TEXT,
    "is_latest_version" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_signed_url_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_signed_url_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "drawing_number" TEXT NOT NULL,
    "title" TEXT,
    "revision" TEXT,
    "issue_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'preliminary',
    "document_id" TEXT NOT NULL,
    "superseded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "link_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "conflict_resolution" TEXT,

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "time_of_day" TEXT NOT NULL DEFAULT '09:00',
    "recipients" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "author_id" TEXT,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_attachments" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_backup_codes_code_hash_key" ON "mfa_backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "mfa_backup_codes_user_id_used_at_idx" ON "mfa_backup_codes"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "consent_records_user_id_consent_type_idx" ON "consent_records"("user_id", "consent_type");

-- CreateIndex
CREATE INDEX "webhook_configs_company_id_enabled_idx" ON "webhook_configs"("company_id", "enabled");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_delivered_at_idx" ON "webhook_deliveries"("webhook_id", "delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");

-- CreateIndex
CREATE INDEX "auth_lockouts_locked_until_idx" ON "auth_lockouts"("locked_until");

-- CreateIndex
CREATE INDEX "auth_lockouts_last_attempt_at_idx" ON "auth_lockouts"("last_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_hash_key" ON "oauth_states"("state_hash");

-- CreateIndex
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_callback_codes_code_hash_key" ON "oauth_callback_codes"("code_hash");

-- CreateIndex
CREATE INDEX "oauth_callback_codes_user_id_created_at_idx" ON "oauth_callback_codes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "oauth_callback_codes_expires_at_idx" ON "oauth_callback_codes"("expires_at");

-- CreateIndex
CREATE INDEX "notification_digest_items_user_id_created_at_idx" ON "notification_digest_items"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_alerts_project_id_resolved_at_idx" ON "notification_alerts"("project_id", "resolved_at");

-- CreateIndex
CREATE INDEX "notification_alerts_assigned_to_id_resolved_at_idx" ON "notification_alerts"("assigned_to_id", "resolved_at");

-- CreateIndex
CREATE INDEX "notification_alerts_type_resolved_at_idx" ON "notification_alerts"("type", "resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "projects_company_id_project_number_key" ON "projects"("company_id", "project_number");

-- CreateIndex
CREATE INDEX "project_users_user_id_idx" ON "project_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_users_project_id_user_id_key" ON "project_users"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "lots_project_id_idx" ON "lots"("project_id");

-- CreateIndex
CREATE INDEX "lots_project_id_status_idx" ON "lots"("project_id", "status");

-- CreateIndex
CREATE INDEX "lots_project_id_conformed_at_idx" ON "lots"("project_id", "conformed_at");

-- CreateIndex
CREATE UNIQUE INDEX "lots_project_id_lot_number_key" ON "lots"("project_id", "lot_number");

-- CreateIndex
CREATE INDEX "itp_checklist_items_template_id_idx" ON "itp_checklist_items"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "itp_instances_lot_id_key" ON "itp_instances"("lot_id");

-- CreateIndex
CREATE INDEX "itp_completions_itp_instance_id_idx" ON "itp_completions"("itp_instance_id");

-- CreateIndex
CREATE INDEX "itp_completions_itp_instance_id_checklist_item_id_idx" ON "itp_completions"("itp_instance_id", "checklist_item_id");

-- CreateIndex
CREATE INDEX "itp_completions_verification_status_idx" ON "itp_completions"("verification_status");

-- CreateIndex
CREATE INDEX "hold_points_lot_id_idx" ON "hold_points"("lot_id");

-- CreateIndex
CREATE INDEX "hold_points_status_created_at_idx" ON "hold_points"("status", "created_at");

-- CreateIndex
CREATE INDEX "hold_points_status_scheduled_date_idx" ON "hold_points"("status", "scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "hold_point_release_tokens_token_key" ON "hold_point_release_tokens"("token");

-- CreateIndex
CREATE INDEX "test_results_project_id_idx" ON "test_results"("project_id");

-- CreateIndex
CREATE INDEX "test_results_project_id_status_idx" ON "test_results"("project_id", "status");

-- CreateIndex
CREATE INDEX "test_results_lot_id_idx" ON "test_results"("lot_id");

-- CreateIndex
CREATE INDEX "test_results_project_id_pass_fail_idx" ON "test_results"("project_id", "pass_fail");

-- CreateIndex
CREATE INDEX "ncrs_project_id_idx" ON "ncrs"("project_id");

-- CreateIndex
CREATE INDEX "ncrs_project_id_status_idx" ON "ncrs"("project_id", "status");

-- CreateIndex
CREATE INDEX "ncrs_project_id_due_date_idx" ON "ncrs"("project_id", "due_date");

-- CreateIndex
CREATE INDEX "ncrs_project_id_category_status_idx" ON "ncrs"("project_id", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ncrs_project_id_ncr_number_key" ON "ncrs"("project_id", "ncr_number");

-- CreateIndex
CREATE UNIQUE INDEX "ncr_lots_ncr_id_lot_id_key" ON "ncr_lots"("ncr_id", "lot_id");

-- CreateIndex
CREATE INDEX "daily_diaries_project_id_date_idx" ON "daily_diaries"("project_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_diaries_project_id_date_key" ON "daily_diaries"("project_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "global_subcontractors_organization_id_company_name_key" ON "global_subcontractors"("organization_id", "company_name");

-- CreateIndex
CREATE INDEX "subcontractor_users_user_id_idx" ON "subcontractor_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcontractor_users_subcontractor_company_id_user_id_key" ON "subcontractor_users"("subcontractor_company_id", "user_id");

-- CreateIndex
CREATE INDEX "lot_subcontractor_assignments_project_id_idx" ON "lot_subcontractor_assignments"("project_id");

-- CreateIndex
CREATE INDEX "lot_subcontractor_assignments_subcontractor_company_id_idx" ON "lot_subcontractor_assignments"("subcontractor_company_id");

-- CreateIndex
CREATE INDEX "lot_subcontractor_assignments_lot_id_status_idx" ON "lot_subcontractor_assignments"("lot_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lot_subcontractor_assignments_lot_id_subcontractor_company__key" ON "lot_subcontractor_assignments"("lot_id", "subcontractor_company_id");

-- CreateIndex
CREATE INDEX "daily_dockets_project_id_date_idx" ON "daily_dockets"("project_id", "date");

-- CreateIndex
CREATE INDEX "daily_dockets_project_id_status_idx" ON "daily_dockets"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "progress_claims_project_id_claim_number_key" ON "progress_claims"("project_id", "claim_number");

-- CreateIndex
CREATE UNIQUE INDEX "claimed_lots_claim_id_lot_id_key" ON "claimed_lots"("claim_id", "lot_id");

-- CreateIndex
CREATE INDEX "documents_project_id_document_type_idx" ON "documents"("project_id", "document_type");

-- CreateIndex
CREATE INDEX "documents_project_id_lot_id_idx" ON "documents"("project_id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_signed_url_tokens_token_hash_key" ON "document_signed_url_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "document_signed_url_tokens_document_id_expires_at_idx" ON "document_signed_url_tokens"("document_id", "expires_at");

-- CreateIndex
CREATE INDEX "document_signed_url_tokens_user_id_created_at_idx" ON "document_signed_url_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "document_signed_url_tokens_expires_at_idx" ON "document_signed_url_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_project_id_created_at_idx" ON "audit_logs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "comments_entity_type_entity_id_idx" ON "comments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "comment_attachments_comment_id_idx" ON "comment_attachments"("comment_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_backup_codes" ADD CONSTRAINT "mfa_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhook_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_callback_codes" ADD CONSTRAINT "oauth_callback_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_email_preferences" ADD CONSTRAINT "notification_email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_digest_items" ADD CONSTRAINT "notification_digest_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_alerts" ADD CONSTRAINT "notification_alerts_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_alerts" ADD CONSTRAINT "notification_alerts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_areas" ADD CONSTRAINT "project_areas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_itp_template_id_fkey" FOREIGN KEY ("itp_template_id") REFERENCES "itp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_assigned_subcontractor_id_fkey" FOREIGN KEY ("assigned_subcontractor_id") REFERENCES "subcontractor_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_conformed_by_fkey" FOREIGN KEY ("conformed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_claimed_in_id_fkey" FOREIGN KEY ("claimed_in_id") REFERENCES "progress_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_templates" ADD CONSTRAINT "itp_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_checklist_items" ADD CONSTRAINT "itp_checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "itp_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_instances" ADD CONSTRAINT "itp_instances_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_instances" ADD CONSTRAINT "itp_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "itp_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_completions" ADD CONSTRAINT "itp_completions_itp_instance_id_fkey" FOREIGN KEY ("itp_instance_id") REFERENCES "itp_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_completions" ADD CONSTRAINT "itp_completions_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "itp_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_completions" ADD CONSTRAINT "itp_completions_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_completions" ADD CONSTRAINT "itp_completions_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_completion_attachments" ADD CONSTRAINT "itp_completion_attachments_completion_id_fkey" FOREIGN KEY ("completion_id") REFERENCES "itp_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itp_completion_attachments" ADD CONSTRAINT "itp_completion_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_points" ADD CONSTRAINT "hold_points_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_points" ADD CONSTRAINT "hold_points_itp_checklist_item_id_fkey" FOREIGN KEY ("itp_checklist_item_id") REFERENCES "itp_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_point_release_tokens" ADD CONSTRAINT "hold_point_release_tokens_hold_point_id_fkey" FOREIGN KEY ("hold_point_id") REFERENCES "hold_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_itp_checklist_item_id_fkey" FOREIGN KEY ("itp_checklist_item_id") REFERENCES "itp_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_certificate_document_id_fkey" FOREIGN KEY ("certificate_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_qm_reviewed_by_fkey" FOREIGN KEY ("qm_reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_escalated_by_fkey" FOREIGN KEY ("escalated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_responsible_subcontractor_id_fkey" FOREIGN KEY ("responsible_subcontractor_id") REFERENCES "subcontractor_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_qm_approved_by_fkey" FOREIGN KEY ("qm_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncr_lots" ADD CONSTRAINT "ncr_lots_ncr_id_fkey" FOREIGN KEY ("ncr_id") REFERENCES "ncrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncr_lots" ADD CONSTRAINT "ncr_lots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncr_evidence" ADD CONSTRAINT "ncr_evidence_ncr_id_fkey" FOREIGN KEY ("ncr_id") REFERENCES "ncrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncr_evidence" ADD CONSTRAINT "ncr_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_diaries" ADD CONSTRAINT "daily_diaries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_diaries" ADD CONSTRAINT "daily_diaries_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_personnel" ADD CONSTRAINT "diary_personnel_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_personnel" ADD CONSTRAINT "diary_personnel_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_personnel" ADD CONSTRAINT "diary_personnel_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "daily_dockets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_plant" ADD CONSTRAINT "diary_plant_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_plant" ADD CONSTRAINT "diary_plant_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_plant" ADD CONSTRAINT "diary_plant_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "daily_dockets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_activities" ADD CONSTRAINT "diary_activities_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_activities" ADD CONSTRAINT "diary_activities_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_visitors" ADD CONSTRAINT "diary_visitors_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_delays" ADD CONSTRAINT "diary_delays_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_delays" ADD CONSTRAINT "diary_delays_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_deliveries" ADD CONSTRAINT "diary_deliveries_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_deliveries" ADD CONSTRAINT "diary_deliveries_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_events" ADD CONSTRAINT "diary_events_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_events" ADD CONSTRAINT "diary_events_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_addendums" ADD CONSTRAINT "diary_addendums_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "daily_diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_addendums" ADD CONSTRAINT "diary_addendums_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_subcontractors" ADD CONSTRAINT "global_subcontractors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_companies" ADD CONSTRAINT "subcontractor_companies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_companies" ADD CONSTRAINT "subcontractor_companies_global_subcontractor_id_fkey" FOREIGN KEY ("global_subcontractor_id") REFERENCES "global_subcontractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_users" ADD CONSTRAINT "subcontractor_users_subcontractor_company_id_fkey" FOREIGN KEY ("subcontractor_company_id") REFERENCES "subcontractor_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_users" ADD CONSTRAINT "subcontractor_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_subcontractor_assignments" ADD CONSTRAINT "lot_subcontractor_assignments_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_subcontractor_assignments" ADD CONSTRAINT "lot_subcontractor_assignments_subcontractor_company_id_fkey" FOREIGN KEY ("subcontractor_company_id") REFERENCES "subcontractor_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_subcontractor_assignments" ADD CONSTRAINT "lot_subcontractor_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_subcontractor_assignments" ADD CONSTRAINT "lot_subcontractor_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roster" ADD CONSTRAINT "employee_roster_subcontractor_company_id_fkey" FOREIGN KEY ("subcontractor_company_id") REFERENCES "subcontractor_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_register" ADD CONSTRAINT "plant_register_subcontractor_company_id_fkey" FOREIGN KEY ("subcontractor_company_id") REFERENCES "subcontractor_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_dockets" ADD CONSTRAINT "daily_dockets_subcontractor_company_id_fkey" FOREIGN KEY ("subcontractor_company_id") REFERENCES "subcontractor_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_dockets" ADD CONSTRAINT "daily_dockets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_labour" ADD CONSTRAINT "docket_labour_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "daily_dockets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_labour" ADD CONSTRAINT "docket_labour_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_labour_lots" ADD CONSTRAINT "docket_labour_lots_docket_labour_id_fkey" FOREIGN KEY ("docket_labour_id") REFERENCES "docket_labour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_labour_lots" ADD CONSTRAINT "docket_labour_lots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_plant" ADD CONSTRAINT "docket_plant_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "daily_dockets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_plant" ADD CONSTRAINT "docket_plant_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plant_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_plant_lots" ADD CONSTRAINT "docket_plant_lots_docket_plant_id_fkey" FOREIGN KEY ("docket_plant_id") REFERENCES "docket_plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_plant_lots" ADD CONSTRAINT "docket_plant_lots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claimed_lots" ADD CONSTRAINT "claimed_lots_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "progress_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claimed_lots" ADD CONSTRAINT "claimed_lots_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signed_url_tokens" ADD CONSTRAINT "document_signed_url_tokens_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signed_url_tokens" ADD CONSTRAINT "document_signed_url_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "drawings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
