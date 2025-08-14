//! Application menu management
//!
//! This module handles the creation and management of the application's native menu system,
//! including File, Edit, and View menus with appropriate keyboard shortcuts and predefined items.

use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{App, AppHandle, Manager, WebviewWindow};

/// Menu item identifiers for custom menu items that need event handling
pub mod menu_ids {
    pub const RELOAD: &str = "reload";
    pub const NEW_CHAT: &str = "new_chat";
    pub const OPEN_SETTINGS: &str = "open_settings";
}

/// Manages the application's menu system
pub struct MenuManager;

impl MenuManager {
    /// Creates and sets up the complete application menu
    pub fn setup_app_menu(app: &mut App) -> Result<(), String> {
        let menu = Self::build_app_menu(app)?;
        app.set_menu(menu)
            .map_err(|e| format!("Failed to set app menu: {e}"))?;
        Ok(())
    }

    /// Builds the complete application menu with File, Edit, and View submenus
    fn build_app_menu(app: &App) -> Result<Menu<tauri::Wry>, String> {
        let file_menu = Self::build_file_menu(app)?;
        let edit_menu = Self::build_edit_menu(app)?;
        let view_menu = Self::build_view_menu(app)?;

        MenuBuilder::new(app)
            .items(&[&file_menu, &edit_menu, &view_menu])
            .build()
            .map_err(|e| format!("Failed to build app menu: {e}"))
    }

    /// Creates the File menu with New Chat, Settings, and Quit items
    fn build_file_menu(app: &App) -> Result<tauri::menu::Submenu<tauri::Wry>, String> {
        let new_chat_item = MenuItemBuilder::new("New Chat")
            .id(menu_ids::NEW_CHAT)
            .accelerator("CmdOrCtrl+N")
            .build(app)
            .map_err(|e| format!("Failed to build New Chat menu item: {e}"))?;

        let open_settings_item = MenuItemBuilder::new("Settings...")
            .id(menu_ids::OPEN_SETTINGS)
            .accelerator("CmdOrCtrl+,")
            .build(app)
            .map_err(|e| format!("Failed to build Settings menu item: {e}"))?;

        let quit_item = PredefinedMenuItem::quit(app, Some("Quit OpenChat"))
            .map_err(|e| format!("Failed to build Quit menu item: {e}"))?;

        SubmenuBuilder::new(app, "File")
            .items(&[&new_chat_item, &open_settings_item, &quit_item])
            .build()
            .map_err(|e| format!("Failed to build File submenu: {e}"))
    }

    /// Creates the Edit menu with standard clipboard and undo operations
    fn build_edit_menu(app: &App) -> Result<tauri::menu::Submenu<tauri::Wry>, String> {
        // Undo/Redo section
        let undo_item = PredefinedMenuItem::undo(app, None)
            .map_err(|e| format!("Failed to build Undo menu item: {e}"))?;
        let redo_item = PredefinedMenuItem::redo(app, None)
            .map_err(|e| format!("Failed to build Redo menu item: {e}"))?;

        // Separators
        let separator1 = PredefinedMenuItem::separator(app)
            .map_err(|e| format!("Failed to build separator: {e}"))?;
        let separator2 = PredefinedMenuItem::separator(app)
            .map_err(|e| format!("Failed to build separator: {e}"))?;

        // Clipboard operations
        let cut_item = PredefinedMenuItem::cut(app, None)
            .map_err(|e| format!("Failed to build Cut menu item: {e}"))?;
        let copy_item = PredefinedMenuItem::copy(app, None)
            .map_err(|e| format!("Failed to build Copy menu item: {e}"))?;
        let paste_item = PredefinedMenuItem::paste(app, None)
            .map_err(|e| format!("Failed to build Paste menu item: {e}"))?;

        // Selection
        let select_all_item = PredefinedMenuItem::select_all(app, None)
            .map_err(|e| format!("Failed to build Select All menu item: {e}"))?;

        SubmenuBuilder::new(app, "Edit")
            .items(&[
                &undo_item,
                &redo_item,
                &separator1,
                &cut_item,
                &copy_item,
                &paste_item,
                &separator2,
                &select_all_item,
            ])
            .build()
            .map_err(|e| format!("Failed to build Edit submenu: {e}"))
    }

    /// Creates the View menu with reload functionality
    fn build_view_menu(app: &App) -> Result<tauri::menu::Submenu<tauri::Wry>, String> {
        let reload_item = MenuItemBuilder::new("Reload")
            .id(menu_ids::RELOAD)
            .accelerator("CmdOrCtrl+R")
            .build(app)
            .map_err(|e| format!("Failed to build Reload menu item: {e}"))?;

        SubmenuBuilder::new(app, "View")
            .items(&[&reload_item])
            .build()
            .map_err(|e| format!("Failed to build View submenu: {e}"))
    }

    /// Handles menu events for custom menu items
    ///
    /// Note: Predefined menu items (Copy, Paste, etc.) are handled automatically
    /// by the system and don't need custom event handling.
    pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
        match event_id {
            menu_ids::RELOAD => Self::handle_reload(app),
            menu_ids::NEW_CHAT => Self::handle_new_chat(app),
            menu_ids::OPEN_SETTINGS => Self::handle_open_settings(app),
            _ => {
                // Handle any other menu events if needed
                log::debug!("Unhandled menu event: {}", event_id);
            }
        }
    }

    /// Handles the reload menu action
    fn handle_reload(app: &AppHandle) {
        if let Some(window) = app.get_webview_window("main") {
            Self::send_frontend_event(&window, "reload");
        }
    }

    /// Handles the new chat menu action
    fn handle_new_chat(app: &AppHandle) {
        if let Some(window) = app.get_webview_window("main") {
            Self::send_frontend_event(&window, "new-chat");
        }
    }

    /// Handles the open settings menu action
    fn handle_open_settings(app: &AppHandle) {
        if let Some(window) = app.get_webview_window("main") {
            Self::send_frontend_event(&window, "open-settings");
        }
    }

    /// Sends a custom event to the frontend
    fn send_frontend_event(window: &WebviewWindow, event_type: &str) {
        let script = match event_type {
            "reload" => "window.location.reload()",
            "new-chat" => "window.dispatchEvent(new CustomEvent('tauri://menu-new-chat'))",
            "open-settings" => {
                "window.dispatchEvent(new CustomEvent('tauri://menu-open-settings'))"
            }
            _ => return,
        };

        if let Err(e) = window.eval(script) {
            log::error!("Failed to send frontend event '{}': {}", event_type, e);
        }
    }
}
