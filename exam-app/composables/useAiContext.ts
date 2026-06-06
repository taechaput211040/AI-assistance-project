// บริบทของหน้าปัจจุบัน ที่จะส่งให้ AI ใช้ตอบคำถาม
// แต่ละหน้า (page) จะ set ค่านี้เอง แล้ว AiChat จะอ่านไปประกอบ system prompt + ปุ่มคำถามแนะนำ
export interface AiContext {
  page: string          // ชื่อหน้า เช่น "Dashboard – Player Feedback"
  summary: string       // สรุปข้อมูลของหน้านั้นแบบ text
  data?: string         // ข้อมูลรายตัว (ตาราง/ลิสต์) ไว้ให้ AI ตอบคำถามเฉพาะเจาะจง
  suggestions?: string[] // ปุ่มคำถามแนะนำของหน้านั้น
}

export const useAiContext = () =>
  useState<AiContext>('ai-context', () => ({
    page: 'หน้านี้',
    summary: 'ยังไม่มีข้อมูลบริบทสำหรับหน้านี้',
    suggestions: []
  }))
