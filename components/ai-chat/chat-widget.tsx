"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Mic, MicOff, RotateCcw, SendHorizonal, Volume2, VolumeX, X } from "lucide-react";
import { MockConversationEngine } from "@/lib/ai-chat/engine";
import { BrowserSpeechRecognizer, BrowserTextToSpeech } from "@/lib/ai-chat/speech";
import { getStrings } from "@/lib/ai-chat/i18n";
import type { ChatLanguage, ChatMessage, EngineReply } from "@/lib/ai-chat/types";
import { ChatCards } from "./chat-cards";

let messageCounter = 0;
function nextId() {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

type VoiceState = "idle" | "listening" | "unsupported";

/**
 * khetE कृषि साथी chat widget. The component only talks to the
 * ConversationEngine / SpeechRecognizer / TextToSpeech interfaces, so all
 * providers can be replaced with live services later without UI changes.
 */
export function KhetSathiChat() {
  const engine = useMemo(() => new MockConversationEngine("en"), []);
  const recognizer = useMemo(() => new BrowserSpeechRecognizer(), []);
  const tts = useMemo(() => new BrowserTextToSpeech(), []);
  const [language, setLanguage] = useState<ChatLanguage>("en");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceSupported] = useState(() => recognizer.isSupported());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const greeted = useRef(false);

  const strings = getStrings(language);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
  }, []);

  const pushAssistant = useCallback(
    (reply: EngineReply) => {
      setTyping(true);
      setSuggestions([]);
      const delay = 550 + Math.min(reply.text.length * 6, 1100);
      window.setTimeout(() => {
        setMessages((current) => [...current, { id: nextId(), role: "assistant", text: reply.text, attachment: reply.attachment, createdAt: Date.now() }]);
        setTyping(false);
        setSuggestions(reply.suggestions);
        scrollToBottom();
      }, delay);
    },
    [scrollToBottom],
  );

  const startConversation = useCallback(() => {
    if (greeted.current) return;
    greeted.current = true;
    const reply = engine.greet();
    setMessages([{ id: nextId(), role: "assistant", text: reply.text, createdAt: Date.now() }]);
    setSuggestions(reply.suggestions);
  }, [engine]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    startConversation();
    scrollToBottom();
  }, [startConversation, scrollToBottom]);

  const sendMessage = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || typing) return;
      setMessages((current) => [...current, { id: nextId(), role: "user", text, createdAt: Date.now() }]);
      setInput("");
      setVoiceTranscript(null);
      scrollToBottom();
      pushAssistant(engine.reply(text));
    },
    [engine, pushAssistant, scrollToBottom, typing],
  );

  const switchLanguage = useCallback(() => {
    setLanguage((current) => {
      const next: ChatLanguage = current === "en" ? "ne" : "en";
      engine.setLanguage(next);
      return next;
    });
  }, [engine]);

  const restart = useCallback(() => {
    engine.reset(language);
    const reply = engine.greet();
    setMessages([{ id: nextId(), role: "assistant", text: `${strings.restartConfirm}\n\n${reply.text}`, createdAt: Date.now() }]);
    setVoiceTranscript(null);
    scrollToBottom();
  }, [engine, language, scrollToBottom, strings.restartConfirm]);

  /* ------------------------------ voice handling ------------------------------ */

  const handleMic = useCallback(() => {
    if (voiceState === "listening") {
      recognizer.stop();
      setVoiceState("idle");
      return;
    }
    setVoiceTranscript(null);
    recognizer.setLanguage(language);
    recognizer.start(
      (transcript, isFinal) => {
        setVoiceTranscript(transcript);
        if (isFinal) setVoiceState("idle");
      },
      (error) => {
        setVoiceState(error === "unsupported" ? "unsupported" : "idle");
      },
    );
    setVoiceState("listening");
  }, [language, recognizer, voiceState]);

  useEffect(() => () => recognizer.abort(), [recognizer]);

  const confirmTranscript = useCallback(() => {
    if (voiceTranscript) sendMessage(voiceTranscript);
    setVoiceTranscript(null);
  }, [sendMessage, voiceTranscript]);

  /* ------------------------------ read aloud ------------------------------ */

  const toggleSpeak = useCallback(
    (message: ChatMessage) => {
      if (speakingId === message.id) {
        tts.cancel();
        setSpeakingId(null);
        return;
      }
      tts.cancel();
      if (!tts.isSupported()) return;
      setSpeakingId(message.id);
      tts.speak(message.text, language, () => setSpeakingId(null));
    },
    [language, speakingId, tts],
  );

  useEffect(() => () => tts.cancel(), [tts]);

  return (
    <>
      <button className="aichat-launcher" type="button" onClick={handleOpen} aria-label={strings.launcherLabel}>
        <MessageCircle size={22} />
        <span>Chat</span>
      </button>

      {open ? (
        <section className="aichat-window" role="dialog" aria-label={strings.name}>
          <header className="aichat-header">
            <div className="aichat-id">
              <span className="aichat-avatar">kE</span>
              <div>
                <strong>{strings.name}</strong>
                <small>{strings.subtitle}</small>
              </div>
            </div>
            <div className="aichat-header-actions">
              <button type="button" className="aichat-lang" onClick={switchLanguage}>
                {strings.languageLabel}
              </button>
              <button type="button" className="aichat-icon" onClick={restart} aria-label={strings.restart} title={strings.restart}>
                <RotateCcw size={17} />
              </button>
              <button type="button" className="aichat-icon" onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </header>

          <p className="aichat-demo-badge">{strings.demoBadge}</p>

          <div className="aichat-scroll" ref={scrollRef}>
            {messages.map((message) => (
              <article key={message.id} className={`aichat-msg aichat-msg-${message.role}`}>
                <p className="aichat-bubble">{message.text}</p>
                {message.attachment ? <ChatCards attachment={message.attachment} language={language} /> : null}
                {message.role === "assistant" ? (
                  <button
                    type="button"
                    className="aichat-speak"
                    onClick={() => toggleSpeak(message)}
                    aria-label={speakingId === message.id ? strings.stopSpeakLabel : strings.speakLabel}
                    title={speakingId === message.id ? strings.stopSpeakLabel : strings.speakLabel}
                  >
                    {speakingId === message.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    {speakingId === message.id ? strings.speaking : null}
                  </button>
                ) : null}
              </article>
            ))}
            {typing ? (
              <div className="aichat-msg aichat-msg-assistant">
                <p className="aichat-bubble aichat-typing" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            ) : null}
          </div>

          {suggestions.length ? (
            <div className="aichat-suggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {voiceState === "unsupported" ? (
            <div className="aichat-voice-note" role="status">
              <strong>{strings.micUnsupportedTitle}</strong>
              <p>{strings.micUnsupportedBody}</p>
              <button type="button" onClick={() => setVoiceState("idle")}>
                <X size={13} /> OK
              </button>
            </div>
          ) : null}

          {voiceState === "listening" || voiceTranscript ? (
            <div className="aichat-voice-panel">
              <p className="aichat-listening">
                <Mic size={14} /> {strings.micListening}
              </p>
              <label>
                <span>{strings.micPreviewLabel}</span>
                <input value={voiceTranscript ?? ""} onChange={(event) => setVoiceTranscript(event.target.value)} placeholder={strings.micEditPlaceholder} />
              </label>
              <div>
                <button type="button" className="aichat-voice-send" onClick={confirmTranscript}>
                  <SendHorizonal size={14} /> {strings.micConfirm}
                </button>
                <button type="button" className="aichat-voice-cancel" onClick={() => { recognizer.abort(); setVoiceTranscript(null); setVoiceState("idle"); }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : null}

          <form
            className="aichat-inputbar"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={strings.inputPlaceholder}
              aria-label={strings.inputAriaLabel}
            />
            <button
              type="button"
              className={`aichat-mic ${voiceState === "listening" ? "listening" : ""}`}
              onClick={handleMic}
              aria-label={voiceState === "listening" ? strings.micStop : strings.micStart}
              title={voiceSupported ? undefined : strings.micUnsupportedTitle}
            >
              {voiceState === "listening" ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button type="submit" className="aichat-send" aria-label={strings.send} disabled={!input.trim() || typing}>
              <SendHorizonal size={18} />
            </button>
          </form>

          <footer className="aichat-footer">{strings.footerNote}</footer>
        </section>
      ) : null}
    </>
  );
}
