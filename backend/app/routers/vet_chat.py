from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional, Dict, List
from datetime import datetime
from ..database import get_db, VetChatRoom, VetChatMessage, User, Pet
from ..auth import get_current_user
import json

router = APIRouter(prefix="/api/vet-chat", tags=["Vet Chat"])

# In-memory: room_id → list of connected WebSockets
_connections: Dict[int, List[WebSocket]] = {}


async def _broadcast_to_room(room_id: int, payload: dict):
    """Send payload to ALL connected sockets in the room (including sender)."""
    dead: List[WebSocket] = []
    for ws in list(_connections.get(room_id, [])):
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for d in dead:
        try:
            _connections[room_id].remove(d)
        except ValueError:
            pass


def _msg_dict(msg: VetChatMessage, db: Session) -> dict:
    sender = db.query(User).filter(User.id == msg.sender_id).first()
    return {
        "id":          msg.id,
        "room_id":     msg.room_id,
        "sender_id":   msg.sender_id,
        "sender_name": sender.name if sender else "Unknown",
        "sender_role": sender.role if sender else "unknown",
        "message":     msg.message,
        "is_read":     msg.is_read,
        "sent_at":     msg.sent_at.isoformat(),
    }


def _room_dict(room: VetChatRoom, current_user_id: int, db: Session) -> dict:
    other_id = room.vet_id if room.owner_id == current_user_id else room.owner_id
    other    = db.query(User).filter(User.id == other_id).first()
    pet      = db.query(Pet).filter(Pet.id == room.pet_id).first() if room.pet_id else None
    last     = room.messages[-1] if room.messages else None
    unread   = sum(1 for m in room.messages if not m.is_read and m.sender_id != current_user_id)
    return {
        "id":          room.id,
        "other_user":  {"id": other.id, "name": other.name, "role": other.role} if other else None,
        "pet":         {"id": pet.id,   "name": pet.name,   "species": pet.species} if pet else None,
        "last_message": last.message[:60] if last else None,
        "last_time":    last.sent_at.isoformat() if last else None,
        "unread_count": unread,
    }


# ── REST ──────────────────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    vet_id: int
    pet_id: Optional[int] = None

    @field_validator("vet_id")
    @classmethod
    def valid_vet(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Invalid vet_id")
        return v


@router.post("/rooms")
def create_room(data: CreateRoomRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in {"owner", "caretaker", "shelter"}:
        raise HTTPException(status_code=403, detail="Only pet owners can start a vet chat")
    vet = db.query(User).filter(User.id == data.vet_id, User.role.in_(["vet", "admin"])).first()
    if not vet:
        raise HTTPException(status_code=404, detail="Vet not found")
    existing = db.query(VetChatRoom).filter(
        VetChatRoom.owner_id == current_user.id,
        VetChatRoom.vet_id   == data.vet_id,
        VetChatRoom.pet_id   == data.pet_id,
    ).first()
    if existing:
        return {"room_id": existing.id, "message": "Existing room returned"}
    room = VetChatRoom(owner_id=current_user.id, vet_id=data.vet_id, pet_id=data.pet_id)
    db.add(room)
    db.commit()
    db.refresh(room)
    return {"room_id": room.id, "message": "Chat room created"}


@router.get("/rooms")
def list_rooms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role in {"vet", "admin"}:
        rooms = db.query(VetChatRoom).filter(VetChatRoom.vet_id == current_user.id).all()
    else:
        rooms = db.query(VetChatRoom).filter(VetChatRoom.owner_id == current_user.id).all()
    return [_room_dict(r, current_user.id, db) for r in rooms]


@router.get("/rooms/{room_id}/messages")
def get_messages(room_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    room = db.query(VetChatRoom).filter(VetChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    if current_user.id not in {room.owner_id, room.vet_id}:
        raise HTTPException(status_code=403, detail="Access denied")
    # Mark incoming messages as read
    db.query(VetChatMessage).filter(
        VetChatMessage.room_id   == room_id,
        VetChatMessage.sender_id != current_user.id,
        VetChatMessage.is_read   == False,
    ).update({"is_read": True})
    db.commit()
    msgs = db.query(VetChatMessage).filter(VetChatMessage.room_id == room_id).order_by(VetChatMessage.sent_at).all()
    return [_msg_dict(m, db) for m in msgs]


@router.get("/vets")
def list_vets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vets = db.query(User).filter(User.role.in_(["vet", "admin"])).all()
    return [{"id": v.id, "name": v.name, "role": v.role} for v in vets]


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/{room_id}/{user_id}")
async def vet_chat_ws(websocket: WebSocket, room_id: int, user_id: int):
    """
    Real-time chat WebSocket.
    - Validates room membership before accepting
    - Persists every message to DB
    - Broadcasts to ALL sockets in the room (both sender and receiver see it live)
    - Sends online/offline status events
    """
    db = next(get_db())
    try:
        room = db.query(VetChatRoom).filter(VetChatRoom.id == room_id).first()
        if not room or user_id not in {room.owner_id, room.vet_id}:
            await websocket.close(code=4003)
            return

        await websocket.accept()

        if room_id not in _connections:
            _connections[room_id] = []
        _connections[room_id].append(websocket)

        user = db.query(User).filter(User.id == user_id).first()
        user_name = user.name if user else "Unknown"

        # Announce online
        await _broadcast_to_room(room_id, {
            "type":    "status",
            "user_id": user_id,
            "name":    user_name,
            "status":  "online",
        })

        while True:
            try:
                raw  = await websocket.receive_text()
                data = json.loads(raw)
                text = (data.get("message") or "").strip()
                if not text:
                    continue

                # Save to DB
                msg = VetChatMessage(room_id=room_id, sender_id=user_id, message=text)
                db.add(msg)
                db.commit()
                db.refresh(msg)

                payload = _msg_dict(msg, db)
                payload["type"] = "message"

                # Broadcast to EVERYONE in the room (sender included)
                await _broadcast_to_room(room_id, payload)

            except WebSocketDisconnect:
                break
            except Exception:
                break

    finally:
        # Clean up
        if room_id in _connections:
            try:
                _connections[room_id].remove(websocket)
            except ValueError:
                pass

        try:
            await _broadcast_to_room(room_id, {
                "type":    "status",
                "user_id": user_id,
                "name":    user_name if "user_name" in dir() else "Unknown",
                "status":  "offline",
            })
        except Exception:
            pass

        db.close()
