import AiQuotaPanel from '../components/AiQuotaPanel'

/**
 * Trang phân bổ hạn mức token AI.
 *
 * <p>Dùng chung cho cả quản lý cao nhất lẫn trưởng đơn vị — nội dung tự đổi theo vai trò.
 * Gác bằng quyền AI_QUOTA:ALLOCATE thay vì đặt trong /settings, vì /settings đòi ORG:VIEW +
 * USER:VIEW + ROLE:VIEW mà trưởng đơn vị không có.
 */
export default function AiQuotaPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Hạn mức AI
        </h1>
        <p className="text-slate-500 font-medium">
          Chia hạn mức token AI hằng tháng cho nhân sự thuộc phạm vi quản lý của bạn
        </p>
      </div>

      <AiQuotaPanel />
    </div>
  )
}
