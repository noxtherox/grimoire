import { Folder, FolderOpen } from "lucide-react";
import { getIconComponent } from "@/lib/type-icons";

/**
 * The icon for a type: its custom lucide icon when one is set (and still
 * exists in the icon set), otherwise the default folder glyph.
 */
export function TypeIcon({
  icon,
  open = false,
  size,
  className,
  style,
}: {
  /** Lucide icon name stored for this type, if any. */
  icon?: string;
  /** Renders the fallback as an open folder (expanded tree rows). */
  open?: boolean;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Custom = getIconComponent(icon);
  if (Custom) return <Custom size={size} className={className} style={style} />;
  const Fallback = open ? FolderOpen : Folder;
  return <Fallback size={size} className={className} style={style} />;
}
