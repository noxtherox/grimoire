/** A markdown file in the vault, path is vault-relative with forward slashes. */
export interface VaultFile {
  path: string;
  content: string;
  updatedAt: string;
}

export interface VaultBackend {
  readonly kind: "desktop" | "browser";
  /** Human-readable location of the vault (absolute path, or a label). */
  readonly location: string;
  loadAll(): Promise<VaultFile[]>;
  /** Reads any text file in the vault (config etc.), throws if missing. */
  readText(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Binary asset support (pasted images etc.). */
  writeBinary(path: string, bytes: Uint8Array): Promise<void>;
  readBinary(path: string): Promise<Uint8Array>;
}
