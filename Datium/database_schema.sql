-- Database Schema Dump
-- Generated from: C:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\db.sqlite3
-- -----------------------------------------------------

-- TABLE: api_appsetting
CREATE TABLE "api_appsetting" ("id" bigint NOT NULL PRIMARY KEY, "key" varchar(100) NOT NULL UNIQUE, "value" text NULL, "updated_at" datetime NOT NULL);

-- TABLE: api_auditlog
CREATE TABLE "api_auditlog" ("id" bigint NOT NULL PRIMARY KEY, "action" varchar(200) NOT NULL, "details" text NULL, "ip" varchar(50) NULL, "created_at" datetime NOT NULL, "system_id" bigint NOT NULL REFERENCES "api_system" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_blockedip
CREATE TABLE "api_blockedip" ("id" bigint NOT NULL PRIMARY KEY, "ip_address" varchar(50) NOT NULL UNIQUE, "reason" text NULL, "created_at" datetime NOT NULL);

-- TABLE: api_discount
CREATE TABLE "api_discount" ("id" bigint NOT NULL PRIMARY KEY, "code" varchar(50) NOT NULL UNIQUE, "percentage" decimal NOT NULL, "is_active" bool NOT NULL, "created_at" datetime NOT NULL);

-- TABLE: api_payment
CREATE TABLE "api_payment" ("id" bigint NOT NULL PRIMARY KEY, "amount" decimal NOT NULL, "status" varchar(20) NOT NULL, "created_at" datetime NOT NULL, "plan_id" bigint NULL REFERENCES "api_plan" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NOT NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_plan
CREATE TABLE "api_plan" ("id" bigint NOT NULL PRIMARY KEY, "name" varchar(50) NOT NULL, "max_systems" integer NOT NULL, "max_tables_per_system" integer NOT NULL, "max_records_per_table" integer NOT NULL, "max_fields_per_table" integer NOT NULL, "max_storage_mb" integer NOT NULL, "price" decimal NOT NULL, "features_json" text NOT NULL, "is_active" bool NOT NULL, "has_ai_assistant" bool NOT NULL);

-- TABLE: api_securityaudit
CREATE TABLE "api_securityaudit" ("id" bigint NOT NULL PRIMARY KEY, "severity" varchar(10) NOT NULL, "event" varchar(255) NOT NULL, "details" text NULL, "created_at" datetime NOT NULL, "system_id" bigint NOT NULL REFERENCES "api_system" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_system
CREATE TABLE "api_system" ("id" bigint NOT NULL PRIMARY KEY, "name" varchar(100) NOT NULL, "description" text NULL, "image_url" text NULL, "security_mode" varchar(20) NOT NULL, "general_password" text NULL, "is_deleted" bool NOT NULL, "created_at" datetime NOT NULL, "owner_id" bigint NOT NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemcollaborator
CREATE TABLE "api_systemcollaborator" ("id" bigint NOT NULL PRIMARY KEY, "can_read" bool NOT NULL, "can_create" bool NOT NULL, "can_update" bool NOT NULL, "can_delete" bool NOT NULL, "system_id" bigint NOT NULL REFERENCES "api_system" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NOT NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemcollaboratortable
CREATE TABLE "api_systemcollaboratortable" ("id" bigint NOT NULL PRIMARY KEY, "can_read" bool NOT NULL, "can_create" bool NOT NULL, "can_update" bool NOT NULL, "can_delete" bool NOT NULL, "collaborator_id" bigint NOT NULL REFERENCES "api_systemcollaborator" ("id") DEFERRABLE INITIALLY DEFERRED, "table_id" bigint NOT NULL REFERENCES "api_systemtable" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemfield
CREATE TABLE "api_systemfield" ("id" bigint NOT NULL PRIMARY KEY, "name" varchar(100) NOT NULL, "type" varchar(20) NOT NULL, "required" bool NOT NULL, "is_unique" bool NOT NULL, "order_index" integer NOT NULL, "created_at" datetime NOT NULL, "related_table_id" bigint NULL REFERENCES "api_systemtable" ("id") DEFERRABLE INITIALLY DEFERRED, "table_id" bigint NOT NULL REFERENCES "api_systemtable" ("id") DEFERRABLE INITIALLY DEFERRED, "related_display_field_id" bigint NULL REFERENCES "api_systemfield" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemfieldoption
CREATE TABLE "api_systemfieldoption" ("id" bigint NOT NULL PRIMARY KEY, "value" varchar(100) NOT NULL, "field_id" bigint NOT NULL REFERENCES "api_systemfield" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemrecord
CREATE TABLE "api_systemrecord" ("id" bigint NOT NULL PRIMARY KEY, "is_deleted" bool NOT NULL, "updated_at" datetime NOT NULL, "order_index" integer NOT NULL, "created_at" datetime NOT NULL, "created_by_id" bigint NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED, "table_id" bigint NOT NULL REFERENCES "api_systemtable" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemrecordvalue
CREATE TABLE "api_systemrecordvalue" ("id" bigint NOT NULL PRIMARY KEY, "value" text NULL, "field_id" bigint NOT NULL REFERENCES "api_systemfield" ("id") DEFERRABLE INITIALLY DEFERRED, "record_id" bigint NOT NULL REFERENCES "api_systemrecord" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemrelationship
CREATE TABLE "api_systemrelationship" ("id" bigint NOT NULL PRIMARY KEY, "relation_type" varchar(20) NOT NULL, "from_field_id" bigint NOT NULL REFERENCES "api_systemfield" ("id") DEFERRABLE INITIALLY DEFERRED, "from_table_id" bigint NOT NULL REFERENCES "api_systemtable" ("id") DEFERRABLE INITIALLY DEFERRED, "system_id" bigint NOT NULL REFERENCES "api_system" ("id") DEFERRABLE INITIALLY DEFERRED, "to_field_id" bigint NOT NULL REFERENCES "api_systemfield" ("id") DEFERRABLE INITIALLY DEFERRED, "to_table_id" bigint NOT NULL REFERENCES "api_systemtable" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_systemtable
CREATE TABLE "api_systemtable" ("id" bigint NOT NULL PRIMARY KEY, "name" varchar(100) NOT NULL, "description" text NULL, "is_deleted" bool NOT NULL, "custom_style_json" text NOT NULL, "created_at" datetime NOT NULL, "system_id" bigint NOT NULL REFERENCES "api_system" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: api_user
CREATE TABLE "api_user" ("id" bigint NOT NULL PRIMARY KEY, "name" varchar(100) NULL, "email" varchar(254) NOT NULL UNIQUE, "password_hash" text NOT NULL, "avatar_url" text NULL, "role" varchar(20) NOT NULL, "phone" varchar(20) NULL, "storage_used_bytes" bigint NOT NULL, "is_suspended" bool NOT NULL, "terms_version_accepted" integer NOT NULL, "session_timeout_minutes" integer NOT NULL, "created_at" datetime NOT NULL, "plan_id" bigint NULL REFERENCES "api_plan" ("id") DEFERRABLE INITIALLY DEFERRED, "expertise_level" varchar(20) NOT NULL);

-- TABLE: api_userreport
CREATE TABLE "api_userreport" ("id" bigint NOT NULL PRIMARY KEY, "title" varchar(200) NOT NULL, "summary" text NOT NULL, "screenshot_url" text NULL, "status" varchar(20) NOT NULL, "created_at" datetime NOT NULL, "user_id" bigint NOT NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: auth_group
CREATE TABLE "auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(150) NOT NULL UNIQUE);

-- TABLE: auth_group_permissions
CREATE TABLE "auth_group_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: auth_permission
CREATE TABLE "auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL, "name" varchar(255) NOT NULL);

-- TABLE: auth_user
CREATE TABLE "auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "username" varchar(150) NOT NULL UNIQUE, "last_name" varchar(150) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL, "first_name" varchar(150) NOT NULL);

-- TABLE: auth_user_groups
CREATE TABLE "auth_user_groups" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: auth_user_user_permissions
CREATE TABLE "auth_user_user_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: chatbot_chatconversation
CREATE TABLE "chatbot_chatconversation" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "system_id" integer NULL, "title" varchar(200) NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "user_id" bigint NOT NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: chatbot_chatmessage
CREATE TABLE "chatbot_chatmessage" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "system_id" integer NULL, "role" varchar(10) NOT NULL, "content" text NOT NULL, "timestamp" datetime NOT NULL, "file_path" varchar(255) NULL, "is_audio" bool NOT NULL, "conversation_id" bigint NULL REFERENCES "chatbot_chatconversation" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NOT NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED);

-- TABLE: django_admin_log
CREATE TABLE "django_admin_log" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "object_id" text NULL, "object_repr" varchar(200) NOT NULL, "action_flag" smallint unsigned NOT NULL CHECK ("action_flag" >= 0), "change_message" text NOT NULL, "content_type_id" integer NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "action_time" datetime NOT NULL);

-- TABLE: django_content_type
CREATE TABLE "django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);

-- TABLE: django_migrations
CREATE TABLE "django_migrations" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app" varchar(255) NOT NULL, "name" varchar(255) NOT NULL, "applied" datetime NOT NULL);

-- TABLE: django_session
CREATE TABLE "django_session" ("session_key" varchar(40) NOT NULL PRIMARY KEY, "session_data" text NOT NULL, "expire_date" datetime NOT NULL);

-- INDEX: api_auditlog_system_id_68f6d19d
CREATE INDEX "api_auditlog_system_id_68f6d19d" ON "api_auditlog" ("system_id");

-- INDEX: api_auditlog_user_id_b15d4175
CREATE INDEX "api_auditlog_user_id_b15d4175" ON "api_auditlog" ("user_id");

-- INDEX: api_payment_plan_id_b2da5869
CREATE INDEX "api_payment_plan_id_b2da5869" ON "api_payment" ("plan_id");

-- INDEX: api_payment_user_id_d7835ec0
CREATE INDEX "api_payment_user_id_d7835ec0" ON "api_payment" ("user_id");

-- INDEX: api_securityaudit_system_id_18e1dc89
CREATE INDEX "api_securityaudit_system_id_18e1dc89" ON "api_securityaudit" ("system_id");

-- INDEX: api_securityaudit_user_id_64eece04
CREATE INDEX "api_securityaudit_user_id_64eece04" ON "api_securityaudit" ("user_id");

-- INDEX: api_system_owner_id_c2d9d812
CREATE INDEX "api_system_owner_id_c2d9d812" ON "api_system" ("owner_id");

-- INDEX: api_systemcollaborator_system_id_b8eae895
CREATE INDEX "api_systemcollaborator_system_id_b8eae895" ON "api_systemcollaborator" ("system_id");

-- INDEX: api_systemcollaborator_system_id_user_id_1a9c8cb2_uniq
CREATE UNIQUE INDEX "api_systemcollaborator_system_id_user_id_1a9c8cb2_uniq" ON "api_systemcollaborator" ("system_id", "user_id");

-- INDEX: api_systemcollaborator_user_id_7f7ed5a5
CREATE INDEX "api_systemcollaborator_user_id_7f7ed5a5" ON "api_systemcollaborator" ("user_id");

-- INDEX: api_systemcollaboratortable_collaborator_id_04077ee8
CREATE INDEX "api_systemcollaboratortable_collaborator_id_04077ee8" ON "api_systemcollaboratortable" ("collaborator_id");

-- INDEX: api_systemcollaboratortable_collaborator_id_table_id_82aada55_uniq
CREATE UNIQUE INDEX "api_systemcollaboratortable_collaborator_id_table_id_82aada55_uniq" ON "api_systemcollaboratortable" ("collaborator_id", "table_id");

-- INDEX: api_systemcollaboratortable_table_id_eb06db69
CREATE INDEX "api_systemcollaboratortable_table_id_eb06db69" ON "api_systemcollaboratortable" ("table_id");

-- INDEX: api_systemfield_related_display_field_id_39fc2c41
CREATE INDEX "api_systemfield_related_display_field_id_39fc2c41" ON "api_systemfield" ("related_display_field_id");

-- INDEX: api_systemfield_related_table_id_3be10b6f
CREATE INDEX "api_systemfield_related_table_id_3be10b6f" ON "api_systemfield" ("related_table_id");

-- INDEX: api_systemfield_table_id_f499e970
CREATE INDEX "api_systemfield_table_id_f499e970" ON "api_systemfield" ("table_id");

-- INDEX: api_systemfieldoption_field_id_227f590b
CREATE INDEX "api_systemfieldoption_field_id_227f590b" ON "api_systemfieldoption" ("field_id");

-- INDEX: api_systemrecord_created_by_id_286a3328
CREATE INDEX "api_systemrecord_created_by_id_286a3328" ON "api_systemrecord" ("created_by_id");

-- INDEX: api_systemrecord_table_id_49fa96b4
CREATE INDEX "api_systemrecord_table_id_49fa96b4" ON "api_systemrecord" ("table_id");

-- INDEX: api_systemrecordvalue_field_id_0e06711c
CREATE INDEX "api_systemrecordvalue_field_id_0e06711c" ON "api_systemrecordvalue" ("field_id");

-- INDEX: api_systemrecordvalue_record_id_6b00e777
CREATE INDEX "api_systemrecordvalue_record_id_6b00e777" ON "api_systemrecordvalue" ("record_id");

-- INDEX: api_systemrecordvalue_record_id_field_id_55d2ec3c_uniq
CREATE UNIQUE INDEX "api_systemrecordvalue_record_id_field_id_55d2ec3c_uniq" ON "api_systemrecordvalue" ("record_id", "field_id");

-- INDEX: api_systemrelationship_from_field_id_85f2e77b
CREATE INDEX "api_systemrelationship_from_field_id_85f2e77b" ON "api_systemrelationship" ("from_field_id");

-- INDEX: api_systemrelationship_from_table_id_6f7bddf5
CREATE INDEX "api_systemrelationship_from_table_id_6f7bddf5" ON "api_systemrelationship" ("from_table_id");

-- INDEX: api_systemrelationship_system_id_235cf7d4
CREATE INDEX "api_systemrelationship_system_id_235cf7d4" ON "api_systemrelationship" ("system_id");

-- INDEX: api_systemrelationship_to_field_id_89df015d
CREATE INDEX "api_systemrelationship_to_field_id_89df015d" ON "api_systemrelationship" ("to_field_id");

-- INDEX: api_systemrelationship_to_table_id_4166e69c
CREATE INDEX "api_systemrelationship_to_table_id_4166e69c" ON "api_systemrelationship" ("to_table_id");

-- INDEX: api_systemtable_system_id_40de380c
CREATE INDEX "api_systemtable_system_id_40de380c" ON "api_systemtable" ("system_id");

-- INDEX: api_systemtable_system_id_name_3ae3a7eb_uniq
CREATE UNIQUE INDEX "api_systemtable_system_id_name_3ae3a7eb_uniq" ON "api_systemtable" ("system_id", "name");

-- INDEX: api_user_plan_id_f999e756
CREATE INDEX "api_user_plan_id_f999e756" ON "api_user" ("plan_id");

-- INDEX: api_userreport_user_id_5ce42584
CREATE INDEX "api_userreport_user_id_5ce42584" ON "api_userreport" ("user_id");

-- INDEX: auth_group_permissions_group_id_b120cbf9
CREATE INDEX "auth_group_permissions_group_id_b120cbf9" ON "auth_group_permissions" ("group_id");

-- INDEX: auth_group_permissions_group_id_permission_id_0cd325b0_uniq
CREATE UNIQUE INDEX "auth_group_permissions_group_id_permission_id_0cd325b0_uniq" ON "auth_group_permissions" ("group_id", "permission_id");

-- INDEX: auth_group_permissions_permission_id_84c5c92e
CREATE INDEX "auth_group_permissions_permission_id_84c5c92e" ON "auth_group_permissions" ("permission_id");

-- INDEX: auth_permission_content_type_id_2f476e4b
CREATE INDEX "auth_permission_content_type_id_2f476e4b" ON "auth_permission" ("content_type_id");

-- INDEX: auth_permission_content_type_id_codename_01ab375a_uniq
CREATE UNIQUE INDEX "auth_permission_content_type_id_codename_01ab375a_uniq" ON "auth_permission" ("content_type_id", "codename");

-- INDEX: auth_user_groups_group_id_97559544
CREATE INDEX "auth_user_groups_group_id_97559544" ON "auth_user_groups" ("group_id");

-- INDEX: auth_user_groups_user_id_6a12ed8b
CREATE INDEX "auth_user_groups_user_id_6a12ed8b" ON "auth_user_groups" ("user_id");

-- INDEX: auth_user_groups_user_id_group_id_94350c0c_uniq
CREATE UNIQUE INDEX "auth_user_groups_user_id_group_id_94350c0c_uniq" ON "auth_user_groups" ("user_id", "group_id");

-- INDEX: auth_user_user_permissions_permission_id_1fbb5f2c
CREATE INDEX "auth_user_user_permissions_permission_id_1fbb5f2c" ON "auth_user_user_permissions" ("permission_id");

-- INDEX: auth_user_user_permissions_user_id_a95ead1b
CREATE INDEX "auth_user_user_permissions_user_id_a95ead1b" ON "auth_user_user_permissions" ("user_id");

-- INDEX: auth_user_user_permissions_user_id_permission_id_14a6b632_uniq
CREATE UNIQUE INDEX "auth_user_user_permissions_user_id_permission_id_14a6b632_uniq" ON "auth_user_user_permissions" ("user_id", "permission_id");

-- INDEX: chatbot_chatconversation_user_id_18056a36
CREATE INDEX "chatbot_chatconversation_user_id_18056a36" ON "chatbot_chatconversation" ("user_id");

-- INDEX: chatbot_chatmessage_conversation_id_c1458541
CREATE INDEX "chatbot_chatmessage_conversation_id_c1458541" ON "chatbot_chatmessage" ("conversation_id");

-- INDEX: chatbot_chatmessage_user_id_81e2c646
CREATE INDEX "chatbot_chatmessage_user_id_81e2c646" ON "chatbot_chatmessage" ("user_id");

-- INDEX: django_admin_log_content_type_id_c4bce8eb
CREATE INDEX "django_admin_log_content_type_id_c4bce8eb" ON "django_admin_log" ("content_type_id");

-- INDEX: django_admin_log_user_id_c564eba6
CREATE INDEX "django_admin_log_user_id_c564eba6" ON "django_admin_log" ("user_id");

-- INDEX: django_content_type_app_label_model_76bd3d3b_uniq
CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type" ("app_label", "model");

-- INDEX: django_session_expire_date_a5c62663
CREATE INDEX "django_session_expire_date_a5c62663" ON "django_session" ("expire_date");

-- INDEX: uniq_system_owner_name_active
CREATE UNIQUE INDEX "uniq_system_owner_name_active" ON "api_system" ("owner_id", "name") WHERE NOT "is_deleted";
