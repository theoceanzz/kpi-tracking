import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'

/**
 * Bước Tự đánh giá — nhúng thẳng form chấm điểm, không rời trang.
 *
 * Dùng lại `EvaluationFormModal` nguyên vẹn thay vì dựng một form gọn hơn: luật điểm ở đó không hề
 * đơn giản (thang điểm của tổ chức, trần điểm cộng thêm từ KPI thưởng, điểm hệ thống tính sẵn, chế
 * độ BSC chính thức, bộ tiêu chí đạo đức). Chép lại một phần là chắc chắn lệch với backend.
 *
 * Trước đây bước này chỉ là nút dẫn sang `/evaluations`. Đường đó còn hỏng với đúng nhóm người
 * dùng của luồng này: mục đó gác bằng `EVALUATION:VIEW_MY`, mà quản lý tự đặt chỉ tiêu cho mình
 * thường không có quyền đó nên bị đá về lưới thẻ của `/me`.
 */
export default function SelfEvalStep() {
  const { goNext, goBack, periodId } = useKpiSetupFlow()

  return (
    <StepShell
      bare
      title="Tự đánh giá"
      description="Chấm điểm cho chính mình ở đợt vừa nộp. Hệ thống đã tính sẵn điểm gợi ý từ kết quả bạn nộp."
      onBack={goBack}
    >
      <EvaluationFormModal
        open
        variant="inline"
        initialPeriodId={periodId ?? undefined}
        // Lưu xong thì wizard dẫn tiếp, không để form tự điều hướng ra ngoài.
        onSaved={() => goNext()}
        onClose={goBack}
      />
    </StepShell>
  )
}
