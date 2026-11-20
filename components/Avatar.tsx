type Props = {
  src?: string;
  alt?: string;
  size?: number;
  className?: string;
};

/**
 * ใช้ <img> ตรง ๆ ไม่ผ่าน next/image เพื่อไม่ต้องตั้ง remotePatterns ของ CDN โปรไฟล์ LINE
 * และไม่กินโควตา image optimization ของ Vercel
 */
export default function Avatar({ src, alt = "", size = 36, className = "" }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || "/avatar-placeholder.svg"}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full border border-line object-cover ${className}`}
    />
  );
}
