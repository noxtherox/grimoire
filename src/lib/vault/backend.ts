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
  write(path: string, content: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
