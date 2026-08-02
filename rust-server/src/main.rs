use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info};

#[derive(Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
enum ServerMessage {
    Broadcast(String),
}

type Tx = futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, Message>;

type SharedClients = Arc<Mutex<Vec<Tx>>>;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let addr = "127.0.0.1:3000";
    let listener = TcpListener::bind(addr).await?;
    info!(%addr, "Rust WebSocket server listening");

    let clients: SharedClients = Arc::new(Mutex::new(Vec::new()));

    while let Ok((stream, peer_addr)) = listener.accept().await {
        info!(%peer_addr, "Client connected");
        let ws_stream = accept_async(stream).await?;
        let (writer, mut reader) = ws_stream.split();
        let shared = clients.clone();

        shared.lock().await.push(writer);
        let broadcast_clients = shared.clone();

        tokio::spawn(async move {
            while let Some(message) = reader.next().await {
                match message {
                    Ok(msg) if msg.is_text() => {
                        let text = msg.to_text().unwrap_or_default().to_string();
                        info!(peer = %peer_addr, message = %text, "Received message");
                        let reply = serde_json::to_string(&ServerMessage::Broadcast(text)).unwrap_or_default();

                        let mut guard = broadcast_clients.lock().await;
                        for client in guard.iter_mut() {
                            if let Err(err) = client.send(Message::Text(reply.clone())).await {
                                error!(%err, "Failed to send broadcast");
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(err) => {
                        error!(%err, "WebSocket error");
                        break;
                    }
                }
            }
            info!(%peer_addr, "Client disconnected");
        });
    }

    Ok(())
}
