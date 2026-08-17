"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { chatWithBrain } from "@/lib/api"

interface Message {
  role: "user" | "assistant"
  content: string
  ts: string
}

const STARTERS = [
  "Who should I captain this week?",
  "Is it worth taking a hit?",
  "Should I activate my bench boost?",
  "What's my best transfer option?",
]

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hey! I have your full season history and live FPL data loaded — squad, prices, injuries, fixtures. Ask me anything and I'll give you a straight answer.",
  ts: new Date().toISOString(),
}

function storageKey(id: string) { return `fpl_chat_${id}` }

function loadMessages(id: string): Message[] {
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (raw) return JSON.parse(raw) as Message[]
  } catch {}
  return [WELCOME]
}

function saveMessages(id: string, msgs: Message[]) {
  try { localStorage.setItem(storageKey(id), JSON.stringify(msgs)) } catch {}
}

export default function ChatPanel({ entryId }: { entryId: string }) {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages(entryId))
  const [input, setInput]   = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Persist messages whenever they change
  useEffect(() => { saveMessages(entryId, messages) }, [entryId, messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    const msg = text.trim()
    if (!msg || loading) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: msg, ts: new Date().toISOString() }])
    setLoading(true)
    try {
      const { reply } = await chatWithBrain(entryId, msg)
      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: new Date().toISOString() }])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${err.message}`, ts: new Date().toISOString() },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div className="card flex flex-col overflow-hidden" style={{ height: "100%" }}>
      {/* Header */}
      <div className="px-5 py-3.5 shrink-0 flex items-center justify-between"
           style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">Season Brain</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "#8B949E" }}>Live data · your history · honest advice</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00FF80" }} />
            <span className="text-[11px] font-medium" style={{ color: "#00FF80" }}>Live</span>
          </div>
          {messages.length > 1 && (
            <button
              onClick={() => { const reset = [WELCOME]; setMessages(reset); saveMessages(entryId, reset) }}
              className="text-[11px] font-medium transition-colors hover:text-white"
              style={{ color: "#8B949E" }}
              title="Clear chat history"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={
                msg.role === "user"
                  ? { background: "#00FF80", color: "#0B0E13", borderBottomRightRadius: 4, fontWeight: 500 }
                  : { background: "#1A2030", color: "#E6EDF3", borderBottomLeftRadius: 4, border: "1px solid var(--border)" }
              }
            >
              {msg.content}
            </div>
            <span className="text-[10px] mt-1 px-1" style={{ color: "#3A4455" }}>{formatTime(msg.ts)}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="rounded-2xl px-4 py-3.5 flex items-center gap-1.5"
                 style={{ background: "#1A2030", borderBottomLeftRadius: 4, border: "1px solid var(--border)" }}>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: "#00FF80", animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick starters */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-[11px] mb-2" style={{ color: "#3A4455" }}>Quick questions:</p>
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full transition-all hover:brightness-110"
                style={{
                  background: "rgba(0,255,128,0.08)",
                  border: "1px solid rgba(0,255,128,0.2)",
                  color: "#00FF80",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e: FormEvent) => { e.preventDefault(); sendMessage(input) }}
        className="px-4 pt-2 pb-4 shrink-0 flex gap-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about transfers, captaincy, chips…"
          disabled={loading}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3A4455]
                     focus:outline-none transition-all disabled:opacity-50"
          style={{
            background: "#0B0E13",
            border: "1px solid var(--border)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(0,255,128,0.4)")}
          onBlur={(e)  => (e.target.style.borderColor = "var(--border)")}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center
                     transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
          style={{ background: "#00FF80", color: "#0B0E13" }}
        >
          ↑
        </button>
      </form>
    </div>
  )
}
