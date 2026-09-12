import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, ShieldAlert, Ghost, Search, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  code?: '403' | '404' | '500';
  title?: string;
  message?: string;
}

const ERROR_CONFIG = {
  '403': {
    title: 'Access Denied',
    subTitle: '403 Forbidden',
    message: 'Bạn không có quyền truy cập vào tài nguyên này. Đây là khu vực hạn chế.',
    icon: ShieldAlert,
    themeColor: 'text-[var(--color-error)]',
    iconColor: 'text-[var(--color-error)]',
    bgColor: 'bg-[var(--color-error-bg)]',
    darkBgColor: 'dark:bg-[var(--color-error-bg)]'
  },
  '404': {
    title: 'Page Not Found',
    subTitle: '404 Error',
    message: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được chuyển sang địa chỉ mới.',
    icon: Ghost,
    themeColor: 'text-[var(--color-info)]',
    iconColor: 'text-[var(--color-info)]',
    bgColor: 'bg-[var(--color-info-bg)]',
    darkBgColor: 'dark:bg-[var(--color-info-bg)]'
  },
  '500': {
    title: 'Internal Server Error',
    subTitle: '500 Error',
    message: 'Đã có lỗi xảy ra từ phía máy chủ. Chúng tôi đang nhanh chóng khắc phục.',
    icon: Search,
    themeColor: 'text-[var(--color-warning)]',
    iconColor: 'text-[var(--color-warning)]',
    bgColor: 'bg-[var(--color-warning-bg)]',
    darkBgColor: 'dark:bg-[var(--color-warning-bg)]'
  }
};

const ErrorPage: React.FC<ErrorPageProps> = ({ code = '404' }) => {
  const navigate = useNavigate();
  const config = ERROR_CONFIG[code] || ERROR_CONFIG['404'];
  const Icon = config.icon;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--color-background)] px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <Icon className={`h-7 w-7 ${config.iconColor}`} aria-hidden="true" />
        </div>
        <p className={`mt-5 text-eyebrow ${config.themeColor}`}>{config.subTitle}</p>
        <h1 className="mt-1 text-page-title">{config.title}</h1>
        <p className="mt-2 text-sm leading-5 text-[var(--color-muted-foreground)]">{config.message}</p>

        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" /> Quay lại
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => navigate('/')}>
            <Home aria-hidden="true" /> Về trang chủ
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 border-t border-[var(--color-border)] pt-6">
          <a href="/help" className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:underline">
            <HelpCircle size={15} aria-hidden="true" /> Trợ giúp
          </a>
          <a href="/report-issue" className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:underline">
            <Search size={15} aria-hidden="true" /> Báo lỗi hệ thống
          </a>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
