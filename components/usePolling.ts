"use client";

import { useEffect, useRef } from "react";

/**
 * เรียก tick เป็นรอบ ๆ โดยปรับจังหวะตามว่าผู้ใช้กำลังดูแท็บนี้อยู่ไหม
 *
 * ดูอยู่ = ถี่ (ดีเลย์ที่ผู้ใช้รู้สึกคือครึ่งหนึ่งของรอบโดยเฉลี่ย)
 * ไม่ได้ดู = ห่าง ๆ พอให้ไม่ตกข่าว แต่ไม่เผา request ทิ้งกับแท็บที่ไม่มีใครมอง
 * พอสลับกลับมาดูจะดึงทันทีไม่ต้องรอรอบถัดไป
 *
 * ใช้ setTimeout ต่อกันเป็นลูกโซ่แทน setInterval เพราะรอบถัดไปต้องอ่านสถานะ
 * การมองเห็นใหม่ทุกครั้ง และกันไม่ให้รอบซ้อนกันถ้าเครือข่ายช้า
 */
export function usePolling(tick: () => void, activeMs: number, hiddenMs: number): void {
  const tickRef = useRef(tick);

  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const schedule = (delay: number) => {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    function run() {
      if (stopped) return;
      tickRef.current();
      schedule(document.visibilityState === "hidden" ? hiddenMs : activeMs);
    }

    function onVisibilityChange() {
      schedule(0);
    }

    schedule(0);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeMs, hiddenMs]);
}
