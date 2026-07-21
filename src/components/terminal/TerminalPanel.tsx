import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import {
  Copy,
  Ellipsis,
  FolderInput,
  OctagonX,
  RefreshCw,
  Search,
  SquareTerminal,
  TextCursorInput,
  X,
} from "lucide-react";
import "@xterm/xterm/css/xterm.css";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { openExternalUrl } from "@/lib/external-links";
import type { Note } from "@/lib/note-utils";
import {
  normalizeFsPath,
  noteAbsolutePath,
  noteContainingFolder,
  noteTitle,
} from "@/lib/note-utils";
import { cn } from "@/lib/utils";
import { showError } from "@/utils/toast";

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
const WIDTH_STORAGE_KEY = "grimoire.terminal.width";

interface SessionInfo {
  sessionId: number;
  workingDirectory: string;
}

interface TerminalOutputEvent {
  sessionId: number;
  data: number[];
}

interface TerminalExitEvent {
  sessionId: number;
  exitCode: number | null;
  signal: string | null;
  error: string | null;
}

interface TerminalPanelProps {
  open: boolean;
  note: Note | null;
  vaultLocation: string | null;
  onOpenChange: (open: boolean) => void;
}

function storedWidth(): number {
  const value = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
  return Number.isFinite(value) && value >= MIN_WIDTH ? value : DEFAULT_WIDTH;
}

function terminalTheme() {
  const styles = getComputedStyle(document.documentElement);
  const rgb = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value ? `rgb(${value.split(/\s+/).join(", ")})` : fallback;
  };
  return {
    background: rgb("--grim-editor-bg", "#ffffff"),
    foreground: rgb("--grim-text", "#020817"),
    cursor: rgb("--grim-accent", "#d84b40"),
    selectionBackground: "rgba(128, 128, 128, 0.28)",
  };
}

function pathsMatch(left: string | null, right: string | null): boolean {
  return !!left && !!right && normalizeFsPath(left) === normalizeFsPath(right);
}

function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function TerminalPanel({
  open,
  note,
  vaultLocation,
  onOpenChange,
}: TerminalPanelProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const focusTerminalOnMenuCloseRef = useRef(false);
  const outputBufferRef = useRef(new Map<number, Uint8Array[]>());
  const startingRef = useRef(false);
  const hasStartedRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [exit, setExit] = useState<TerminalExitEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replacementDirectory, setReplacementDirectory] = useState<
    string | null
  >(null);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [width, setWidth] = useState(storedWidth);

  const notePath = note ? noteAbsolutePath(note, vaultLocation) : null;
  const targetDirectory = note
    ? noteContainingFolder(note, vaultLocation)
    : null;
  const workingInSelectedFolder = pathsMatch(
    session?.workingDirectory ?? null,
    targetDirectory,
  );

  const writeBufferedOutput = useCallback((sessionId: number) => {
    const terminal = terminalRef.current;
    const chunks = outputBufferRef.current.get(sessionId);
    if (!terminal || !chunks) return;
    outputBufferRef.current.delete(sessionId);
    for (const chunk of chunks) terminal.write(chunk);
  }, []);

  const resizeTerminal = useCallback(() => {
    if (!openRef.current) return;
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    try {
      fitAddon.fit();
      const active = sessionRef.current;
      if (active) {
        void invoke("terminal_resize", {
          sessionId: active.sessionId,
          rows: terminal.rows,
          cols: terminal.cols,
        });
      }
    } catch {
      // The panel may be between display states; the next observer tick retries.
    }
  }, []);

  const startSession = useCallback(
    async (directory: string) => {
      if (startingRef.current) return;
      const terminal = terminalRef.current;
      startingRef.current = true;
      setError(null);
      try {
        if (sessionRef.current) {
          await invoke("terminal_stop", {
            sessionId: sessionRef.current.sessionId,
          });
        }
        terminal?.reset();
        setExit(null);
        sessionRef.current = null;
        setSession(null);
        fitAddonRef.current?.fit();
        const info = await invoke<SessionInfo>("terminal_start", {
          workingDirectory: directory,
          rows: terminal?.rows ?? 24,
          cols: terminal?.cols ?? 80,
        });
        hasStartedRef.current = true;
        sessionRef.current = info;
        setSession(info);
        writeBufferedOutput(info.sessionId);
        requestAnimationFrame(resizeTerminal);
        terminal?.focus();
      } catch (startError) {
        const message = String(startError);
        setError(message);
        showError(`Failed to open terminal: ${message}`);
      } finally {
        startingRef.current = false;
      }
    },
    [resizeTerminal, writeBufferedOutput],
  );

  useEffect(() => {
    if (!terminalContainerRef.current) return;
    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13.5,
      scrollback: 10_000,
      theme: terminalTheme(),
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(
      new WebLinksAddon((event, uri) => {
        event.preventDefault();
        void openExternalUrl(uri);
      }),
    );
    terminal.open(terminalContainerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const dataDisposable = terminal.onData((data) => {
      const active = sessionRef.current;
      if (!active) return;
      void invoke("terminal_write", {
        sessionId: active.sessionId,
        data,
      }).catch(() => {});
    });
    terminal.attachCustomKeyEventHandler((event) => {
      if (
        event.type === "keydown" &&
        event.metaKey &&
        event.key.toLowerCase() === "c" &&
        terminal.hasSelection()
      ) {
        void navigator.clipboard.writeText(terminal.getSelection());
        return false;
      }
      return true;
    });

    const resizeObserver = new ResizeObserver(() => resizeTerminal());
    resizeObserver.observe(terminalContainerRef.current);

    let disposed = false;
    const unlisteners: Array<() => void> = [];
    void Promise.all([
      listen<TerminalOutputEvent>("grimoire-terminal-output", ({ payload }) => {
        const active = sessionRef.current;
        if (active?.sessionId === payload.sessionId) {
          terminal.write(new Uint8Array(payload.data));
          return;
        }
        const chunks = outputBufferRef.current.get(payload.sessionId) ?? [];
        chunks.push(new Uint8Array(payload.data));
        outputBufferRef.current.set(payload.sessionId, chunks);
      }),
      listen<TerminalExitEvent>("grimoire-terminal-exit", ({ payload }) => {
        if (sessionRef.current?.sessionId !== payload.sessionId) return;
        sessionRef.current = null;
        setSession(null);
        setExit(payload);
      }),
    ]).then(async (listeners) => {
      if (disposed) {
        listeners.forEach((unlisten) => unlisten());
        return;
      }
      unlisteners.push(...listeners);
      try {
        const info = await invoke<SessionInfo | null>("terminal_status");
        if (info && !disposed) {
          hasStartedRef.current = true;
          sessionRef.current = info;
          setSession(info);
          writeBufferedOutput(info.sessionId);
        }
      } catch {
        // No native session is expected on a fresh frontend mount.
      } finally {
        if (!disposed) setReady(true);
      }
    });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
      resizeObserver.disconnect();
      dataDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [resizeTerminal, writeBufferedOutput]);

  useEffect(() => {
    if (!ready || !open || !targetDirectory) return;
    requestAnimationFrame(resizeTerminal);
    if (
      !sessionRef.current &&
      !exit &&
      !startingRef.current &&
      !hasStartedRef.current
    ) {
      void startSession(targetDirectory);
    }
  }, [exit, open, ready, resizeTerminal, startSession, targetDirectory]);

  useEffect(() => {
    const applyTheme = () => {
      if (terminalRef.current) terminalRef.current.options.theme = terminalTheme();
    };
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  const exitLabel = useMemo(() => {
    if (!exit) return null;
    if (exit.error) return `Terminal stopped: ${exit.error}`;
    if (exit.signal) return `Terminal ended by ${exit.signal}`;
    return `Terminal exited with status ${exit.exitCode ?? "unknown"}.`;
  }, [exit]);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? width;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent) => {
      const editorAreaWidth =
        panelRef.current?.parentElement?.getBoundingClientRect().width ??
        window.innerWidth;
      const maxWidth = Math.min(
        window.innerWidth * 0.6,
        Math.max(MIN_WIDTH, editorAreaWidth - 240),
      );
      setWidth(
        Math.round(
          Math.max(
            MIN_WIDTH,
            Math.min(maxWidth, startWidth - (moveEvent.clientX - startX)),
          ),
        ),
      );
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      setWidth((current) => {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(current));
        return current;
      });
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const confirmReplacement = async () => {
    const directory = replacementDirectory;
    setReplacementDirectory(null);
    if (directory) await startSession(directory);
  };

  const insertCurrentNotePath = async () => {
    const active = sessionRef.current;
    const terminal = terminalRef.current;
    if (!active || !notePath) return;
    focusTerminalOnMenuCloseRef.current = true;
    try {
      await invoke("terminal_write", {
        sessionId: active.sessionId,
        data: quoteShellArgument(notePath),
      });
      terminal?.focus();
    } catch (insertError) {
      showError(`Failed to insert note path: ${String(insertError)}`);
    }
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative h-full shrink-0 border-l border-border/70 bg-grim-editor",
        !open && "hidden",
      )}
      style={{
        width: `min(${width}px, 60vw)`,
        maxWidth: "calc(100% - 240px)",
      }}
    >
      <div
        className="absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize touch-none"
        onPointerDown={handleResizeStart}
        role="separator"
        aria-label="Resize terminal panel"
      />
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 px-2">
          <SquareTerminal className="mx-1 shrink-0 text-grim-accent" size={16} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">Terminal</div>
            <div
              className="truncate text-[10px] text-muted-foreground"
              title={session?.workingDirectory ?? targetDirectory ?? undefined}
            >
              {session?.workingDirectory ?? targetDirectory ?? "Select a note"}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Terminal actions"
                aria-label="Terminal actions"
              >
                <Ellipsis size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52"
              onCloseAutoFocus={(event) => {
                if (!focusTerminalOnMenuCloseRef.current) return;
                event.preventDefault();
                focusTerminalOnMenuCloseRef.current = false;
                requestAnimationFrame(() => terminalRef.current?.focus());
              }}
            >
              {session && targetDirectory && !workingInSelectedFolder && (
                <>
                  <DropdownMenuItem
                    onSelect={() => setReplacementDirectory(targetDirectory)}
                  >
                    <FolderInput className="mr-2" size={14} />
                    Open terminal here
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                disabled={!notePath || !session}
                onSelect={() => void insertCurrentNotePath()}
              >
                <TextCursorInput className="mr-2" size={14} />
                Insert current note path
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!notePath}
                onSelect={() =>
                  notePath && void navigator.clipboard.writeText(notePath)
                }
              >
                <Copy className="mr-2" size={14} />
                Copy current note path
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setSearchOpen((current) => !current)}
              >
                <Search className="mr-2" size={14} />
                {searchOpen ? "Hide output search" : "Search terminal output"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!session}
                onSelect={() =>
                  session && setReplacementDirectory(session.workingDirectory)
                }
              >
                <RefreshCw className="mr-2" size={14} />
                Restart shell
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!session}
                className="text-destructive focus:text-destructive"
                onSelect={() => setEndConfirmOpen(true)}
              >
                <OctagonX className="mr-2" size={14} />
                End terminal session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Hide terminal (⌘J)"
            onClick={() => onOpenChange(false)}
          >
            <X size={14} />
          </Button>
        </div>
        {searchOpen && (
          <form
            className="flex h-9 shrink-0 items-center gap-1 border-b border-border/50 px-2"
            onSubmit={(event) => {
              event.preventDefault();
              searchAddonRef.current?.findNext(searchQuery);
            }}
          >
            <Input
              autoFocus
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                searchAddonRef.current?.findNext(event.target.value, {
                  incremental: true,
                });
              }}
              placeholder="Search output"
              className="h-7 text-xs"
            />
            <Button type="submit" variant="ghost" size="sm" className="h-7 px-2">
              Next
            </Button>
          </form>
        )}
        <div ref={terminalContainerRef} className="min-h-0 flex-1 p-2" />
        {(exitLabel || error) && (
          <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {error ?? exitLabel}
            </span>
            {targetDirectory && (
              <Button
                size="sm"
                className="h-7 shrink-0 gap-1.5 text-xs"
                onClick={() => void startSession(targetDirectory)}
              >
                <RefreshCw size={13} /> Start new shell
              </Button>
            )}
          </div>
        )}
        {note && (
          <div className="shrink-0 truncate border-t border-border/40 px-3 py-1.5 text-[10px] text-muted-foreground">
            Selected note: <span title={notePath ?? undefined}>{noteTitle(note)}</span>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!replacementDirectory}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setReplacementDirectory(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the running terminal?</AlertDialogTitle>
            <AlertDialogDescription>
              This ends the current shell and any Claude, Codex, or other process
              running inside it. Its terminal output will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current terminal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmReplacement()}>
              End and start here
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the terminal session?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops the shell and any Claude, Codex, or other process
              running inside it. The terminal output stays visible until you
              start a new shell.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const active = sessionRef.current;
                if (active) {
                  void invoke("terminal_stop", { sessionId: active.sessionId });
                }
              }}
            >
              End terminal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
