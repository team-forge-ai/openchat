use tauri_plugin_sql::{Migration, MigrationKind};

/// Returns the list of schema migrations in ascending `version` order.
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_conversations",
            sql: include_str!("../migrations/001_create_conversations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_messages",
            sql: include_str!("../migrations/002_create_messages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "index_messages_conv_id",
            sql: include_str!("../migrations/003_index_messages_conv_id.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_reasoning_to_messages",
            sql: include_str!("../migrations/004_add_reasoning_to_messages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_status_to_messages",
            sql: include_str!("../migrations/005_add_status_to_messages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_app_settings",
            sql: include_str!("../migrations/006_create_app_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_messages_fts",
            sql: include_str!("../migrations/007_create_messages_fts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "create_conversations_fts",
            sql: include_str!("../migrations/008_create_conversations_fts.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
