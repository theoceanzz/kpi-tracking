/**
 * Danh sách ngân hàng theo chuẩn VietQR.
 *
 * `code` là giá trị lưu xuống backend và được ghép thẳng vào URL ảnh QR của SePay
 * (tham số `bank`), nên phải giữ đúng tên viết tắt VietQR — gõ sai hoa thường hay
 * thừa dấu cách là mã QR dựng ra sẽ trỏ nhầm ngân hàng.
 *
 * `id` là mã ngắn dùng để lấy logo: https://api.vietqr.io/img/{id}.png
 * `bin` là mã định danh 6 số của Napas, để tra cứu khi không nhớ tên viết tắt.
 */
export interface BankOption {
  /** Tên viết tắt VietQR — giá trị lưu xuống backend. */
  code: string
  /** Mã ngắn dùng cho ảnh logo. */
  id: string
  /** Mã BIN Napas. */
  bin: string
  /** Tên đầy đủ. */
  name: string
}

export const VIETQR_BANKS: BankOption[] = [
  { code: 'Vietcombank', id: 'VCB', bin: '970436', name: 'NH TMCP Ngoại Thương Việt Nam' },
  { code: 'VietinBank', id: 'ICB', bin: '970415', name: 'NH TMCP Công Thương Việt Nam' },
  { code: 'BIDV', id: 'BIDV', bin: '970418', name: 'NH TMCP Đầu tư và Phát triển Việt Nam' },
  { code: 'Agribank', id: 'VBA', bin: '970405', name: 'NH NN&PTNT Việt Nam' },
  { code: 'Techcombank', id: 'TCB', bin: '970407', name: 'NH TMCP Kỹ Thương Việt Nam' },
  { code: 'MBBank', id: 'MB', bin: '970422', name: 'NH TMCP Quân Đội' },
  { code: 'ACB', id: 'ACB', bin: '970416', name: 'NH TMCP Á Châu' },
  { code: 'VPBank', id: 'VPB', bin: '970432', name: 'NH TMCP Việt Nam Thịnh Vượng' },
  { code: 'TPBank', id: 'TPB', bin: '970423', name: 'NH TMCP Tiên Phong' },
  { code: 'Sacombank', id: 'STB', bin: '970403', name: 'NH TMCP Sài Gòn Thương Tín' },
  { code: 'HDBank', id: 'HDB', bin: '970437', name: 'NH TMCP Phát triển TP. Hồ Chí Minh' },
  { code: 'VIB', id: 'VIB', bin: '970441', name: 'NH TMCP Quốc tế Việt Nam' },
  { code: 'SHB', id: 'SHB', bin: '970443', name: 'NH TMCP Sài Gòn - Hà Nội' },
  { code: 'Eximbank', id: 'EIB', bin: '970431', name: 'NH TMCP Xuất Nhập khẩu Việt Nam' },
  { code: 'MSB', id: 'MSB', bin: '970426', name: 'NH TMCP Hàng Hải' },
  { code: 'OCB', id: 'OCB', bin: '970448', name: 'NH TMCP Phương Đông' },
  { code: 'SeABank', id: 'SEAB', bin: '970440', name: 'NH TMCP Đông Nam Á' },
  { code: 'LPBank', id: 'LPB', bin: '970449', name: 'NH TMCP Lộc Phát Việt Nam' },
  { code: 'NamABank', id: 'NAB', bin: '970428', name: 'NH TMCP Nam Á' },
  { code: 'ABBANK', id: 'ABB', bin: '970425', name: 'NH TMCP An Bình' },
  { code: 'BacABank', id: 'BAB', bin: '970409', name: 'NH TMCP Bắc Á' },
  { code: 'PVcomBank', id: 'PVCB', bin: '970412', name: 'NH TMCP Đại Chúng Việt Nam' },
  { code: 'NCB', id: 'NCB', bin: '970419', name: 'NH TMCP Quốc Dân' },
  { code: 'VietABank', id: 'VAB', bin: '970427', name: 'NH TMCP Việt Á' },
  { code: 'VietBank', id: 'VIETBANK', bin: '970433', name: 'NH TMCP Việt Nam Thương Tín' },
  { code: 'BaoVietBank', id: 'BVB', bin: '970438', name: 'NH TMCP Bảo Việt' },
  { code: 'BVBank', id: 'VCCB', bin: '970454', name: 'NH TMCP Bản Việt' },
  { code: 'SaigonBank', id: 'SGICB', bin: '970400', name: 'NH TMCP Sài Gòn Công Thương' },
  { code: 'KienLongBank', id: 'KLB', bin: '970452', name: 'NH TMCP Kiên Long' },
  { code: 'PGBank', id: 'PGB', bin: '970430', name: 'NH TMCP Thịnh vượng và Phát triển' },
  { code: 'COOPBANK', id: 'COOPBANK', bin: '970446', name: 'NH Hợp tác xã Việt Nam' },
  { code: 'DongABank', id: 'DOB', bin: '970406', name: 'NH TMCP Đông Á' },
  { code: 'CBBank', id: 'CBB', bin: '970444', name: 'NH TM TNHH MTV Xây dựng Việt Nam' },
  { code: 'Oceanbank', id: 'OCEANBANK', bin: '970414', name: 'NH TM TNHH MTV Đại Dương (MBV)' },
  { code: 'GPBank', id: 'GPB', bin: '970408', name: 'NH TM TNHH MTV Dầu Khí Toàn Cầu' },
  { code: 'VRB', id: 'VRB', bin: '970421', name: 'NH Liên doanh Việt - Nga' },
  { code: 'IndovinaBank', id: 'IVB', bin: '970434', name: 'NH TNHH Indovina' },
  { code: 'Woori', id: 'WVN', bin: '970457', name: 'NH TNHH MTV Woori Việt Nam' },
  { code: 'ShinhanBank', id: 'SHBVN', bin: '970424', name: 'NH TNHH MTV Shinhan Việt Nam' },
  { code: 'HSBC', id: 'HSBC', bin: '458761', name: 'NH TNHH MTV HSBC Việt Nam' },
  { code: 'StandardChartered', id: 'SCVN', bin: '970410', name: 'NH TNHH MTV Standard Chartered Việt Nam' },
  { code: 'PublicBank', id: 'PBVN', bin: '970439', name: 'NH TNHH MTV Public Việt Nam' },
  { code: 'UnitedOverseas', id: 'UOB', bin: '970458', name: 'NH United Overseas Bank Việt Nam' },
  { code: 'CIMB', id: 'CIMB', bin: '422589', name: 'NH TNHH MTV CIMB Việt Nam' },
  { code: 'HongLeong', id: 'HLBVN', bin: '970442', name: 'NH TNHH MTV Hong Leong Việt Nam' },
  { code: 'IBKHCM', id: 'IBKHCM', bin: '970456', name: 'NH Công nghiệp Hàn Quốc - CN TP. Hồ Chí Minh' },
  { code: 'IBKHN', id: 'IBKHN', bin: '970455', name: 'NH Công nghiệp Hàn Quốc - CN Hà Nội' },
  { code: 'Nonghyup', id: 'NHB', bin: '801011', name: 'NH Nonghyup - CN Hà Nội' },
  { code: 'KBHN', id: 'KBHN', bin: '970462', name: 'NH Kookmin - CN Hà Nội' },
  { code: 'KBHCM', id: 'KBHCM', bin: '970463', name: 'NH Kookmin - CN TP. Hồ Chí Minh' },
  { code: 'KBank', id: 'KBANK', bin: '668888', name: 'NH Đại chúng TNHH Kasikornbank' },
  { code: 'Timo', id: 'TIMO', bin: '963388', name: 'Ngân hàng số Timo' },
  { code: 'CAKE', id: 'CAKE', bin: '546034', name: 'Ngân hàng số CAKE by VPBank' },
  { code: 'Ubank', id: 'UBANK', bin: '546035', name: 'Ngân hàng số Ubank by VPBank' },
  { code: 'ViettelMoney', id: 'VTLMONEY', bin: '971005', name: 'Viettel Money' },
  { code: 'VNPTMoney', id: 'VNPTMONEY', bin: '971011', name: 'VNPT Money' },
]

export const bankLogoUrl = (id: string) => `https://api.vietqr.io/img/${id}.png`

/** Tìm ngân hàng theo tên viết tắt, mã ngắn hoặc mã BIN — chấp nhận cả giá trị cũ gõ tay. */
export const findBank = (code?: string | null): BankOption | undefined => {
  const v = code?.trim().toLowerCase()
  if (!v) return undefined
  return VIETQR_BANKS.find(
    (b) => b.code.toLowerCase() === v || b.id.toLowerCase() === v || b.bin === v,
  )
}
