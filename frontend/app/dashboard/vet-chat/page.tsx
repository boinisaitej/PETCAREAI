"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { vetChatApi, petsApi, WS_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  message: string;
  is_read: boolean;
  sent_at: string;
  type?: string;
}
interface Room {
  id: number;
  other_user: { id: number; name: string; role: string } | null;
  pet: { id: number; name: string; species: string } | null;
  last_message: string | null;
  last_time: string | null;
  unread_count: number;
}
interface Vet { id: number; name: string; role: string; }
interface Pet { id: number; name: string; species: string; }

// WebSocket base — no /api/vet-chat prefix, that's REST only
const WS_URL = (roomId: number, userId: number) =>
  `${WS_BASE}/api/vet-chat/ws/${roomId}/${userId}`;

export default function VetChatPage() {
  const { user } = useAuth();
  const isVet = user?.role === "vet" || user?.role === "admin";

  const [rooms, setRooms]             = useState<Room[]>([]);
  const [activeRoom, setActiveRoom]   = useState<Room | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [online, setOnline]           = useState<Record<number, boolean>>({});
  const [vets, setVets]               = useState<Vet[]>([]);
  const [pets, setPets]               = useState<Pet[]>([]);
  const [showNew, setShowNew]         = useState(false);
  const [selVet, setSelVet]           = useState<number | "">("");
  const [selPet, setSelPet]           = useState<number | "">("");
  const [showRooms, setShowRooms]     = useState(true); // mobile toggle

  const wsRef     = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const msgIdsRef = useRef<Set<number>>(new Set()); // dedup by message id

  const loadRooms = useCallback(async () => {
    try {
      const r = await vetChatApi.listRooms();
      setRooms(r.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadRooms();
    if (!isVet) {
      vetChatApi.listVets().then(r => setVets(r.data)).catch(() => {});
      petsApi.list().then(r => setPets(r.data)).catch(() => {});
    }
  }, [loadRooms, isVet]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup WS on unmount
  useEffect(() => () => { wsRef.current?.close(); }, []);

  const openRoom = useCallback(async (room: Room) => {
    wsRef.current?.close();
    wsRef.current = null;
    msgIdsRef.current = new Set();
    setActiveRoom(room);
    setMessages([]);
    setShowRooms(false); // on mobile, switch to chat view

    // Load history
    try {
      const r = await vetChatApi.getMessages(room.id);
      const hist: Message[] = r.data;
      hist.forEach(m => msgIdsRef.current.add(m.id));
      setMessages(hist);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count: 0 } : r));
    } catch { /* ignore */ }

    // Connect WS
    const ws = new WebSocket(WS_URL(room.id, user!.id));

    ws.onopen = () => {
      console.log(`[WS] Connected to room ${room.id}`);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "status") {
          if (data.user_id) {
            setOnline(prev => ({ ...prev, [data.user_id]: data.status === "online" }));
          }
          return;
        }

        if (data.type === "message") {
          // Deduplicate: skip if we already have this message id
          if (msgIdsRef.current.has(data.id)) return;
          msgIdsRef.current.add(data.id);

          setMessages(prev => [...prev, data]);
          setRooms(prev => prev.map(r =>
            r.id === room.id
              ? { ...r, last_message: data.message, last_time: data.sent_at, unread_count: 0 }
              : r
          ));
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = (e) => console.error("[WS] Error", e);
    ws.onclose = () => console.log("[WS] Closed");

    wsRef.current = ws;
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [user]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Not open, readyState:", wsRef.current.readyState);
      return;
    }
    wsRef.current.send(JSON.stringify({ message: text }));
    setInput("");
    inputRef.current?.focus();
  }, [input]);

  const startChat = async () => {
    if (!selVet) return;
    try {
      const r = await vetChatApi.createRoom(Number(selVet), selPet ? Number(selPet) : undefined);
      await loadRooms();
      setShowNew(false);
      setSelVet(""); setSelPet("");
      const rooms2 = await vetChatApi.listRooms();
      const found = rooms2.data.find((rm: Room) => rm.id === r.data.room_id);
      if (found) openRoom(found);
    } catch { /* ignore */ }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => {
    const d = new Date(iso), t = new Date();
    if (d.toDateString() === t.toDateString()) return "Today";
    const y = new Date(t); y.setDate(t.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString();
  };

  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach(m => {
    const d = fmtDate(m.sent_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== d) grouped.push({ date: d, msgs: [m] });
    else last.msgs.push(m);
  });

  const otherOnline = activeRoom?.other_user ? online[activeRoom.other_user.id] : false;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
      <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white min-h-0">

        {/* ── Room List (left panel) ────────────────────────────────────────── */}
        <div className={`${showRooms ? "flex" : "hidden"} lg:flex w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-gray-100 flex-col`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-bold text-gray-800 text-base">💬 {isVet ? "Patient Chats" : "Vet Chat"}</h2>
              <p className="text-xs text-gray-400">{isVet ? "Conversations with owners" : "Talk to your veterinarian"}</p>
            </div>
            {!isVet && (
              <button onClick={() => setShowNew(v => !v)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                + New
              </button>
            )}
          </div>

          {/* New chat form */}
          {showNew && !isVet && (
            <div className="p-4 bg-green-50 border-b border-green-100 flex-shrink-0">
              <p className="text-xs font-semibold text-green-800 mb-2">Start new conversation</p>
              <select value={selVet} onChange={e => setSelVet(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">Select vet…</option>
                {vets.map(v => <option key={v.id} value={v.id}>🏥 {v.name}</option>)}
              </select>
              <select value={selPet} onChange={e => setSelPet(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">About which pet? (optional)</option>
                {pets.map(p => <option key={p.id} value={p.id}>{p.species === "dog" ? "🐕" : "🐈"} {p.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={startChat} disabled={!selVet}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-40">
                  Start Chat
                </button>
                <button onClick={() => setShowNew(false)}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rooms */}
          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="text-5xl mb-3">💬</div>
                <p className="text-gray-400 text-sm font-medium">No conversations yet</p>
                {!isVet && <p className="text-gray-400 text-xs mt-1">Click &quot;+ New&quot; to start</p>}
              </div>
            ) : rooms.map(room => {
              const active  = activeRoom?.id === room.id;
              const isOnline = room.other_user ? online[room.other_user.id] : false;
              return (
                <button key={room.id} onClick={() => openRoom(room)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 text-left transition ${active ? "bg-green-50 border-l-4 border-l-green-500" : "hover:bg-gray-50"}`}>
                  <div className="relative flex-shrink-0 mt-0.5">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base ${isVet ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {room.other_user?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-semibold text-gray-800 truncate">{room.other_user?.name ?? "Unknown"}</p>
                      {room.last_time && <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{fmt(room.last_time)}</span>}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-xs text-gray-400 truncate flex-1">
                        {room.pet ? `🐾 ${room.pet.name} · ` : ""}{room.last_message ?? "No messages yet"}
                      </p>
                      {room.unread_count > 0 && (
                        <span className="ml-2 flex-shrink-0 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chat Window (right panel) ─────────────────────────────────────── */}
        <div className={`${!showRooms ? "flex" : "hidden"} lg:flex flex-1 flex-col min-w-0`}>
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center px-4">
              <div className="text-7xl mb-4 opacity-20">💬</div>
              <p className="text-gray-400 font-medium">Select a conversation to start</p>
              {!isVet && <p className="text-gray-300 text-sm mt-1">Or click &quot;+ New&quot; to chat with a vet</p>}
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3 flex-shrink-0">
                {/* Back button on mobile */}
                <button onClick={() => setShowRooms(true)} className="lg:hidden text-gray-400 hover:text-gray-600 mr-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isVet ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {activeRoom.other_user?.name?.[0]?.toUpperCase()}
                  </div>
                  {otherOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{activeRoom.other_user?.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${otherOnline ? "bg-green-500" : "bg-gray-300"}`} />
                    {otherOnline ? "Online" : "Offline"}
                    {activeRoom.pet && <span className="ml-2">· 🐾 {activeRoom.pet.name}</span>}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-gray-300">
                    <p className="text-sm">No messages yet — say hello! 👋</p>
                  </div>
                )}
                {grouped.map(({ date, msgs }) => (
                  <div key={date} className="space-y-1">
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">{date}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    {msgs.map(msg => {
                      const mine = msg.sender_id === user!.id;
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                          {!mine && (
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {msg.sender_name[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[75%] lg:max-w-md`}>
                            {!mine && (
                              <p className="text-xs text-gray-400 mb-0.5 ml-1">
                                {msg.sender_name} · <span className="capitalize">{msg.sender_role}</span>
                              </p>
                            )}
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${mine ? "bg-green-600 text-white rounded-br-none" : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none"}`}>
                              {msg.message}
                            </div>
                            <p className={`text-xs mt-1 px-1 ${mine ? "text-gray-400" : "text-gray-400"}`}>
                              {fmt(msg.sent_at)}
                              {mine && <span className="ml-1 text-green-600">{msg.is_read ? " ✓✓" : " ✓"}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center gap-2 flex-shrink-0">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message ${activeRoom.other_user?.name ?? ""}…`}
                  className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50 min-w-0"
                />
                <button onClick={sendMessage} disabled={!input.trim()}
                  className="w-10 h-10 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-full flex items-center justify-center transition flex-shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
