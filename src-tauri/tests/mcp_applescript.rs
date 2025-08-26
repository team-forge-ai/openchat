//! Integration test for the AppleScript MCP server via npx.
//!
//! This test is ignored by default because it depends on Node/npx and network
//! access to fetch `@peakmojo/applescript-mcp`. Enable it locally by running:
//!
//!   RUN_MCP_APPLESCRIPT=1 cargo test -p OpenChat --test mcp_applescript -- --ignored
//!
//! It verifies that we can connect over stdio, list tools, that the
//! `applescript_execute` tool exposes an input schema with `code_snippet`, and
//! that we can successfully invoke the tool with a simple script.

#[cfg(target_os = "macos")]
use openchat_lib::mcp::{check_server, McpManager, TransportConfig};

#[cfg(target_os = "macos")]
#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
#[ignore]
async fn applescript_mcp_lists_tools_and_schema_and_executes() {
    if std::env::var("RUN_MCP_APPLESCRIPT").ok().as_deref() != Some("1") {
        // Allow opting-in to run this integration test
        eprintln!("skipping (set RUN_MCP_APPLESCRIPT=1 to run)");
        return;
    }

    // Use npx to spawn the MCP server over stdio; -y to avoid prompts
    let command = "npx";
    let args = vec![
        String::from("-y"),
        String::from("@peakmojo/applescript-mcp"),
    ];

    // 1) Lightweight check + tools discovery
    let result = check_server(TransportConfig::Stdio {
        command,
        args: &args,
        env: None,
        cwd: None,
        connect_timeout_ms: 15_000,
        list_tools_timeout_ms: 15_000,
    })
    .await;

    assert!(result.ok, "mcp check failed: {:?}", result.error);
    let tools = result.tools.unwrap_or_default();
    assert!(!tools.is_empty(), "no tools listed by applescript MCP");

    let tool = tools
        .iter()
        .find(|t| t.name == "applescript_execute")
        .expect("applescript_execute tool not found");

    let schema = tool
        .input_schema
        .as_ref()
        .expect("missing inputSchema on applescript_execute");

    let props = schema
        .get("properties")
        .and_then(|v| v.as_object())
        .expect("schema.properties not an object");

    assert!(
        props.contains_key("code_snippet"),
        "schema missing code_snippet"
    );

    // 2) Establish a managed session and invoke the tool
    let manager = McpManager::new();

    // Use a fixed test id; tests are single-threaded here
    let test_id: i64 = 9_999;

    manager
        .ensure_stdio(
            test_id,
            command,
            &args,
            &serde_json::json!({}),
            None,
            20_000,
        )
        .await
        .expect("failed to ensure stdio session");

    let listed = manager
        .list_tools(test_id, 15_000)
        .await
        .expect("list_tools failed");
    assert!(
        listed.iter().any(|t| t.name == "applescript_execute"),
        "tool not in list"
    );

    // Minimal AppleScript that returns a value without UI interaction
    let call_args = serde_json::json!({
        "code_snippet": "return \"OK\""
    });

    let output = manager
        .call_tool(test_id, "applescript_execute", call_args, 20_000)
        .await
        .expect("call_tool failed");

    assert!(
        output.to_lowercase().contains("ok"),
        "unexpected applescript output: {}",
        output
    );
}
