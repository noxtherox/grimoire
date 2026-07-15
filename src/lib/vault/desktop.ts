import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { TRASH_DIR, MAX_TYPE_DEPTH } from "@/lib/note-utils";
import type { VaultBackend, VaultFile } from "./backend";

/** Reads/writes notes as real .md files inside a user-chosen folder. */
export class DesktopVault implements VaultBackend {
  readonly kind = "desktop" as const;

  constructor(private readonly root: string) {}

  get location(): string {
    return this.root;
  }

  private abs(relPath: string): string {
    const segments = relPath.split(/[\\/]/);
    if (
      /^(?:[\\/]|[a-z]:[\\/])/i.test(relPath) ||
      segments.some((segment) => segment === "." || segment === "..")
    ) {
      throw new Error(`Unsafe vault path: ${relPath}`);
    }
    return `${this.root}/${relPath}`;
  }

  async loadAll(): Promise<VaultFile[]> {
    const files: VaultFile[] = [];

    const walk = async (relDir: string, depth: number): Promise<void> => {
      const absDir = relDir ? this.abs(relDir) : this.root;
      const entries = await readDir(absDir);
      for (const entry of entries) {
        const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
        if (entry.isDirectory) {
          const isTrashRoot = relPath === TRASH_DIR;
          if (entry.name.startsWith(".") && !isTrashRoot) continue;
          // one extra level inside .trash mirrors the type depth
          const maxDepth = MAX_TYPE_DEPTH + 1;
          if (depth < maxDepth) await walk(relPath, depth + 1);
          continue;
        }
        if (!entry.isFile || !/\.md$/i.test(entry.name)) continue;
        const absPath = this.abs(relPath);
        const [content, info] = await Promise.all([
          readTextFile(absPath),
          stat(absPath),
        ]);
        files.push({
          path: relPath,
          content,
          updatedAt: (info.mtime ?? new Date()).toISOString(),
        });
      }
    };

    await walk("", 0);
    return files;
  }

  private async ensureParentDir(relPath: string): Promise<void> {
    const dir = relPath.split("/").slice(0, -1).join("/");
    if (!dir) return;
    const absDir = this.abs(dir);
    if (!(await exists(absDir))) {
      await mkdir(absDir, { recursive: true });
    }
  }

  async readText(path: string): Promise<string> {
    return readTextFile(this.abs(path));
  }

  async write(path: string, content: string): Promise<void> {
    await this.ensureParentDir(path);
    await writeTextFile(this.abs(path), content);
  }

  async writeNew(path: string, content: string): Promise<void> {
    await invoke("write_new_vault_file", {
      root: this.root,
      relativePath: path,
      content,
    });
  }

  async move(from: string, to: string): Promise<void> {
    await this.ensureParentDir(to);
    await rename(this.abs(from), this.abs(to));
  }

  async removeFile(path: string): Promise<void> {
    await remove(this.abs(path));
  }

  async exists(path: string): Promise<boolean> {
    return exists(this.abs(path));
  }

  async mkDir(path: string): Promise<void> {
    await mkdir(this.abs(path), { recursive: true });
  }

  async removeDir(path: string): Promise<void> {
    const absPath = this.abs(path);
    if (!(await exists(absPath))) return;
    await remove(absPath, { recursive: true });
  }

  async renameDir(from: string, to: string): Promise<void> {
    await this.ensureParentDir(to);
    await rename(this.abs(from), this.abs(to));
  }

  async listDirs(): Promise<string[]> {
    const dirs: string[] = [];
    const walk = async (relDir: string, depth: number): Promise<void> => {
      const entries = await readDir(relDir ? this.abs(relDir) : this.root);
      for (const entry of entries) {
        if (!entry.isDirectory || entry.name.startsWith(".")) continue;
        const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
        dirs.push(relPath);
        if (depth + 1 < MAX_TYPE_DEPTH) await walk(relPath, depth + 1);
      }
    };
    await walk("", 0);
    return dirs;
  }

  async writeBinary(path: string, bytes: Uint8Array): Promise<void> {
    await this.ensureParentDir(path);
    await writeFile(this.abs(path), bytes);
  }

  async readBinary(path: string): Promise<Uint8Array> {
    return readFile(this.abs(path));
  }
}
