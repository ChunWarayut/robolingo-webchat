/** สัญลักษณ์แทนฝั่ง LINE OA ในหน้าที่ผู้ใช้คุยกับทีมงาน — ไม่มีรูปโปรไฟล์ของ OA ให้ดึงผ่าน API */
export default function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-accent text-accent-fg"
      aria-hidden
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.1A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
      </svg>
    </span>
  );
}
