import MyWorkflowPanel from '../components/MyWorkflowPanel'
import OrgWorkflowPanel from '../components/OrgWorkflowPanel'

/**
 * Trang cấu hình luồng KPI.
 *
 * Nằm thẳng ở sidebar chứ không nấp trong một tab của `/settings`, vì hai lý do:
 *
 * 1. `/settings` gác bằng ORG:VIEW + USER:VIEW + ROLE:VIEW (đủ CẢ BA), nên một trưởng đơn vị có
 *    quyền `WORKFLOW:MANAGE` vẫn không vào nổi — đúng cái bẫy mà trang Hạn mức AI đã ghi chú lại
 *    khi nó tách ra khỏi `/settings`.
 * 2. Phần "Hiển thị của tôi" dành cho MỌI người, mà `/settings` thì đa số nhân viên không mở được.
 *
 * Thứ tự hai khối là có chủ đích: phần cá nhân đứng trước vì nó đúng với mọi người vào trang;
 * phần tổ chức đứng sau vì phần lớn người xem chỉ đọc nó.
 */
export default function KpiWorkflowPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Luồng KPI
        </h1>
        <p className="font-medium text-slate-500">
          Chọn những bước bạn muốn thấy, và xem quy trình mà tổ chức đang áp dụng
        </p>
      </div>

      <MyWorkflowPanel />
      <OrgWorkflowPanel />
    </div>
  )
}
