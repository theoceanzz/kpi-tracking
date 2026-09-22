import MyWorkflowPanel from './MyWorkflowPanel'
import OrgWorkflowPanel from './OrgWorkflowPanel'

/**
 * Mục "Thiết lập luồng xử lí" trong trang Thiết lập công ty (cụm Hệ thống).
 *
 * Từng là một dòng sidebar riêng (`/kpi-workflow`) với lý do `/settings` cũ gác bằng ORG:VIEW +
 * USER:VIEW + ROLE:VIEW nên người có `WORKFLOW:MANAGE` không vào nổi. Trang Thiết lập công ty
 * hiện nay gác bằng `COMPANY:VIEW` và mỗi mục tự gác riêng, nên trở ngại đó không còn — và về
 * nghĩa thì luật luồng xử lí là một thiết lập của tổ chức, đứng cạnh thông báo, email, API.
 *
 * Không có `WorkspaceHeader`: `SettingsSectionLayout` cố ý không lặp lại tên mục, vì đường dẫn
 * phân cấp trên header đã ghi nó rồi.
 *
 * Phần tổ chức đứng TRƯỚC: người mở mục này từ trang Thiết lập công ty đến để cấu hình cho tổ
 * chức, phần hiển thị cá nhân là việc phụ.
 */
export default function WorkflowSettingsTab() {
  return (
    <div className="space-y-4">
      <OrgWorkflowPanel />
      <MyWorkflowPanel />
    </div>
  )
}
