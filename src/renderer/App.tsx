import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSession, SessionSummary } from "../shared/types";
import { ChatInput } from "./components/ChatInput";
import { Messages } from "./components/Messages";
import { Sidebar } from "./components/Sidebar";

function DesktopOnly(): JSX.Element {
  return (
    <main className="desktop-only">
      <section>
        <h1>ArnAIv is a desktop application</h1>
        <p>
          Start it with <code>npm run dev</code> to open it in Electron. The
          browser preview cannot access local conversations or the protected
          OpenAI connection.
        </p>
      </section>
    </main>
  );
}

export default function App(): JSX.Element {
  const api = window.arnAIv;
  return api ? <ElectronApp api={api} /> : <DesktopOnly />;
}

interface DeleteDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteDialog({ onCancel, onConfirm }: DeleteDialogProps): JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <h2 id="delete-dialog-title">Delete this chat?</h2>
        <p id="delete-dialog-description">This cannot be undone.</p>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-delete" autoFocus onClick={onConfirm}>
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}

function ElectronApp({ api }: { api: typeof window.arnAIv }): JSX.Element {
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [composerFocusRequest, setComposerFocusRequest] = useState(0);
  const pendingSession = useRef<Promise<ChatSession> | null>(null);
  const refresh = async (): Promise<void> =>
    setItems(await api.sessions.list());
  const ensureSession = async (): Promise<ChatSession> => {
    if (session) return session;
    if (!pendingSession.current)
      pendingSession.current = api.sessions
        .create()
        .then(async (created) => {
          setSession(created);
          await refresh();
          return created;
        })
        .finally(() => {
          pendingSession.current = null;
        });
    return pendingSession.current;
  };
  useEffect(() => {
    void refresh().catch(() =>
      setError("Unable to load previous conversations."),
    );
    const offChunk = api.chat.onChunk((event) => {
      setSession((current) => {
        if (!current || current.id !== event.sessionId) return current;
        const existing = current.messages.find(
          (message) => message.id === event.messageId,
        );
        const messages: ChatMessage[] = existing
          ? current.messages.map((message) =>
              message.id === event.messageId
                ? {
                    ...message,
                    content: message.content + (event.content ?? ""),
                  }
                : message,
            )
          : [
              ...current.messages,
              {
                id: event.messageId,
                role: "assistant",
                content: event.content ?? "",
                createdAt: new Date().toISOString(),
              },
            ];
        return { ...current, messages };
      });
    });
    const offComplete = api.chat.onComplete(() => {
      setGenerating(false);
      void refresh();
    });
    const offError = api.chat.onError((event) => {
      setGenerating(false);
      setError(event.error ?? "Unable to generate a response.");
    });
    return () => {
      offChunk();
      offComplete();
      offError();
    };
  }, [api]);
  const select = async (id: string): Promise<void> => {
    if (generating) return;
    const loaded = await api.sessions.get(id);
    if (loaded) setSession(loaded);
  };
  const create = async (): Promise<void> => {
    if (generating) return;
    setError("");
    setSession(await api.sessions.create());
    await refresh();
  };
  const prepareComposer = (): void => {
    if (!generating && !session)
      void ensureSession().catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to start a new conversation.",
        ),
      );
  };
  const requestDelete = (id: string): void => {
    if (!generating) setDeletingId(id);
  };
  const cancelDelete = (): void => {
    setDeletingId(null);
    setComposerFocusRequest((request) => request + 1);
  };
  const remove = async (): Promise<void> => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    setError("");
    try {
      await api.sessions.delete(id);
      if (session?.id === id) setSession(null);
      await refresh();
      setComposerFocusRequest((request) => request + 1);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to delete this conversation.",
      );
    }
  };
  const send = async (content: string): Promise<void> => {
    setError("");
    setGenerating(true);
    try {
      const activeSession = await ensureSession();
      setSession({
        ...activeSession,
        messages: [
          ...activeSession.messages,
          {
            id: crypto.randomUUID(),
            role: "user",
            content,
            createdAt: new Date().toISOString(),
          },
        ],
      });
      await api.chat.send({ sessionId: activeSession.id, content });
    } catch (reason: unknown) {
      setGenerating(false);
      setError(
        reason instanceof Error ? reason.message : "Unable to send message.",
      );
    }
  };
  return (
    <>
      <main>
        <Sidebar
          items={items}
          active={session?.id ?? null}
          onNew={() => void create()}
          onSelect={(id) => void select(id)}
          onDelete={requestDelete}
        />
        <section className="chat">
          <header>
            <span>{generating ? "ArnAIv is generating…" : "ArnAIv"}</span>
          </header>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {session?.messages.length ? (
            <Messages messages={session.messages} generating={generating} />
          ) : (
            <div className="empty">ArnAIv</div>
          )}
          <ChatInput
            disabled={generating}
            focusRequest={composerFocusRequest}
            onFocus={prepareComposer}
            onSend={(content) => void send(content)}
          />
        </section>
      </main>
      {deletingId && (
        <DeleteDialog onCancel={cancelDelete} onConfirm={() => void remove()} />
      )}
    </>
  );
}
