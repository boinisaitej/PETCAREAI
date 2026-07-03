from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, List
import json

router = APIRouter(prefix="/ws", tags=["Real-time"])


class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        if room not in self.active:
            self.active[room] = []
        self.active[room].append(ws)

    def disconnect(self, room: str, ws: WebSocket):
        if room in self.active:
            self.active[room] = [c for c in self.active[room] if c != ws]

    async def broadcast(self, room: str, message: dict):
        if room in self.active:
            dead = []
            for ws in self.active[room]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for d in dead:
                self.active[room].remove(d)

    async def send_personal(self, ws: WebSocket, message: dict):
        await ws.send_json(message)


manager = ConnectionManager()


@router.websocket("/emergency/{room_id}")
async def emergency_vet_connect(websocket: WebSocket, room_id: str):
    """WebSocket for emergency vet video/chat room"""
    await manager.connect(f"emergency_{room_id}", websocket)
    await manager.broadcast(f"emergency_{room_id}", {"type": "user_joined", "room": room_id})
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await manager.broadcast(f"emergency_{room_id}", message)
    except WebSocketDisconnect:
        manager.disconnect(f"emergency_{room_id}", websocket)
        await manager.broadcast(f"emergency_{room_id}", {"type": "user_left", "room": room_id})


@router.websocket("/health-monitor/{pet_id}")
async def live_health_monitor(websocket: WebSocket, pet_id: int):
    """WebSocket for live health metrics from smart collar"""
    await manager.connect(f"health_{pet_id}", websocket)
    try:
        while True:
            data = await websocket.receive_text()
            metrics = json.loads(data)
            # Broadcast metrics to all connected viewers (owner, vet)
            await manager.broadcast(f"health_{pet_id}", {
                "type": "health_metrics",
                "pet_id": pet_id,
                "data": metrics
            })
    except WebSocketDisconnect:
        manager.disconnect(f"health_{pet_id}", websocket)


@router.websocket("/geofence-alerts/{owner_id}")
async def geofence_alert_stream(websocket: WebSocket, owner_id: int):
    """WebSocket for real-time geofence alerts"""
    await manager.connect(f"geo_{owner_id}", websocket)
    try:
        while True:
            data = await websocket.receive_text()
            alert = json.loads(data)
            await manager.send_personal(websocket, {"type": "geofence_alert", **alert})
    except WebSocketDisconnect:
        manager.disconnect(f"geo_{owner_id}", websocket)
