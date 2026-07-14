import { Folder, FolderOpen } from "lucide-react";
import { isEmojiValue } from "@/lib/type-icons";

/**
 * The icon for a type: its custom emoji when one is set, otherwise the
 * default folder glyph.
 */
export function TypeIcon({
  icon,
  open = false,
  size,
  className,
  style,
}: {
  /** Emoji stored for this type, if any. */
  icon?: string;
  /** Renders the fallback as an open folder (expanded tree rows). */
  open?: boolean;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (isEmojiValue(icon)) {
    return (
      <span
        role="img"
        className={className}
        style={{
          fontSize: size,
          lineHeight: 1,
          width: size,
          display: "inline-flex",
          justifyContent: "center",
          ...style,
        }}
      >
        {icon}
      </span>
    );
  }
  const Fallback = open ? FolderOpen : Folder;
  return <Fallback size={size} className={className} style={style} />;
}
